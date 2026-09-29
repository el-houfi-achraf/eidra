import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { proceduralTexture, tileableNoise } from '../vfx/textures';
import type { Tint } from './Mood';
import { mixRgb } from './Mood';
interface Band {
  mesh: Mesh;
  material: StandardMaterial;
  texture: RawTexture;
  /** Opacity at full haze. */
  strength: number;
  /** World metres per repetition of the mist texture. */
  tile: number;
  /** Drift speed in tiles per second. */
  drift: number;
  /** Presets that draw this band. */
  presets: readonly string[];
}
const WIDTH = 140;
/**
 * Drifting mist between the painted layers. Each band follows the camera but
 * scrolls its texture with the world, so the mist stays put while it slowly
 * rolls; the nearer bands pool on the floor, the further ones veil the vault.
 */
export class Atmosphere {
  private bands: Band[] = [];
  private preset = 'MEDIUM';
  constructor(scene: Scene) {
    const band = (
      name: string,
      z: number,
      y: number,
      height: number,
      strength: number,
      tile: number,
      drift: number,
      presets: readonly string[],
    ): void => {
      // Each band scrolls on its own, so each owns a small texture (and its own clouds).
      const cloud = tileableNoise(23 + this.bands.length * 17, 5, 4);
      const texture = proceduralTexture(
        scene,
        256,
        64,
        (u, v) => {
          // Soft vertical falloff, puffy horizontally; wraps along u.
          const fade = Math.sin(Math.PI * v) ** 1.6;
          const puff = Math.max(0, cloud(u, v * 0.25) * 1.5 - 0.35);
          return [1, 1, 1, Math.min(1, puff * fade)];
        },
        true,
      );
      texture.hasAlpha = true;
      texture.uScale = WIDTH / tile;
      const mesh = MeshBuilder.CreatePlane(name, { width: WIDTH, height }, scene);
      mesh.position.set(0, y, z);
      mesh.isPickable = false;
      const material = new StandardMaterial(name, scene);
      material.diffuseTexture = texture;
      material.useAlphaFromDiffuseTexture = true;
      material.disableLighting = true;
      material.specularColor = Color3.Black();
      material.fogEnabled = false;
      material.disableDepthWrite = true;
      material.backFaceCulling = false;
      mesh.material = material;
      this.bands.push({ mesh, material, texture, strength, tile, drift, presets });
    };
    band('floor-mist', 2.9, 0.6, 3.2, 0.85, 26, 0.012, ['MEDIUM', 'HIGH', 'ULTRA']);
    band('hall-mist', 10, 2.5, 9, 0.75, 38, -0.008, ['MEDIUM', 'HIGH', 'ULTRA']);
    band('vault-mist', 20, 6, 16, 0.6, 55, 0.005, ['HIGH', 'ULTRA']);
  }
  setQuality(preset: string): void {
    this.preset = preset;
  }
  update(x: number, time: number, tint: Tint, reducedMotion: boolean): void {
    for (const band of this.bands) {
      const visible = band.presets.includes(this.preset) && tint.haze > 0.01;
      band.mesh.setEnabled(visible);
      if (!visible) continue;
      band.mesh.position.x = x;
      // Offset by the camera travel: the mist is anchored in the world while it drifts.
      band.texture.uOffset = x / band.tile + (reducedMotion ? 0 : time * band.drift);
      // Unlit: the emissive colour tints the white mist texture.
      band.material.emissiveColor.copyFromFloats(...mixRgb(tint.mist, tint.light, 0.3));
      band.material.alpha = band.strength * tint.haze;
    }
  }
  dispose(): void {
    for (const band of this.bands) {
      band.mesh.dispose();
      band.material.dispose();
      band.texture.dispose();
    }
  }
}
