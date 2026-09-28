import { describe, it, expect } from 'vitest';
import { BossDirector } from '../../src/bosses/BossDirector';
import { EnemyManager } from '../../src/enemies/EnemyManager';
import { makeCombatant } from '../../src/combat/CombatSystem';
import { guardianData } from '../../game-data/bosses/guardian';
const full = guardianData.health;
const half = full * guardianData.phaseThreshold - 1;
function toWindup(b: BossDirector, health: number, playerX = 180): void {
  for (let i = 0; i < 400 && b.state !== 'windup'; i++) b.update(0.05, health, 2, -1, 0, playerX);
}
describe('Faceless Guardian director', () => {
  it('is armored during the introduction and the phase transition', () => {
    const b = new BossDirector();
    b.activate();
    expect(b.armored).toBe(true);
    b.update(2.3, full, 2, -1);
    b.update(0.1, full, 2, -1);
    expect(b.armored).toBe(false);
    b.update(0.1, half, 2, -1);
    expect(b.state).toBe('transition');
    expect(b.phase).toBe(2);
    expect(b.armored).toBe(true);
    // Stagger does not interrupt the roar.
    b.update(0.5, half, 2, -1, 1);
    expect(b.state).toBe('transition');
    b.update(guardianData.transition, half, 2, -1);
    expect(b.state).toBe('approach');
  });
  it('adds the shard rain to the rotation only in phase two', () => {
    const phaseOne = new BossDirector();
    phaseOne.activate();
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      phaseOne.patternIndex = i;
      seen.add(phaseOne.pattern.id);
    }
    expect(seen.has('rain')).toBe(false);
    const b = new BossDirector();
    b.activate();
    b.phase = 2;
    b.patternIndex = guardianData.patterns.findIndex((p) => p.id === 'rain');
    b.update(2.3, half, 2, -1, 0, 196);
    toWindup(b, half, 196);
    expect(b.pattern.id).toBe('rain');
    expect(b.targets).toHaveLength(5);
    expect(Math.max(...b.targets)).toBeLessThanOrEqual(197);
    expect(new Set(b.targets).size).toBeGreaterThan(2);
  });
  it('drops rain shards on the marked positions', () => {
    const m = new EnemyManager();
    const player = makeCombatant('eidra', 100, 180, 1);
    m.director.activate();
    m.director.phase = 2;
    m.director.patternIndex = guardianData.patterns.findIndex((p) => p.id === 'rain');
    m.boss.health = half;
    let spawned: number[] = [];
    for (let i = 0; i < 600 && spawned.length === 0; i++) {
      m.update(1 / 60, player, () => undefined);
      if (m.director.trigger) spawned = m.projectiles.map((p) => p.x);
    }
    expect(spawned.length).toBe(5);
    expect(m.projectiles.every((p) => p.vy < 0 && p.y > 5)).toBe(true);
  });
});
