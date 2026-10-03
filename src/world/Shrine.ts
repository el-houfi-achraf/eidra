import { shrineLooks } from '../../game-data/abilities/abilities';
import type { Solid } from '../enemies/Terrain';
/** A ring turning round a power's orb: its size, its tilt and how fast it turns. */
export interface ShrineRing {
  diameter: number;
  tilt: number;
  speed: number;
}
/**
 * Where the parts of a power's shrine stand (D037): a rune on the ground under the
 * relic, a column of light rising from it, the orb at the relic's height and its
 * rings. No slab and no gem: those are an anchor's.
 */
export interface ShrinePlan {
  x: number;
  /** Top of the ground under the relic, where the rune lies. */
  ground: number;
  /** Height of the orb. */
  orb: number;
  color: string;
  runeDiameter: number;
  beamHeight: number;
  rings: ShrineRing[];
}
/** Top of the highest solid under (x, y), or a little under y when none stands there. */
function groundUnder(x: number, y: number, solids: readonly Solid[]): number {
  let ground = Number.NEGATIVE_INFINITY;
  for (const s of solids) {
    const top = s.y + s.h / 2;
    if (Math.abs(x - s.x) <= s.w / 2 && top <= y + 0.01 && top > ground) ground = top;
  }
  return Number.isFinite(ground) ? ground : y - 1.3;
}
/** The shrine of a power relic, or null for anything that is not a power. */
export function shrinePlan(
  id: string,
  x: number,
  y: number,
  solids: readonly Solid[],
): ShrinePlan | null {
  const look = (shrineLooks as Record<string, (typeof shrineLooks)['dash'] | undefined>)[id];
  if (!look) return null;
  return {
    x,
    ground: groundUnder(x, y, solids),
    orb: y,
    color: look.color,
    runeDiameter: 1.8,
    beamHeight: 6,
    rings: Array.from({ length: look.rings }, (_, i) => ({
      diameter: 0.85 + i * 0.22,
      tilt: 0.5 + i * 0.9,
      speed: (i % 2 ? -1 : 1) * (1.1 + i * 0.35),
    })),
  };
}
