import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { FresnelParameters } from '@babylonjs/core/Materials/fresnelParameters';
import { Constants } from '@babylonjs/core/Engines/constants';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import { proceduralTexture, smooth } from '../vfx/textures';
export class Palette {
  readonly stone: StandardMaterial;
  readonly trim: StandardMaterial;
  readonly dark: StandardMaterial;
  readonly ivory: StandardMaterial;
  readonly crystal: StandardMaterial;
  readonly gold: StandardMaterial;
  readonly danger: StandardMaterial;
  readonly memory: StandardMaterial;
  readonly distant: StandardMaterial;
  readonly ink: StandardMaterial;
  /** Near-black foreground silhouettes that frame the play plane. */
  readonly silhouette: StandardMaterial;
  /** Additive light shafts falling from the broken windows. */
  readonly shaft: StandardMaterial;
  /** Character materials with a fresnel rim so silhouettes read against the stone. */
  readonly heroInk: StandardMaterial;
  readonly foeDark: StandardMaterial;
  /** Solid white used for hit flashes. */
  readonly flash: StandardMaterial;
  constructor(scene: Scene) {
    const make = (id: string, color: string, emission = 0, alpha = 1): StandardMaterial => {
      const m = new StandardMaterial(id, scene);
      m.diffuseColor = Color3.FromHexString(color);
      m.emissiveColor = m.diffuseColor.scale(emission);
      m.specularColor = new Color3(0.08, 0.12, 0.12);
      m.alpha = alpha;
      return m;
    };
    const rim = (material: StandardMaterial, color: string, power: number): StandardMaterial => {
      material.emissiveFresnelParameters = new FresnelParameters({
        leftColor: Color3.FromHexString(color),
        rightColor: material.emissiveColor.clone(),
        power,
        bias: 0.05,
      });
      return material;
    };
    this.stone = make('basalt', '#28403f');
    this.trim = make('aged-bronze', '#8c8164');
    this.dark = make('deep-stone', '#102325');
    this.ivory = make('ceramic', '#dae0cb', 0.12);
    this.crystal = make('lumerite', '#8effdb', 1.2);
    this.gold = make('remembered-gold', '#d7ad69', 0.6);
    this.danger = make('warning-amber', '#ff914d', 1);
    this.memory = make('memory-surface', '#86d6bf', 0.55, 0.38);
    this.distant = make('distant-ruins', '#243b3a');
    this.ink = make('cloak', '#132f34');
    this.silhouette = make('foreground-silhouette', '#040b0c');
    this.silhouette.specularColor = Color3.Black();
    this.heroInk = rim(make('cloak-rim', '#163a40'), '#7fe8cf', 2.2);
    this.foeDark = rim(make('foe-rim', '#0f2224'), '#d9824a', 2.6);
    this.flash = make('hit-flash', '#ffffff', 1);
    this.flash.disableLighting = true;
    this.shaft = new StandardMaterial('light-shaft', scene);
    // Brightest where the light enters (top, v = 1), fading downwards and at both edges.
    this.shaft.emissiveTexture = proceduralTexture(scene, 32, 64, (u, v) => {
      const edge = smooth(0, 0.35, u) * smooth(1, 0.65, u);
      const fall = v ** 1.6 * (0.25 + 0.75 * smooth(0, 0.2, v));
      const a = edge * fall;
      return [0.75 * a, 0.95 * a, 0.82 * a, 1];
    });
    this.shaft.diffuseColor = Color3.Black();
    this.shaft.specularColor = Color3.Black();
    this.shaft.disableLighting = true;
    this.shaft.backFaceCulling = false;
    this.shaft.fogEnabled = false;
    this.shaft.alpha = 0.55;
    this.shaft.alphaMode = Constants.ALPHA_ADD;
    this.shaft.disableDepthWrite = true;
  }
  dispose(): void {
    for (const value of Object.values(this))
      if (value instanceof StandardMaterial) value.dispose(false, true);
  }
}
