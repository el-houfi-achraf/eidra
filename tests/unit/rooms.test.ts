import { describe, expect, it } from 'vitest';
import {
  arenas,
  checkpoints,
  chunks,
  landmarks,
  pits,
  ROUTE_BOTTOM,
  ROUTE_TOP,
  route,
  routeChunks,
  seals,
} from '../../game-data/zones/laboratory';
import { enemyData } from '../../game-data/enemies/roster';
import {
  across,
  chambers,
  inside,
  neighbours,
  openings,
  passages,
  roomAt,
  roomById,
  shell,
  SHELL,
  trackRoom,
  worldSolids,
} from '../../src/world/Rooms';
import { bodyBand } from '../../src/enemies/Terrain';
import { SceneManager } from '../../src/world/SceneManager';
import { MovementModel } from '../../src/player/MovementModel';
import { reach, start, surfaceNear } from './support/reach';
import type { Power, Surface } from './support/reach';

const overlap = (a0: number, a1: number, b0: number, b1: number): number =>
  Math.min(a1, b1) - Math.max(a0, b0);

describe('rooms of the world (D036)', () => {
  it('builds Act I from 25 rooms or more: the route sectors and their chambers', () => {
    const actOne = chunks.filter((room) => {
      const sector = room.sector ?? room.id;
      return routeChunks.slice(0, 5).some((r) => r.id === sector);
    });
    expect(actOne.length).toBeGreaterThanOrEqual(25);
    expect(chambers.filter((room) => room.secret).length).toBeGreaterThanOrEqual(3);
    // Rooms span one to three screens wide and stand up to three screens tall.
    for (const room of chambers) {
      expect(room.end - room.start, room.id).toBeLessThanOrEqual(78);
      expect(room.top - room.bottom, room.id).toBeGreaterThanOrEqual(8);
    }
  });
  it('never lets two chambers overlap, nor a chamber climb into a route room', () => {
    for (const a of chambers)
      for (const b of chambers)
        if (a !== b)
          expect(
            overlap(a.start, a.end, b.start, b.end) > 0.01 &&
              overlap(a.bottom, a.top, b.bottom, b.top) > 0.01,
            `${a.id} / ${b.id}`,
          ).toBe(false);
    for (const room of chambers)
      for (const r of routeChunks)
        if (overlap(room.start, room.end, r.start, r.end) > 0.01)
          // Under the route's floor slab (bottom −2), or above its vault.
          expect(room.top <= -2 || room.bottom >= ROUTE_TOP, room.id).toBe(true);
  });
  it('keeps the chambers under a rift out of reach of a fall into it', () => {
    for (const pit of pits)
      for (const room of chambers)
        if (overlap(room.start, room.end, pit.from, pit.to) > 0 && room.top <= -2)
          expect(room.top, room.id).toBeLessThanOrEqual(ROUTE_BOTTOM - 4);
  });
  it('leads every door somewhere, and back: doors meet on both sides', () => {
    for (const room of chambers)
      for (const door of room.doors) {
        const target = roomAt(...across(room, door));
        // A floor may open on nothing: a pit.
        if (!target) {
          expect(door.side, `${room.id} ${door.side} door`).toBe('bottom');
          continue;
        }
        if (target.kind === 'route') {
          expect(['top', 'bottom'], `${room.id} → ${target.id}`).toContain(door.side);
          continue;
        }
        const facing = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' }[door.side];
        const match = target.doors.find(
          (d) => d.side === facing && overlap(d.from, d.to, door.from, door.to) >= 1.6,
        );
        expect(match, `${room.id} → ${target.id}`).toBeDefined();
      }
  });
  it('opens the route’s floor where a chamber hangs under it', () => {
    for (const p of passages) {
      const target = roomById(p.to)!;
      if (target.kind !== 'route' || p.door.side !== 'top') continue;
      // No slab of the route closes the hole between floor and chamber.
      const blocking = routeChunks
        .flatMap((r) => r.platforms)
        .filter(
          (s) =>
            !s.memory &&
            s.y + s.h / 2 > -2.05 &&
            s.y - s.h / 2 < 0.05 &&
            overlap(s.x - s.w / 2, s.x + s.w / 2, p.door.from, p.door.to) > 0.01,
        );
      expect(blocking, p.from).toEqual([]);
    }
  });
  it('builds each chamber’s shell with a gap at every door', () => {
    const well = roomById('mira-well')!;
    const walls = shell(well);
    // Top: two pieces around the well's mouth; floor: one; two walls cut by their doors.
    const ceiling = walls.filter((s) => Math.abs(s.y - (well.top - SHELL / 2)) < 0.01);
    expect(ceiling.map((s) => [s.x - s.w / 2, s.x + s.w / 2])).toEqual([
      [74, 78],
      [80, 84],
    ]);
    for (const door of well.doors) {
      const [x, y] = across(well, door);
      // Just inside the door, nothing solid.
      const inX = door.side === 'left' ? x + 0.5 : door.side === 'right' ? x - 0.5 : x;
      const inY = door.side === 'top' ? y - 0.5 : door.side === 'bottom' ? y + 0.5 : y;
      expect(
        walls.some((s) => Math.abs(s.x - inX) < s.w / 2 && Math.abs(s.y - inY) < s.h / 2),
        `${door.side} door`,
      ).toBe(false);
    }
    expect(shell(routeChunks[0]!)).toEqual([]);
  });
  it('finds the room of a point, keeping the room Eidra stands in at its edge', () => {
    expect(roomAt(10, 1)?.id).toBe('awakening');
    expect(roomAt(79, -10)?.id).toBe('mira-well');
    expect(roomAt(60, -20)?.id).toBe('archives');
    expect(roomAt(79, 1)?.id).toBe('watchers');
    expect(roomAt(95, -8)).toBeNull();
    const archives = roomById('archives')!,
      well = roomById('mira-well')!;
    // A step across the line keeps the current room; a stride changes it.
    expect(trackRoom(74.2, -28, archives)?.id).toBe('archives');
    expect(trackRoom(74.6, -28, archives)?.id).toBe('mira-well');
    // Falling through the gallery's floor into the well switches at once.
    expect(trackRoom(79, -2.1, routeChunks[1]!)?.id).toBe('mira-well');
    expect(trackRoom(79, -1.8, well)?.id).toBe('mira-well');
    expect(trackRoom(79, -1.6, well)?.id).toBe('watchers');
    expect(inside(well, 74, -2.1)).toBe(true);
  });
  it('places every anchor, relic, spawn and seal in a room, walkers on their ground', () => {
    for (const c of checkpoints) expect(roomAt(c.x, c.y + 0.5), c.id).not.toBeNull();
    for (const m of landmarks) expect(roomAt(m.x, m.y), m.id).not.toBeNull();
    for (const room of chambers)
      for (const spawn of room.enemies) {
        expect(inside(room, spawn.x, spawn.y), spawn.id).toBe(true);
        const data = enemyData[spawn.kind];
        if (data.flying) continue;
        const band = bodyBand(worldSolids, spawn.x, spawn.y, data.scale * 1.8);
        expect(band, spawn.id).not.toBeNull();
        expect(spawn.y - band![0], spawn.id).toBeLessThan(1.3);
      }
    for (const seal of seals) {
      // Each seal fills a doorway: a passage runs through it.
      const through = passages.some((p) => {
        const room = roomById(p.from)!;
        const d = p.door;
        return d.side === 'left' || d.side === 'right'
          ? Math.abs(seal.x - (d.side === 'left' ? room.start : room.end)) <= 0.7 &&
              seal.y > d.from &&
              seal.y < d.to
          : Math.abs(seal.y - (d.side === 'top' ? room.top : room.bottom)) <= 0.7 &&
              seal.x > d.from &&
              seal.x < d.to;
      });
      expect(through, seal.id).toBe(true);
      if (seal.lever) expect(roomAt(seal.lever.x, seal.lever.y + 0.5), seal.id).not.toBeNull();
    }
  });
  it('keeps chambers clear of the arenas: no boss wakes under or over them', () => {
    for (const room of chambers)
      for (const arena of arenas)
        expect(overlap(room.start, room.end, arena.left, arena.right) > 0, room.id).toBe(false);
  });
  it('streams a chamber alone, with its neighbours loaded behind their doors', () => {
    let live = 0;
    const shown: Record<string, boolean> = {};
    const manager = new SceneManager((data) => {
      live++;
      return {
        dispose: () => {
          live--;
        },
        setMemory: () => undefined,
        setShown: (value: boolean) => {
          shown[data.id] = value;
        },
      };
    });
    manager.update(60, -25, false);
    expect(manager.room.id).toBe('archives');
    expect([...manager.shown.keys()]).toEqual(['archives']);
    expect(new Set(manager.loaded.keys())).toEqual(
      new Set(['archives', ...neighbours(roomById('archives')!).map((r) => r.id)]),
    );
    expect(shown.archives).toBe(true);
    expect(shown['mira-well']).toBe(false);
    // Back on the route: the corridor around Eidra and the chambers off her room.
    manager.update(60, 1, false);
    expect(manager.room.id).toBe('watchers');
    expect([...manager.shown.keys()].sort()).toEqual(['awakening', 'palimpsest', 'watchers']);
    expect(manager.loaded.has('mira-well')).toBe(true);
    for (let i = 0; i < 50; i++) {
      manager.update(i % 2 ? 180 : 60, i % 2 ? 1 : -25, false);
      expect(live).toBeLessThanOrEqual(8);
    }
    manager.dispose();
    expect(live).toBe(0);
  });
  it('lets every step of a stair be leapt from without striking a step above', () => {
    // Taking off from the edge facing the next step, the head must rise freely
    // (1.83 m standing, 2.49 m of jump) until the feet clear that step.
    const bonks: string[] = [];
    for (const room of chunks) {
      const slabs = [...room.platforms, ...shell(room)];
      const top = (p: { y: number; h: number }) => p.y + p.h / 2;
      const bottom = (p: { y: number; h: number }) => p.y - p.h / 2;
      for (const a of slabs)
        for (const b of slabs) {
          const rise = top(b) - top(a);
          const gap = Math.max(0, Math.abs(b.x - a.x) - (a.w + b.w) / 2);
          if (a === b || rise <= 0.3 || rise > 1.75 || gap <= 0.05 || gap > 3 || a.w < 1.2)
            continue;
          const dir = Math.sign(b.x - a.x);
          const edge = a.x + (dir * a.w) / 2;
          const [x0, x1] = [Math.min(edge, edge - dir * 0.68), Math.max(edge, edge - dir * 0.68)];
          for (const c of slabs) {
            if (c === a || c === b) continue;
            if (c.x + c.w / 2 <= x0 || c.x - c.w / 2 >= x1) continue;
            const above = bottom(c) - (top(a) + 1.83);
            if (above > 0 && above < rise + 0.4)
              bonks.push(
                `${room.id}: from ${a.x}@${top(a).toFixed(2)} to ${b.x}@${top(b).toFixed(2)}`,
              );
          }
        }
    }
    expect(bonks).toEqual([]);
  });
  it('never asks for a remembered climb longer than the Rémanence lasts', () => {
    // It holds ten seconds; at well under a second a step, eight in a row is the most.
    for (const room of chunks) {
      const top = (p: { y: number; h: number }) => p.y + p.h / 2;
      const steps = room.platforms
        .filter((p) => p.memory)
        .map(top)
        .sort((a, b) => a - b);
      const rests = room.platforms.filter((p) => !p.memory && p.w < 12).map(top);
      let run = 0,
        longest = 0,
        last = Number.NEGATIVE_INFINITY;
      for (const step of steps) {
        if (rests.some((r) => r > last + 0.01 && r <= step + 0.01)) run = 0;
        run++;
        longest = Math.max(longest, run);
        last = step;
      }
      expect(longest, room.id).toBeLessThanOrEqual(8);
    }
  });
  it('opens the vault of the counterweight over its ledges, the way up to the cage', () => {
    const counterweight = routeChunks.find((r) => r.id === 'counterweight')!;
    expect(openings(counterweight)).toEqual([{ side: 'top', from: 135, to: 138 }]);
  });
});

describe('the way through Act I', () => {
  const relic = (id: string): Surface => {
    const m = landmarks.find((l) => l.id === id)!;
    const s = surfaceNear(m.x, m.y);
    expect(s, id).toBeDefined();
    return s!;
  };
  const powers = (...list: Power[]): Set<Power> => new Set(list);
  it('wins the Élan first: nothing else of the act lies within reach before it', () => {
    const first = reach(start, powers());
    expect(first.has(relic('dash'))).toBe(true);
    expect(first.has(relic('remanence'))).toBe(false);
    expect(first.has(relic('memory-step'))).toBe(false);
    expect(first.has(relic('kael'))).toBe(false);
  });
  it('then the Rémanence, past the chasm only the Élan crosses', () => {
    const second = reach(start, powers('dash'));
    expect(second.has(relic('remanence'))).toBe(true);
    expect(second.has(relic('memory-step'))).toBe(false);
    expect(second.has(relic('cache-trial'))).toBe(true);
  });
  it('then the Écho mémoriel, up the counterweight, the cage and the belfry', () => {
    const third = reach(start, powers('dash', 'remanence'));
    expect(third.has(relic('memory-step'))).toBe(true);
    expect(third.has(relic('seris'))).toBe(false);
    for (const id of ['kael', 'deren', 'aren', 'noa', 'cache-oculus', 'cache-sanctum'])
      expect(third.has(relic(id)), id).toBe(true);
  });
  it('then the counterweight’s gate, Seris and the end of the act', () => {
    const all = reach(start, powers('dash', 'remanence', 'memory-step'));
    expect(all.has(relic('seris'))).toBe(true);
    expect(all.has(surfaceNear(route.act2.x + 3, 1)!)).toBe(true);
  });
  it('holds no dead end: wherever Eidra stands, the next power is still within reach', () => {
    const steps: [Power[], string][] = [
      [[], 'dash'],
      [['dash'], 'remanence'],
      [['dash', 'remanence'], 'memory-step'],
    ];
    for (const [owned, next] of steps) {
      const target = relic(next);
      for (const place of reach(start, powers(...owned)))
        expect(
          reach(place, powers(...owned)).has(target),
          `${place.room} ${place.x0} ${place.y} → ${next}`,
        ).toBe(true);
    }
    // With every power, every place leads on to Act II.
    const end = surfaceNear(route.act2.x + 3, 1)!;
    const all = powers('dash', 'remanence', 'memory-step');
    for (const place of reach(start, all))
      expect(reach(place, all).has(end), `${place.room} ${place.x0} ${place.y}`).toBe(true);
  });
});

describe('the Élan’s chasms, with the real movement', () => {
  /**
   * Runs MovementModel step by step off a ledge at full speed (coyote jump at the
   * edge) and returns how far the body travels before it falls back to the
   * ledge's height: with the Élan at the top of the jump, or without it.
   */
  const leap = (dash: boolean): number => {
    const m = new MovementModel();
    const dt = 1 / 60;
    let x = -3,
      y = 0,
      jumped = false,
      rising = false,
      dashed = false;
    for (let t = 0; t < 4; t += dt) {
      const supported = !jumped && x <= 0;
      const jump = !jumped && x > -0.02;
      if (jump) jumped = true;
      // The Élan at the top of the arc: once the jump has risen and slows to a halt.
      if (m.vy > 5) rising = true;
      const dashNow = dash && rising && !dashed && m.vy < 1;
      if (dashNow) dashed = true;
      m.step(
        dt,
        { axis: 1, jump, jumpHeld: true, dash: dashNow, walk: false },
        supported,
        true,
        false,
      );
      x += m.vx * dt;
      // On the ledge the body stays on its floor; in the air it follows its speed.
      y = supported && !jump ? 0 : y + m.vy * dt;
      if (jumped && m.vy < 0 && y < 0) return x;
    }
    return x;
  };
  it('crosses every chasm the act asks the Élan for, and none of them without it', () => {
    const withDash = leap(true),
      without = leap(false);
    // Eidra's capsule (0.33 m) may overhang either lip: a chasm narrower than the leap plus
    // both overhangs is crossed.
    const chasms = [
      { room: 'dash-trial', gap: 20.6 - 13 },
      { room: 'scriptorium', gap: 101 - 93 },
      { room: 'hanging-archives', gap: 98 - 90.7 },
    ];
    for (const { room, gap } of chasms) {
      expect(withDash + 0.66, room).toBeGreaterThan(gap + 0.5);
      expect(without + 0.66, room).toBeLessThan(gap - 0.3);
    }
  });
});
