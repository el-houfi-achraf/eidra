import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { proceduralTexture, mix, smooth } from '../vfx/textures';
/**
 * Far gradient sky behind every parallax layer. It follows the camera, so it
 * reads as infinitely distant, and melts into the fog colour at the horizon.
 */
export class Backdrop {
  private plane: Mesh;
  private material: StandardMaterial;
  constructor(scene: Scene, fog: Color3) {
    const top: [number, number, number] = [0.008, 0.024, 0.03];
    const glow: [number, number, number] = [0.1, 0.22, 0.2];
    const low: [number, number, number] = [fog.r, fog.g, fog.b];
    this.material = new StandardMaterial('vault-sky', scene);
    this.material.emissiveTexture = proceduralTexture(scene, 4, 128, (_u, v) => {
      // v = 0 at the bottom of the plane.
      const horizon = Math.exp(-(((v - 0.42) / 0.13) ** 2));
      const base = mix(low, top, smooth(0.3, 0.95, v));
      return [...mix(base, glow, horizon * 0.55), 1] as const;
    });
    this.material.diffuseColor = Color3.Black();
    this.material.specularColor = Color3.Black();
    this.material.disableLighting = true;
    this.material.fogEnabled = false;
    this.plane = MeshBuilder.CreatePlane('vault-sky', { width: 260, height: 120 }, scene);
    this.plane.material = this.material;
    this.plane.isPickable = false;
    this.plane.infiniteDistance = false;
    this.plane.position.z = 95;
  }
  /** Disabled on LOW: the clear colour already matches the fog. */
  setEnabled(enabled: boolean): void {
    this.plane.setEnabled(enabled);
  }
  update(x: number, y: number): void {
    this.plane.position.x = x;
    this.plane.position.y = y + 6;
  }
  dispose(): void {
    this.plane.dispose();
    this.material.dispose(false, true);
  }
}
