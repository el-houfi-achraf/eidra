import { InputAction, defaultBindings, keyLabel } from './InputAction';
import {
  AXIS_BUTTONS,
  PadReader,
  captureToken,
  directions,
  identify,
  stick,
  tokenGlyph,
  tokenHeld,
} from './Gamepad';
import type { NormalizedPad, PadInfo, RawPad } from './Gamepad';
import { defaultPadBindings, menuButtons } from '../../game-data/input/controllers';
import type { PadFamily, PadToken } from '../../game-data/input/controllers';
import type { Rumble } from '../../game-data/input/rumble';
/** Controller preferences, from the settings. */
export interface PadOptions {
  bindings: Record<string, PadToken>;
  deadzone: number;
  /** 0 turns vibration off. */
  vibration: number;
  glyphs: 'auto' | PadFamily;
}
/** Menu navigation from a pad: edges, with auto-repeat on held directions. */
export interface MenuInput {
  x: number;
  y: number;
  confirm: boolean;
  back: boolean;
  previous: boolean;
  next: boolean;
}
const idleMenu = (): MenuInput => ({
  x: 0,
  y: 0,
  confirm: false,
  back: false,
  previous: false,
  next: false,
});
/** Held direction repeats after this delay, then at this interval (ms). */
const REPEAT_DELAY = 380;
const REPEAT_EVERY = 110;
/** A capture waits this long for a button before giving up (ms). */
const CAPTURE_TIMEOUT = 8000;
interface Capture {
  rest: Map<number, NormalizedPad>;
  started: number;
  done: (token: PadToken | null) => void;
}
/** Vibration APIs: Chromium / Safari (`vibrationActuator`) and Firefox (`hapticActuators`). */
interface RumblePad {
  vibrationActuator?: {
    playEffect?: (type: string, params: Record<string, number>) => Promise<unknown>;
  } | null;
  hapticActuators?: readonly { pulse?: (value: number, duration: number) => Promise<unknown> }[];
}
export class InputManager {
  private keys = new Set<string>();
  private pendingCodes = new Set<string>();
  private current = new Set<InputAction>();
  private previous = new Set<InputAction>();
  private edges = new Set<InputAction>();
  private abort = new AbortController();
  bindings = { ...defaultBindings };
  padBindings: Record<string, PadToken> = { ...defaultPadBindings };
  private options: PadOptions = {
    bindings: {},
    deadzone: 0.25,
    vibration: 0.7,
    glyphs: 'auto',
  };
  gamepadConnected = false;
  /** The device that produced the latest input; prompts follow it. */
  device: 'keyboard' | 'gamepad' = 'keyboard';
  private axis = 0;
  private readers = new Map<number, PadReader>();
  private ids = new Map<number, string>();
  private states = new Map<number, NormalizedPad>();
  /** Index of the pad that moved last: the one that plays. */
  private active: number | null = null;
  private lastFamily: PadFamily = 'xbox';
  /** Pad actions held through a reset stay ignored until released. */
  private guarded = new Set<InputAction>();
  private guard = false;
  private menuHeld = new Set<string>();
  private menuDirection = { x: 0, y: 0, since: 0, repeated: 0 };
  menu: MenuInput = idleMenu();
  private capturing: Capture | null = null;
  private listeners = new Set<(info: PadInfo, connected: boolean) => void>();
  private warned = new Set<string>();
  constructor(private canvas: HTMLCanvasElement) {
    const options = { signal: this.abort.signal };
    window.addEventListener(
      'keydown',
      (event) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)
          return;
        // Auto-repeat keeps the key held without producing new presses.
        if (!this.keys.has(event.code) && !event.repeat) this.pendingCodes.add(event.code);
        this.keys.add(event.code);
        this.device = 'keyboard';
        if (document.activeElement === canvas && Object.values(this.bindings).includes(event.code))
          event.preventDefault();
      },
      options,
    );
    window.addEventListener('keyup', (event) => this.keys.delete(event.code), options);
    canvas.addEventListener(
      'pointerdown',
      (event) => {
        this.pendingCodes.add(`Mouse${event.button}`);
        this.keys.add(`Mouse${event.button}`);
        canvas.focus();
      },
      options,
    );
    window.addEventListener(
      'pointerup',
      (event) => this.keys.delete(`Mouse${event.button}`),
      options,
    );
    canvas.addEventListener('contextmenu', (event) => event.preventDefault(), options);
    window.addEventListener('blur', () => this.reset(), options);
    window.addEventListener(
      'gamepadconnected',
      (event) => this.connection(event.gamepad, true),
      options,
    );
    window.addEventListener(
      'gamepaddisconnected',
      (event) => this.connection(event.gamepad, false),
      options,
    );
  }
  setBindings(overrides: Record<string, string>): void {
    this.bindings = { ...defaultBindings, ...overrides };
    this.reset();
  }
  setPad(options: PadOptions): void {
    this.options = options;
    this.padBindings = { ...defaultPadBindings, ...options.bindings };
  }
  /** Called with the pad's identity when a controller is plugged in or removed. */
  onConnection(listener: (info: PadInfo, connected: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  /** The pad that plays, if any. */
  get pad(): PadInfo | null {
    return this.active === null ? null : (this.readers.get(this.active)?.info ?? null);
  }
  /** Glyph set of the prompts: the setting, else the pad in hand. */
  get family(): PadFamily {
    return this.options.glyphs === 'auto' ? this.lastFamily : this.options.glyphs;
  }
  padLabel(token: PadToken | undefined): string {
    return tokenGlyph(token, this.family);
  }
  label(action: InputAction): string {
    if (this.device !== 'gamepad') return keyLabel(this.bindings[action]);
    // Walking is the analog stick, pushed part way.
    if (action === InputAction.Walk) return 'Stick';
    return this.padLabel(this.padBindings[action]);
  }
  /** Waits for the next new pad input, for remapping. Start or a timeout cancel. */
  capture(done: (token: PadToken | null) => void): void {
    this.cancelCapture();
    this.capturing = { rest: new Map(this.states), started: performance.now(), done };
  }
  cancelCapture(): void {
    const capture = this.capturing;
    this.capturing = null;
    capture?.done(null);
  }
  get isCapturing(): boolean {
    return this.capturing !== null;
  }
  poll(): void {
    this.previous = this.current;
    this.current = new Set();
    this.axis = 0;
    for (const action of Object.values(InputAction))
      if (this.keys.has(this.bindings[action])) this.current.add(action);
    if (this.keys.has('Mouse0')) this.current.add(InputAction.Attack);
    if (this.keys.has('Mouse2')) this.current.add(InputAction.Charge);
    if (this.keys.has('ArrowLeft')) this.current.add(InputAction.Left);
    if (this.keys.has('ArrowRight')) this.current.add(InputAction.Right);
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) this.current.add(InputAction.Jump);
    if (this.keys.has('ArrowDown')) this.current.add(InputAction.Down);
    const pad = this.readPads();
    this.menu = idleMenu();
    if (this.capturing) this.pollCapture();
    else if (pad) this.fromPad(pad);
    for (const action of this.current) if (!this.previous.has(action)) this.edges.add(action);
    for (const action of Object.values(InputAction))
      if (this.pendingCodes.has(this.bindings[action])) this.edges.add(action);
    for (const [code, action] of [
      ['Mouse0', InputAction.Attack],
      ['Mouse2', InputAction.Charge],
      ['KeyW', InputAction.Jump],
      ['ArrowUp', InputAction.Jump],
      ['ArrowDown', InputAction.Down],
    ] as const)
      if (this.pendingCodes.has(code)) this.edges.add(action);
    this.pendingCodes.clear();
  }
  /** Reads every connected pad and returns the active one's state. */
  private readPads(): NormalizedPad | null {
    let pads: (RawPad | null)[] = [];
    try {
      pads = [...(navigator.getGamepads?.() ?? [])];
    } catch (error) {
      // A permissions policy can forbid the Gamepad API: the keyboard keeps working.
      this.warn('gamepad-api', 'Gamepad API unavailable', error);
    }
    const seen = new Set<number>();
    for (const raw of pads) {
      if (!raw?.connected) continue;
      let reader = this.readers.get(raw.index);
      if (!reader || this.ids.get(raw.index) !== raw.id) {
        reader = new PadReader(identify(raw.id ?? '', raw.mapping ?? ''));
        this.readers.set(raw.index, reader);
        this.ids.set(raw.index, raw.id);
      }
      if (reader.info.sensor) continue;
      seen.add(raw.index);
      const state = reader.read(raw);
      const before = this.states.get(raw.index);
      this.states.set(raw.index, state);
      // A button press hands the game to that pad; a stick alone only wakes the pad
      // already in hand (or the first one), so a drifting spare never steals it.
      const activity = this.activity(before, state);
      if (
        activity === 'button' ||
        (activity === 'stick' && (this.active === null || this.active === raw.index))
      ) {
        this.active = raw.index;
        this.lastFamily = reader.info.glyphs;
        this.device = 'gamepad';
      }
    }
    for (const index of [...this.readers.keys()])
      if (!seen.has(index)) {
        this.readers.delete(index);
        this.ids.delete(index);
        this.states.delete(index);
        if (this.active === index) this.active = null;
      }
    this.gamepadConnected = seen.size > 0;
    if (this.active !== null && !seen.has(this.active)) this.active = null;
    return this.active === null ? null : (this.states.get(this.active) ?? null);
  }
  /** New activity: a real button pushed, or the stick (or another axis) leaving rest. */
  private activity(
    before: NormalizedPad | undefined,
    now: NormalizedPad,
  ): 'button' | 'stick' | null {
    const on = (pad: NormalizedPad | undefined, i: number): boolean =>
      (pad?.buttons[i] ?? 0) > 0.55;
    let axis = false;
    for (let i = 0; i < now.buttons.length; i++) {
      if (!on(now, i) || on(before, i)) continue;
      if (i < AXIS_BUTTONS) return 'button';
      axis = true;
    }
    const tilted = (pad: NormalizedPad | undefined): boolean =>
      pad !== undefined && Math.hypot(pad.x, pad.y) > this.options.deadzone + 0.1;
    return axis || (tilted(now) && !tilted(before)) ? 'stick' : null;
  }
  private fromPad(pad: NormalizedPad): void {
    const dz = this.options.deadzone;
    const held = new Set<InputAction>();
    for (const action of Object.values(InputAction)) {
      // Horizontal movement stays analog: it is read from the stick below.
      if (action === InputAction.Left || action === InputAction.Right) continue;
      const token = this.padBindings[action];
      if (token && tokenHeld(token, pad, dz)) held.add(action);
    }
    // After a reset (menu closed, dialogue ended), buttons still held stay ignored
    // until released: the press that closed a menu must not also jump.
    if (this.guard) {
      this.guarded = new Set(held);
      this.guard = false;
    }
    for (const action of [...this.guarded]) if (!held.has(action)) this.guarded.delete(action);
    for (const action of held) if (!this.guarded.has(action)) this.current.add(action);
    this.axis = directions(pad, dz).axis;
    this.readMenu(pad);
  }
  private readMenu(pad: NormalizedPad): void {
    const now = performance.now();
    const pressed = (name: keyof typeof menuButtons): boolean => {
      const down = (pad.buttons[menuButtons[name]] ?? 0) > 0.55;
      const edge = down && !this.menuHeld.has(name);
      if (down) this.menuHeld.add(name);
      else this.menuHeld.delete(name);
      return edge;
    };
    this.menu.confirm = pressed('confirm');
    this.menu.back = pressed('back');
    this.menu.previous = pressed('previous');
    this.menu.next = pressed('next');
    // Menus use a firmer threshold than play, so a resting thumb never scrolls.
    const s = stick(pad.x, pad.y, 0.5);
    const d = pad.buttons;
    const x = (d[15] ?? 0) > 0.55 || s.x > 0.1 ? 1 : (d[14] ?? 0) > 0.55 || s.x < -0.1 ? -1 : 0;
    const y = (d[13] ?? 0) > 0.55 || s.y > 0.1 ? 1 : (d[12] ?? 0) > 0.55 || s.y < -0.1 ? -1 : 0;
    const held = this.menuDirection;
    if (x !== held.x || y !== held.y) {
      this.menuDirection = { x, y, since: now, repeated: now };
      this.menu.x = x;
      this.menu.y = y;
    } else if ((x || y) && now - held.since > REPEAT_DELAY && now - held.repeated > REPEAT_EVERY) {
      held.repeated = now;
      this.menu.x = x;
      this.menu.y = y;
    }
  }
  private pollCapture(): void {
    const capture = this.capturing!;
    for (const [index, now] of this.states) {
      const rest = capture.rest.get(index) ?? { buttons: [], x: 0, y: 0 };
      const start = (now.buttons[menuButtons.start] ?? 0) > 0.55;
      const token = start ? null : captureToken(rest, now, this.options.deadzone);
      if (!start && !token) continue;
      this.capturing = null;
      // Menu buttons count as held exactly when they are down now: the captured press
      // must not also confirm the menu behind it, a later one must not be swallowed.
      this.menuHeld = new Set(
        (Object.keys(menuButtons) as (keyof typeof menuButtons)[]).filter(
          (name) => (now.buttons[menuButtons[name]] ?? 0) > 0.55,
        ),
      );
      this.guard = true;
      capture.done(token);
      return;
    }
    if (performance.now() - capture.started > CAPTURE_TIMEOUT) this.cancelCapture();
  }
  /** Plays a vibration on the pad in hand, scaled by the player's setting. */
  rumble(effect: Rumble): void {
    const scale = this.options.vibration;
    if (this.device !== 'gamepad' || scale <= 0 || this.active === null) return;
    let pad: RumblePad | null = null;
    try {
      pad = (navigator.getGamepads?.()[this.active] ?? null) as unknown as RumblePad | null;
    } catch (error) {
      this.warn('gamepad-api', 'Gamepad API unavailable', error);
    }
    if (!pad) return;
    const strong = effect.strong * scale,
      weak = effect.weak * scale;
    const failed = (error: unknown): void => this.warn('rumble', 'Vibration failed', error);
    try {
      if (pad.vibrationActuator?.playEffect)
        void pad.vibrationActuator
          .playEffect('dual-rumble', {
            startDelay: 0,
            duration: effect.duration,
            strongMagnitude: strong,
            weakMagnitude: weak,
          })
          .catch(failed);
      else
        void pad.hapticActuators?.[0]
          ?.pulse?.(Math.max(strong, weak), effect.duration)
          .catch(failed);
    } catch (error) {
      failed(error);
    }
  }
  private connection(raw: Gamepad, connected: boolean): void {
    const info = identify(raw.id, raw.mapping);
    if (connected) this.lastFamily = info.glyphs;
    for (const listener of this.listeners) listener(info, connected);
  }
  /** Logs a hardware problem once; the game carries on without it. */
  private warn(key: string, message: string, error: unknown): void {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    console.warn(`[EIDRA] ${message}`, error);
  }
  held(action: InputAction): boolean {
    return this.current.has(action);
  }
  pressed(action: InputAction): boolean {
    return this.edges.has(action);
  }
  consume(action: InputAction): boolean {
    const pressed = this.edges.has(action);
    this.edges.delete(action);
    return pressed;
  }
  get movement(): number {
    return (
      (this.held(InputAction.Right) ? 1 : 0) - (this.held(InputAction.Left) ? 1 : 0) || this.axis
    );
  }
  reset(): void {
    this.keys.clear();
    this.pendingCodes.clear();
    this.current.clear();
    this.previous.clear();
    this.edges.clear();
    this.axis = 0;
    this.guard = true;
  }
  focus(): void {
    this.canvas.focus();
  }
  dispose(): void {
    this.abort.abort();
    this.capturing = null;
    this.reset();
  }
}
