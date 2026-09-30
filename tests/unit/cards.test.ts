import { describe, it, expect } from 'vitest';
import { CardSystem } from '../../src/combat/Cards';
import { CombatSystem, makeCombatant } from '../../src/combat/CombatSystem';
import { heroPose } from '../../src/animation/Poses';
import { TutorialDirector } from '../../src/quests/TutorialDirector';
import { cardData, focusData } from '../../game-data/abilities/abilities';
import { appearances } from '../../game-data/characters/appearance';
const open = (): boolean => false;
describe('Eidra’s cards', () => {
  it('throws one card straight ahead, fast, fading at its range', () => {
    const cards = new CardSystem();
    const [card] = cards.throw(10, 1, 1, false);
    expect(cards.shots).toHaveLength(1);
    expect(card!.vx).toBeCloseTo(cardData.speed);
    expect(card!.vy).toBeCloseTo(0);
    expect(cards.ready).toBe(false);
    let travelled = 0;
    for (let i = 0; i < 200 && cards.shots.length; i++) {
      cards.update(1 / 60, open);
      travelled = cards.shots[0]?.x ?? travelled;
    }
    expect(cards.shots).toHaveLength(0);
    expect(travelled - 10).toBeGreaterThan(cardData.range - 0.5);
    expect(travelled - 10).toBeLessThanOrEqual(cardData.range);
    expect(cards.ready).toBe(true);
  });
  it('fans three cards during a riposte, facing left as well', () => {
    const cards = new CardSystem();
    const fan = cards.throw(10, 1, -1, true);
    expect(fan).toHaveLength(cardData.fan);
    expect(fan.every((c) => c.vx < 0)).toBe(true);
    expect(new Set(fan.map((c) => Math.sign(Math.round(c.vy)))).size).toBe(3);
  });
  it('stops against walls and is spent on the first body it strikes', () => {
    const cards = new CardSystem();
    // 1.8 m per tenth of a second: open air, then the wall at 3 m.
    cards.throw(0, 1, 1, false);
    cards.update(0.1, (x) => x > 3);
    expect(cards.shots).toHaveLength(1);
    cards.update(0.1, (x) => x > 3);
    expect(cards.shots).toHaveLength(0);
    cards.throw(0, 1, 1, false);
    const near = makeCombatant('watcher', 50, 2, 1),
      far = makeCombatant('sentinel', 50, 2.3, 1);
    cards.update(0.1, open);
    const shot = cards.strike(near);
    expect(shot).not.toBeNull();
    expect(cards.hitbox(shot!).damage).toBe(cardData.damage);
    expect(cards.strike(far)).toBeNull();
    cards.update(0, open);
    expect(cards.shots).toHaveLength(0);
  });
  it('costs two hits of resonance and shows one card per hit', () => {
    expect(cardData.perCard).toBe(focusData.gainPerHit);
    expect(cardData.cost).toBe(cardData.perCard * 2);
    // A heal still costs three cards: throwing is a choice against mending.
    expect(focusData.cost).toBeGreaterThan(cardData.cost);
    expect(Math.floor(focusData.capacity / cardData.perCard)).toBe(9);
  });
  it('reaches further with the charged card burst than with a swing', () => {
    const combat = new CombatSystem();
    const eidra = makeCombatant('eidra', 100, 0, 1);
    combat.begin('light');
    const swing = combat.strike(eidra, 1);
    combat.cooldown = 0;
    combat.begin('charged');
    const burst = combat.strike(eidra, 1);
    expect(burst.x + burst.width / 2).toBeGreaterThan(swing.x + swing.width / 2 + 1.5);
  });
  it('teaches the throw only once Eidra holds enough resonance', () => {
    const t = new TutorialDirector();
    const flags = new Set(['tutorial:attack', 'tutorial:jump', 'tutorial:move']);
    // In the Ash Rifts, where no other prompt competes.
    const context = { x: 230, flags, abilities: new Set<string>(), wounded: false };
    expect(t.update({ ...context, cards: false })?.id).not.toBe('cast');
    expect(t.update({ ...context, cards: true })?.id).toBe('cast');
    t.perform('cast', flags);
    expect(t.update({ ...context, cards: true })).toBeNull();
  });
});
describe('Eidra’s staff poses', () => {
  const at = (combo: number, t: number) =>
    heroPose({ attackTime: 0.32 * (1 - t), attackKind: 'light', dashing: false, combo });
  it('sweeps low, rises, then thrusts over the three-hit combo', () => {
    // The sweep starts behind the shoulder and ends low in front.
    expect(at(1, 0.02).swing!).toBeGreaterThan(0.5);
    expect(at(1, 0.9).swing!).toBeLessThan(-1.5);
    // The rising arc climbs from low in front.
    expect(at(2, 0.02).swing!).toBeLessThan(-2);
    expect(at(2, 0.9).swing!).toBeGreaterThan(-0.5);
    // The thrust stays level and drives the hand forward.
    expect(at(3, 0.02).swing).toBeCloseTo(at(3, 0.9).swing!);
    expect(at(3, 0.9).reach!).toBeGreaterThan(at(3, 0.02).reach! + 0.4);
  });
  it('raises the staff while a charge gathers and points it down for the pogo', () => {
    const idle = heroPose({ attackTime: 0, attackKind: 'light', dashing: false, charge: 0 });
    expect(idle).toEqual({});
    const held = heroPose({ attackTime: 0, attackKind: 'light', dashing: false, charge: 1 });
    expect(held.swing!).toBeGreaterThan(2.5);
    const pogo = heroPose({ attackTime: 0.16, attackKind: 'down', dashing: false });
    expect(pogo.swing).toBeCloseTo(Math.PI);
    expect(heroPose({ attackTime: 0, attackKind: 'light', dashing: true }).swing!).toBeGreaterThan(
      1,
    );
  });
});
describe('Eidra’s look', () => {
  it('wears the thorn crown, long hair, a spattered robe, a crimson cape and a staff', () => {
    const eidra = appearances.eidra;
    expect(eidra.weapon).toBe('staff');
    expect(eidra.glow).toBe('crimson');
    expect(eidra.crown?.spikes).toBeGreaterThan(6);
    expect(eidra.hair?.strands).toBeGreaterThan(1);
    expect(eidra.mantle).not.toBeNull();
    expect(eidra.spatter).not.toBeNull();
    expect(eidra.cards).not.toBeNull();
    // Her Echo keeps the silhouette but not the cards.
    expect(appearances.echo.weapon).toBe('staff');
    expect(appearances.echo.cards).toBeNull();
    // Other characters are untouched by the new fields.
    expect(appearances.mira.crown).toBeNull();
    expect(appearances.watcher.cards).toBeNull();
  });
});
