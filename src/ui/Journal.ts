import {
  actAt,
  arenas,
  checkpoints,
  chunks,
  landmarks,
  route,
  routeChunks,
} from '../../game-data/zones/laboratory';
import type { ChunkData } from '../../game-data/zones/laboratory';
import { enemyData, enemyKinds } from '../../game-data/enemies/roster';
import { bossRoster } from '../../game-data/bosses/roster';
import { dialogues, fundamentalMemories } from '../../game-data/dialogue/story';
import { neighbours, passages, roomAt, sectorOf } from '../world/Rooms';
/**
 * The journal's pages, as plain data and markup: the map of the rooms of an act,
 * the bestiary and the recovered fragments. Pure: the menu only lays them out.
 */
export interface MapState {
  /** Rooms Eidra has entered. */
  discovered: ReadonlySet<string>;
  /** The room she stands in, and where. */
  room: string;
  x: number;
  y: number;
  checkpoint: string;
  collected: ReadonlySet<string>;
  defeated: (guardian: string) => boolean;
}
type Act = (typeof route.acts)[number];
/** The act a room belongs to: its sector's. */
export const actOf = (room: ChunkData): Act => actAt(sectorOf(room).start);
/** Rooms of an act: its route sectors and the chambers off them. */
export const roomsOf = (act: Act): ChunkData[] => chunks.filter((room) => actOf(room) === act);
/** How a room shows on the map: visited, glimpsed through a doorway, or not at all. */
export type RoomMark = 'visited' | 'glimpsed' | 'hidden';
export function markOf(room: ChunkData, discovered: ReadonlySet<string>): RoomMark {
  if (discovered.has(room.id)) return 'visited';
  // A secret stays off the map until found; other rooms show as a doorway leads to them.
  if (room.secret) return 'hidden';
  const seen = neighbours(room).some((n) => discovered.has(n.id));
  const alongRoute =
    room.kind === 'route' &&
    routeChunks.some((r) => discovered.has(r.id) && (r.end === room.start || r.start === room.end));
  return seen || alongRoute ? 'glimpsed' : 'hidden';
}
/** The route's band as drawn: floor to vault. */
const ROUTE_FLOOR = -2;
const boxOf = (room: ChunkData): { x0: number; x1: number; y0: number; y1: number } => ({
  x0: room.start,
  x1: room.end,
  y0: room.kind === 'route' ? ROUTE_FLOOR : room.bottom,
  y1: room.top,
});
const escape = (text: string): string =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const fixed = (v: number): string => (Math.round(v * 10) / 10).toString();
/**
 * The map of an act as SVG, in world metres (y up): visited rooms filled,
 * rooms glimpsed through a doorway dashed, doorways as gaps of light, and in
 * the visited rooms their anchors, relics, fragments, reliquaries and guardians.
 */
export function roomMap(act: Act, state: MapState): string {
  const rooms = roomsOf(act);
  const marks = new Map(rooms.map((room) => [room.id, markOf(room, state.discovered)]));
  const shown = rooms.filter((room) => marks.get(room.id) !== 'hidden');
  const boxes = (shown.length ? shown : rooms).map(boxOf);
  const x0 = Math.min(...boxes.map((b) => b.x0)) - 4,
    x1 = Math.max(...boxes.map((b) => b.x1)) + 4,
    y0 = Math.min(...boxes.map((b) => b.y0)) - 4,
    y1 = Math.max(...boxes.map((b) => b.y1)) + 6;
  const parts: string[] = [];
  for (const room of shown) {
    const b = boxOf(room);
    const mark = marks.get(room.id)!;
    const here = room.id === state.room;
    parts.push(
      `<rect class="room ${mark} ${room.kind} ${here ? 'current' : ''} ${room.secret ? 'secret' : ''}" data-room="${room.id}" x="${fixed(b.x0)}" y="${fixed(-b.y1)}" width="${fixed(b.x1 - b.x0)}" height="${fixed(b.y1 - b.y0)}"><title>${mark === 'visited' ? escape(room.name) : 'Inexploré'}</title></rect>`,
    );
  }
  // Doorways of visited rooms: a short bright line across the shared wall.
  for (const p of passages) {
    const from = chunks.find((r) => r.id === p.from)!;
    if (marks.get(p.from) !== 'visited' && marks.get(p.to) !== 'visited') continue;
    if (!rooms.includes(from) || marks.get(p.to) === 'hidden' || marks.get(p.from) === 'hidden')
      continue;
    const d = p.door;
    const line =
      d.side === 'left' || d.side === 'right'
        ? { x: d.side === 'left' ? from.start : from.end, a: -d.to, b: -d.from, vertical: true }
        : { y: d.side === 'top' ? -from.top : -from.bottom, a: d.from, b: d.to, vertical: false };
    parts.push(
      line.vertical
        ? `<line class="door" x1="${fixed(line.x!)}" x2="${fixed(line.x!)}" y1="${fixed(line.a)}" y2="${fixed(line.b)}"/>`
        : `<line class="door" x1="${fixed(line.a)}" x2="${fixed(line.b)}" y1="${fixed(line.y!)}" y2="${fixed(line.y!)}"/>`,
    );
  }
  const visited = (x: number, y: number): boolean => {
    const room = roomAt(x, y);
    return room !== null && marks.get(room.id) === 'visited';
  };
  const icon = (x: number, y: number, glyph: string, cls: string, title: string): string =>
    `<text class="icon ${cls}" x="${fixed(x)}" y="${fixed(-y)}"><title>${escape(title)}</title>${glyph}</text>`;
  for (const c of checkpoints)
    if (visited(c.x, c.y + 0.5))
      parts.push(
        icon(c.x, c.y + 1.2, '◇', c.id === state.checkpoint ? 'anchor active' : 'anchor', c.name),
      );
  for (const m of landmarks) {
    if (m.kind === 'npc' || !visited(m.x, m.y)) continue;
    const glyph = m.kind === 'memory' ? '❖' : m.kind === 'cache' ? '◆' : '✦';
    parts.push(icon(m.x, m.y, glyph, state.collected.has(m.id) ? 'found' : m.kind, m.label));
  }
  for (const arena of arenas)
    if (visited((arena.left + arena.right) / 2, 1))
      parts.push(
        icon(
          (arena.left + arena.right) / 2,
          2,
          '☗',
          state.defeated(arena.guardian) ? 'found' : 'danger',
          arena.name,
        ),
      );
  // Sector names along the route.
  for (const room of shown)
    if (room.kind === 'route' && marks.get(room.id) === 'visited')
      parts.push(
        `<text class="label" x="${fixed((room.start + room.end) / 2)}" y="${fixed(-room.top - 1.5)}">${escape(room.name)}</text>`,
      );
  parts.push(
    `<circle class="you" cx="${fixed(state.x)}" cy="${fixed(-state.y)}" r="2.2"><title>Eidra</title></circle>`,
  );
  return `<svg class="room-map" viewBox="${fixed(x0)} ${fixed(-y1)} ${fixed(x1 - x0)} ${fixed(y1 - y0)}" role="img" aria-label="Carte de l’acte">${parts.join('')}</svg>`;
}
/** A foe in the bestiary: known once one has fallen. */
export interface BestiaryEntry {
  id: string;
  name: string;
  lore: string;
  defeated: number;
  boss: boolean;
}
export function bestiary(counts: ReadonlyMap<string, number>): BestiaryEntry[] {
  return [
    ...enemyKinds.map((kind) => ({
      id: kind,
      name: enemyData[kind].name,
      lore: enemyData[kind].lore,
      defeated: counts.get(kind) ?? 0,
      boss: false,
    })),
    ...bossRoster.map((boss) => ({
      id: boss.id,
      name: boss.name.charAt(0) + boss.name.slice(1).toLowerCase(),
      lore: boss.subtitle,
      defeated: counts.get(boss.id) ?? 0,
      boss: true,
    })),
  ];
}
/** A fundamental memory: its words once recovered. */
export interface MemoryEntry {
  id: string;
  number: string;
  found: boolean;
  speaker: string;
  lines: readonly string[];
}
export function memories(found: ReadonlySet<string>): MemoryEntry[] {
  return fundamentalMemories.map((id, i) => {
    const dialogue = (dialogues as Record<string, { speaker: string; lines: string[] }>)[id];
    return {
      id,
      number: String(i + 1).padStart(2, '0'),
      found: found.has(id),
      speaker: dialogue?.speaker ?? '',
      lines: found.has(id) ? (dialogue?.lines ?? []) : [],
    };
  });
}
