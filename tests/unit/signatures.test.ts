import { describe, it, expect } from 'vitest';
import {
  EnemyManager,
  GAZE_TOLERANCE,
  REFLECTION_SHOT,
  STANDARD_INTERVAL,
  gaitStride,
} from '../../src/enemies/EnemyManager';
import type { BossEncounter } from '../../src/enemies/EnemyManager';
import { makeCombatant } from '../../src/combat/CombatSystem';
import type { Combatant, Hitbox } from '../../src/combat/CombatSystem';
import { bossRoster } from '../../game-data/bosses/roster';
import { guardianData } from '../../game-data/bosses/guardian';
import { ilyraData } from '../../game-data/bosses/ilyra';
const DT = 1 / 60;
/** A boss woken in the given phase, about to use `pattern`. */
function wake(m: EnemyManager, id: string, pattern: string, phase = 1): BossEncounter {
  const encounter = m.encounter(id)!;
  const data = encounter.data;
  encounter.director.activate();
  encounter.director.phase = phase;
  encounter.actor.health = phase === 1 ? data.health : data.health * data.phases[phase - 2]! - 1;
  encounter.director.select(pattern);
  return encounter;
}
/** Steps the fight until `done`, or fails after `steps` frames. */
function until(
  m: EnemyManager,
  player: Combatant,
  done: () => boolean,
  onAttack: (hit: Hitbox, source: Combatant) => void = () => undefined,
  steps = 1200,
): void {
  for (let i = 0; i < steps; i++) {
    m.update(DT, player, onAttack);
    if (done()) return;
  }
  throw new Error('condition never met');
}
describe('boss identities', () => {
  it('gives each boss its own signature ability and way of moving', () => {
    const signatures = bossRoster.map(
      (b) =>
        b.patterns.find((p) => ['standard', 'command', 'leap', 'mirror'].includes(p.kind))!.kind,
    );
    expect(signatures).toEqual(['standard', 'command', 'leap', 'mirror']);
    expect(bossRoster.map((b) => b.movement)).toEqual(['march', 'hover', 'leap', 'glide']);
    // The Sentinelle's bound is backed by a line of geysers.
    expect(bossRoster[2]!.patterns.some((p) => p.kind === 'eruption')).toBe(true);
  });
  it('paces each gait differently', () => {
    const samples = (movement: 'march' | 'hover' | 'leap' | 'glide'): number[] =>
      Array.from({ length: 40 }, (_, i) => gaitStride(movement, i * 0.05));
    // Heavy steps: surges and near stops.
    expect(Math.min(...samples('march'))).toBeLessThan(0.5);
    expect(Math.max(...samples('march'))).toBeGreaterThan(1.4);
    // Bounds: fast in the air, a pause on landing.
    expect(new Set(samples('leap'))).toEqual(new Set([2, 0.15]));
    expect(new Set(samples('hover'))).toEqual(new Set([1]));
    expect(new Set(samples('glide'))).toEqual(new Set([1]));
  });
});
describe('Keeper: the standard', () => {
  it('plants a banner that sends waves both ways until it falls', () => {
    const m = new EnemyManager();
    const player = makeCombatant('eidra', 100, 151, 1);
    const keeper = wake(m, 'keeper', 'standard');
    until(m, player, () => keeper.standard !== null);
    const planted = keeper.standard!.x;
    const pattern = keeper.data.patterns.find((p) => p.id === 'standard')!;
    // The first pulse leaves at once, from the banner.
    expect(m.projectiles.filter((p) => p.vy === 0).map((p) => Math.sign(p.vx))).toEqual([-1, 1]);
    expect(m.projectiles.every((p) => Math.abs(p.x - planted) < 0.2 && p.y < 1)).toBe(true);
    let pulses = 1;
    until(m, player, () => {
      if (keeper.pulsed) pulses++;
      return keeper.standard === null;
    });
    expect(pulses).toBe(Math.ceil(pattern.duration! / STANDARD_INTERVAL));
  });
  it('stays planted while its bearer fights on, and falls with the reset', () => {
    const m = new EnemyManager();
    const player = makeCombatant('eidra', 100, 151, 1);
    const keeper = wake(m, 'keeper', 'standard');
    until(m, player, () => keeper.standard !== null);
    const planted = keeper.standard!.x;
    player.x = 156;
    until(m, player, () => Math.abs(keeper.actor.x - planted) > 1.5);
    expect(keeper.standard?.x).toBe(planted);
    keeper.reset();
    expect(keeper.standard).toBeNull();
  });
});
describe('Faceless Guardian: the command', () => {
  function command(): { m: EnemyManager; guardian: BossEncounter; player: Combatant } {
    const m = new EnemyManager();
    const player = makeCombatant('eidra', 100, 180, 1);
    const guardian = wake(m, 'faceless-guardian', 'command', 2);
    until(m, player, () => guardian.gaze !== null);
    return { m, guardian, player };
  }
  const shard = (m: EnemyManager) => m.projectiles.find((p) => p.vy < -20);
  it('spares Eidra when she stays still', () => {
    const { m, guardian, player } = command();
    until(m, player, () => guardian.director.state !== 'attack');
    expect(shard(m)).toBeUndefined();
    expect(guardian.punished).toBe(0);
  });
  it('drops a shard on her as soon as she moves under its gaze', () => {
    const { m, guardian, player } = command();
    player.x += GAZE_TOLERANCE + 0.2;
    until(m, player, () => shard(m) !== undefined);
    const falling = shard(m)!;
    expect(falling.x).toBe(player.x);
    expect(falling.y).toBeGreaterThan(player.y + 5);
    expect(guardian.punished).toBeGreaterThan(0);
    expect(guardianData.patterns.find((p) => p.kind === 'command')!.phase).toBe(2);
  });
});
describe('Sentinelle de cendre: bound and eruption', () => {
  it('bounds onto the mark where Eidra stood, and lands with waves', () => {
    const m = new EnemyManager();
    const player = makeCombatant('eidra', 100, 336, 1);
    const warden = wake(m, 'cinder-warden', 'pounce');
    until(m, player, () => warden.director.state === 'windup');
    const mark = warden.director.targets[0]!;
    expect(mark).toBe(336);
    // Eidra leaves the mark during the windup.
    player.x = 331;
    const hits: Hitbox[] = [];
    until(m, player, () => warden.leap !== null);
    until(
      m,
      player,
      () => warden.leap === null,
      (hit) => hits.push(hit),
    );
    expect(warden.actor.x).toBeCloseTo(mark, 5);
    // In the air, no contact; on landing, a crushing blow on the mark and two waves.
    const impact = hits.find((h) => !h.unblockable)!;
    expect(impact.x).toBeCloseTo(mark, 5);
    expect(Math.abs(player.x - impact.x)).toBeGreaterThan(impact.width / 2);
    expect(m.projectiles.filter((p) => p.vy === 0).map((p) => Math.sign(p.vx))).toEqual([-1, 1]);
  });
  it('lights a line of geysers racing towards Eidra, each burning her once', () => {
    const m = new EnemyManager();
    const player = makeCombatant('eidra', 100, 340, 1);
    player.invulnerable = 99;
    const warden = wake(m, 'cinder-warden', 'eruption');
    until(m, player, () => warden.director.state === 'windup');
    const line = [...warden.director.targets];
    const from = warden.actor.x;
    expect(line.length).toBeGreaterThan(2);
    // Racing from the Sentinelle towards Eidra, one after the other.
    expect(line.every((x, i) => i === 0 || x < line[i - 1]!)).toBe(true);
    expect(line[0]!).toBeLessThan(from);
    player.x = line[1]!;
    const burns: Hitbox[] = [];
    const lit = new Set<number>();
    until(
      m,
      player,
      () => {
        for (const g of warden.geysers) lit.add(g.x);
        return warden.director.state === 'recover';
      },
      (hit, source) => {
        if (source === warden.actor && hit.unblockable && hit.height === 3) burns.push(hit);
      },
    );
    expect([...lit]).toEqual(line);
    expect(burns).toHaveLength(1);
  });
});
describe('Ilyra: the reflections', () => {
  function mirror(): { m: EnemyManager; ilyra: BossEncounter; player: Combatant } {
    const m = new EnemyManager();
    const player = makeCombatant('eidra', 100, 380, 1);
    player.invulnerable = 99;
    const ilyra = wake(m, 'ilyra', 'reflections', 2);
    until(m, player, () => ilyra.reflections.length > 0);
    return { m, ilyra, player };
  }
  it('splits into reflections that share her places and join the fight', () => {
    const { m, ilyra } = mirror();
    const places = [ilyra.actor.x, ...ilyra.reflections.map((r) => r.actor.x)].sort();
    expect(places).toEqual([...ilyra.mirrorSlots()].sort());
    const reflections = ilyra.reflections.map((r) => r.actor);
    expect(reflections).toHaveLength(ilyraData.patterns.find((p) => p.kind === 'mirror')!.count);
    for (const r of reflections) expect(m.actors).toContain(r);
  });
  it('holds the true body still among them, and the reflections shoot', () => {
    const { m, ilyra, player } = mirror();
    const x = ilyra.actor.x;
    const before = m.projectiles.length;
    for (let i = 0; i < (REFLECTION_SHOT + 1) * 60; i++) m.update(DT, player, () => undefined);
    expect(ilyra.actor.x).toBe(x);
    expect(m.projectiles.length).toBeGreaterThan(before);
  });
  it('shatters a reflection in one blow, and dispels them all when the true one is struck', () => {
    const { m, ilyra, player } = mirror();
    ilyra.reflections[0]!.actor.health = 0;
    m.update(DT, player, () => undefined);
    expect(ilyra.reflections).toHaveLength(1);
    ilyra.actor.health -= 10;
    m.update(DT, player, () => undefined);
    expect(ilyra.reflections).toHaveLength(0);
  });
  it('lets them fade after a while, and takes another place the next time', () => {
    const { m, ilyra, player } = mirror();
    const first = ilyra.actor.x;
    until(m, player, () => ilyra.reflections.length === 0, undefined, 60 * 12);
    ilyra.director.select('reflections');
    until(m, player, () => ilyra.reflections.length > 0, undefined, 60 * 20);
    expect(ilyra.actor.x).not.toBe(first);
    ilyra.reset();
    expect(ilyra.reflections).toHaveLength(0);
  });
});
