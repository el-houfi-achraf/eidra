import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { Palette } from '../world/Palette';
import { PuppetGeometry } from '../animation/PuppetGeometry';
interface Ghost {
  mesh: Mesh;
  life: number;
}
/** Fading hooded silhouettes left behind by the dash, pooled and reused. */
export class Afterimages {
  private ghosts: Ghost[] = [];
  private cursor = 0;
  private clock = 0;
  constructor(scene: Scene, p: Palette) {
    for (let i = 0; i < 7; i++) {
      const g = new PuppetGeometry();
      const tint = [0.75, 1, 0.9] as const;
      g.lathe(
        [
          [0.2, 0.36],
          [0.34, 0.1],
          [0.46, -0.2],
          [0.54, -0.46],
        ],
        { segments: 14, pleats: 7, pleatDepth: 0.08, hemDepth: 0.12, color: () => tint },
      );
      g.lathe(
        [
          [0.015, 1.12],
          [0.2, 0.8],
          [0.3, 0.6],
          [0.2, 0.28],
        ],
        { segments: 10, lean: (t) => -0.22 * (1 - t) ** 2, color: () => tint },
      );
      const mesh = g.build(scene, 'afterimage', undefined, false);
      mesh.material = p.ghost;
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
      ghost.mesh.rotation.y = facing < 0 ? 0.3 : -0.3;
      ghost.mesh.scaling.set(facing < 0 ? -1.12 : 1.12, 0.92, 1);
    }
    for (const ghost of this.ghosts) {
      if (ghost.life <= 0) continue;
      ghost.life -= dt;
      ghost.mesh.setEnabled(ghost.life > 0);
      ghost.mesh.visibility = Math.max(0, ghost.life / 0.28) * 0.8;
    }
  }
  dispose(): void {
    for (const ghost of this.ghosts) ghost.mesh.dispose();
  }
}
