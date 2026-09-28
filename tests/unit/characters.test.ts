import { describe, it, expect } from 'vitest';
import { SecondaryChain } from '../../src/animation/SecondaryChain';
import { appearances, AppearanceSchema } from '../../game-data/characters/appearance';
import { enemyData } from '../../game-data/enemies/roster';
describe('Character appearance data', () => {
  it('validates every archetype and covers the whole enemy roster', () => {
    for (const [kind, look] of Object.entries(appearances))
      expect(() => AppearanceSchema.parse(look), kind).not.toThrow();
    for (const kind of Object.keys(enemyData)) expect(appearances).toHaveProperty(kind);
    for (const kind of ['eidra', 'echo', 'mira', 'boss']) expect(appearances).toHaveProperty(kind);
  });
  it('keeps silhouettes readable: cloaks widen towards the hem, hoods rise above the mask', () => {
    for (const look of Object.values(appearances)) {
      if (look.cloak) {
        expect(look.cloak.hem).toBeGreaterThan(look.cloak.top);
        expect(look.cloak.shoulder).toBeGreaterThan(look.cloak.bottom);
      }
      if (look.hood) expect(look.hood.tip).toBeGreaterThan(look.mask.y + look.mask.height);
    }
    expect(appearances.echo.ghost).toBe(true);
    expect(appearances.boss.mask.eyes).toBe('none');
  });
});
describe('Secondary motion chain', () => {
  it('hangs below its anchor and keeps its segment lengths', () => {
    const chain = new SecondaryChain(6, 0.2);
    chain.reset(0, 0);
    for (let i = 0; i < 240; i++) chain.step(1 / 60, 0, 0, { gravity: 6, damping: 0.9 });
    const tail = chain.nodes.at(-1)!;
    expect(tail.y).toBeLessThan(-0.9);
    expect(Math.abs(tail.x)).toBeLessThan(0.05);
    for (let i = 1; i < chain.nodes.length; i++) {
      const a = chain.nodes[i - 1]!,
        b = chain.nodes[i]!;
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(0.2, 1);
    }
  });
  it('trails behind a moving anchor and streams with the wind', () => {
    const chain = new SecondaryChain(6, 0.2);
    chain.reset(0, 0);
    for (let i = 0; i < 60; i++) chain.step(1 / 60, i * 0.1, 0, { gravity: 6 });
    expect(chain.nodes.at(-1)!.x).toBeLessThan(chain.nodes[0]!.x - 0.3);
    const windy = new SecondaryChain(6, 0.2);
    windy.reset(0, 0);
    for (let i = 0; i < 240; i++) windy.step(1 / 60, 0, 0, { gravity: 4, wind: -6 });
    expect(windy.nodes.at(-1)!.x).toBeLessThan(-0.3);
    expect(windy.nodes.at(-1)!.y).toBeLessThan(0);
  });
  it('snaps back after a teleport and ignores invalid steps', () => {
    const chain = new SecondaryChain(4, 0.3);
    chain.reset(0, 0);
    chain.step(1 / 60, 100, 5);
    expect(chain.nodes.at(-1)!.x).toBeCloseTo(100);
    chain.step(Number.NaN, 0, 0);
    chain.step(1 / 60, Number.POSITIVE_INFINITY, 0);
    expect(chain.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
    expect(() => new SecondaryChain(1, 0.2)).toThrow();
  });
});
