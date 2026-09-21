import '@babylonjs/core/Engines/AbstractEngine/abstractEngine.timeQuery';
import '@babylonjs/core/Engines/AbstractEngine/abstractEngine.query';
import '@babylonjs/core/Engines/Extensions/engine.query';
import { EngineInstrumentation } from '@babylonjs/core/Instrumentation/engineInstrumentation';
import type { Scene } from '@babylonjs/core/scene';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation';
export class DebugOverlay {
  private element = document.createElement('pre');
  private instrumentation: SceneInstrumentation;
  private elapsed = 0;
  private cpuMs = 0;
  private engineInstrumentation: EngineInstrumentation;
  constructor(private scene: Scene) {
    this.engineInstrumentation = new EngineInstrumentation(scene.getEngine());
    this.engineInstrumentation.captureGPUFrameTime = true;
    this.element.id = 'debug-overlay';
    document.body.append(this.element);
    this.instrumentation = new SceneInstrumentation(scene);
    this.instrumentation.captureFrameTime = true;
  }
  recordCPU(ms: number): void {
    this.cpuMs = ms;
  }
  get metrics(): {
    cpuMs: number;
    gpuMs: number | null;
    drawCalls: number;
    triangles: number;
    frameMs: number;
  } {
    return {
      cpuMs: this.cpuMs,
      gpuMs:
        this.engineInstrumentation.gpuFrameTimeCounter.current > 0
          ? this.engineInstrumentation.gpuFrameTimeCounter.current / 1e6
          : null,
      drawCalls: this.instrumentation.drawCallsCounter.current,
      triangles: Math.round(this.scene.getActiveIndices() / 3),
      frameMs: this.scene.getEngine().getDeltaTime(),
    };
  }
  update(dt: number, extra = ''): void {
    this.elapsed += dt;
    if (this.elapsed < 0.5) return;
    this.elapsed = 0;
    const engine = this.scene.getEngine();
    this.element.textContent = `EIDRA / ${engine.isWebGPU ? 'WebGPU' : 'WebGL2'}\nFPS ${engine.getFps().toFixed(0)} • frame ${engine.getDeltaTime().toFixed(1)} ms\nCPU total ${this.cpuMs.toFixed(2)} ms • GPU ${this.metrics.gpuMs?.toFixed(2) ?? 'n/a'} ms\nDraws ${this.instrumentation.drawCallsCounter.current} • triangles ${Math.round(this.scene.getActiveIndices() / 3)}\nMeshes ${this.scene.getActiveMeshes().length}/${this.scene.meshes.length}\nMaterials ${this.scene.materials.length} • textures ${this.scene.textures.length}\n${extra}`;
  }
  dispose(): void {
    this.engineInstrumentation.dispose();
    this.instrumentation.dispose();
    this.element.remove();
  }
}
