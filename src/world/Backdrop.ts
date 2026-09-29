import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import type { Tint } from './Mood';
import { mixRgb } from './Mood';
import type { RGB } from './Mood';
/** Heights (0 bottom .. 1 top) of the gradient rows of the sky. */
const ROWS = [0, 0.3, 0.42, 0.55, 0.75, 1];
const WIDTH = 260,
  HEIGHT = 120;
/**
 * Far gradient sky behind every parallax layer. It follows the camera, so it
 * reads as infinitely distant, and is recoloured by the sector's mood: fog at
 * the bottom, a glowing horizon band, the dark vault on top.
 */
export class Backdrop {
  private plane: Mesh;
  private material: StandardMaterial;
  private colors = new Float32Array(ROWS.length * 2 * 4);
  private tint: Tint | null = null;
  constructor(scene: Scene) {
    const positions: number[] = [];
    const indices: number[] = [];
    ROWS.forEach((v, i) => {
      const y = (v - 0.5) * HEIGHT;
      positions.push(-WIDTH / 2, y, 0, WIDTH / 2, y, 0);
      if (i > 0) {
        const a = (i - 1) * 2;
        indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
      }
    });
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.colors = Array.from(this.colors);
    this.plane = new Mesh('vault-sky', scene);
    data.applyToMesh(this.plane, true);
    this.material = new StandardMaterial('vault-sky', scene);
    this.material.diffuseColor = Color3.White();
    this.material.ambientColor = Color3.White();
    this.material.specularColor = Color3.Black();
    this.material.disableLighting = true;
    this.material.backFaceCulling = false;
    this.material.fogEnabled = false;
    this.plane.material = this.material;
    this.plane.isPickable = false;
    this.plane.position.z = 95;
  }
  /** Disabled on LOW: the clear colour already matches the fog. */
  setEnabled(enabled: boolean): void {
    this.plane.setEnabled(enabled);
  }
  update(x: number, y: number, tint: Tint): void {
    this.plane.position.x = x;
    this.plane.position.y = y + 6;
    if (tint === this.tint) return;
    this.tint = tint;
    const glow = mixRgb(tint.horizon, tint.light, 0.12);
    const rows: RGB[] = [
      tint.fog,
      tint.fog,
      glow,
      mixRgb(tint.horizon, tint.sky, 0.45),
      mixRgb(tint.horizon, tint.sky, 0.85),
      tint.sky,
    ];
    rows.forEach((c, i) => {
      for (let k = 0; k < 2; k++) this.colors.set([c[0], c[1], c[2], 1], (i * 2 + k) * 4);
    });
    this.plane.updateVerticesData(VertexBuffer.ColorKind, this.colors);
  }
  dispose(): void {
    this.plane.dispose();
    this.material.dispose(false, true);
  }
}
