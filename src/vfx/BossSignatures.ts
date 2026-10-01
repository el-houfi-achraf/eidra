import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import type { Palette } from '../world/Palette';
import type { EffectPool } from './EffectPool';
import type { CameraRig } from '../camera/CameraRig';
import { CharacterView } from '../animation/CharacterView';
import type { CharacterKind, Pose } from '../animation/CharacterView';
import { PuppetGeometry, hexToRgb } from '../animation/PuppetGeometry';
import type { RGB } from '../animation/PuppetGeometry';
import { appearances } from '../../game-data/characters/appearance';
import type { BossEncounter } from '../enemies/EnemyManager';
/** Height of a geyser's flame column, metres. */
const GEYSER_HEIGHT = 3.4;
/** Seconds between two flickers betraying a reflection. */
const TELL_PERIOD = 1.3;
/**
 * What the signature abilities leave in the arena, read from the encounters: the
 * Keeper's planted standard, the Guardian's eye watching Eidra, the Sentinelle's
 * geysers and landings, and Ilyra's reflections. A view only: nothing here decides.
 * TODO_ART: procedural stand-ins until authored meshes and effects exist.
 */
export class BossSignatures {
  private standard: Mesh | null = null;
  private rise = 0;
  private eye: Mesh;
  private geysers: Mesh[] = [];
  private lit = new Map<string, number>();
  private reflections = new Map<string, CharacterView>();
  /** Where each reflection stood last frame, to shatter it when it disappears. */
  private standing = new Map<string, { x: number; y: number }>();
  private leaping = new Map<string, boolean>();
  private steps = new Map<string, number>();
  constructor(
    private scene: Scene,
    private p: Palette,
    private effects: EffectPool,
    private camera: CameraRig,
  ) {
    // An almond eye with a slit pupil and rays, glowing above Eidra's head.
    const eye = new PuppetGeometry();
    const white: RGB = [1, 1, 1];
    const lid = (t: number, top: number): [number, number] => {
      const x = -0.8 + 1.6 * t;
      return [x, top * 0.34 * Math.sin(t * Math.PI) ** 0.8];
    };
    for (const top of [1, -1])
      for (let k = 0; k < 12; k++) {
        const [x0, y0] = lid(k / 12, top),
          [x1, y1] = lid((k + 1) / 12, top);
        const stroke = 0.075 * Math.sin(((k + 0.5) / 12) * Math.PI) + 0.02;
        eye.plate(
          [
            [x0, y0],
            [x1, y1],
            [x1, y1 + top * stroke],
            [x0, y0 + top * stroke],
          ],
          0,
          white,
        );
      }
    eye.plate(
      [
        [0, 0.3],
        [0.1, 0],
        [0, -0.3],
        [-0.1, 0],
      ],
      -0.01,
      white,
    );
    for (let k = 0; k < 5; k++) {
      const a = Math.PI * (0.2 + 0.15 * k);
      const [cx, cy] = [Math.cos(a), Math.sin(a)];
      eye.plate(
        [
          [cx * 0.5 - cy * 0.025, cy * 0.5 + cx * 0.025],
          [cx * 0.72, cy * 0.72],
          [cx * 0.5 + cy * 0.025, cy * 0.5 - cx * 0.025],
        ],
        0,
        white,
      );
    }
    this.eye = eye.build(scene, 'command-gaze', undefined, false);
    this.eye.material = p.danger;
    this.eye.isPickable = false;
    this.eye.setEnabled(false);
    for (let i = 0; i < 8; i++) {
      const column = MeshBuilder.CreatePlane(
        'eruption-geyser',
        { width: 1.4, height: GEYSER_HEIGHT },
        scene,
      );
      column.material = p.flame;
      column.isPickable = false;
      column.setEnabled(false);
      this.geysers.push(column);
    }
  }
  /** Dust under heavy steps and bounds, from the gait's phase of the step. */
  footfall(encounter: BossEncounter, step: number): void {
    const id = encounter.data.id;
    const last = this.steps.get(id) ?? step;
    this.steps.set(id, step);
    const movement = encounter.data.movement;
    const landed =
      movement === 'march' ? step < last - 0.5 : movement === 'leap' && last < 0.55 && step >= 0.55;
    if (!landed) return;
    const feet = encounter.actor.y - encounter.actor.height / 2;
    this.effects.burst(encounter.actor.x, feet + 0.15, 'dust', movement === 'march' ? 6 : 9);
    if (movement === 'march') this.camera.punch(0.025);
  }
  /**
   * Ilyra's reflections take her pose; each flickers for an instant every so often,
   * the only tell, and shatters when it disappears.
   */
  renderReflections(
    encounter: BossEncounter,
    time: number,
    reducedMotion: boolean,
    facing: (x: number) => number,
    pose: Pose,
    attack: number,
  ): void {
    const seen = new Set<string>();
    encounter.reflections.forEach((reflection, i) => {
      const a = reflection.actor;
      const key = `${encounter.data.id}-${i}`;
      seen.add(key);
      let view = this.reflections.get(key);
      if (!view) {
        view = new CharacterView(this.scene, this.p, encounter.data.appearance as CharacterKind);
        this.reflections.set(key, view);
      }
      if (!this.standing.has(key)) {
        // Detaching from the true body.
        this.effects.ring(a.x, a.y, 'memory', 5, 0.5);
        this.effects.burst(a.x, a.y, 'memory', 8);
      }
      this.standing.set(key, { x: a.x, y: a.y });
      const tell = (time + i * 0.55) % TELL_PERIOD < 0.09;
      view.root.setEnabled(true);
      view.update(a.x, a.y, facing(a.x), time, 0, attack, tell, reducedMotion, {
        ...pose,
        grounded: true,
      });
    });
    for (const [key, at] of this.standing)
      if (key.startsWith(`${encounter.data.id}-`) && !seen.has(key)) {
        this.standing.delete(key);
        this.reflections.get(key)?.root.setEnabled(false);
        // Shattered by a blow, dispelled or faded: it breaks into light.
        this.effects.burst(at.x, at.y, 'memory', 16);
        this.effects.ring(at.x, at.y, 'memory', 6, 0.45);
      }
  }
  update(
    dt: number,
    encounters: readonly BossEncounter[],
    player: { x: number; y: number },
    time: number,
    reducedMotion: boolean,
  ): void {
    let banner: BossEncounter | null = null;
    let gaze: BossEncounter | null = null;
    let slot = 0;
    for (const encounter of encounters) {
      const { actor, data, director } = encounter;
      const id = data.id;
      if (encounter.standard) banner = encounter;
      const kind = director.pattern.kind;
      if (
        kind === 'command' &&
        (director.state === 'windup' || director.state === 'attack') &&
        actor.health > 0
      )
        gaze = encounter;
      // A bound ends in a crushing landing.
      const leaping = encounter.leap !== null;
      if (this.leaping.get(id) && !leaping) {
        this.effects.burst(actor.x, 0.3, 'dust', 16);
        this.effects.ring(actor.x, 0.5, 'damage', 8, 0.5);
        this.camera.punch(0.08);
      }
      this.leaping.set(id, leaping);
      // Geysers burst out of the floor one after the other.
      const count = this.lit.get(id) ?? 0;
      if (encounter.geysers.length > count) {
        const last = encounter.geysers[encounter.geysers.length - 1]!;
        this.effects.burst(last.x, 0.4, 'damage', 7);
        this.effects.ring(last.x, 0.3, 'damage', 2.5, 0.35);
      }
      this.lit.set(id, encounter.geysers.length);
      for (const geyser of encounter.geysers) {
        const column = this.geysers[slot++];
        if (!column) break;
        const t = 1 - geyser.life / 0.45;
        const height = Math.min(1, t * 5) * (1 - Math.max(0, t - 0.7) / 0.3);
        column.setEnabled(true);
        column.scaling.y = Math.max(0.02, height);
        column.scaling.x = 1 + Math.sin(time * 37 + geyser.x) * 0.12;
        column.position.set(geyser.x, (GEYSER_HEIGHT * height) / 2, -0.25);
        column.visibility = 0.95 - t * 0.3;
      }
    }
    for (let i = slot; i < this.geysers.length; i++) this.geysers[i]!.setEnabled(false);
    this.renderStandard(dt, banner, time, reducedMotion);
    this.renderGaze(gaze, player, time);
  }
  /** The planted banner: it rises out of the floor, sways, and rings at each pulse. */
  private renderStandard(
    dt: number,
    encounter: BossEncounter | null,
    time: number,
    reducedMotion: boolean,
  ): void {
    const standard = encounter?.standard;
    if (!encounter || !standard) {
      this.standard?.setEnabled(false);
      this.rise = 0;
      return;
    }
    const mesh = (this.standard ??= this.buildStandard(encounter.data.appearance));
    if (this.rise === 0) this.effects.burst(standard.x, 0.3, 'dust', 12);
    this.rise = Math.min(1, this.rise + dt / 0.15);
    mesh.setEnabled(true);
    mesh.position.set(standard.x, 0, 0.35);
    mesh.scaling.set(1, this.rise, 1);
    mesh.rotation.z = reducedMotion ? 0 : Math.sin(time * 2.6) * 0.03;
    // Fades in its last second.
    mesh.visibility = Math.min(1, standard.life);
    if (encounter.pulsed) {
      this.effects.ring(standard.x, 0.45, 'gold', 7, 0.55);
      this.effects.burst(standard.x, 2.6, 'gold', 6);
    }
  }
  private buildStandard(kind: string): Mesh {
    const look = appearances[kind as CharacterKind];
    const cloth = hexToRgb(look.cloak?.color ?? '#2a3350');
    const trim = hexToRgb(look.collar?.color ?? '#c9a55f');
    const g = new PuppetGeometry();
    const wood: RGB = [0.24, 0.19, 0.14];
    g.box([0, 1.45, 0], [0.1, 2.9, 0.1], wood);
    g.box([0.42, 2.72, 0], [0.95, 0.07, 0.07], wood);
    g.box([0, 3.0, 0], [0.16, 0.16, 0.12], trim, Math.PI / 4);
    // Iron spikes that bit into the floor.
    for (const s of [-1, 1]) g.box([s * 0.1, 0.12, 0], [0.05, 0.3, 0.05], wood, s * 0.5);
    const lift = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
    g.plate(
      [
        [0.05, 2.68],
        [0.86, 2.68],
        [0.86, 1.3],
        [0.46, 1.58],
        [0.05, 1.3],
      ],
      -0.06,
      lift(cloth, 1.3),
    );
    g.plate(
      [
        [0.46, 2.4],
        [0.6, 2.12],
        [0.46, 1.84],
        [0.32, 2.12],
      ],
      -0.08,
      trim,
    );
    const mesh = g.build(this.scene, 'planted-standard');
    mesh.material = this.p.puppet;
    mesh.isPickable = false;
    mesh.renderOutline = true;
    mesh.outlineWidth = 0.03;
    return mesh;
  }
  /** "NE BOUGEZ PLUS": an eye opens above Eidra and flares red when it punishes her. */
  private renderGaze(
    encounter: BossEncounter | null,
    player: { x: number; y: number },
    time: number,
  ): void {
    if (!encounter) {
      this.eye.setEnabled(false);
      return;
    }
    const director = encounter.director;
    const open =
      director.state === 'windup'
        ? Math.min(1, director.timer / Math.max(0.1, director.windup))
        : 1;
    const flare = encounter.punished > 0;
    this.eye.setEnabled(true);
    this.eye.material = flare ? this.p.crimson : this.p.danger;
    this.eye.position.set(player.x, player.y + 2.5, -0.6);
    const pulse = 1 + Math.sin(time * 7) * 0.04;
    this.eye.scaling.set(pulse * (flare ? 1.45 : 1), open * pulse * (flare ? 1.45 : 1), 1);
    this.eye.visibility = 0.35 + open * 0.6;
  }
  dispose(): void {
    this.standard?.dispose();
    this.eye.dispose();
    for (const column of this.geysers) column.dispose();
    for (const view of this.reflections.values()) view.dispose();
  }
}
