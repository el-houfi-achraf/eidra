import {
  directionGlyphs,
  familyMatchers,
  homeGlyphs,
  padGlyphs,
  padProfiles,
} from '../../game-data/input/controllers';
import type { Direction, PadFamily, PadProfile, PadToken } from '../../game-data/input/controllers';
/** The part of the Gamepad API the game reads; plain objects in tests. */
export interface RawPad {
  id: string;
  index: number;
  mapping: string;
  connected: boolean;
  buttons: readonly { pressed: boolean; value: number }[];
  axes: readonly number[];
}
export interface PadInfo {
  /** Readable name, without the browser's vendor / mapping decorations. */
  name: string;
  vendor: string | null;
  family: PadFamily;
  /**
   * Glyphs shown for it: its family's, and for unknown pads the browser maps to the
   * standard layout (mostly XInput clones) the common A / B / X / Y letters.
   */
  glyphs: PadFamily;
  /** Null when the browser already maps the pad to the standard layout. */
  profile: PadProfile | null;
  /**
   * Not a controller: Linux exposes the motion sensors and touchpad of PlayStation
   * pads as extra "gamepads" whose axes never rest.
   */
  sensor: boolean;
}
/** A pad in the standard layout: button values 0..1 and the raw left stick. */
export interface NormalizedPad {
  buttons: number[];
  x: number;
  y: number;
}
/** A button counts as held above this value (analog triggers included). */
export const PRESS = 0.55;
/** First virtual button index of generic axes (two per axis: + then −). */
export const AXIS_BUTTONS = 32;
/** First index of raw buttons a profile does not name. */
export const EXTRA_BUTTONS = 17;
/**
 * Reads the vendor and a clean name from the id strings of Chromium
 * ("Name (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)"), Firefox
 * ("054c-0ce6-Name") and Safari ("Name").
 */
export function identify(id: string, mapping: string): PadInfo {
  let vendor = /vendor:\s*([0-9a-f]{4})/i.exec(id)?.[1]?.toLowerCase() ?? null;
  let name = id.replace(/\s*\(.*\)\s*$/, '').trim();
  const firefox = /^([0-9a-f]{1,4})-([0-9a-f]{1,4})-(.+)$/i.exec(id);
  if (firefox) {
    vendor = firefox[1]!.toLowerCase().padStart(4, '0');
    name = firefox[3]!.trim();
  }
  const lower = id.toLowerCase();
  const matches = (m: { vendors: readonly string[]; names: readonly string[] }): boolean =>
    (vendor !== null && m.vendors.includes(vendor)) || m.names.some((n) => lower.includes(n));
  const family =
    (Object.keys(familyMatchers) as (keyof typeof familyMatchers)[]).find((f) =>
      matches(familyMatchers[f]),
    ) ?? 'generic';
  const profile =
    mapping === 'standard'
      ? null
      : (padProfiles.find((p) => p.id !== 'generic' && matches(p)) ??
        padProfiles.find((p) => p.id === 'generic')!);
  const glyphs = family !== 'generic' ? family : mapping === 'standard' ? 'xbox' : 'generic';
  const sensor = /motion sensors|touchpad|accelerometer|gyro/i.test(id);
  return { name: name || 'Manette', vendor, family, glyphs, profile, sensor };
}
/** Directions of a DirectInput POV hat reported as one axis (neutral beyond ±1). */
export function hatDirections(value: number): Direction[] {
  if (!Number.isFinite(value) || Math.abs(value) > 1.05) return [];
  const step = Math.round((value + 1) / (2 / 7));
  return (
    (
      [
        ['up'],
        ['up', 'right'],
        ['right'],
        ['down', 'right'],
        ['down'],
        ['down', 'left'],
        ['left'],
        ['up', 'left'],
      ] as Direction[][]
    )[step] ?? []
  );
}
const DPAD: Record<Direction, number> = { up: 12, down: 13, left: 14, right: 15 };
/**
 * Normalises one physical pad to the standard layout. Keeps its own calibration:
 * which axes are POV hats, and the resting value of generic axes (a trigger
 * rests at −1, a stick at 0; Firefox reports 0 until a trigger is first touched).
 */
export class PadReader {
  private hats = new Set<number>();
  private rest = new Map<number, number>();
  constructor(readonly info: PadInfo) {}
  read(raw: RawPad): NormalizedPad {
    const buttons: number[] = Array.from({ length: EXTRA_BUTTONS }, () => 0);
    const set = (index: number, value: number): void => {
      buttons[index] = Math.max(buttons[index] ?? 0, value);
    };
    const profile = this.info.profile;
    raw.buttons.forEach((button, i) => {
      // Some drivers only report `pressed`; others only an analog `value`.
      const value = Math.max(Number(button.value) || 0, button.pressed ? 1 : 0);
      set(profile ? (profile.buttons[String(i)] ?? i + EXTRA_BUTTONS) : i, value);
    });
    const used = new Set([0, 1]);
    if (profile) {
      for (const trigger of profile.triggers) {
        const value = raw.axes[trigger.axis];
        if (value === undefined) continue;
        used.add(trigger.axis);
        set(trigger.button, Math.max(0, Math.min(1, (value + 1) / 2)));
      }
      if (profile.dpad) {
        const x = raw.axes[profile.dpad.x] ?? 0,
          y = raw.axes[profile.dpad.y] ?? 0;
        used.add(profile.dpad.x).add(profile.dpad.y);
        set(DPAD.up, y < -0.5 ? 1 : 0);
        set(DPAD.down, y > 0.5 ? 1 : 0);
        set(DPAD.left, x < -0.5 ? 1 : 0);
        set(DPAD.right, x > 0.5 ? 1 : 0);
      }
    }
    raw.axes.forEach((value, axis) => {
      if (used.has(axis)) return;
      if (Math.abs(value) > 1.05) this.hats.add(axis);
      if (this.hats.has(axis)) {
        for (const direction of hatDirections(value)) set(DPAD[direction], 1);
        return;
      }
      // Any other axis becomes two bindable virtual buttons, relative to its rest.
      let rest = this.rest.get(axis) ?? value;
      if (rest === 0 && value <= -0.99) rest = -1;
      this.rest.set(axis, rest);
      const range = rest < -0.5 ? 1 - rest : 1;
      set(AXIS_BUTTONS + axis * 2, Math.max(0, (value - (rest < -0.5 ? rest : 0)) / range));
      set(AXIS_BUTTONS + axis * 2 + 1, rest < -0.5 ? 0 : Math.max(0, -value));
    });
    for (let i = 0; i < buttons.length; i++) buttons[i] ??= 0;
    return { buttons, x: raw.axes[0] ?? 0, y: raw.axes[1] ?? 0 };
  }
}
/** Radial dead zone, rescaled so the stick still reaches full speed. */
export function stick(x: number, y: number, deadzone: number): { x: number; y: number } {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= deadzone || magnitude === 0) return { x: 0, y: 0 };
  const scale = Math.min(1, (magnitude - deadzone) / (1 - deadzone)) / magnitude;
  return { x: x * scale, y: y * scale };
}
export interface PadDirections {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  /** Horizontal movement, analog on the stick, digital on the d-pad. */
  axis: number;
}
export function directions(pad: NormalizedPad, deadzone: number): PadDirections {
  const s = stick(pad.x, pad.y, deadzone);
  const held = (d: Direction): boolean => (pad.buttons[DPAD[d]] ?? 0) > PRESS;
  const digital = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
  return {
    // Up is reserved for deliberate pushes, so running never talks to anyone.
    up: held('up') || (s.y < -0.6 && -s.y >= Math.abs(s.x)),
    down: held('down') || s.y > 0.5,
    left: held('left') || s.x < -0.5,
    right: held('right') || s.x > 0.5,
    axis: digital || s.x,
  };
}
export function tokenHeld(token: PadToken, pad: NormalizedPad, deadzone: number): boolean {
  if (token === 'up' || token === 'down' || token === 'left' || token === 'right')
    return directions(pad, deadzone)[token];
  return (pad.buttons[Number(token.slice(1))] ?? 0) > PRESS;
}
/**
 * The input newly pushed since `rest`, for remapping: a button (d-pad presses
 * become directions) or a stick direction. Null while nothing new is held.
 */
export function captureToken(
  rest: NormalizedPad,
  now: NormalizedPad,
  deadzone: number,
): PadToken | null {
  for (let i = 0; i < now.buttons.length; i++) {
    if ((now.buttons[i] ?? 0) <= 0.6 || (rest.buttons[i] ?? 0) > 0.3) continue;
    const direction = (Object.keys(DPAD) as Direction[]).find((d) => DPAD[d] === i);
    return direction ?? `b${i}`;
  }
  const before = directions(rest, deadzone),
    after = directions(now, deadzone);
  return (['up', 'down', 'left', 'right'] as const).find((d) => after[d] && !before[d]) ?? null;
}
/** Glyph of a binding for the given family of pad. */
export function tokenGlyph(token: PadToken | undefined, family: PadFamily): string {
  if (!token) return '—';
  if (token === 'up' || token === 'down' || token === 'left' || token === 'right')
    return directionGlyphs[token];
  const index = Number(token.slice(1));
  if (index < 12) return padGlyphs[family][index]!;
  if (index < 16) return directionGlyphs[(['up', 'down', 'left', 'right'] as const)[index - 12]!];
  if (index === 16) return homeGlyphs[family];
  if (index < AXIS_BUTTONS) return `B${index - EXTRA_BUTTONS + 1}`;
  const axis = Math.floor((index - AXIS_BUTTONS) / 2);
  return `Axe ${axis}${(index - AXIS_BUTTONS) % 2 ? '−' : '+'}`;
}
