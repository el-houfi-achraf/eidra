import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { Palette } from './Palette';
import { ChunkView } from './ChunkView';
import { SceneManager } from './SceneManager';
export class World {
  private quality: 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA' = 'MEDIUM';
  readonly stream: SceneManager<ChunkView>;
  private gates = new Map<string, { mesh: Mesh; body: PhysicsAggregate | null }>();
  constructor(
    private scene: Scene,
    p: Palette,
  ) {
    this.stream = new SceneManager((data) => {
      const chunk = new ChunkView(data, scene, p);
      chunk.setQuality(this.quality);
      return chunk;
    });
    for (const [id, x] of [
      ['echo', 141],
      ['arena', 164],
    ] as const) {
      const mesh = MeshBuilder.CreateBox(
        `${id}-gate`,
        { width: 0.4, height: 8, depth: 4.5 },
        scene,
      );
      mesh.position.set(x, 4, 0);
      mesh.material = p.gold;
      mesh.visibility = 0.55;
      this.gates.set(id, { mesh, body: null });
    }
  }
  setQuality(preset: 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA'): void {
    this.quality = preset;
    for (const chunk of this.stream.loaded.values()) chunk.setQuality(preset);
  }
  update(x: number, memory: boolean, echoOpen: boolean, arenaClosed: boolean): void {
    this.stream.update(x, memory);
    this.gate('echo', !echoOpen && Math.abs(x - 141) < 45);
    this.gate('arena', arenaClosed && Math.abs(x - 164) < 45);
  }
  private gate(id: string, closed: boolean): void {
    const gate = this.gates.get(id)!;
    gate.mesh.setEnabled(closed);
    if (closed && !gate.body)
      gate.body = new PhysicsAggregate(gate.mesh, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    if (!closed && gate.body) {
      gate.body.dispose();
      gate.body = null;
    }
  }
  render(time: number, collected: ReadonlySet<string>, flags: ReadonlySet<string>): void {
    for (const chunk of this.stream.loaded.values()) chunk.update(time, collected, flags);
  }
  get bodyCount(): number {
    return (
      [...this.stream.loaded.values()].reduce((sum, c) => sum + c.bodyCount, 1) +
      [...this.gates.values()].filter((g) => g.body).length
    );
  }
  dispose(): void {
    this.stream.dispose();
    for (const gate of this.gates.values()) {
      gate.body?.dispose();
      gate.mesh.dispose();
    }
  }
}
