import { describe, it, expect } from 'vitest';
import {
  CombatSystem,
  DamageSystem,
  makeCombatant,
  HurtboxSystem,
} from '../../src/combat/CombatSystem';
import { EnemyFSM } from '../../src/ai/EnemyFSM';
import { BossDirector } from '../../src/bosses/BossDirector';
import { enemyData } from '../../game-data/enemies/roster';
const hit = { x: 1, y: 1, width: 2, height: 2, damage: 12, stagger: 0.2, force: 2, direction: 1 };
describe('Combat', () => {
  it('caps damage, protects invulnerability and rejects invalid damage', () => {
    const a = makeCombatant('a', 20);
    const d = new DamageSystem();
    expect(d.apply(a, hit)).toBe(12);
    expect(d.apply(a, hit)).toBe(0);
    a.invulnerable = 0;
    expect(d.apply(a, { ...hit, damage: NaN })).toBe(0);
    expect(d.apply(a, hit)).toBe(8);
    expect(a.health).toBe(0);
  });
  it('hitboxes are spatial and each swing hits a target once', () => {
    const c = new CombatSystem();
    const a = makeCombatant('a', 20, 1, 1);
    expect(c.hitboxes.test(hit, a)).toBe(true);
    expect(c.hitboxes.test(hit, a)).toBe(false);
    expect(new HurtboxSystem().overlaps({ ...hit, x: 10 }, a)).toBe(false);
    c.hitboxes.reset();
    expect(c.hitboxes.test(hit, a)).toBe(true);
  });
  it('attack windup, active window, combo and recovery are distinct', () => {
    const c = new CombatSystem();
    c.begin('light');
    expect(c.active).toBe(false);
    c.update(0.1, []);
    expect(c.active).toBe(true);
    expect(c.begin('charged')).toBe(false);
    c.update(0.25, []);
    expect(c.active).toBe(false);
    c.begin('light');
    expect(c.comboIndex).toBe(2);
  });
  it('parry has a narrow window and staggers once', () => {
    const c = new CombatSystem();
    const a = makeCombatant('a', 20);
    c.parry.start();
    expect(c.parry.tryParry(a)).toBe(true);
    expect(a.stagger).toBeGreaterThan(1);
    expect(c.parry.tryParry(a)).toBe(false);
  });
});
describe('Deterministic opponents', () => {
  it('telegraphs before attacking and recovers', () => {
    const f = new EnemyFSM(enemyData.watcher);
    const b = { distance: 1, homeDistance: 0, health: 36, stagger: 0 };
    f.update(0.1, b);
    expect(f.state).toBe('DETECT');
    f.update(0.3, b);
    f.update(0.01, b);
    expect(f.state).toBe('ALERT');
    f.update(0.5, b);
    expect(f.attackTriggered).toBe(false);
    f.update(0.3, b);
    expect(f.attackTriggered).toBe(true);
    f.update(0.3, b);
    expect(f.state).toBe('RECOVER');
    f.update(0.1, { ...b, health: 0 });
    expect(f.state).toBe('DEAD');
  });
  it('boss patterns cycle and phase two preserves telegraphy', () => {
    const b = new BossDirector();
    b.activate();
    b.update(2.3, 320, 2, -1);
    b.update(0.1, 320, 2, -1);
    expect(b.state).toBe('windup');
    b.update(1.2, 320, 2, -1);
    expect(b.trigger).toBe(true);
    b.update(0.3, 100, 2, -1);
    expect(b.phase).toBe(2);
    b.update(2, 100, 2, -1);
    expect(b.pattern.id).toBe('slam');
  });
});
