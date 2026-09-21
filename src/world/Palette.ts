import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
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
    this.distant = make('distant-ruins', '#243b3a');
    this.ink = make('cloak', '#132f34');
  }
  dispose(): void {
    for (const value of Object.values(this)) if (value instanceof StandardMaterial) value.dispose();
  }
}
