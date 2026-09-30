import { describe, it, expect } from 'vitest';
import {
  AXIS_BUTTONS,
  PadReader,
  captureToken,
  directions,
  hatDirections,
  identify,
  stick,
  tokenGlyph,
  tokenHeld,
} from '../../src/player/Gamepad';
import type { RawPad } from '../../src/player/Gamepad';
import { defaultPadBindings, padProfiles } from '../../game-data/input/controllers';
import { rumbleCues } from '../../game-data/input/rumble';
import { SettingsSchema } from '../../src/config/settings';
import { InputAction } from '../../src/player/InputAction';
/** A raw pad as the Gamepad API reports it. */
function raw(
  id: string,
  mapping: string,
  pressed: number[] = [],
  axes: number[] = [0, 0, 0, 0],
  count = 17,
): RawPad {
  return {
    id,
    index: 0,
    mapping,
    connected: true,
    axes,
    buttons: Array.from({ length: count }, (_, i) => ({
      pressed: pressed.includes(i),
      value: pressed.includes(i) ? 1 : 0,
    })),
  };
}
describe('controller identification', () => {
  it('recognises families from Chromium, Firefox and Safari ids', () => {
    const chromium = identify(
      'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)',
      'standard',
    );
    expect(chromium).toMatchObject({
      name: 'DualSense Wireless Controller',
      vendor: '054c',
      family: 'playstation',
      profile: null,
    });
    expect(identify('Xbox 360 Controller (XInput STANDARD GAMEPAD)', 'standard').family).toBe(
      'xbox',
    );
    const firefox = identify('57e-2009-Pro Controller', '');
    expect(firefox).toMatchObject({ vendor: '057e', name: 'Pro Controller', family: 'nintendo' });
    // Unknown pads mapped by the browser are mostly XInput clones: A / B / X / Y.
    expect(identify('Wireless Gamepad', 'standard')).toMatchObject({
      family: 'generic',
      glyphs: 'xbox',
    });
    expect(identify('Generic USB Joystick', '').glyphs).toBe('generic');
    // Linux lists a PlayStation pad's motion sensors as another "gamepad".
    expect(
      identify('054c-0ce6-Sony Interactive Entertainment DualSense Motion Sensors', '').sensor,
    ).toBe(true);
    expect(identify('054c-0ce6-DualSense Wireless Controller', '').sensor).toBe(false);
  });
  it('picks a layout profile only when the browser does not map the pad', () => {
    expect(identify('045e-028e-Microsoft X-Box 360 pad', '').profile?.id).toBe('evdev-xbox');
    expect(identify('054c-09cc-Wireless Controller', '').profile?.id).toBe('evdev-playstation');
    expect(identify('Generic USB Joystick (Vendor: 0079 Product: 0006)', '').profile?.id).toBe(
      'generic',
    );
    expect(padProfiles.map((p) => p.id)).toContain('generic');
  });
});
describe('controller normalisation', () => {
  it('keeps standard pads as they are', () => {
    const reader = new PadReader(
      identify('Xbox Wireless Controller (STANDARD GAMEPAD)', 'standard'),
    );
    const pad = reader.read(raw('x', 'standard', [0, 7], [0.4, -0.2, 0, 0]));
    expect(pad.buttons[0]).toBe(1);
    expect(pad.buttons[7]).toBe(1);
    expect(pad.buttons[1]).toBe(0);
    expect(pad).toMatchObject({ x: 0.4, y: -0.2 });
  });
  it('maps a raw Linux PlayStation pad: swapped north / west, triggers and d-pad on axes', () => {
    const reader = new PadReader(identify('054c-0ce6-Wireless Controller', ''));
    // Raw 2 is the triangle (north), raw 3 the square (west).
    const pad = reader.read(raw('p', '', [2], [0, 0, 1, 0, 0, -1, -1, 1], 13));
    expect(pad.buttons[3]).toBe(1);
    expect(pad.buttons[2]).toBe(0);
    expect(pad.buttons[6]).toBe(1); // L2 fully pressed on axis 2
    expect(pad.buttons[7]).toBe(0); // R2 at rest on axis 5
    expect(pad.buttons[14]).toBe(1); // d-pad left
    expect(pad.buttons[13]).toBe(1); // d-pad down
  });
  it('maps a raw Linux Xbox pad: select, start and guide move to their standard places', () => {
    const reader = new PadReader(identify('045e-02ea-Microsoft X-Box One S pad', ''));
    const pad = reader.read(raw('x', '', [7], [0, 0, -1, 0, 0, -1, 0, 0], 11));
    expect(pad.buttons[9]).toBe(1);
    expect(pad.buttons[7]).toBe(0);
  });
  it('reads a DirectInput POV hat reported as a single axis', () => {
    expect(hatDirections(1.2857)).toEqual([]);
    expect(hatDirections(-1)).toEqual(['up']);
    expect(hatDirections(-0.4286)).toEqual(['right']);
    expect(hatDirections(0.1429)).toEqual(['down']);
    expect(hatDirections(0.7143)).toEqual(['left']);
    expect(hatDirections(-0.7143)).toEqual(['up', 'right']);
    const reader = new PadReader(identify('Generic USB Joystick', ''));
    const axes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1.2857];
    expect(reader.read(raw('g', '', [], axes)).buttons.slice(12, 16)).toEqual([0, 0, 0, 0]);
    axes[9] = -0.4286;
    const right = reader.read(raw('g', '', [], axes));
    expect(right.buttons[15]).toBe(1);
    expect(directions(right, 0.25)).toMatchObject({ right: true, axis: 1 });
  });
  it('turns unknown axes into bindable buttons relative to their rest', () => {
    const reader = new PadReader(identify('Generic USB Joystick', ''));
    // Axis 2 is a trigger resting at −1; axis 3 a stick resting at 0.
    reader.read(raw('g', '', [], [0, 0, -1, 0]));
    const pad = reader.read(raw('g', '', [], [0, 0, 1, -0.9]));
    expect(pad.buttons[AXIS_BUTTONS + 4]).toBeCloseTo(1); // axis 2 +
    expect(pad.buttons[AXIS_BUTTONS + 5]).toBe(0); // a trigger has no − side
    expect(pad.buttons[AXIS_BUTTONS + 7]).toBeCloseTo(0.9); // axis 3 −
    const rest = reader.read(raw('g', '', [], [0, 0, -1, 0]));
    expect(rest.buttons[AXIS_BUTTONS + 4]).toBe(0);
  });
});
describe('sticks, bindings and capture', () => {
  it('applies a radial dead zone and still reaches full speed', () => {
    expect(stick(0.2, 0.1, 0.25)).toEqual({ x: 0, y: 0 });
    expect(stick(1, 0, 0.25).x).toBeCloseTo(1);
    const half = stick(0.625, 0, 0.25).x;
    expect(half).toBeCloseTo(0.5);
    // A drifting stick does not move Eidra.
    const drift = { buttons: [], x: 0.18, y: 0.12 };
    expect(directions(drift, 0.25).axis).toBe(0);
  });
  it('keeps walking analog and reserves up for deliberate pushes', () => {
    const walk = directions({ buttons: [], x: 0.45, y: 0 }, 0.25);
    expect(walk.axis).toBeGreaterThan(0.2);
    expect(walk.axis).toBeLessThan(0.5);
    expect(directions({ buttons: [], x: 0.9, y: -0.5 }, 0.25).up).toBe(false);
    expect(directions({ buttons: [], x: 0.2, y: -0.9 }, 0.25).up).toBe(true);
    expect(directions({ buttons: [], x: 0.3, y: 0.8 }, 0.25).down).toBe(true);
  });
  it('holds tokens for buttons and directions', () => {
    const pad = { buttons: [0, 0, 0, 0, 0, 0, 0.8, 0.3], x: 0, y: 0.9 };
    expect(tokenHeld('b6', pad, 0.25)).toBe(true);
    expect(tokenHeld('b7', pad, 0.25)).toBe(false);
    expect(tokenHeld('down', pad, 0.25)).toBe(true);
    expect(tokenHeld('up', pad, 0.25)).toBe(false);
  });
  it('captures the input newly pushed, ignoring what was already held', () => {
    const rest = { buttons: [0, 0, 0, 0, 0, 0, 1], x: 0, y: 0 };
    expect(captureToken(rest, { buttons: [0, 0, 0, 0, 0, 0, 1], x: 0, y: 0 }, 0.25)).toBeNull();
    expect(captureToken(rest, { buttons: [0, 0, 0, 1, 0, 0, 1], x: 0, y: 0 }, 0.25)).toBe('b3');
    const dpad = Array.from({ length: 17 }, (_, i) => (i === 12 ? 1 : 0));
    expect(captureToken(rest, { buttons: dpad, x: 0, y: 0 }, 0.25)).toBe('up');
    expect(captureToken(rest, { buttons: [], x: 0, y: -0.95 }, 0.25)).toBe('up');
  });
  it('shows the glyphs of the controller in hand', () => {
    expect(tokenGlyph('b0', 'xbox')).toBe('A');
    expect(tokenGlyph('b0', 'playstation')).toBe('✕');
    expect(tokenGlyph('b2', 'playstation')).toBe('□');
    expect(tokenGlyph('b0', 'nintendo')).toBe('B');
    expect(tokenGlyph('b7', 'xbox')).toBe('RT');
    expect(tokenGlyph('up', 'xbox')).toBe('▲');
    expect(tokenGlyph('b16', 'playstation')).toBe('PS');
    expect(tokenGlyph('b19', 'generic')).toBe('B3');
    expect(tokenGlyph(`b${AXIS_BUTTONS + 5}`, 'generic')).toBe('Axe 2−');
    expect(tokenGlyph(undefined, 'xbox')).toBe('—');
  });
});
describe('controller defaults and settings', () => {
  it('binds every action a pad needs, each to its own input', () => {
    for (const action of Object.values(InputAction))
      if (action !== InputAction.Walk) expect(defaultPadBindings, action).toHaveProperty(action);
    const tokens = Object.values(defaultPadBindings);
    expect(new Set(tokens).size).toBe(tokens.length);
    // Jump on the south button, strike on the west, dash on the right trigger.
    expect(defaultPadBindings).toMatchObject({ jump: 'b0', attack: 'b2', dash: 'b7' });
  });
  it('validates controller settings with safe defaults for older saves', () => {
    const settings = SettingsSchema.parse({});
    expect(settings).toMatchObject({
      padBindings: {},
      deadzone: 0.25,
      vibration: 0.7,
      glyphs: 'auto',
    });
    expect(SettingsSchema.safeParse({ padBindings: { jump: 'b3' } }).success).toBe(true);
    expect(SettingsSchema.safeParse({ padBindings: { jump: 'KeyA' } }).success).toBe(false);
    expect(SettingsSchema.safeParse({ deadzone: 0.9 }).success).toBe(false);
  });
  it('keeps every vibration within the motors’ range', () => {
    for (const rumble of Object.values(rumbleCues)) {
      expect(rumble.strong).toBeLessThanOrEqual(1);
      expect(rumble.duration).toBeLessThanOrEqual(1000);
    }
    expect(rumbleCues.hurt!.strong).toBeGreaterThan(rumbleCues.hit!.strong);
  });
});
