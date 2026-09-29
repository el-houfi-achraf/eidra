import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
/**
 * Radiant burst of thin light blades, one mesh and one draw call: recovered
 * powers, fallen guardians and anchors being lit. The blades shoot out, turn
 * slowly and fade.
 */
export class LightRays {
  private mesh: Mesh;
  private life = 0;
  private duration = 1;
  private size = 6;
  constructor(scene: Scene) {
    const positions: number[] = [];
    const indices: number[] = [];
    const rays = 14;
    for (let i = 0; i < rays; i++) {
      const angle = (i / rays) * Math.PI * 2 + (i % 2) * 0.11;
      // Alternating long and short blades read as a star rather than a wheel.
      const length = i % 2 ? 0.55 : 1;
      const half = i % 2 ? 0.025 : 0.04;
      const cx = Math.cos(angle),
        cy = Math.sin(angle);
      const base = positions.length / 3;
      positions.push(
        -cy * half + cx * 0.08,
        cx * half + cy * 0.08,
        0,
        cy * half + cx * 0.08,
        -cx * half + cy * 0.08,
        0,
        cx * length,
        cy * length,
        0,
      );
      indices.push(base, base + 1, base + 2, base, base + 2, base + 1);
    }
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    this.mesh = new Mesh('light-rays', scene);
    data.applyToMesh(this.mesh);
    this.mesh.isPickable = false;
    this.mesh.setEnabled(false);
  }
  play(x: number, y: number, material: StandardMaterial, size = 6, duration = 1.1): void {
    this.mesh.material = material;
    this.mesh.position.set(x, y, -0.5);
    this.life = this.duration = duration;
    this.size = size;
    this.mesh.setEnabled(true);
  }
  update(dt: number, reducedMotion: boolean): void {
    if (this.life <= 0) return;
    this.life -= dt;
    const t = 1 - Math.max(0, this.life) / this.duration;
    const grow = 1 - (1 - Math.min(1, t * 2.2)) ** 3;
    this.mesh.scaling.setAll(Math.max(0.01, grow * this.size));
    if (!reducedMotion) this.mesh.rotation.z += dt * 0.6;
    this.mesh.visibility = Math.min(1, (1 - t) * 1.6) * 0.85;
    this.mesh.setEnabled(this.life > 0);
  }
  /** Keeps the burst centred on a moving source. */
  follow(x: number, y: number): void {
    if (this.life > 0) this.mesh.position.set(x, y, -0.5);
  }
  dispose(): void {
    this.mesh.dispose();
  }
}
