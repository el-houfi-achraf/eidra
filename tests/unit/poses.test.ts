import { describe, expect, it } from 'vitest';
import { bossPose, enemyPose, gaitPose, heroPose, withGait } from '../../src/animation/Poses';
import { bossRoster } from '../../game-data/bosses/roster';
import type { EnemyPoseInput } from '../../src/animation/Poses';
import type { EnemyState } from '../../src/ai/EnemyFSM';
import { enemyData } from '../../game-data/enemies/roster';
import { guardianData } from '../../game-data/bosses/guardian';
import type { PatternKind } from '../../game-data/bosses/schema';
import { NOVA_INTERVAL } from '../../src/bosses/BossDirector';

const watcher = enemyData.watcher;
const melee = (state: EnemyState, timer: number, flash = 0): EnemyPoseInput => ({
  state,
  timer,
  windup: watcher.windup,
  recover: watcher.recover,
  ranged: false,
  flash,
});

describe('enemy key poses', () => {
  it('anticipates a blow: leans away, crouches and raises the weapon, shivering at the end', () => {
    const early = enemyPose(melee('ALERT', watcher.windup * 0.2)).pose;
    const late = enemyPose(melee('ALERT', watcher.windup * 0.95)).pose;
    expect(early.lean!).toBeLessThan(0);
    expect(late.lean!).toBeLessThan(early.lean!);
    expect(late.raise!).toBeGreaterThan(0.95);
    expect(late.squash!).toBeGreaterThan(early.squash!);
    expect(early.tremble).toBe(0);
    expect(late.tremble!).toBeGreaterThan(0);
  });
  it('lunges forward and sweeps the blade during the strike', () => {
    const start = enemyPose(melee('ATTACK', 0.02));
    const end = enemyPose(melee('ATTACK', 0.19));
    expect(start.pose.lean!).toBeGreaterThan(0.3);
    expect(end.pose.offset!).toBeGreaterThan(start.pose.offset!);
    expect(start.attack).toBeGreaterThan(end.attack);
    expect(end.attack).toBeGreaterThanOrEqual(0);
  });
  it('slumps after the blow and settles back to neutral', () => {
    const slump = enemyPose(melee('RECOVER', 0)).pose;
    const settled = enemyPose(melee('RECOVER', watcher.recover)).pose;
    expect(slump.lean!).toBeGreaterThan(0);
    expect(settled.lean).toBeCloseTo(0);
    expect(settled.squash).toBeCloseTo(0);
  });
  it('recoils from a hit and hops when it notices the player', () => {
    expect(enemyPose(melee('IDLE', 0, 0.09)).pose.lean!).toBeLessThan(-0.25);
    expect(enemyPose(melee('DETECT', 0.125)).pose.lift!).toBeGreaterThan(0.25);
  });
  it('makes casters rise to aim and recoil when firing, without a blade sweep', () => {
    const wisp = enemyData.wisp;
    const input = { ...melee('ALERT', wisp.windup), windup: wisp.windup, ranged: true };
    expect(enemyPose(input).pose.lift!).toBeGreaterThan(0.25);
    const fire = enemyPose({ ...input, state: 'ATTACK', timer: 0 });
    expect(fire.pose.offset!).toBeLessThan(0);
    expect(fire.attack).toBe(0);
  });
});

describe('guardian key poses', () => {
  const windup = (pattern: string) => {
    const data = guardianData.patterns.find((p) => p.id === pattern)!;
    return bossPose({
      state: 'windup',
      timer: data.windup,
      kind: data.kind,
      windup: data.windup,
      recover: data.recover,
    }).pose;
  };
  it('telegraphs every pattern with its own silhouette', () => {
    const sweep = windup('sweep'),
      slam = windup('slam'),
      charge = windup('charge'),
      rain = windup('rain');
    expect(sweep.lean!).toBeLessThan(0);
    expect(sweep.raise).toBeCloseTo(1);
    expect(slam.lift!).toBeGreaterThan(0.5);
    expect(slam.squash!).toBeLessThan(0);
    expect(charge.lean!).toBeGreaterThan(0.25);
    expect(charge.squash!).toBeGreaterThan(0.15);
    expect(rain.lift!).toBeGreaterThan(slam.lift!);
  });
  it('rises from a crouch during its introduction', () => {
    const start = bossPose({ state: 'intro', timer: 0, kind: 'sweep', windup: 1, recover: 1 });
    const end = bossPose({ state: 'intro', timer: 2.2, kind: 'sweep', windup: 1, recover: 1 });
    expect(start.pose.squash!).toBeGreaterThan(0.35);
    expect(end.pose.squash).toBeCloseTo(0);
    expect(end.pose.raise).toBeCloseTo(1);
  });
  it('gives the Act II patterns their own silhouettes', () => {
    const pose = (kind: PatternKind, state: 'windup' | 'attack', timer: number) =>
      bossPose({ state, timer, kind, windup: 1, recover: 1 }).pose;
    // The volley draws back, the blink folds inward, the nova stamps once per wave.
    expect(pose('volley', 'windup', 1).lean!).toBeLessThan(-0.2);
    expect(pose('blink', 'windup', 1).squash!).toBeGreaterThan(0.25);
    const stamp = pose('nova', 'attack', 0).squash!;
    expect(stamp).toBeGreaterThan(0.2);
    expect(pose('nova', 'attack', NOVA_INTERVAL).squash!).toBeCloseTo(stamp);
    expect(pose('nova', 'attack', NOVA_INTERVAL * 0.9).squash!).toBeLessThan(0.05);
  });
  it('gives each signature ability its own silhouette', () => {
    const pose = (kind: PatternKind, state: 'windup' | 'attack', timer: number) =>
      bossPose({ state, timer, kind, windup: 1, recover: 1 }).pose;
    // The standard is heaved overhead, the command stands tall and still, the eruption
    // and the bound coil low, the mirror shimmers.
    expect(pose('standard', 'windup', 1).raise).toBeCloseTo(1);
    expect(pose('command', 'windup', 1).squash!).toBeLessThan(-0.1);
    expect(pose('command', 'attack', 0.5).tremble!).toBeLessThan(0.02);
    expect(pose('eruption', 'windup', 1).squash!).toBeGreaterThan(0.2);
    expect(pose('leap', 'windup', 1).squash!).toBeGreaterThan(
      pose('eruption', 'windup', 1).squash!,
    );
    expect(pose('mirror', 'windup', 1).tremble!).toBeGreaterThan(0.03);
    const silhouettes = (['standard', 'command', 'eruption', 'leap', 'mirror'] as const).map(
      (kind) => JSON.stringify(pose(kind, 'windup', 1)),
    );
    expect(new Set(silhouettes).size).toBe(5);
  });
  it('keeps every pose within readable bounds', () => {
    for (const pattern of bossRoster.flatMap((b) => b.patterns))
      for (const state of ['intro', 'windup', 'attack', 'recover', 'transition'] as const)
        for (const timer of [0, 0.1, 0.3, 0.7, 1.5, 3]) {
          const { pose, attack } = bossPose({
            state,
            timer,
            kind: pattern.kind,
            windup: pattern.windup,
            recover: pattern.recover,
          });
          expect(Math.abs(pose.lean ?? 0)).toBeLessThan(0.6);
          expect(pose.lift ?? 0).toBeLessThanOrEqual(1.3);
          expect(Math.abs(pose.squash ?? 0)).toBeLessThanOrEqual(0.45);
          expect(attack).toBeGreaterThanOrEqual(0);
          expect(attack).toBeLessThanOrEqual(0.32);
        }
  });
});

describe('boss gaits', () => {
  const at = (movement: 'march' | 'hover' | 'leap' | 'glide', timer: number, time = 0) =>
    gaitPose({ movement, state: 'approach', timer, time });
  it('marches in heavy steps, sinking on each footfall', () => {
    const footfall = at('march', 0).pose,
      stride = at('march', 0.5 / 1.4).pose;
    expect(footfall.squash!).toBeGreaterThan(stride.squash!);
    expect(stride.lean!).toBeGreaterThan(footfall.lean!);
    // Nothing moves when it stands still.
    expect(gaitPose({ movement: 'march', state: 'windup', timer: 0.2, time: 0 }).pose).toEqual({});
  });
  it('hovers and glides above the floor, the Guardian higher', () => {
    for (const time of [0, 0.7, 1.9]) {
      expect(at('hover', 0, time).pose.lift!).toBeGreaterThan(0.25);
      expect(at('glide', 0, time).pose.lift!).toBeGreaterThan(0.1);
      expect(at('hover', 0, time).pose.lift!).toBeGreaterThan(at('glide', 0, time).pose.lift!);
    }
    // Still afloat while it strikes; grounded once dead.
    expect(
      gaitPose({ movement: 'hover', state: 'attack', timer: 0, time: 0 }).pose.lift!,
    ).toBeGreaterThan(0.25);
    expect(gaitPose({ movement: 'hover', state: 'dead', timer: 0, time: 0 }).pose).toEqual({});
  });
  it('bounds towards Eidra, and arcs high over a leap', () => {
    expect(at('leap', 0.2).pose.lift!).toBeGreaterThan(0.5);
    expect(at('leap', 0.6).pose.lift ?? 0).toBe(0);
    expect(at('leap', 0.6).pose.squash!).toBeGreaterThan(0);
    const flight = (leap: number) =>
      gaitPose({ movement: 'leap', state: 'attack', timer: 0, time: 0, leap }).pose.lift!;
    expect(flight(0.5)).toBeGreaterThan(4);
    expect(flight(0)).toBeCloseTo(0);
    expect(flight(1)).toBeCloseTo(0);
  });
  it('adds up with the key pose instead of replacing it', () => {
    const merged = withGait({ lift: 0.5, raise: 1, squash: 0.1 }, { lift: 0.4, squash: -0.05 });
    expect(merged.lift).toBeCloseTo(0.9);
    expect(merged.squash).toBeCloseTo(0.05);
    expect(merged.raise).toBe(1);
  });
});

describe('hero key poses', () => {
  it('leans into dashes and swings, peaking mid-swing', () => {
    expect(heroPose({ attackTime: 0, attackKind: 'light', dashing: true }).lean).toBeGreaterThan(
      0.3,
    );
    expect(heroPose({ attackTime: 0, attackKind: 'light', dashing: false })).toEqual({});
    const mid = heroPose({ attackTime: 0.16, attackKind: 'light', dashing: false });
    const edge = heroPose({ attackTime: 0.31, attackKind: 'light', dashing: false });
    expect(mid.lean!).toBeGreaterThan(edge.lean!);
    const down = heroPose({ attackTime: 0.16, attackKind: 'down', dashing: false });
    expect(down.lean!).toBeGreaterThan(mid.lean!);
  });
  it('sweeps the staff overhead for a strike upwards, leaning back', () => {
    const start = heroPose({ attackTime: 0.32, attackKind: 'up', dashing: false });
    const blow = heroPose({ attackTime: 0.2, attackKind: 'up', dashing: false });
    // From behind her shoulder, over the crown (0 is upright), forward.
    expect(start.swing!).toBeGreaterThan(1);
    expect(Math.abs(blow.swing!)).toBeLessThan(0.6);
    expect(blow.lean!).toBeLessThan(0);
    expect(blow.lift!).toBeGreaterThan(0);
  });
});
