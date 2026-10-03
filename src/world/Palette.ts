import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Constants } from '@babylonjs/core/Engines/constants';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Texture } from '@babylonjs/core/Materials/Textures/texture';
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
  /** Additive fire column of the ember vents. */
  readonly flame: StandardMaterial;
  /** Eidra's crimson: eyes, heart, slashes and sparks. */
  readonly crimson: StandardMaterial;
  /** Face of Eidra's cards: crimson, gold frame, a pale diamond. */
  readonly card: StandardMaterial;
  /** Additive red streak behind a thrown card or a dash. */
  readonly cardTrail: StandardMaterial;
  /** Rising light of a power's shrine, tinted by each power. */
  private beamTexture: Texture;
  private powers = new Map<string, { core: StandardMaterial; light: StandardMaterial }>();
  constructor(private scene: Scene) {
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
    this.crimson = make('eidra-crimson', '#ee3441', 1.15);
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
    // A card: crimson field, gold frame, a pale diamond pip; unlit so it reads at any depth.
    this.card = new StandardMaterial('eidra-card', scene);
    this.card.diffuseTexture = proceduralTexture(scene, 32, 48, (u, v) => {
      const edge = Math.min(u, 1 - u, v * (32 / 48), (1 - v) * (32 / 48));
      if (edge < 0.08) return [0.88, 0.7, 0.36, 1];
      if (edge < 0.12) return [0.3, 0.04, 0.07, 1];
      const pip = Math.abs(u - 0.5) * 1.4 + Math.abs(v - 0.5);
      if (pip < 0.17) return [0.98, 0.9, 0.82, 1];
      if (pip < 0.22) return [0.88, 0.7, 0.36, 1];
      const grain = 0.85 + 0.15 * Math.sin(u * 40) * Math.sin(v * 52);
      return [0.62 * grain, 0.07 * grain, 0.11 * grain, 1];
    });
    this.card.diffuseColor = Color3.White();
    this.card.ambientColor = Color3.White();
    this.card.emissiveColor = new Color3(0.28, 0.02, 0.04);
    this.card.specularColor = Color3.Black();
    this.card.disableLighting = true;
    this.card.backFaceCulling = false;
    this.card.fogEnabled = false;
    this.cardTrail = new StandardMaterial('card-trail', scene);
    this.cardTrail.diffuseTexture = proceduralTexture(scene, 64, 16, (u, v) => {
      const a = u ** 1.6 * (1 - Math.abs(v - 0.5) * 2) ** 1.4;
      return [a, a * 0.12, a * 0.16, 1];
    });
    this.cardTrail.diffuseColor = Color3.White();
    this.cardTrail.ambientColor = Color3.White();
    this.cardTrail.specularColor = Color3.Black();
    this.cardTrail.disableLighting = true;
    this.cardTrail.backFaceCulling = false;
    this.cardTrail.fogEnabled = false;
    this.cardTrail.alphaMode = Constants.ALPHA_ADD;
    this.cardTrail.disableDepthWrite = true;
    // Fire: white-hot at the vent, orange then red as it rises, ragged at the edges.
    const lick = tileableNoise(29, 4, 3);
    this.flame = new StandardMaterial('ember-vent', scene);
    this.flame.diffuseTexture = proceduralTexture(scene, 32, 128, (u, v) => {
      const edge = smooth(0, 0.3, u) * smooth(1, 0.7, u);
      const body = (1 - v) ** 1.3 * (0.55 + 0.45 * lick(u, v));
      const a = edge * body;
      return [a, a * (0.45 + 0.4 * (1 - v)), a * 0.18 * (1 - v), 1];
    });
    this.flame.diffuseColor = Color3.White();
    this.flame.ambientColor = Color3.White();
    this.flame.emissiveColor = new Color3(0.25, 0.08, 0.02);
    this.flame.specularColor = Color3.Black();
    this.flame.disableLighting = true;
    this.flame.backFaceCulling = false;
    this.flame.fogEnabled = false;
    this.flame.alphaMode = Constants.ALPHA_ADD;
    this.flame.disableDepthWrite = true;
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
    // A power's column of light: brightest at the rune (v = 0), fading upwards and at its sides.
    this.beamTexture = proceduralTexture(scene, 32, 64, (u, v) => {
      const edge = Math.sin(Math.PI * u) ** 2;
      const a = edge * (1 - v) ** 1.8;
      return [a, a, a, 1];
    });
  }
  /**
   * A power's own colour (its shrine): a bright unlit core for the orb, rings and
   * rune, and the additive light of its column. Made once per colour.
   */
  power(color: string): { core: StandardMaterial; light: StandardMaterial } {
    const known = this.powers.get(color);
    if (known) return known;
    const tint = Color3.FromHexString(color);
    const core = new StandardMaterial(`power-core-${color}`, this.scene);
    core.diffuseColor = tint;
    core.emissiveColor = tint.scale(0.6);
    core.specularColor = Color3.Black();
    core.disableLighting = true;
    core.fogEnabled = false;
    const light = new StandardMaterial(`power-light-${color}`, this.scene);
    light.diffuseTexture = this.beamTexture;
    light.diffuseColor = tint;
    light.emissiveColor = tint.scale(0.35);
    light.specularColor = Color3.Black();
    light.disableLighting = true;
    light.backFaceCulling = false;
    light.fogEnabled = false;
    light.alphaMode = Constants.ALPHA_ADD;
    light.alpha = 0.55;
    light.disableDepthWrite = true;
    const made = { core, light };
    this.powers.set(color, made);
    return made;
  }
  dispose(): void {
    for (const { core, light } of this.powers.values()) {
      core.dispose();
      light.dispose();
    }
    this.powers.clear();
    this.beamTexture.dispose();
    for (const value of Object.values(this))
      if (value instanceof StandardMaterial) value.dispose(false, true);
  }
}
