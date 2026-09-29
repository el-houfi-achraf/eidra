import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { Palette } from './Palette';
import { ChunkView } from './ChunkView';
import { SceneManager } from './SceneManager';
import { gates as gateLayout } from '../../game-data/zones/laboratory';
interface Gate {
  x: number;
  mesh: Mesh;
  body: PhysicsAggregate | null;
  /** Visual state 0 (sunk into the floor) .. 1 (raised); the collider switches instantly. */
  raised: number;
  closed: boolean;
}
const GATE_HEIGHT = 8;
export class World {
  private quality: 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA' = 'MEDIUM';
  readonly stream: SceneManager<ChunkView>;
  private gates = new Map<string, Gate>();
  private lastTime = Number.NaN;
  /** Gates that started rising or sinking since the presentation last looked. */
  private changes: { x: number; closed: boolean }[] = [];
  constructor(
    private scene: Scene,
    p: Palette,
  ) {
    this.stream = new SceneManager((data) => {
      const chunk = new ChunkView(data, scene, p);
      chunk.setQuality(this.quality);
      return chunk;
    });
    for (const { id, x } of gateLayout) {
      const mesh = MeshBuilder.CreateBox(
        `${id}-gate`,
        // Thin in depth: the perspective camera would otherwise show a glowing slab side.
        { width: 0.4, height: GATE_HEIGHT, depth: 1.4 },
        scene,
      );
      mesh.position.set(x, GATE_HEIGHT / 2, 0);
      mesh.material = id === 'echo' ? p.gold : p.danger;
      mesh.visibility = id === 'echo' ? 0.55 : 0.7;
      mesh.isPickable = false;
      mesh.setEnabled(false);
      this.gates.set(id, { x, mesh, body: null, raised: 0, closed: false });
    }
  }
  setQuality(preset: 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA'): void {
    this.quality = preset;
    for (const chunk of this.stream.loaded.values()) chunk.setQuality(preset);
  }
  /** Streams sectors around `x` and applies the gates that are currently closed. */
  update(x: number, memory: boolean, closed: ReadonlySet<string>): void {
    this.stream.update(x, memory);
    for (const [id, gate] of this.gates)
      this.gate(gate, closed.has(id) && Math.abs(x - gate.x) < 45);
  }
  private gate(gate: Gate, closed: boolean): void {
    if (closed !== gate.closed) this.changes.push({ x: gate.x, closed });
    gate.closed = closed;
    if (closed && !gate.body) {
      // The collider always sits at full height, whatever the visual animation shows.
      gate.mesh.position.y = GATE_HEIGHT / 2;
      gate.mesh.computeWorldMatrix(true);
      // Static bodies keep their creation transform: the mesh can animate independently.
      gate.body = new PhysicsAggregate(gate.mesh, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    }
    if (!closed && gate.body) {
      gate.body.dispose();
      gate.body = null;
    }
  }
  takeGateChanges(): { x: number; closed: boolean }[] {
    const changes = this.changes;
    this.changes = [];
    return changes;
  }
  isClosed(id: string): boolean {
    return this.gates.get(id)?.closed ?? false;
  }
  render(time: number, collected: ReadonlySet<string>, flags: ReadonlySet<string>): void {
    const dt = Number.isFinite(this.lastTime)
      ? Math.min(0.1, Math.max(0, time - this.lastTime))
      : 0;
    this.lastTime = time;
    // Gates rise from and sink into the floor instead of popping in and out.
    for (const gate of this.gates.values()) {
      gate.raised = Math.max(0, Math.min(1, gate.raised + (gate.closed ? 5 : -3) * dt));
      if (gate.closed && dt === 0) gate.raised = 1;
      gate.mesh.setEnabled(gate.raised > 0.01);
      const eased = 1 - (1 - gate.raised) ** 3;
      gate.mesh.position.y = GATE_HEIGHT / 2 - (1 - eased) * GATE_HEIGHT;
    }
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
