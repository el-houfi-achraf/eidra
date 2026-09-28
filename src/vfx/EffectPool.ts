import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
import type { Palette } from '../world/Palette';
import type { BurstKind } from '../core/GameSession';
interface Particle {
  mesh: Mesh;
  life: number;
  vx: number;
  vy: number;
  gravity: number;
  duration: number;
}
interface Ring {
  mesh: Mesh;
  life: number;
  duration: number;
  size: number;
}
export class EffectPool {
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private cursor = 0;
  private ringCursor = 0;
  private seed = 19;
  /** Scales particle counts with the quality preset. */
  density = 1;
  constructor(
    scene: Scene,
    private p: Palette,
  ) {
    for (let i = 0; i < 96; i++) {
      const mesh = MeshBuilder.CreatePolyhedron(
        'pooled-memory-spark',
        { type: 1, size: 0.06 },
        scene,
      );
      mesh.material = p.crystal;
      mesh.isPickable = false;
      mesh.setEnabled(false);
      this.particles.push({ mesh, life: 0, vx: 0, vy: 0, gravity: 8, duration: 0.5 });
    }
    for (let i = 0; i < 6; i++) {
      const mesh = MeshBuilder.CreateTorus(
        'pooled-shockwave',
        { diameter: 1, thickness: 0.05, tessellation: 40 },
        scene,
      );
      mesh.rotation.x = Math.PI / 2;
      mesh.isPickable = false;
      mesh.setEnabled(false);
      this.rings.push({ mesh, life: 0, duration: 0.4, size: 3 });
    }
  }
  private random(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  private material(kind: BurstKind): StandardMaterial {
    return {
      gold: this.p.gold,
      damage: this.p.danger,
      memory: this.p.crystal,
      dust: this.p.trim,
      heal: this.p.ivory,
    }[kind];
  }
  burst(x: number, y: number, kind: BurstKind, count = 10): void {
    const total = Math.max(2, Math.round(count * this.density));
    for (let i = 0; i < total; i++) {
      const p = this.particles[this.cursor++ % this.particles.length]!;
      p.mesh.position.set(x, y, -0.3);
      p.mesh.material = this.material(kind);
      p.mesh.setEnabled(true);
      p.life = 0.35 + this.random() * 0.35;
      if (kind === 'dust') {
        // Low puffs that roll sideways from the feet.
        p.vx = (this.random() < 0.5 ? -1 : 1) * (1.5 + this.random() * 3);
        p.vy = this.random() * 1.2;
        p.gravity = 1.5;
        p.mesh.scaling.setAll(1.3 + this.random());
      } else if (kind === 'heal') {
        p.vx = (this.random() - 0.5) * 2.5;
        p.vy = 2 + this.random() * 3;
        p.gravity = -1;
        p.life += 0.3;
        p.mesh.scaling.setAll(1);
      } else {
        p.vx = (this.random() - 0.5) * 8;
        p.vy = this.random() * 5;
        p.gravity = 8;
        p.mesh.scaling.setAll(1);
      }
      p.duration = p.life;
    }
  }
  /** Expanding shockwave on the play plane (parries, landings, phase changes). */
  ring(x: number, y: number, kind: BurstKind, size = 3, duration = 0.4): void {
    const ring = this.rings[this.ringCursor++ % this.rings.length]!;
    ring.mesh.material = this.material(kind);
    ring.mesh.position.set(x, y, -0.2);
    ring.mesh.setEnabled(true);
    ring.life = ring.duration = duration;
    ring.size = size;
  }
  update(dt: number): void {
    for (const p of this.particles)
      if (p.life > 0) {
        p.life -= dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.vy -= p.gravity * dt;
        p.vx *= Math.exp(-2 * dt);
        p.mesh.visibility = Math.max(0, p.life / p.duration);
        p.mesh.setEnabled(p.life > 0);
      }
    for (const ring of this.rings)
      if (ring.life > 0) {
        ring.life -= dt;
        const t = 1 - Math.max(0, ring.life) / ring.duration;
        const eased = 1 - (1 - t) ** 3;
        ring.mesh.scaling.set(0.2 + eased * ring.size, 1 + eased * 2, 0.2 + eased * ring.size);
        ring.mesh.visibility = (1 - t) * 0.9;
        ring.mesh.setEnabled(ring.life > 0);
      }
  }
  dispose(): void {
    for (const p of this.particles) p.mesh.dispose();
    for (const ring of this.rings) ring.mesh.dispose();
  }
}
