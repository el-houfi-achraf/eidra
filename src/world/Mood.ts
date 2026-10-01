import { routeChunks } from '../../game-data/zones/laboratory';
import type { ChunkData } from '../../game-data/zones/laboratory';
import { moods } from '../../game-data/zones/moods';
import { sectorOf } from './Rooms';
import type { Mood } from '../../game-data/zones/moods';
export type RGB = [number, number, number];
/** A mood with its colours decoded to linear 0..1 triples. */
export interface Tint {
  fog: RGB;
  sky: RGB;
  horizon: RGB;
  far: RGB;
  mid: RGB;
  near: RGB;
  ground: RGB;
  lip: RGB;
  mist: RGB;
  light: RGB;
  haze: number;
}
const COLORS = [
  'fog',
  'sky',
  'horizon',
  'far',
  'mid',
  'near',
  'ground',
  'lip',
  'mist',
  'light',
] as const;
export const hexToRgb = (hex: string): RGB => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
];
export const mixRgb = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
export function toTint(mood: Mood): Tint {
  const tint = { haze: mood.haze } as Tint;
  for (const key of COLORS) tint[key] = hexToRgb(mood[key]);
  return tint;
}
export function mixTint(a: Tint, b: Tint, t: number): Tint {
  const tint = { haze: a.haze + (b.haze - a.haze) * t } as Tint;
  for (const key of COLORS) tint[key] = mixRgb(a[key], b[key], t);
  return tint;
}
/** Metres over which two neighbouring sectors cross-fade their colours. */
export const BLEND = 12;
const sectors = routeChunks.map((chunk) => ({
  start: chunk.start,
  end: chunk.end,
  tint: toTint(moods[chunk.id] ?? moods.awakening!),
}));
const smooth = (t: number): number => t * t * (3 - 2 * t);
const roomTints = new Map<string, Tint>();
/**
 * Colour identity of a chamber: its own mood if it has one, else its sector's. A
 * chamber is one closed space, so its colours do not drift as the camera moves.
 */
export function roomTint(room: ChunkData): Tint {
  let tint = roomTints.get(room.id);
  if (!tint) {
    tint = toTint(moods[room.id] ?? moods[sectorOf(room).id] ?? moods.awakening!);
    roomTints.set(room.id, tint);
  }
  return tint;
}
/** Colour identity along the route, blended smoothly across sector borders. */
export function tintAt(x: number): Tint {
  const last = sectors.length - 1;
  let i = sectors.findIndex((s) => x < s.end);
  if (i < 0) i = last;
  const sector = sectors[i]!;
  const fromStart = x - sector.start,
    toEnd = sector.end - x;
  if (i > 0 && fromStart < BLEND / 2)
    return mixTint(sectors[i - 1]!.tint, sector.tint, smooth(0.5 + fromStart / BLEND));
  if (i < last && toEnd < BLEND / 2)
    return mixTint(sectors[i + 1]!.tint, sector.tint, smooth(0.5 + toEnd / BLEND));
  return sector.tint;
}
