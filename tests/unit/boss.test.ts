import { describe, it, expect } from 'vitest';
import { BossDirector, COMBO_HASTE, NOVA_INTERVAL } from '../../src/bosses/BossDirector';
import { EnemyManager } from '../../src/enemies/EnemyManager';
import { makeCombatant } from '../../src/combat/CombatSystem';
import { guardianData } from '../../game-data/bosses/guardian';
import { ilyraData } from '../../game-data/bosses/ilyra';
import { bossRoster } from '../../game-data/bosses/roster';
import { BossSchema } from '../../game-data/bosses/schema';
import type { BossData } from '../../game-data/bosses/schema';
import { arenas } from '../../game-data/zones/laboratory';
const full = guardianData.health;
/** Health just inside each phase of the Guardian. */
const phaseHealth = [full, full * guardianData.phases[0]! - 1, full * guardianData.phases[1]! - 1];
const BOUNDS: [number, number] = [165, 195];
/** A director past its introduction, in the given phase. */
function awake(data: BossData = guardianData, phase = 1): BossDirector {
  const b = new BossDirector(data, BOUNDS);
  b.activate();
  b.phase = phase;
  b.update(data.intro + 0.05, data.health, 2, -1);
  return b;
}
function toWindup(b: BossDirector, health: number, playerX = 180, direction = -1): void {
  for (let i = 0; i < 400 && b.state !== 'windup'; i++)
    b.update(0.05, health, 2, direction, 0, playerX);
}
/** Steps until the current attack ends; returns the (pattern, state) sequence. */
function run(b: BossDirector, health: number, seconds: number, playerX = 180): string[] {
  const seen: string[] = [];
  for (let t = 0; t < seconds; t += 0.02) {
    b.update(0.02, health, 2, -1, 0, playerX);
    const step = `${b.pattern.id}:${b.state}`;
    if (seen.at(-1) !== step) seen.push(step);
  }
  return seen;
}
describe('boss data', () => {
  it('validates every boss of the roster against an existing arena', () => {
    expect(bossRoster.map((b) => b.id)).toEqual([
      'keeper',
      'faceless-guardian',
      'cinder-warden',
      'ilyra',
    ]);
    for (const boss of bossRoster)
      expect(arenas.some((a) => a.id === boss.arena && a.guardian === boss.id)).toBe(true);
    // Each act closes on its longest fight, in three phases.
    const [keeper, guardian, warden, ilyra] = bossRoster.map((b) => b.health);
    expect(keeper!).toBeLessThan(guardian!);
    expect(warden!).toBeLessThan(ilyra!);
    expect(guardian!).toBeLessThan(ilyra!);
    expect(guardianData.phases).toHaveLength(2);
    expect(ilyraData.phases).toHaveLength(2);
  });
  it('rejects inconsistent phases and combos', () => {
    expect(BossSchema.safeParse({ ...guardianData, haste: [1, 0.8] }).success).toBe(false);
    expect(BossSchema.safeParse({ ...guardianData, phases: [0.3, 0.6] }).success).toBe(false);
    const orphan = guardianData.patterns.map((p) => ({
      ...p,
      combo: { pattern: 'nope', phase: 1 },
    }));
    expect(BossSchema.safeParse({ ...guardianData, patterns: orphan }).success).toBe(false);
    // The first phase must have something to do.
    const late = guardianData.patterns.map((p) => ({ ...p, phase: 2 }));
    expect(BossSchema.safeParse({ ...guardianData, patterns: late }).success).toBe(false);
    // Pattern ids name one pattern each; lasting abilities need a duration.
    const twins = [...guardianData.patterns, guardianData.patterns[0]!];
    expect(BossSchema.safeParse({ ...guardianData, patterns: twins }).success).toBe(false);
    const endless = guardianData.patterns.map((p) =>
      p.kind === 'command' ? { ...p, kind: 'mirror' } : p,
    );
    expect(BossSchema.safeParse({ ...guardianData, patterns: endless }).success).toBe(false);
  });
});
describe('Faceless Guardian director', () => {
  it('is armored during the introduction and each phase transition', () => {
    const b = new BossDirector(guardianData, BOUNDS);
    b.activate();
    expect(b.armored).toBe(true);
    b.update(guardianData.intro + 0.1, full, 2, -1);
    b.update(0.1, full, 2, -1);
    expect(b.armored).toBe(false);
    for (const phase of [2, 3]) {
      b.update(0.1, phaseHealth[phase - 1]!, 2, -1);
      expect(b.state).toBe('transition');
      expect(b.phase).toBe(phase);
      expect(b.armored).toBe(true);
      // Stagger does not interrupt the roar.
      b.update(0.5, phaseHealth[phase - 1]!, 2, -1, 1);
      expect(b.state).toBe('transition');
      b.update(guardianData.transition, phaseHealth[phase - 1]!, 2, -1);
      expect(b.state).toBe('approach');
    }
  });
  it('widens its rotation with each phase', () => {
    const ids = (phase: number) => {
      const b = new BossDirector(guardianData, BOUNDS);
      b.phase = phase;
      return b.cycle().map((p) => p.id);
    };
    expect(ids(1)).toEqual(['sweep', 'slam', 'charge']);
    expect(ids(2)).toEqual(['sweep', 'slam', 'charge', 'rain', 'command']);
    expect(ids(3)).toEqual(['sweep', 'slam', 'charge', 'rain', 'command', 'blink', 'nova']);
  });
  it('shortens its telegraphs as the fight goes on', () => {
    const windups = [1, 2, 3].map((phase) => {
      const b = awake(guardianData, phase);
      b.select('sweep');
      toWindup(b, phaseHealth[phase - 1]!);
      return b.windup;
    });
    expect(windups[1]).toBeLessThan(windups[0]!);
    expect(windups[2]).toBeLessThan(windups[1]!);
    // Still readable: never under half a second for a fresh pattern.
    expect(windups[2]).toBeGreaterThan(0.5);
  });
  it('recovers after a sweep in phase one but chains a charge from phase two', () => {
    const one = awake(guardianData, 1);
    one.select('sweep');
    expect(run(one, full, 2.2).slice(0, 3)).toEqual([
      'sweep:windup',
      'sweep:attack',
      'sweep:recover',
    ]);
    const two = awake(guardianData, 2);
    two.select('sweep');
    const steps = run(two, phaseHealth[1]!, 2.8);
    expect(steps.slice(0, 4)).toEqual([
      'sweep:windup',
      'sweep:attack',
      'charge:windup',
      'charge:attack',
    ]);
    expect(steps).toContain('charge:recover');
  });
  it('winds up chained follow-ups faster than fresh patterns', () => {
    const b = awake(guardianData, 2);
    b.select('sweep');
    run(b, phaseHealth[1]!, 1.2);
    expect(b.pattern.id).toBe('charge');
    expect(b.state).toBe('windup');
    expect(b.chain).toBe(1);
    const charge = guardianData.patterns.find((p) => p.id === 'charge')!;
    expect(b.windup).toBeCloseTo(charge.windup * guardianData.haste[1]! * COMBO_HASTE);
  });
  it('blinks behind Eidra, then cuts at once in phase three', () => {
    const b = awake(guardianData, 3);
    b.select('blink');
    toWindup(b, phaseHealth[2]!, 180, -1);
    // Coming from the right, it reappears on her left.
    expect(b.targets).toHaveLength(1);
    const blink = guardianData.patterns.find((p) => p.id === 'blink')!;
    expect(b.targets[0]).toBeCloseTo(180 - blink.range);
    const steps = run(b, phaseHealth[2]!, 2.4);
    expect(steps.slice(0, 3)).toEqual(['blink:windup', 'blink:attack', 'sweep:windup']);
  });
  it('blinks to the near side when a wall stands behind Eidra', () => {
    const b = awake(guardianData, 3);
    b.select('blink');
    toWindup(b, phaseHealth[2]!, BOUNDS[0] + 1, -1);
    expect(b.targets[0]).toBeGreaterThan(BOUNDS[0] + 1);
    expect(b.targets[0]).toBeLessThanOrEqual(BOUNDS[1]);
  });
  it('releases the waves of a nova in rhythm', () => {
    const b = awake(guardianData, 3);
    b.select('nova');
    toWindup(b, phaseHealth[2]!);
    const beats: number[] = [];
    let t = 0;
    for (let i = 0; i < 400 && b.state !== 'recover'; i++) {
      b.update(0.01, phaseHealth[2]!, 2, -1);
      t += 0.01;
      if (b.trigger) beats.push(t);
    }
    expect(beats).toHaveLength(3);
    expect(beats[1]! - beats[0]!).toBeCloseTo(NOVA_INTERVAL, 1);
    expect(beats[2]! - beats[1]!).toBeCloseTo(NOVA_INTERVAL, 1);
  });
  it('marks the ground for the shard rain inside the arena', () => {
    const b = awake(guardianData, 2);
    b.select('rain');
    toWindup(b, phaseHealth[1]!, 194);
    expect(b.pattern.id).toBe('rain');
    expect(b.targets).toHaveLength(5);
    expect(Math.max(...b.targets)).toBeLessThanOrEqual(BOUNDS[1]);
    expect(new Set(b.targets).size).toBeGreaterThan(2);
  });
  it('breaks a combo when staggered', () => {
    const b = awake(guardianData, 2);
    b.select('sweep');
    run(b, phaseHealth[1]!, 1.2);
    expect(b.chain).toBe(1);
    b.update(0.02, phaseHealth[1]!, 2, -1, 0.3);
    expect(b.state).toBe('recover');
    expect(b.chain).toBe(0);
  });
});
describe('Ilyra director', () => {
  it('comes back with a second charge from phase two', () => {
    const b = awake(ilyraData, 2);
    b.select('mirror');
    const health = ilyraData.health * ilyraData.phases[0]! - 1;
    toWindup(b, health, 380, -1);
    const first = b.direction;
    // Once through, Eidra is behind her: the follow-up charges the other way.
    for (let i = 0; i < 200 && b.pattern.id !== 'mirror-back'; i++)
      b.update(0.02, health, 2, 1, 0, 380);
    expect(b.pattern.id).toBe('mirror-back');
    expect(b.direction).toBe(-first);
  });
  it('never picks a follow-up from its rotation', () => {
    for (const phase of [1, 2, 3]) {
      const b = new BossDirector(ilyraData, BOUNDS);
      b.phase = phase;
      expect(b.cycle().some((p) => p.followUp)).toBe(false);
    }
  });
});
describe('boss blows in the enemy manager', () => {
  it('drops rain shards on the marked positions', () => {
    const m = new EnemyManager();
    const player = makeCombatant('eidra', 100, 180, 1);
    const guardian = m.encounter('faceless-guardian')!;
    guardian.director.activate();
    guardian.director.phase = 2;
    guardian.director.select('rain');
    guardian.actor.health = phaseHealth[1]!;
    let spawned: number[] = [];
    for (let i = 0; i < 600 && spawned.length === 0; i++) {
      m.update(1 / 60, player, () => undefined);
      if (guardian.director.trigger) spawned = m.projectiles.map((p) => p.x);
    }
    expect(spawned.length).toBe(5);
    expect(m.projectiles.every((p) => p.vy < 0 && p.y > 5)).toBe(true);
  });
  it('moves the Guardian to its blink mark', () => {
    const m = new EnemyManager();
    const player = makeCombatant('eidra', 100, 180, 1);
    player.invulnerable = 99;
    const guardian = m.encounter('faceless-guardian')!;
    guardian.director.activate();
    guardian.director.phase = 3;
    guardian.director.select('blink');
    guardian.actor.health = phaseHealth[2]!;
    let landed = Number.NaN;
    for (let i = 0; i < 600 && Number.isNaN(landed); i++) {
      m.update(1 / 60, player, () => undefined);
      if (guardian.director.trigger && guardian.director.pattern.kind === 'blink')
        landed = guardian.actor.x;
    }
    // It came from the right: it lands on Eidra's left, and turns to face her.
    expect(landed).toBeLessThan(player.x);
    expect(guardian.director.direction).toBe(1);
  });
  it('fans Ilyra’s veil of shards towards Eidra', () => {
    const m = new EnemyManager();
    const player = makeCombatant('eidra', 100, 385, 1);
    const ilyra = m.encounter('ilyra')!;
    ilyra.director.activate();
    ilyra.director.select('veil');
    let shards: { vx: number; vy: number }[] = [];
    for (let i = 0; i < 900 && shards.length === 0; i++) {
      m.update(1 / 60, player, () => undefined);
      if (ilyra.director.trigger) shards = m.projectiles.map((p) => ({ vx: p.vx, vy: p.vy }));
    }
    expect(shards).toHaveLength(3);
    expect(shards.every((s) => s.vx < 0)).toBe(true);
    expect(new Set(shards.map((s) => s.vy.toFixed(2))).size).toBe(3);
  });
  it('leaves a boss asleep while Eidra is far from its arena', () => {
    const m = new EnemyManager();
    const player = makeCombatant('eidra', 100, 180, 1);
    for (let i = 0; i < 60; i++) m.update(1 / 60, player, () => undefined);
    expect(m.encounter('faceless-guardian')!.director.state).not.toBe('dormant');
    expect(m.encounter('ilyra')!.director.state).toBe('dormant');
  });
});
