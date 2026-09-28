import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { Palette } from '../world/Palette';
interface Ghost {
  mesh: Mesh;
  life: number;
}
/** Fading silhouettes left behind by the dash, pooled and reused. */
export class Afterimages {
  private ghosts: Ghost[] = [];
  private cursor = 0;
  private clock = 0;
  constructor(scene: Scene, p: Palette) {
    for (let i = 0; i < 7; i++) {
      const body = MeshBuilder.CreateCylinder(
        'afterimage-body',
        { height: 1.1, diameterTop: 0.42, diameterBottom: 1.02, tessellation: 5 },
        scene,
      );
      body.position.y = -0.25;
      const head = MeshBuilder.CreatePolyhedron('afterimage-head', { type: 1, size: 0.3 }, scene);
      head.position.y = 0.65;
      head.scaling.set(0.7, 1.2, 0.75);
      const mesh = Mesh.MergeMeshes([body, head], true, true)!;
      mesh.material = p.memory;
      mesh.isPickable = false;
      mesh.setEnabled(false);
      this.ghosts.push({ mesh, life: 0 });
    }
  }
  update(dt: number, emit: boolean, x: number, y: number, facing: number): void {
    this.clock -= dt;
    if (emit && this.clock <= 0) {
      this.clock = 0.028;
      const ghost = this.ghosts[this.cursor++ % this.ghosts.length]!;
      ghost.life = 0.28;
      ghost.mesh.position.set(x, y, 0.15);
      ghost.mesh.rotation.y = facing < 0 ? 0.25 : -0.25;
      ghost.mesh.scaling.set(1.12, 0.92, 1);
    }
    for (const ghost of this.ghosts) {
      if (ghost.life <= 0) continue;
      ghost.life -= dt;
      ghost.mesh.setEnabled(ghost.life > 0);
      ghost.mesh.visibility = Math.max(0, ghost.life / 0.28) * 0.7;
    }
  }
  dispose(): void {
    for (const ghost of this.ghosts) ghost.mesh.dispose();
  }
}
