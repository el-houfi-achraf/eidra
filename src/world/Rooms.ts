import { chunks, routeChunks } from '../../game-data/zones/laboratory';
import type { ChunkData, Door } from '../../game-data/zones/laboratory';
import type { Solid } from '../enemies/Terrain';
/**
 * Geometry of the rooms on the 2D plane (D036). Pure: gameplay, streaming, the
 * camera and the map all read the same rooms, walls and passages.
 */
/** Thickness of a chamber's walls, floor and ceiling, inside its bounds. */
export const SHELL = 0.6;
/** Metres a body must cross into a new room before it counts as there (no flicker on a line). */
export const ROOM_HYSTERESIS = 0.3;
export const chambers = chunks.filter((room) => room.kind === 'chamber');
export interface Bounds {
  left: number;
  right: number;
  bottom: number;
  top: number;
}
export const boundsOf = (room: ChunkData): Bounds => ({
  left: room.start,
  right: room.end,
  bottom: room.bottom,
  top: room.top,
});
/** The point lies in the room's box, grown by `margin` on every side. */
export function inside(room: ChunkData, x: number, y: number, margin = 0): boolean {
  return (
    x >= room.start - margin &&
    x < room.end + margin &&
    y >= room.bottom - margin &&
    y < room.top + margin
  );
}
const byId = new Map(chunks.map((room) => [room.id, room]));
export const roomById = (id: string): ChunkData | undefined => byId.get(id);
/**
 * The room a point belongs to. Chambers come first: one hung under a route room
 * may reach up to its floor slab, inside the route room's box.
 */
export function roomAt(x: number, y: number): ChunkData | null {
  for (const room of chambers) if (inside(room, x, y)) return room;
  for (const room of routeChunks) if (inside(room, x, y)) return room;
  return null;
}
/** A chamber at that point, if any. */
export const chamberAt = (x: number, y: number): ChunkData | null =>
  chambers.find((room) => inside(room, x, y)) ?? null;
/**
 * The room Eidra is in, keeping the previous one while she stands within a few
 * centimetres of its edge.
 */
export function trackRoom(x: number, y: number, previous: ChunkData | null): ChunkData | null {
  if (previous && inside(previous, x, y, ROOM_HYSTERESIS)) {
    const here = roomAt(x, y);
    // A chamber reached through the floor of a route room takes over at once.
    if (!here || here === previous || previous.kind === 'chamber' || here.kind === 'route')
      return previous;
  }
  return roomAt(x, y) ?? previous;
}
/** The route room whose mood, music and ground a room shares. */
export function sectorOf(room: ChunkData): ChunkData {
  return (room.sector && byId.get(room.sector)) || room;
}
/** Sides along x (top, bottom) or along y (left, right). */
const horizontal = (door: Door): boolean => door.side === 'top' || door.side === 'bottom';
/** A point just across a door, in the room it leads to. */
export function across(room: ChunkData, door: Door): [number, number] {
  const mid = (door.from + door.to) / 2;
  switch (door.side) {
    case 'left':
      return [room.start - 0.25, mid];
    case 'right':
      return [room.end + 0.25, mid];
    case 'top':
      return [mid, room.top + 0.25];
    case 'bottom':
      return [mid, room.bottom - 0.25];
  }
}
/** A doorway between two rooms, as seen from `from`. */
export interface Passage {
  from: string;
  to: string;
  door: Door;
}
/** Every doorway, from each chamber that declares it. */
export const passages: Passage[] = chambers.flatMap((room) =>
  room.doors.flatMap((door) => {
    const target = roomAt(...across(room, door));
    return target ? [{ from: room.id, to: target.id, door }] : [];
  }),
);
/** Rooms one doorway away, either way through it. */
export function neighbours(room: ChunkData): ChunkData[] {
  const ids = new Set<string>();
  for (const p of passages) {
    if (p.from === room.id) ids.add(p.to);
    if (p.to === room.id) ids.add(p.from);
  }
  return [...ids].map((id) => byId.get(id)!);
}
/** Openings of a route room's floor and ceiling: where chambers meet it. */
export function openings(room: ChunkData): { side: 'top' | 'bottom'; from: number; to: number }[] {
  return passages
    .filter((p) => p.to === room.id && horizontal(p.door))
    .map((p) => ({
      // A chamber's top door opens in the floor of the route room above it.
      side: p.door.side === 'top' ? ('bottom' as const) : ('top' as const),
      from: p.door.from,
      to: p.door.to,
    }));
}
/** Metres under a doorway overhead where its draft catches a rising leap. */
export const DRAFT = 2;
/** A doorway overhead: the boundary to cross and the room beyond it. */
export interface Overhead {
  boundary: number;
  from: number;
  to: number;
  upper: ChunkData;
}
/** Doorways in the ceiling of a room: a chamber's top doors, a route room's vault openings. */
export function overheads(room: ChunkData): Overhead[] {
  if (room.kind === 'chamber')
    return room.doors
      .filter((d) => d.side === 'top')
      .flatMap((d) => {
        const upper = roomAt((d.from + d.to) / 2, room.top + 0.25);
        return upper ? [{ boundary: room.top, from: d.from, to: d.to, upper }] : [];
      });
  return passages
    .filter((p) => p.to === room.id && p.door.side === 'bottom')
    .map((p) => {
      const upper = byId.get(p.from)!;
      return { boundary: upper.bottom, from: p.door.from, to: p.door.to, upper };
    });
}
/**
 * The doorway overhead whose draft holds a body at (x, y): under the opening, far
 * enough from its edges for the head to pass, at most `DRAFT` below it.
 */
export function draftAt(room: ChunkData, x: number, y: number): Overhead | null {
  return (
    overheads(room).find(
      (o) => x >= o.from + 0.35 && x <= o.to - 0.35 && y >= o.boundary - DRAFT && y < o.boundary,
    ) ?? null
  );
}
/** Cuts the ranges of `doors` out of the span [a, b]. */
function cut(a: number, b: number, doors: readonly Door[]): [number, number][] {
  const spans: [number, number][] = [];
  let from = a;
  for (const door of [...doors].sort((p, q) => p.from - q.from)) {
    if (door.from > from) spans.push([from, Math.min(door.from, b)]);
    from = Math.max(from, door.to);
  }
  if (b > from) spans.push([from, b]);
  return spans.filter(([p, q]) => q - p > 0.01);
}
/**
 * The walls, floor and ceiling of a chamber, `SHELL` thick inside its box, with
 * a gap at every door. Route rooms have none: their slabs are their ground.
 */
export function shell(room: ChunkData): Solid[] {
  if (room.kind !== 'chamber') return [];
  const solids: Solid[] = [];
  const side = (s: Door['side']) => room.doors.filter((d) => d.side === s);
  for (const [a, b] of cut(room.start, room.end, side('bottom')))
    solids.push({ x: (a + b) / 2, y: room.bottom + SHELL / 2, w: b - a, h: SHELL });
  for (const [a, b] of cut(room.start, room.end, side('top')))
    solids.push({ x: (a + b) / 2, y: room.top - SHELL / 2, w: b - a, h: SHELL });
  for (const [a, b] of cut(room.bottom, room.top, side('left')))
    solids.push({ x: room.start + SHELL / 2, y: (a + b) / 2, w: SHELL, h: b - a });
  for (const [a, b] of cut(room.bottom, room.top, side('right')))
    solids.push({ x: room.end - SHELL / 2, y: (a + b) / 2, w: SHELL, h: b - a });
  return solids;
}
/** Everything solid in a room that never moves: its slabs and its shell. */
export const solidsOf = (room: ChunkData): Solid[] => [
  ...room.platforms.filter((p) => !p.memory),
  ...shell(room),
];
/** Solid ground and walls of the whole world, cracked walls aside. */
export const worldSolids: Solid[] = chunks.flatMap(solidsOf);
