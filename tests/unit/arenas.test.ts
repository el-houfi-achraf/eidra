import { describe, expect, it } from 'vitest';
import { arenas, checkpoints, chunks, gates } from '../../game-data/zones/laboratory';
import { enemyData } from '../../game-data/enemies/roster';
import { ArenaDirector } from '../../src/bosses/ArenaDirector';
import { EnemyManager } from '../../src/enemies/EnemyManager';
import { bodyBand, clampToGates, walkableSpan } from '../../src/enemies/Terrain';
import type { Solid } from '../../src/enemies/Terrain';
import { makeCombatant } from '../../src/combat/CombatSystem';
import type { Hitbox } from '../../src/combat/CombatSystem';

const solids: Solid[] = chunks.flatMap((chunk) => chunk.platforms.filter((p) => !p.memory));
const crosses = (s: Solid, x: number, radius: number, [feet, head]: [number, number]): boolean =>
  Math.abs(s.x - x) < s.w / 2 + radius - 0.01 &&
  s.y - s.h / 2 < head - 0.06 &&
  s.y + s.h / 2 > feet + 0.16;

describe('walkable spans', () => {
  const floor = { x: 0, y: -0.5, w: 20, h: 1 };
  it('stands walkers on the highest slab under them and centres flyers', () => {
    const step = { x: 2, y: 0.5, w: 2, h: 1 };
    expect(bodyBand([floor, step], 0, 1, 2)).toEqual([0, 2]);
    expect(bodyBand([floor, step], 2, 1.2, 2)).toEqual([1, 3]);
    expect(bodyBand([floor], 30, 1, 2)).toBeNull();
    expect(bodyBand([floor], 30, 3, 1, true)).toEqual([2.5, 3.5]);
  });
  it('keeps a walker on the floor it stands on and before any slab crossing its body', () => {
    const wall = { x: 4, y: 1, w: 1, h: 2 };
    expect(walkableSpan([floor, wall], 0, 0.9, 0.5, 1.8)).toEqual([-9.5, 3]);
  });
  it('lets a body walk under a slab that clears its head', () => {
    const ledge = { x: 4, y: 3, w: 2, h: 0.5 };
    expect(walkableSpan([floor, ledge], 0, 0.9, 0.5, 1.8)).toEqual([-9.5, 9.5]);
  });
  it('merges contiguous floors and pins a body without floor in place', () => {
    const next = { x: 20, y: -0.5, w: 20, h: 1 };
    expect(walkableSpan([floor, next], 0, 0.9, 0.5, 1.8)).toEqual([-9.5, 29.5]);
    expect(walkableSpan([floor], 40, 0.9, 0.5, 1.8)).toEqual([40, 40]);
  });
  it('lets flyers cross gaps but not slabs in their band', () => {
    const pillar = { x: -6, y: 3, w: 1, h: 2 };
    const [min, max] = walkableSpan([pillar], 0, 3, 0.4, 1, true);
    expect(min).toBeCloseTo(-5.1);
    expect(max).toBe(Number.POSITIVE_INFINITY);
  });
  it('never lets a laboratory enemy overlap a solid slab anywhere in its patrol', () => {
    const manager = new EnemyManager();
    manager.sync(chunks);
    expect(manager.entities.size).toBe(chunks.flatMap((c) => c.enemies).length);
    for (const entity of manager.entities.values()) {
      const { x, y, radius, height } = entity.actor;
      const [low, high] = entity.patrol;
      expect(low, entity.actor.id).toBeLessThanOrEqual(x);
      expect(high, entity.actor.id).toBeGreaterThanOrEqual(x);
      const flying = enemyData[entity.kind as keyof typeof enemyData].flying;
      const band = bodyBand(solids, x, y, height, flying)!;
      for (let t = 0; t <= 1; t += 0.05) {
        const at = low + (high - low) * t,
          where = `${entity.actor.id} at ${at.toFixed(2)}`;
        expect(
          solids.find((s) => crosses(s, at, radius, band)),
          where,
        ).toBeUndefined();
        // Walkers keep ground under their centre along the whole patrol.
        if (!flying)
          expect(
            solids.some(
              (s) => Math.abs(s.x - at) <= s.w / 2 && Math.abs(s.y + s.h / 2 - band[0]) < 0.26,
            ),
            where,
          ).toBe(true);
      }
    }
  });
});

describe('closed gates', () => {
  it('keeps a body on its home side of every closed gate', () => {
    expect(clampToGates(12, 5, 0.5, [10], [0, 20])).toBe(9.25);
    expect(clampToGates(8, 15, 0.5, [10], [0, 20])).toBe(10.75);
    expect(clampToGates(8, 15, 0.5, [], [0, 20])).toBe(8);
  });
});

describe('guarded arenas', () => {
  const alive = (): boolean => false;
  it('describes coherent chambers in the data', () => {
    const ids = new Set(gates.map((g) => g.id));
    for (const arena of arenas) {
      expect(arena.left).toBeLessThan(arena.trigger);
      expect(arena.trigger).toBeLessThan(arena.right);
      expect(arena.roam[0]).toBeGreaterThan(arena.left);
      expect(arena.roam[1]).toBeLessThan(arena.right);
      expect(ids.has(`${arena.id}-left`) && ids.has(`${arena.id}-right`)).toBe(true);
    }
    const keeper = chunks.flatMap((c) => c.enemies).find((e) => e.kind === 'keeper')!;
    const lastOrder = arenas.find((a) => a.guardian === 'keeper')!;
    expect(keeper.x).toBeGreaterThan(lastOrder.trigger);
    expect(keeper.x).toBeLessThan(lastOrder.right);
    // The threshold anchor is the reward for the Keeper, not a way around it.
    expect(checkpoints.find((c) => c.id === 'threshold')!.x).toBeGreaterThan(lastOrder.right);
  });
  it('keeps the far gate shut while the guardian lives and seals the way back', () => {
    const director = new ArenaDirector();
    const [first] = arenas;
    expect(director.update(first!.trigger - 1, alive)).toBeNull();
    expect(director.closedGates(alive)).toContain(`${first!.id}-right`);
    expect(director.closedGates(alive)).not.toContain(`${first!.id}-left`);
    expect(director.update(first!.trigger + 0.5, alive)).toEqual({ type: 'sealed', arena: first });
    expect(director.closedGates(alive)).toContain(`${first!.id}-left`);
    // Already sealed: no repeated event.
    expect(director.update(first!.trigger + 1, alive)).toBeNull();
    const defeated = (guardian: string): boolean => guardian === first!.guardian;
    expect(director.update(first!.trigger + 1, defeated)).toEqual({
      type: 'cleared',
      arena: first,
    });
    expect(director.closedGates(defeated)).not.toContain(`${first!.id}-right`);
    expect(director.update(first!.trigger + 1, defeated)).toBeNull();
  });
  it('reopens the way back when the player respawns', () => {
    const director = new ArenaDirector();
    director.update(arenas[1]!.trigger + 1, alive);
    expect(director.active).toBe(arenas[1]);
    director.reset();
    expect(director.closedGates(alive)).not.toContain(`${arenas[1]!.id}-left`);
    expect(director.closedGates(alive)).toContain(`${arenas[1]!.id}-right`);
  });
  it('does not seal an arena whose guardian already fell', () => {
    const director = new ArenaDirector();
    expect(director.update(arenas[0]!.trigger + 1, () => true)).toBeNull();
    expect(director.closedGates(() => true)).toEqual([]);
  });
});

describe('guardians inside their arenas', () => {
  it('keeps the Keeper behind its closed gate while chasing', () => {
    const manager = new EnemyManager();
    const counterweight = chunks.find((c) => c.enemies.some((e) => e.kind === 'keeper'))!;
    manager.sync([counterweight]);
    const keeper = manager.entities.get('keeper')!;
    const arena = arenas.find((a) => a.guardian === 'keeper')!;
    const player = makeCombatant('eidra', 100, arena.left - 3, 1);
    player.invulnerable = 99;
    for (let i = 0; i < 900; i++) manager.update(1 / 60, player, () => undefined, [arena.left]);
    expect(keeper.actor.x - keeper.actor.radius).toBeGreaterThan(arena.left);
  });
  it('confines the Guardian to its arena and only wakes it past the trigger', () => {
    const manager = new EnemyManager();
    const arena = arenas.find((a) => a.guardian === 'faceless-guardian')!;
    const guardian = manager.encounter('faceless-guardian')!;
    const player = makeCombatant('eidra', 100, arena.trigger - 1, 1);
    player.invulnerable = 99;
    manager.update(1 / 60, player, () => undefined);
    expect(guardian.director.state).toBe('dormant');
    player.x = arena.trigger + 1;
    manager.update(1 / 60, player, () => undefined);
    expect(guardian.director.state).not.toBe('dormant');
    // Lured far beyond its gates, it stays in its arena.
    player.x = arena.right + 20;
    for (let i = 0; i < 1200; i++) manager.update(1 / 60, player, () => undefined);
    expect(guardian.actor.x).toBeLessThanOrEqual(arena.roam[1]);
    expect(guardian.actor.x).toBeGreaterThanOrEqual(arena.roam[0]);
  });
  it('hurts a player who walks into a body, without allowing a parry', () => {
    const manager = new EnemyManager();
    manager.sync([chunks[0]!]);
    const watcher = manager.entities.get('watcher-1')!;
    const player = makeCombatant('eidra', 100, watcher.actor.x - 0.3, watcher.actor.y);
    const hits: Hitbox[] = [];
    manager.update(1 / 60, player, (hit) => hits.push(hit));
    const touch = hits.find((h) => h.unblockable);
    expect(touch?.damage).toBe(enemyData.watcher.contact);
    expect(touch?.direction).toBe(-1);
  });
  it('lets a plunge strike the body below instead of being hurt by it', () => {
    const manager = new EnemyManager();
    manager.sync([chunks[0]!]);
    const watcher = manager.entities.get('watcher-1')!;
    // Eidra drops onto the Veilleur's head: bodies overlap.
    const player = makeCombatant('eidra', 100, watcher.actor.x, watcher.actor.y + 1.2);
    const contact = (plunging: boolean): Hitbox[] => {
      const hits: Hitbox[] = [];
      manager.update(1 / 60, player, (hit) => hits.push(hit), [], plunging);
      return hits.filter((h) => h.unblockable);
    };
    expect(contact(false)).toHaveLength(1);
    expect(contact(true)).toHaveLength(0);
    // A plunge gives no protection against a body above Eidra.
    player.y = watcher.actor.y - 1.2;
    expect(contact(true)).toHaveLength(1);
  });
});
