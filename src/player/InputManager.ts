import { InputAction, defaultBindings, gamepadLabels, keyLabel } from './InputAction';
export class InputManager {
  private keys = new Set<string>();
  private pendingCodes = new Set<string>();
  private current = new Set<InputAction>();
  private previous = new Set<InputAction>();
  private edges = new Set<InputAction>();
  private abort = new AbortController();
  bindings = { ...defaultBindings };
  gamepadConnected = false;
  /** The device that produced the latest input; prompts follow it. */
  device: 'keyboard' | 'gamepad' = 'keyboard';
  private axis = 0;
  private menuAxis = 0;
  private previousMenuAxis = 0;
  constructor(private canvas: HTMLCanvasElement) {
    const options = { signal: this.abort.signal };
    window.addEventListener(
      'keydown',
      (event) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)
          return;
        if (!this.keys.has(event.code)) this.pendingCodes.add(event.code);
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
  }
  setBindings(overrides: Record<string, string>): void {
    this.bindings = { ...defaultBindings, ...overrides };
    this.reset();
  }
  label(action: InputAction): string {
    return this.device === 'gamepad' ? gamepadLabels[action] : keyLabel(this.bindings[action]);
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
    const pad = navigator.getGamepads?.().find((candidate) => candidate?.connected);
    this.gamepadConnected = Boolean(pad);
    this.previousMenuAxis = this.menuAxis;
    this.menuAxis = 0;
    if (pad) {
      const vertical = pad.axes[1] ?? 0;
      this.menuAxis = pad.buttons[12]?.pressed
        ? -1
        : pad.buttons[13]?.pressed
          ? 1
          : Math.abs(vertical) > 0.6
            ? Math.sign(vertical)
            : 0;
      const raw = pad.axes[0] ?? 0;
      this.axis = Math.abs(raw) > 0.2 ? raw : 0;
      if (vertical > 0.6) this.current.add(InputAction.Down);
      const map: [number, InputAction][] = [
        [0, InputAction.Jump],
        [1, InputAction.Dash],
        [2, InputAction.Attack],
        [3, InputAction.Remanence],
        [4, InputAction.Parry],
        [5, InputAction.Echo],
        [6, InputAction.Charge],
        [7, InputAction.Interact],
        // Holding the interaction trigger channels Recueillement when nothing is nearby.
        [7, InputAction.Heal],
        [8, InputAction.Map],
        [9, InputAction.Pause],
        [13, InputAction.Down],
        [14, InputAction.Left],
        [15, InputAction.Right],
      ];
      for (const [index, action] of map) if (pad.buttons[index]?.pressed) this.current.add(action);
      if (this.axis !== 0 || pad.buttons.some((button) => button?.pressed)) this.device = 'gamepad';
    }
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
  get menuDirection(): number {
    return this.menuAxis !== this.previousMenuAxis ? this.menuAxis : 0;
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
  }
  focus(): void {
    this.canvas.focus();
  }
  dispose(): void {
    this.abort.abort();
    this.reset();
  }
}
