import { afterEach, describe, it, expect, vi } from 'vitest';
import { InputManager } from '../../src/player/InputManager';
import { InputAction } from '../../src/player/InputAction';
const control = vi.hoisted(() => ({
  supported: true,
  probeFails: false,
  initFails: false,
  webGLVersion: 2,
  disposedGPU: 0,
}));
vi.mock('@babylonjs/core/Engines/engine', () => ({
  Engine: class {
    webGLVersion = control.webGLVersion;
    isWebGPU = false;
    dispose(): void {
      /* Test double: no native resources. */
    }
  },
}));
vi.mock('@babylonjs/core/Engines/webgpuEngine', () => ({
  WebGPUEngine: class {
    isWebGPU = true;
    static get IsSupportedAsync(): Promise<boolean> {
      return control.probeFails
        ? Promise.reject(new Error('adapter unavailable'))
        : Promise.resolve(control.supported);
    }
    async initAsync(): Promise<void> {
      if (control.initFails) throw new Error('device initialization failed');
    }
    dispose(): void {
      control.disposedGPU++;
    }
  },
}));
import { createEngine } from '../../src/core/engine';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  control.supported = true;
  control.probeFails = false;
  control.initFails = false;
  control.webGLVersion = 2;
  control.disposedGPU = 0;
});
describe('Renderer negotiation', () => {
  it('prefers WebGPU when initialization succeeds', async () => {
    vi.stubGlobal('location', { search: '' });
    expect((await createEngine({} as HTMLCanvasElement)).isWebGPU).toBe(true);
  });
  it('disposes a failed WebGPU device and uses WebGL2', async () => {
    vi.stubGlobal('location', { search: '' });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    control.initFails = true;
    expect((await createEngine({} as HTMLCanvasElement)).isWebGPU).toBe(false);
    expect(control.disposedGPU).toBe(1);
  });
  it('handles rejected capability probes and rejects WebGL1', async () => {
    vi.stubGlobal('location', { search: '' });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    control.probeFails = true;
    expect((await createEngine({} as HTMLCanvasElement)).isWebGPU).toBe(false);
    control.webGLVersion = 1;
    await expect(createEngine({} as HTMLCanvasElement)).rejects.toThrow('WebGL2');
  });
});
describe('Input buffering', () => {
  it('retains short taps between rendered frames until the simulation consumes them', () => {
    const win = new EventTarget();
    const canvas = new EventTarget();
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', { activeElement: canvas });
    vi.stubGlobal('navigator', { getGamepads: () => [] });
    vi.stubGlobal('HTMLInputElement', class {});
    vi.stubGlobal('HTMLSelectElement', class {});
    const input = new InputManager(canvas as HTMLCanvasElement);
    win.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyJ' }));
    win.dispatchEvent(Object.assign(new Event('keyup'), { code: 'KeyJ' }));
    input.poll();
    input.poll();
    expect(input.consume(InputAction.Attack)).toBe(true);
    expect(input.consume(InputAction.Attack)).toBe(false);
    expect(input.held(InputAction.Attack)).toBe(false);
    input.dispose();
  });
  it('reads the downward direction and switches prompts to the last device used', () => {
    const win = new EventTarget();
    const canvas = new EventTarget();
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false }));
    const pad = {
      id: 'Wireless Gamepad',
      mapping: 'standard',
      connected: true,
      axes: [0, 0],
      buttons,
    };
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', { activeElement: canvas });
    vi.stubGlobal('navigator', { getGamepads: () => [pad] });
    vi.stubGlobal('HTMLInputElement', class {});
    vi.stubGlobal('HTMLSelectElement', class {});
    const input = new InputManager(canvas as HTMLCanvasElement);
    win.dispatchEvent(Object.assign(new Event('keydown'), { code: 'ArrowDown' }));
    input.poll();
    expect(input.held(InputAction.Down)).toBe(true);
    expect(input.label(InputAction.Interact)).toBe('E');
    expect(input.label(InputAction.Dash)).toBe('Shift');
    win.dispatchEvent(Object.assign(new Event('keyup'), { code: 'ArrowDown' }));
    // Up aims overhead as well as jumping, on either key.
    for (const code of ['ArrowUp', 'KeyW']) {
      win.dispatchEvent(Object.assign(new Event('keydown'), { code }));
      input.poll();
      expect(input.held(InputAction.Up), code).toBe(true);
      expect(input.held(InputAction.Jump), code).toBe(true);
      win.dispatchEvent(Object.assign(new Event('keyup'), { code }));
      input.poll();
    }
    // Pushed up, the stick aims the staff overhead and talks to whoever stands there.
    pad.axes[1] = -0.9;
    input.poll();
    expect(input.held(InputAction.Up)).toBe(true);
    expect(input.held(InputAction.Interact)).toBe(true);
    pad.axes[1] = 0.9;
    buttons[1]!.pressed = true;
    input.poll();
    expect(input.held(InputAction.Down)).toBe(true);
    // Focus on the east button, talking by pushing up, as in the classic layout.
    expect(input.held(InputAction.Heal)).toBe(true);
    expect(input.label(InputAction.Heal)).toBe('B');
    expect(input.label(InputAction.Interact)).toBe('▲');
    win.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyJ' }));
    expect(input.label(InputAction.Attack)).toBe('J');
    input.dispose();
  });
});
describe('Controllers', () => {
  interface FakePad {
    id: string;
    index: number;
    mapping: string;
    connected: boolean;
    axes: number[];
    buttons: { pressed: boolean; value: number }[];
    vibrationActuator?: {
      playEffect: (type: string, params: Record<string, number>) => Promise<string>;
    };
  }
  const fakePad = (id: string, index = 0, mapping = 'standard'): FakePad => ({
    id,
    index,
    mapping,
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  });
  const press = (pad: FakePad, index: number, down = true): void => {
    pad.buttons[index] = { pressed: down, value: down ? 1 : 0 };
  };
  function setup(pads: FakePad[]): { input: InputManager; win: EventTarget } {
    const win = new EventTarget();
    const canvas = new EventTarget();
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', { activeElement: canvas });
    vi.stubGlobal('navigator', { getGamepads: () => pads });
    vi.stubGlobal('HTMLInputElement', class {});
    vi.stubGlobal('HTMLSelectElement', class {});
    return { input: new InputManager(canvas as HTMLCanvasElement), win };
  }
  it('plays with whichever pad moved last and shows its glyphs', () => {
    const xbox = fakePad('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)', 0);
    const sony = fakePad('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c)', 1);
    const { input } = setup([xbox, sony]);
    input.poll();
    expect(input.gamepadConnected).toBe(true);
    expect(input.pad).toBeNull();
    press(xbox, 0);
    input.poll();
    expect(input.consume(InputAction.Jump)).toBe(true);
    expect(input.label(InputAction.Jump)).toBe('A');
    press(xbox, 0, false);
    press(sony, 2);
    input.poll();
    expect(input.pad?.family).toBe('playstation');
    expect(input.consume(InputAction.Attack)).toBe(true);
    expect(input.label(InputAction.Jump)).toBe('✕');
    // A drifting stick on the spare pad does not take the game back…
    xbox.axes[0] = 0.9;
    input.poll();
    expect(input.pad?.family).toBe('playstation');
    // …a button press does.
    press(xbox, 2);
    input.poll();
    expect(input.pad?.family).toBe('xbox');
    input.dispose();
  });
  it('ignores the motion sensors Linux lists as another pad', () => {
    const sensors = fakePad('054c-0ce6-Sony Interactive Entertainment Motion Sensors', 0, '');
    const { input } = setup([sensors]);
    sensors.axes = [0.8, -0.7, 0.3, 0.5];
    input.poll();
    expect(input.gamepadConnected).toBe(false);
    expect(input.pad).toBeNull();
    expect(input.movement).toBe(0);
    input.dispose();
  });
  it('plays a pad the browser does not map, and follows remapped buttons', () => {
    const generic = fakePad('Generic USB Joystick (Vendor: 0079 Product: 0006)', 0, '');
    generic.axes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1.2857];
    const { input } = setup([generic]);
    input.poll();
    generic.axes[9] = -0.4286; // hat right
    input.poll();
    expect(input.movement).toBe(1);
    input.setPad({ bindings: { jump: 'b5' }, deadzone: 0.25, vibration: 0.7, glyphs: 'auto' });
    press(generic, 5);
    input.poll();
    expect(input.consume(InputAction.Jump)).toBe(true);
    expect(input.label(InputAction.Jump)).toBe('R1');
    input.dispose();
  });
  it('ignores a button still held after a menu closes until it is released', () => {
    const pad = fakePad('Xbox Wireless Controller (STANDARD GAMEPAD)');
    const { input } = setup([pad]);
    press(pad, 0);
    input.poll();
    input.reset();
    input.poll();
    expect(input.held(InputAction.Jump)).toBe(false);
    expect(input.consume(InputAction.Jump)).toBe(false);
    press(pad, 0, false);
    input.poll();
    press(pad, 0);
    input.poll();
    expect(input.consume(InputAction.Jump)).toBe(true);
    input.dispose();
  });
  it('navigates menus with edges and a delayed auto-repeat', () => {
    const pad = fakePad('Xbox Wireless Controller (STANDARD GAMEPAD)');
    const { input } = setup([pad]);
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    press(pad, 13);
    input.poll();
    expect(input.menu.y).toBe(1);
    now += 100;
    input.poll();
    expect(input.menu.y).toBe(0);
    now += 400;
    input.poll();
    expect(input.menu.y).toBe(1);
    press(pad, 13, false);
    press(pad, 0);
    input.poll();
    expect(input.menu).toMatchObject({ y: 0, confirm: true });
    input.poll();
    expect(input.menu.confirm).toBe(false);
    press(pad, 1);
    press(pad, 5);
    input.poll();
    expect(input.menu).toMatchObject({ back: true, next: true });
    input.dispose();
  });
  it('captures the next new input for remapping; start cancels', () => {
    const pad = fakePad('Xbox Wireless Controller (STANDARD GAMEPAD)');
    const { input } = setup([pad]);
    press(pad, 0);
    input.poll();
    const results: (string | null)[] = [];
    input.capture((token) => results.push(token));
    input.poll();
    expect(results).toEqual([]);
    press(pad, 3);
    input.poll();
    expect(results).toEqual(['b3']);
    // The captured press neither acts in the game nor confirms the menu.
    expect(input.consume(InputAction.Remanence)).toBe(false);
    expect(input.menu.confirm).toBe(false);
    // A button released during the capture counts again at once.
    press(pad, 3, false);
    press(pad, 0, false);
    input.poll();
    press(pad, 1);
    input.poll();
    expect(input.menu.back).toBe(true);
    input.capture((token) => results.push(token));
    press(pad, 9);
    input.poll();
    expect(results).toEqual(['b3', null]);
    input.dispose();
  });
  it('rumbles the pad in hand, scaled by the setting, and never when it is off', () => {
    const pad = fakePad('Xbox Wireless Controller (STANDARD GAMEPAD)');
    const playEffect = vi.fn(() => Promise.resolve('complete'));
    pad.vibrationActuator = { playEffect };
    const { input } = setup([pad]);
    input.rumble({ strong: 1, weak: 1, duration: 100 });
    expect(playEffect).not.toHaveBeenCalled();
    press(pad, 0);
    input.poll();
    input.setPad({ bindings: {}, deadzone: 0.25, vibration: 0.5, glyphs: 'auto' });
    input.rumble({ strong: 0.8, weak: 0.4, duration: 100 });
    expect(playEffect).toHaveBeenCalledWith('dual-rumble', {
      startDelay: 0,
      duration: 100,
      strongMagnitude: 0.4,
      weakMagnitude: 0.2,
    });
    input.setPad({ bindings: {}, deadzone: 0.25, vibration: 0, glyphs: 'auto' });
    input.rumble({ strong: 0.8, weak: 0.4, duration: 100 });
    expect(playEffect).toHaveBeenCalledTimes(1);
    input.dispose();
  });
  it('announces controllers plugged in and removed', () => {
    const { input, win } = setup([]);
    const seen: string[] = [];
    input.onConnection((info, connected) => seen.push(`${info.family}:${connected}`));
    const gamepad = fakePad('054c-0ce6-DualSense Wireless Controller', 0, '');
    win.dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad }));
    win.dispatchEvent(Object.assign(new Event('gamepaddisconnected'), { gamepad }));
    expect(seen).toEqual(['playstation:true', 'playstation:false']);
    input.dispose();
  });
});
