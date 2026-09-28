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
    const pad = { connected: true, axes: [0, 0], buttons };
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
    pad.axes[1] = 0.9;
    buttons[7]!.pressed = true;
    input.poll();
    expect(input.held(InputAction.Down)).toBe(true);
    expect(input.held(InputAction.Heal)).toBe(true);
    expect(input.label(InputAction.Interact)).toBe('RT');
    win.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyJ' }));
    expect(input.label(InputAction.Attack)).toBe('J');
    input.dispose();
  });
});
