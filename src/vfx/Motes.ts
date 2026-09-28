import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Palette } from '../world/Palette';
interface Mote {
  mesh: Mesh;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  homing: boolean;
}
/**
 * Homing motes: Lumérite shards that spray out of a defeated foe and are drawn
 * into Eidra, and the resonance gathering around her while she channels.
 */
export class Motes {
  private motes: Mote[] = [];
  private cursor = 0;
  private seed = 7;
  constructor(scene: Scene, p: Palette) {
    for (let i = 0; i < 48; i++) {
      const mesh = MeshBuilder.CreatePolyhedron('lumerite-mote', { type: 1, size: 0.09 }, scene);
      mesh.scaling.y = 1.7;
      mesh.material = p.gold;
      mesh.isPickable = false;
      mesh.setEnabled(false);
      this.motes.push({ mesh, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0, homing: true });
    }
  }
  private random(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  private next(material: StandardMaterial): Mote {
    const mote = this.motes[this.cursor++ % this.motes.length]!;
    mote.mesh.material = material;
    mote.mesh.setEnabled(true);
    mote.age = 0;
    return mote;
  }
  /** Shards burst outwards then home in on the collector. */
  spray(x: number, y: number, count: number, material: StandardMaterial): void {
    for (let i = 0; i < Math.min(16, count); i++) {
      const mote = this.next(material);
      const angle = this.random() * Math.PI;
      const speed = 4 + this.random() * 5;
      Object.assign(mote, {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.4,
        homing: true,
      });
    }
  }
  /** Motes drift inwards around a point, used while channelling. */
  gather(x: number, y: number, material: StandardMaterial): void {
    const mote = this.next(material);
    const angle = this.random() * Math.PI * 2;
    Object.assign(mote, {
      x: x + Math.cos(angle) * 1.6,
      y: y + Math.sin(angle) * 1.4,
      vx: 0,
      vy: 0,
      age: 0.3,
      life: 0.45,
      homing: true,
    });
  }
  update(dt: number, tx: number, ty: number): void {
    for (const m of this.motes) {
      if (m.life <= 0) continue;
      m.age += dt;
      m.life -= dt;
      const pull = Math.min(1, Math.max(0, (m.age - 0.25) * 3));
      if (m.homing && pull > 0) {
        const dx = tx - m.x,
          dy = ty - m.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 0.4) m.life = 0;
        const speed = 6 + pull * 16;
        m.vx += ((dx / Math.max(0.01, distance)) * speed - m.vx) * Math.min(1, dt * 8 * pull);
        m.vy += ((dy / Math.max(0.01, distance)) * speed - m.vy) * Math.min(1, dt * 8 * pull);
      } else m.vy -= 9 * dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.mesh.position.set(m.x, m.y, -0.5);
      m.mesh.rotation.y += dt * 9;
      m.mesh.setEnabled(m.life > 0);
    }
  }
  dispose(): void {
    for (const m of this.motes) m.mesh.dispose();
  }
}
