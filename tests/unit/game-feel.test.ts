import { describe, it, expect } from 'vitest';
import { CombatSystem, HitStop, makeCombatant } from '../../src/combat/CombatSystem';
import { MovementModel } from '../../src/player/MovementModel';
import { FocusSystem } from '../../src/abilities/FocusSystem';
import { Inventory } from '../../src/inventory/Inventory';
import { focusData } from '../../game-data/abilities/abilities';
import { offeringData } from '../../game-data/items/offerings';
const idle = { axis: 0, jump: false, jumpHeld: false, dash: false, walk: false };
describe('Hit-stop', () => {
  it('freezes whole steps, keeps the longest request and caps its duration', () => {
    const stop = new HitStop();
    expect(stop.freeze(1 / 60)).toBe(false);
    stop.trigger(0.05);
    stop.trigger(0.02);
    expect(stop.remaining).toBe(0.05);
    let frozen = 0;
    while (stop.freeze(1 / 60)) frozen++;
    expect(frozen).toBe(3);
    stop.trigger(5);
    expect(stop.remaining).toBe(0.2);
    stop.reset();
    stop.trigger(Number.NaN);
    stop.trigger(-1);
    expect(stop.remaining).toBe(0);
  });
});
describe('Attack buffering', () => {
  it('keeps a press made during recovery and fires it once the swing is ready', () => {
    const c = new CombatSystem();
    expect(c.begin('light')).toBe(true);
    c.update(0.2, []);
    c.attackBuffer.press();
    expect(c.attackBuffer.take(c.cooldown === 0)).toBe(false);
    c.update(0.13, []);
    expect(c.cooldown).toBe(0);
    expect(c.attackBuffer.take(c.cooldown === 0)).toBe(true);
    expect(c.attackBuffer.take(true)).toBe(false);
    c.attackBuffer.press();
    c.update(0.3, []);
    expect(c.attackBuffer.take(true)).toBe(false);
  });
});
describe('Riposte and downward strike', () => {
  it('a successful parry empowers only the next swing, within one second', () => {
    const c = new CombatSystem();
    const attacker = makeCombatant('watcher', 30);
    const eidra = makeCombatant('eidra', 100, 0, 1);
    const base = (c.begin('light'), c.strike(eidra, 1).damage);
    c.update(1, []);
    c.parry.start();
    expect(c.parry.tryParry(attacker)).toBe(true);
    expect(c.parry.cooldown).toBe(0);
    c.update(0.5, []);
    expect(c.begin('light')).toBe(true);
    expect(c.empowered).toBe(true);
    expect(c.finisher).toBe(true);
    expect(c.strike(eidra, 1).damage).toBeGreaterThanOrEqual(base * 2);
    c.update(1, []);
    c.begin('light');
    expect(c.empowered).toBe(false);
    c.update(1, []);
    c.parry.start();
    c.parry.tryParry(attacker);
    c.update(1.01, []);
    c.begin('light');
    expect(c.empowered).toBe(false);
  });
  it('places the downward hitbox beneath Eidra without advancing the combo', () => {
    const c = new CombatSystem();
    const eidra = makeCombatant('eidra', 100, 10, 4);
    c.begin('light');
    c.update(1, []);
    c.begin('down');
    expect(c.comboIndex).toBe(1);
    const hit = c.strike(eidra, 1);
    expect(hit.x).toBe(10);
    expect(hit.y).toBeLessThan(eidra.y - 1);
    expect(c.hitboxes.test(hit, makeCombatant('watcher', 30, 10, 2.2))).toBe(true);
    expect(c.hitboxes.test(hit, makeCombatant('wisp', 30, 12.5, 2.2))).toBe(false);
  });
  it('a pogo bounce has a fixed height and refreshes the dash', () => {
    const m = new MovementModel();
    m.step(1 / 60, { ...idle, dash: true }, false);
    expect(m.dashCooldown).toBeGreaterThan(0);
    m.bounce();
    expect(m.dashCooldown).toBe(0);
    m.step(1 / 60, idle, false);
    // Jump is not held, yet the bounce is not shortened like a released jump.
    expect(m.vy).toBeGreaterThan(9);
    for (let i = 0; i < 20; i++) m.step(1 / 60, idle, false);
    expect(m.vy).toBeLessThanOrEqual(5);
  });
});
describe('Recueillement', () => {
  it('earns resonance, channels while allowed and heals once per segment', () => {
    const focus = new FocusSystem();
    const eidra = makeCombatant('eidra', 100);
    eidra.health = 40;
    expect(focus.update(1, true, true, eidra)).toBe(0);
    for (let i = 0; i < 20; i++) focus.gain(focusData.gainPerHit);
    expect(focus.resonance).toBe(focusData.capacity);
    expect(focus.segments).toBe(3);
    let healed = 0;
    for (let t = 0; t < focusData.channel - 0.05; t += 0.05)
      healed += focus.update(0.05, true, true, eidra);
    expect(healed).toBe(0);
    expect(focus.progress).toBeGreaterThan(0.8);
    healed += focus.update(0.1, true, true, eidra);
    expect(healed).toBe(focusData.heal);
    expect(eidra.health).toBe(40 + focusData.heal);
    expect(focus.segments).toBe(2);
  });
  it('is interrupted by release, damage or movement and never overheals', () => {
    const focus = new FocusSystem();
    const eidra = makeCombatant('eidra', 100);
    focus.gain(99);
    eidra.health = 90;
    focus.update(0.5, true, true, eidra);
    focus.interrupt();
    expect(focus.channeling).toBe(false);
    focus.update(0.5, true, false, eidra);
    expect(focus.channel).toBe(0);
    focus.update(0.5, true, true, eidra);
    focus.update(0.1, false, true, eidra);
    expect(focus.channel).toBe(0);
    expect(focus.update(1, true, true, eidra)).toBe(10);
    expect(eidra.health).toBe(100);
    expect(focus.update(1, true, true, eidra)).toBe(0);
    focus.gain(Number.NaN);
    focus.reset();
    expect(focus.resonance).toBe(0);
  });
});
describe('Anchor offerings', () => {
  it('spends escalating shard costs for a bounded number of vitality upgrades', () => {
    const inventory = new Inventory();
    expect(inventory.offer()).toBe(false);
    inventory.shards = offeringData.costs.reduce((a, b) => a + b, 0) + 3;
    for (const cost of offeringData.costs) {
      expect(inventory.offeringCost).toBe(cost);
      expect(inventory.offer()).toBe(true);
    }
    expect(inventory.shards).toBe(3);
    expect(inventory.healthUpgrades).toBe(offeringData.costs.length);
    expect(inventory.maxHealth).toBe(100 + offeringData.costs.length * offeringData.vitality);
    expect(inventory.offeringCost).toBeNull();
    expect(inventory.offer()).toBe(false);
  });
});
