import { describe, expect, it } from 'vitest';
import { bossPose, enemyPose, heroPose } from '../../src/animation/Poses';
import type { EnemyPoseInput } from '../../src/animation/Poses';
import type { EnemyState } from '../../src/ai/EnemyFSM';
import { enemyData } from '../../game-data/enemies/roster';
import { guardianData } from '../../game-data/bosses/guardian';
import { ilyraData } from '../../game-data/bosses/ilyra';
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
  it('keeps every pose within readable bounds', () => {
    for (const pattern of [...guardianData.patterns, ...ilyraData.patterns])
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
});
