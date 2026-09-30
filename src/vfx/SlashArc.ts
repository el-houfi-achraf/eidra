import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { Palette } from '../world/Palette';
import type { AttackKind } from '../combat/CombatSystem';
/**
 * Crescent blade trail. A ribbon between an inner and an outer arc, thick in the
 * middle and sharp at both tips, swept and faded over the active window.
 */
export class SlashArc {
  private mesh: Mesh;
  private life = 0;
  private duration = 0.16;
  constructor(
    scene: Scene,
    private p: Palette,
  ) {
    const inner: Vector3[] = [];
    const outer: Vector3[] = [];
    const steps = 18;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = (-0.5 + t) * Math.PI * 0.95;
      const width = Math.sin(t * Math.PI) ** 0.8 * 0.42;
      outer.push(new Vector3(Math.cos(angle) * 1.35, Math.sin(angle) * 1.35, 0));
      inner.push(
        new Vector3(Math.cos(angle) * (1.35 - width), Math.sin(angle) * (1.35 - width), 0),
      );
    }
    this.mesh = MeshBuilder.CreateRibbon(
      'blade-crescent',
      { pathArray: [inner, outer], sideOrientation: 2 },
      scene,
    );
    this.mesh.material = p.ivory;
    this.mesh.isPickable = false;
    this.mesh.setEnabled(false);
  }
  /**
   * Starts a new trail; `down` strikes aim beneath the character. Eidra's staff leaves
   * crimson arcs: the second swing of the combo rises, the third is a straight thrust.
   */
  play(kind: AttackKind, empowered: boolean, finisher: boolean, combo = 1): void {
    this.life = this.duration = kind === 'charged' ? 0.24 : 0.16;
    this.mesh.material = empowered ? this.p.gold : this.p.crimson;
    const thrust = kind === 'dash' || (kind === 'light' && combo === 3);
    const size = kind === 'charged' ? 1.5 : finisher ? 1.2 : 1;
    this.mesh.scaling.set(
      size * (thrust ? 1.5 : 1),
      size * (thrust ? 0.16 : kind === 'down' ? 1 : 0.7),
      size,
    );
    this.mesh.metadata = thrust ? 'thrust' : kind === 'light' && combo === 2 ? 'rising' : kind;
  }
  update(dt: number, x: number, y: number, facing: number): void {
    this.life = Math.max(0, this.life - dt);
    const active = this.life > 0;
    this.mesh.setEnabled(active);
    if (!active) return;
    const t = 1 - this.life / this.duration;
    const down = this.mesh.metadata === 'down',
      thrust = this.mesh.metadata === 'thrust',
      rising = this.mesh.metadata === 'rising';
    this.mesh.position.set(
      x + (down ? 0 : facing * (thrust ? -0.3 + t * 0.5 : 0.35)),
      y + (down ? -0.4 : thrust ? 0.1 : 0.05),
      -0.4,
    );
    // Sweep through the arc while fading out; a thrust stays level, a rising arc climbs.
    this.mesh.rotation.z = down
      ? -Math.PI / 2 + (t - 0.5) * 0.6 * facing
      : thrust
        ? 0
        : rising
          ? (t - 0.5) * 1.1 + 0.25
          : (0.5 - t) * 0.9;
    this.mesh.rotation.y = !down && facing < 0 ? Math.PI : 0;
    this.mesh.visibility = Math.min(1, (1 - t) * 1.6);
  }
  dispose(): void {
    this.mesh.dispose();
  }
}
