import {
  chunks,
  GATE_HEIGHT,
  gates,
  route,
  routeChunks,
  seals,
} from '../../../game-data/zones/laboratory';
import type { ChunkData, Door } from '../../../game-data/zones/laboratory';
import { DRAFT, passages, roomById, shell, SHELL, solidsOf } from '../../../src/world/Rooms';
/**
 * A coarse model of where Eidra can go: the tops of slabs and floors as surfaces,
 * joined by the jumps, falls and dashes her movement allows (MovementModel:
 * jump 11.8 m/s against 28 m/s², run 6.8 m/s, dash 17 m/s for 0.19 s), by the
 * doors between rooms, the updraft of a door overhead, the Rémanence's slabs,
 * cracked walls and shutters. Used to prove the level can be finished in order
 * and holds no dead end.
 *
 * Her body counts (capsule 0.66 m wide, 1.7 m tall): a slab too low to walk
 * under cuts the floor beneath it in two, she cannot step off an edge where a
 * slab hangs at head height just beyond it, nor pass a slab standing between two
 * surfaces without climbing it, nor land in a gap narrower than herself.
 */
export interface Surface {
  id: number;
  room: string;
  x0: number;
  x1: number;
  y: number;
  memory: boolean;
}
export type Power = 'dash' | 'remanence' | 'memory-step';
/** Highest rise from one top to another, with margin under the 2.49 m apex. */
const UP = 2.35;
/** Centre apex of a jump above the surface jumped from (feet apex 2.49 m + 0.98 m). */
const APEX = 3.47;
/** Room switch past the boundary, plus margin. */
const THROUGH = 0.6;
/** Head room her body needs (capsule 1.7 m), and its width (2 × 0.33 m). */
const BODY = 1.75;
const WIDTH = 0.66;
/**
 * Widest gap a running jump clears between two tops `dy` apart: the time the arc
 * takes to come back down to the target's height at 6.8 m/s, plus the Élan at the
 * top of the jump; a little under the ideal, plus the coyote time's head start.
 */
function across(dy: number, dash: boolean): number {
  const v = 11.8,
    g = 28;
  const disc = v * v - 2 * g * dy;
  if (disc < 0) return -1;
  const t = (v + Math.sqrt(disc)) / g;
  return (6.8 * t + (dash ? 17 * 0.19 : 0)) * 0.92 + 0.4;
}
const top = (s: { y: number; h: number }): number => s.y + s.h / 2;
const gapBetween = (a: Surface, b: Surface): number =>
  Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1));
/** The route is one open space: its rooms share one id here. */
const spaceOf = (room: ChunkData): string => (room.kind === 'route' ? 'route' : room.id);
/** Gates of the route that need a power (the counterweight's seal). */
const echoGate = gates.find((g) => g.id === 'echo')!.x;
export const surfaces: Surface[] = [];
interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
/** What stands in her way in each space: solid slabs and chamber walls, not memories. */
const obstacles = new Map<string, Box[]>();
for (const room of chunks) {
  const list = obstacles.get(spaceOf(room)) ?? [];
  for (const s of solidsOf(room))
    list.push({ x0: s.x - s.w / 2, x1: s.x + s.w / 2, y0: s.y - s.h / 2, y1: s.y + s.h / 2 });
  obstacles.set(spaceOf(room), list);
}
/** The span [x0, x1] at height y less what stands on it lower than her head. */
function standable(space: string, x0: number, x1: number, y: number): [number, number][] {
  let spans: [number, number][] = [[x0, x1]];
  for (const o of obstacles.get(space) ?? []) {
    if (o.y1 <= y + 0.01 || o.y0 >= y + BODY) continue;
    spans = spans.flatMap(([a, b]): [number, number][] =>
      o.x1 <= a || o.x0 >= b
        ? [[a, b]]
        : ([
            [a, Math.min(b, o.x0)],
            [Math.max(a, o.x1), b],
          ] as [number, number][]),
    );
  }
  return spans.filter(([a, b]) => b - a > 0.3);
}
const add = (room: string, x0: number, x1: number, y: number, memory: boolean): void => {
  for (const [a, b] of standable(room, x0, x1, y))
    surfaces.push({ id: surfaces.length, room, x0: a, x1: b, y, memory });
};
for (const room of chunks) {
  const solids = [
    ...room.platforms.map((p) => ({ ...p, memory: p.memory })),
    ...shell(room)
      .filter((s) => s.w > SHELL + 0.01 || s.h <= SHELL + 0.01)
      .filter((s) => Math.abs(top(s) - (room.bottom + SHELL)) < 0.01)
      .map((s) => ({ ...s, memory: false })),
  ];
  for (const s of solids) {
    const x0 = s.x - s.w / 2,
      x1 = s.x + s.w / 2;
    // A floor running under the counterweight's gate is two floors, one each side.
    if (room.kind === 'route' && x0 < echoGate && x1 > echoGate && top(s) < GATE_HEIGHT) {
      add(spaceOf(room), x0, echoGate - 0.3, top(s), Boolean(s.memory));
      add(spaceOf(room), echoGate + 0.3, x1, top(s), Boolean(s.memory));
    } else add(spaceOf(room), x0, x1, top(s), Boolean(s.memory));
  }
}
/**
 * An edge she cannot step off: just beyond it, closer than her width, something
 * solid stands between her feet and her head.
 */
function pinched(a: Surface, side: -1 | 1): boolean {
  return (obstacles.get(a.room) ?? []).some(
    (o) =>
      o.y1 > a.y + 0.01 &&
      o.y0 < a.y + BODY &&
      (side < 0
        ? o.x1 <= a.x0 + 0.01 && o.x1 > a.x0 - WIDTH - 0.04
        : o.x0 >= a.x1 - 0.01 && o.x0 < a.x1 + WIDTH + 0.04),
  );
}
/** Something solid stands in the gap between two surfaces, in the way of her body. */
function obstructed(a: Surface, b: Surface): boolean {
  const lo = Math.min(a.x1, b.x1),
    hi = Math.max(a.x0, b.x0);
  if (hi - lo <= 0.01) return false;
  return (obstacles.get(a.room) ?? []).some(
    (o) =>
      o.x0 < hi - 0.01 &&
      o.x1 > lo + 0.01 &&
      o.y1 > Math.min(a.y, b.y) + 0.05 &&
      o.y0 < Math.max(a.y, b.y) + BODY,
  );
}
/** Slabs of the route that are floors, for its holes. */
const roomOfSurface = (s: Surface): ChunkData =>
  s.room === 'route'
    ? (routeChunks.find((r) => (s.x0 + s.x1) / 2 >= r.start && (s.x0 + s.x1) / 2 < r.end) ??
      routeChunks[0]!)
    : roomById(s.room)!;
function jumpable(a: Surface, b: Surface, dash: boolean): boolean {
  const dy = b.y - a.y;
  if (dy > UP) return false;
  if (gapBetween(a, b) > across(dy, dash)) return false;
  // Whatever stands between them must be climbed: its top is a surface of its own.
  if (obstructed(a, b)) return false;
  // Rising, the head leads (the stairs' bonk test watches it); falling, the body
  // leaves by an edge with room beside it and lands where it fits.
  if (dy > 0.05) return true;
  const via = (side: -1 | 1): boolean => {
    const edge = side < 0 ? a.x0 : a.x1;
    if (pinched(a, side)) return false;
    if ((side < 0 ? edge - b.x0 : b.x1 - edge) >= WIDTH) return true;
    // A narrower landing beside the edge is reached only by falling past it deep
    // enough to steer back under the surface left, with nothing in the way.
    if (-dy < BODY + 0.35) return false;
    const [c0, c1] = side < 0 ? [edge - WIDTH, edge] : [edge, edge + WIDTH];
    return !(obstacles.get(a.room) ?? []).some(
      (o) => o.x1 > c0 + 0.01 && o.x0 < c1 - 0.01 && o.y1 > b.y + 0.05 && o.y0 < a.y - 0.05,
    );
  };
  return (b.x0 < a.x0 - 0.01 && via(-1)) || (b.x1 > a.x1 + 0.01 && via(1));
}
/** The surfaces next to a doorway's range on its side, on the floor or at its sill. */
const at = (space: string, x0: number, x1: number, y: number, slack = 1.2): Surface[] =>
  surfaces.filter(
    (s) => s.room === space && Math.abs(s.y - y) < 0.06 && s.x1 >= x0 - slack && s.x0 <= x1 + slack,
  );
/** Surfaces over a range, highest first: where a fall through it lands. */
const below = (space: string, x0: number, x1: number, under: number): Surface[] => {
  const hits = surfaces
    .filter((s) => s.room === space && s.y < under && s.x1 > x0 - 0.5 && s.x0 < x1 + 0.5)
    .sort((a, b) => b.y - a.y);
  return hits;
};
interface Link {
  from: Surface;
  to: Surface;
  /** A seal that must be open, and the power the move needs. */
  seal?: string;
  power?: Power;
}
const links: Link[] = [];
/** Each side door, with the surfaces at its sill on either side. */
export const doorways: { name: string; here: Surface[]; there: Surface[] }[] = [];
/** Side doors join the floors on either side at the sill; overhead doors, an updraft. */
for (const p of passages) {
  const from = roomById(p.from)!,
    to = roomById(p.to)!;
  const door: Door = p.door;
  const seal = seals.find((s) =>
    door.side === 'left' || door.side === 'right'
      ? Math.abs(s.x - (door.side === 'left' ? from.start : from.end)) < 1.2 &&
        s.y > door.from &&
        s.y < door.to
      : Math.abs(s.y - (door.side === 'top' ? from.top : from.bottom)) < 1.2 &&
        s.x > door.from &&
        s.x < door.to,
  )?.id;
  if (door.side === 'left' || door.side === 'right') {
    const wall = door.side === 'left' ? from.start : from.end;
    const here = at(spaceOf(from), wall - 1.5, wall + 1.5, door.from, 0.2);
    const there = at(spaceOf(to), wall - 1.5, wall + 1.5, door.from, 0.2);
    doorways.push({ name: `${p.from} → ${p.to}`, here, there });
    for (const a of here)
      for (const b of there) {
        links.push({ from: a, to: b, seal });
        links.push({ from: b, to: a, seal });
      }
    continue;
  }
  const [upper, lower] = door.side === 'top' ? [to, from] : [from, to];
  const boundary = door.side === 'top' ? from.top : from.bottom;
  // Falling through: from the floor beside the opening down to whatever lies under it.
  const sill = upper.kind === 'route' ? 0 : upper.bottom + SHELL;
  const edges = at(spaceOf(upper), door.from, door.to, sill, 0.5);
  const landing = below(spaceOf(lower), door.from, door.to, boundary);
  const memoryFree = landing.find((s) => !s.memory);
  for (const a of edges) {
    if (landing[0]) links.push({ from: a, to: landing[0], seal });
    if (memoryFree && memoryFree !== landing[0]) links.push({ from: a, to: memoryFree, seal });
  }
  // Rising through: a leap from under the opening into its draft, which carries on.
  for (const a of surfaces.filter(
    (s) =>
      s.room === spaceOf(lower) &&
      s.y < boundary &&
      s.y + APEX >= boundary - DRAFT + THROUGH &&
      s.x1 > door.from + 0.35 &&
      s.x0 < door.to - 0.35,
  ))
    for (const b of edges) links.push({ from: a, to: b, seal });
}
/** Where Eidra stands once she has: the relics, fragments and reliquaries. */
export function surfaceNear(x: number, y: number): Surface | undefined {
  return surfaces
    .filter((s) => x >= s.x0 - 1.2 && x <= s.x1 + 1.2 && Math.abs(s.y + 0.98 - y) < 1.8)
    .sort((a, b) => Math.abs(a.y + 0.98 - y) - Math.abs(b.y + 0.98 - y))[0];
}
export const start = surfaceNear(route.wake, 1.2)!;
/**
 * Every surface reachable from `from` with `powers`. Cracked walls give way to
 * blows from either side; a shutter opens once its lever has been reached.
 */
export function reach(from: Surface, powers: ReadonlySet<Power>): Set<Surface> {
  const dash = powers.has('dash'),
    remanence = powers.has('remanence'),
    echo = powers.has('memory-step');
  const usable = (s: Surface): boolean => !s.memory || remanence;
  const open = new Set(seals.filter((s) => s.kind === 'cracked').map((s) => s.id));
  for (;;) {
    const seen = new Set([from]);
    const queue = [from];
    while (queue.length) {
      const a = queue.shift()!;
      const next: Surface[] = [];
      for (const b of surfaces) {
        if (b === a || b.room !== a.room || !usable(b) || seen.has(b)) continue;
        // The counterweight's gate parts only for the Écho mémoriel.
        if (a.room === 'route' && !echo && b.y < GATE_HEIGHT && a.y < GATE_HEIGHT) {
          const ax = (a.x0 + a.x1) / 2,
            bx = (b.x0 + b.x1) / 2;
          if (ax < echoGate !== bx < echoGate) continue;
        }
        if (jumpable(a, b, dash)) next.push(b);
      }
      for (const link of links)
        if (
          link.from === a &&
          usable(link.to) &&
          !seen.has(link.to) &&
          (!link.seal || open.has(link.seal))
        )
          next.push(link.to);
      for (const b of next) {
        seen.add(b);
        queue.push(b);
      }
    }
    // Shutters whose lever Eidra has reached stay open.
    let changed = false;
    for (const seal of seals)
      if (seal.lever && !open.has(seal.id)) {
        const lever = surfaceNear(seal.lever.x, seal.lever.y + 0.98);
        if (lever && seen.has(lever)) {
          open.add(seal.id);
          changed = true;
        }
      }
    if (!changed) return seen;
  }
}
export { roomOfSurface };
