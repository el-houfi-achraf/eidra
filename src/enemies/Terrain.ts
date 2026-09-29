export interface Solid {
  x: number;
  y: number;
  w: number;
  h: number;
}
const left = (s: Solid): number => s.x - s.w / 2;
const right = (s: Solid): number => s.x + s.w / 2;
const top = (s: Solid): number => s.y + s.h / 2;
const bottom = (s: Solid): number => s.y - s.h / 2;
/**
 * Vertical band a body occupies: walkers stand on the highest slab under their
 * centre (gameplay heights are centres, so large bodies would otherwise sink into
 * the floor); flyers are centred on `y`. Null when a walker has no ground.
 */
export function bodyBand(
  solids: readonly Solid[],
  x: number,
  y: number,
  height: number,
  flying = false,
): [number, number] | null {
  if (flying) return [y - height / 2, y + height / 2];
  let ground: number | null = null;
  for (const s of solids)
    if (left(s) <= x && x <= right(s) && top(s) <= y + 0.05 && (ground === null || top(s) > ground))
      ground = top(s);
  return ground === null ? null : [ground, ground + height];
}
/**
 * Horizontal interval an enemy's centre may occupy: it stays on the floor it
 * stands on (contiguous floors at the same level merge) and never overlaps a
 * solid slab crossing its body. Flyers ignore floors but respect slabs in their band.
 */
export function walkableSpan(
  solids: readonly Solid[],
  x: number,
  y: number,
  radius: number,
  height: number,
  flying = false,
): [number, number] {
  const band = bodyBand(solids, x, y, height, flying);
  if (!band) return [x, x];
  const [feet, head] = band;
  let min = Number.NEGATIVE_INFINITY,
    max = Number.POSITIVE_INFINITY;
  if (!flying) {
    const floors = solids
      .filter((s) => Math.abs(top(s) - feet) <= 0.25)
      .map((s) => [left(s), right(s)] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const [a, b] of floors) {
      const last = merged.at(-1);
      if (last && a <= last[1] + 0.05) last[1] = Math.max(last[1], b);
      else merged.push([a, b]);
    }
    const floor = merged.find(([a, b]) => x >= a && x <= b);
    if (!floor) return [x, x];
    min = floor[0] + radius;
    max = floor[1] - radius;
  }
  for (const s of solids) {
    // Only slabs crossing the body's height block it; the floor underfoot does not.
    if (bottom(s) >= head - 0.05 || top(s) <= feet + 0.15) continue;
    if (right(s) <= x) min = Math.max(min, right(s) + radius);
    else if (left(s) >= x) max = Math.min(max, left(s) - radius);
  }
  return [min, Math.max(min, max)];
}
/** Keeps a body on its side of every closed gate. */
export function clampToGates(
  x: number,
  home: number,
  radius: number,
  gates: readonly number[],
  span: readonly [number, number],
): number {
  let [min, max] = span;
  for (const gate of gates) {
    if (home < gate) max = Math.min(max, gate - radius - 0.25);
    else min = Math.max(min, gate + radius + 0.25);
  }
  return Math.max(min, Math.min(max, x));
}
