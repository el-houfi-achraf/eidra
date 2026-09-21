import { Engine } from '@babylonjs/core/Engines/engine';
import type { WebGPUEngine as WebGPUEngineType } from '@babylonjs/core/Engines/webgpuEngine';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { GameError } from './errors';

export async function createEngine(canvas: HTMLCanvasElement): Promise<AbstractEngine> {
  const forceWebGL = new URLSearchParams(location.search).get('renderer') === 'webgl2';
  if (!forceWebGL) {
    let candidate: WebGPUEngineType | undefined;
    try {
      const { WebGPUEngine } = await import('@babylonjs/core/Engines/webgpuEngine');
      await import('@babylonjs/core/Engines/WebGPU/Extensions/engine.computeShader');
      if (await WebGPUEngine.IsSupportedAsync) {
        candidate = new WebGPUEngine(canvas, { antialias: true, adaptToDeviceRatio: false });
        const base = import.meta.env.BASE_URL;
        await candidate.initAsync(
          { jsPath: `${base}decoders/glslang.js`, wasmPath: `${base}decoders/glslang.wasm` },
          { jsPath: `${base}decoders/twgsl.js`, wasmPath: `${base}decoders/twgsl.wasm` },
        );
        return candidate;
      }
    } catch (error) {
      console.warn('[EIDRA] WebGPU initialization failed; switching to WebGL2.', error);
      candidate?.dispose();
    }
  }
  const engine = new Engine(canvas, true, {
    disableWebGL2Support: false,
    preserveDrawingBuffer: false,
    stencil: true,
  });
  if (engine.webGLVersion < 2) {
    engine.dispose();
    throw new GameError(
      'WebGL2 est nécessaire pour entrer dans Nhalis. Mettez à jour votre navigateur et vos pilotes graphiques.',
    );
  }
  return engine;
}
