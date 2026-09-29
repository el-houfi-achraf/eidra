import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Constants } from '@babylonjs/core/Engines/constants';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import { proceduralTexture, smooth, tileableNoise } from '../vfx/textures';
export class Palette {
  readonly stone: StandardMaterial;
  readonly trim: StandardMaterial;
  readonly dark: StandardMaterial;
  readonly ivory: StandardMaterial;
  readonly crystal: StandardMaterial;
  readonly gold: StandardMaterial;
  readonly danger: StandardMaterial;
  readonly memory: StandardMaterial;
  readonly ink: StandardMaterial;
  /** Additive light shafts falling from the broken windows. */
  readonly shaft: StandardMaterial;
  /** Solid white used for hit flashes. */
  readonly flash: StandardMaterial;
  /** Unlit vertex-coloured materials for the toon-shaded puppets. */
  readonly puppet: StandardMaterial;
  readonly puppetDouble: StandardMaterial;
  readonly ghost: StandardMaterial;
  readonly ghostDouble: StandardMaterial;
  /** Painted scenery: unlit vertex colours modulated by a tiling brush texture. */
  readonly painted: StandardMaterial;
  /** Painted foreground with feathered, out-of-focus edges (vertex alpha). */
  readonly paintedSoft: StandardMaterial;
  /** Additive soft light pools around lanterns, crystals and windows. */
  readonly halo: StandardMaterial;
  /** Painted remembered slabs; a faint emissive lets the bloom catch them. */
  readonly paintedMemory: StandardMaterial;
  constructor(scene: Scene) {
    const make = (id: string, color: string, emission = 0, alpha = 1): StandardMaterial => {
      const m = new StandardMaterial(id, scene);
      m.diffuseColor = Color3.FromHexString(color);
      m.emissiveColor = m.diffuseColor.scale(emission);
      m.specularColor = new Color3(0.08, 0.12, 0.12);
      m.alpha = alpha;
      return m;
    };
    this.stone = make('basalt', '#28403f');
    this.trim = make('aged-bronze', '#8c8164');
    this.dark = make('deep-stone', '#102325');
    this.ivory = make('ceramic', '#dae0cb', 0.12);
    this.crystal = make('lumerite', '#8effdb', 1.2);
    this.gold = make('remembered-gold', '#d7ad69', 0.6);
    this.danger = make('warning-amber', '#ff914d', 1);
    this.memory = make('memory-surface', '#86d6bf', 0.55, 0.38);
    this.ink = make('cloak', '#132f34');
    this.flash = make('hit-flash', '#ffffff', 1);
    this.flash.disableLighting = true;
    // Colours and toon tones are baked into the vertices; lighting would only muddy them.
    // Unlit standard materials output (emissive + ambient) x vertex colour. A white scene
    // ambient only reaches materials whose own ambient is white (the puppets): every other
    // material keeps the default black ambient, and the glow layer, which reads emissive,
    // does not light the puppets up.
    scene.ambientColor = Color3.White();
    const puppet = (id: string, alpha: number, doubleSided: boolean): StandardMaterial => {
      const m = new StandardMaterial(id, scene);
      m.diffuseColor = Color3.White();
      m.ambientColor = Color3.White();
      m.specularColor = Color3.Black();
      m.disableLighting = true;
      m.backFaceCulling = !doubleSided;
      // Characters stay crisp in front of the atmospheric fog, like inked figures on a painted set.
      m.fogEnabled = false;
      m.alpha = alpha;
      if (alpha < 1) m.emissiveColor = new Color3(0.08, 0.2, 0.17);
      return m;
    };
    this.puppet = puppet('puppet', 1, false);
    this.puppetDouble = puppet('puppet-ribbon', 1, true);
    this.ghost = puppet('memory-puppet', 0.5, false);
    this.ghostDouble = puppet('memory-ribbon', 0.45, true);
    // Hand-painted grain: soft blotches and faint horizontal strokes, tiling in world space.
    const blotch = tileableNoise(7, 4, 4),
      stroke = tileableNoise(11, 16, 2);
    const brush = proceduralTexture(
      scene,
      128,
      128,
      (u, v) => {
        const k = 0.8 + 0.2 * (0.65 * blotch(u, v) + 0.35 * stroke(u * 0.25, v));
        return [k, k, k, 1];
      },
      true,
    );
    const painted = (id: string): StandardMaterial => {
      const m = new StandardMaterial(id, scene);
      m.diffuseColor = Color3.White();
      m.specularColor = Color3.Black();
      m.diffuseTexture = brush;
      // Unlit standard materials output (emissive + ambient) x texture x vertex colour.
      m.ambientColor = Color3.White();
      m.disableLighting = true;
      m.backFaceCulling = false;
      // Depth haze is painted into the vertex colours per layer.
      m.fogEnabled = false;
      return m;
    };
    this.painted = painted('painted-layer');
    this.paintedSoft = painted('painted-foreground');
    this.paintedMemory = painted('painted-memory');
    this.paintedMemory.emissiveColor = new Color3(0.08, 0.16, 0.14);
    this.halo = new StandardMaterial('light-pool', scene);
    this.halo.diffuseTexture = proceduralTexture(scene, 64, 64, (u, v) => {
      const r = Math.min(1, Math.hypot(u - 0.5, v - 0.5) * 2);
      const a = (1 - r) ** 2.2;
      return [a, a, a, 1];
    });
    this.halo.diffuseColor = Color3.White();
    this.halo.ambientColor = Color3.White();
    this.halo.specularColor = Color3.Black();
    this.halo.disableLighting = true;
    this.halo.backFaceCulling = false;
    this.halo.fogEnabled = false;
    this.halo.alphaMode = Constants.ALPHA_ADD;
    this.halo.alpha = 0.99;
    this.halo.disableDepthWrite = true;
    this.shaft = new StandardMaterial('light-shaft', scene);
    // Brightest where the light enters (top, v = 1), fading downwards and at both edges.
    // Tinted per sector by the vertex colours of each shaft.
    this.shaft.diffuseTexture = proceduralTexture(scene, 32, 64, (u, v) => {
      const edge = smooth(0, 0.35, u) * smooth(1, 0.65, u);
      const fall = v ** 1.6 * (0.25 + 0.75 * smooth(0, 0.2, v));
      const a = edge * fall;
      return [0.75 * a, 0.95 * a, 0.82 * a, 1];
    });
    this.shaft.diffuseColor = Color3.White();
    this.shaft.ambientColor = Color3.White();
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
