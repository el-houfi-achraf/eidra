import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { Palette } from '../world/Palette';
interface Particle {
  mesh: Mesh;
  life: number;
  vx: number;
  vy: number;
  duration: number;
}
export class EffectPool {
  private particles: Particle[] = [];
  private cursor = 0;
  private seed = 19;
  constructor(
    scene: Scene,
    private p: Palette,
  ) {
    for (let i = 0; i < 64; i++) {
      const mesh = MeshBuilder.CreatePolyhedron(
        'pooled-memory-spark',
        { type: 1, size: 0.06 },
        scene,
      );
      mesh.material = p.crystal;
      mesh.setEnabled(false);
      this.particles.push({ mesh, life: 0, vx: 0, vy: 0, duration: 0.5 });
    }
  }
  private random(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  burst(x: number, y: number, kind: 'gold' | 'damage' | 'memory', count = 10): void {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.cursor++ % this.particles.length]!;
      p.mesh.position.set(x, y, -0.3);
      p.mesh.material =
        kind === 'gold' ? this.p.gold : kind === 'damage' ? this.p.danger : this.p.crystal;
      p.mesh.setEnabled(true);
      p.life = 0.35 + this.random() * 0.35;
      p.duration = p.life;
      p.vx = (this.random() - 0.5) * 8;
      p.vy = this.random() * 5;
    }
  }
  update(dt: number): void {
    for (const p of this.particles)
      if (p.life > 0) {
        p.life -= dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.vy -= 8 * dt;
        p.mesh.visibility = Math.max(0, p.life / p.duration);
        p.mesh.setEnabled(p.life > 0);
      }
  }
  dispose(): void {
    for (const p of this.particles) p.mesh.dispose();
  }
}
