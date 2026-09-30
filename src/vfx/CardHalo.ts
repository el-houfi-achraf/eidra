import '@babylonjs/core/Meshes/instancedMesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import type { Scene } from '@babylonjs/core/scene';
import type { Palette } from '../world/Palette';
import type { CardShot } from '../combat/Cards';
import type { EffectPool } from './EffectPool';
/** Orbit slots: one card per `perCard` resonance, up to nine. */
export const ORBIT_SLOTS = 9;
const CARD_W = 0.16,
  CARD_H = 0.24;
interface Flying {
  card: InstancedMesh;
  trail: InstancedMesh;
  x: number;
  y: number;
}
interface Burst {
  mesh: InstancedMesh;
  vx: number;
  vy: number;
  spin: number;
  life: number;
}
export interface HaloState {
  /** Cards to show in orbit (resonance / per-card value). */
  count: number;
  /** 0..1: the parry window pulls the cards into a shield in front of Eidra. */
  shield: number;
  /** 0..1: Recueillement draws the cards in as it is channelled. */
  gather: number;
  /** A riposte is ready: the cards turn gold. */
  empowered: boolean;
  /** Dashing: the orbit streams out behind. */
  trail: number;
  hidden: boolean;
}
/**
 * Eidra's cards as the player sees them: an orbit that shows her resonance, a
 * shield while parrying, spinning thrown cards with their streaks, and the burst of
 * a charged blow. Purely visual: the simulation lives in `CardSystem`. Every card is
 * an instance of one of three hidden sources, so each kind costs a single draw call;
 * cards fade by shrinking, since instances share their source's visibility.
 */
export class CardHalo {
  private sources: Mesh[] = [];
  private orbitSource: Mesh;
  private orbit: InstancedMesh[] = [];
  private shown: number[] = [];
  private flying = new Map<number, Flying>();
  private pool: Flying[] = [];
  private bursts: Burst[] = [];
  private cursor = 0;
  constructor(
    scene: Scene,
    private p: Palette,
    private effects: EffectPool,
  ) {
    const source = (name: string, width: number, height: number, material = p.card): Mesh => {
      const mesh = MeshBuilder.CreatePlane(name, { width, height }, scene);
      mesh.material = material;
      mesh.isPickable = false;
      // Hidden sources still draw their instances.
      mesh.isVisible = false;
      this.sources.push(mesh);
      return mesh;
    };
    const instance = (from: Mesh, name: string): InstancedMesh => {
      const mesh = from.createInstance(name);
      mesh.isPickable = false;
      mesh.setEnabled(false);
      return mesh;
    };
    this.orbitSource = source('orbit-cards', CARD_W, CARD_H);
    const cards = source('flying-cards', CARD_W, CARD_H);
    const trails = source('card-streaks', 2.4, 0.3, p.cardTrail);
    for (let i = 0; i < ORBIT_SLOTS; i++) {
      this.orbit.push(instance(this.orbitSource, 'orbit-card'));
      this.shown.push(0);
    }
    for (let i = 0; i < 10; i++)
      this.pool.push({
        card: instance(cards, 'thrown-card'),
        trail: instance(trails, 'card-streak'),
        x: 0,
        y: 0,
      });
    for (let i = 0; i < 12; i++)
      this.bursts.push({ mesh: instance(cards, 'burst-card'), vx: 0, vy: 0, spin: 0, life: 0 });
  }
  /** A fan of cards bursting from the hand: the charged blow. */
  burst(x: number, y: number, facing: number): void {
    for (let i = 0; i < 9; i++) {
      const b = this.bursts[this.cursor++ % this.bursts.length]!;
      const angle = (i / 8 - 0.5) * 0.9 + Math.sin(i * 7.3) * 0.08;
      const speed = 6.5 + ((i * 5) % 4) * 0.8;
      b.vx = Math.cos(angle) * speed * facing;
      b.vy = Math.sin(angle) * speed;
      b.spin = (i % 2 ? 1 : -1) * (14 + i);
      b.life = 0.45;
      b.mesh.position.set(x + facing * 0.4, y + 0.1, -0.35);
      b.mesh.setEnabled(true);
    }
  }
  update(
    dt: number,
    time: number,
    x: number,
    y: number,
    facing: number,
    state: HaloState,
    shots: readonly CardShot[],
    reducedMotion: boolean,
  ): void {
    const spin = reducedMotion ? 0.3 : 1;
    this.orbitSource.material = state.empowered ? this.p.gold : this.p.card;
    this.orbit.forEach((mesh, i) => {
      const target = !state.hidden && i < state.count ? 1 : 0;
      this.shown[i]! += (target - this.shown[i]!) * Math.min(1, dt * 8);
      const shown = this.shown[i]! * (1 - state.gather * 0.6);
      mesh.setEnabled(shown > 0.02);
      if (shown <= 0.02) return;
      // A tilted ring around the body: cards pass behind her, then in front.
      const a = time * 1.1 * spin + (i / ORBIT_SLOTS) * Math.PI * 2;
      const shrink = 1 - state.gather * 0.75;
      const ox = x - facing * 0.55 * state.trail + Math.cos(a) * 0.72 * shrink;
      const oy = y + 0.18 + Math.sin(a) * 0.52 * shrink * (1 - 0.5 * state.trail);
      const oz = Math.sin(a) * 0.32;
      // The shield: a tight spinning disc before her.
      const s = (i / ORBIT_SLOTS) * Math.PI * 2 + time * 6 * spin;
      const sx = x + facing * 0.55 + Math.cos(s) * 0.12,
        sy = y + 0.12 + Math.sin(s) * 0.46,
        sz = -0.3 + Math.sin(s) * 0.05;
      const k = state.shield;
      mesh.position.set(ox + (sx - ox) * k, oy + (sy - oy) * k, oz + (sz - oz) * k);
      mesh.rotation.z =
        (1 - k) * (Math.sin(time * 2 + i) * 0.35 + a * 0.15) + k * (s + Math.PI / 2);
      mesh.rotation.y = (1 - k) * Math.cos(a) * 0.7 + k * facing * 1.2;
      // Appearing and spent cards grow and shrink rather than fade.
      mesh.scaling.setAll(
        (0.85 + 0.15 * Math.sin(time * 3 + i)) * (1 + k * 0.15) * Math.min(1, shown),
      );
    });
    // Thrown cards spin along their flight, a streak behind each.
    const live = new Set<number>();
    for (const shot of shots) {
      live.add(shot.id);
      let view = this.flying.get(shot.id);
      if (!view) {
        view = this.pool.pop();
        if (!view) continue;
        this.flying.set(shot.id, view);
      }
      view.x = shot.x;
      view.y = shot.y;
      view.card.setEnabled(true);
      view.trail.setEnabled(true);
      view.card.position.set(shot.x, shot.y, -0.35);
      view.card.rotation.z = time * 22 * spin;
      view.card.scaling.setAll(1.7);
      const heading = Math.atan2(shot.vy, shot.vx);
      view.trail.position.set(
        shot.x - Math.cos(heading) * 1.15,
        shot.y - Math.sin(heading) * 1.15,
        -0.3,
      );
      view.trail.rotation.z = heading;
    }
    for (const [id, view] of this.flying)
      if (!live.has(id)) {
        // Spent on a body, a wall or its range: it bursts into red sparks.
        this.effects.burst(view.x, view.y, 'crimson', 5);
        view.card.setEnabled(false);
        view.trail.setEnabled(false);
        this.flying.delete(id);
        this.pool.push(view);
      }
    for (const b of this.bursts) {
      if (b.life <= 0) continue;
      b.life -= dt;
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.vx *= Math.exp(-4 * dt);
      b.vy *= Math.exp(-4 * dt);
      b.mesh.rotation.z += b.spin * dt * spin;
      b.mesh.scaling.setAll(1.5 * Math.min(1, Math.max(0, b.life / 0.3)));
      b.mesh.setEnabled(b.life > 0);
    }
  }
  dispose(): void {
    // Disposing a source disposes its instances.
    for (const mesh of this.sources) mesh.dispose();
  }
}
