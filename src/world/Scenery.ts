import type { ChunkData, Seal } from '../../game-data/zones/laboratory';
import { checkpoints } from '../../game-data/zones/laboratory';
import { moods } from '../../game-data/zones/moods';
import type { Mood } from '../../game-data/zones/moods';
import { PaintedGeometry, random } from './PaintedGeometry';
import type { Paint, Point, RGBA } from './PaintedGeometry';
import { mixRgb, roomTint, tintAt } from './Mood';
import type { RGB, Tint } from './Mood';
import { openings, roomAt, sectorOf, SHELL } from './Rooms';
/**
 * Painted set of a sector, as flat silhouettes stacked in depth like cut-out
 * layers: the nearer, the darker; the further, the more they melt into the haze.
 * Everything stays behind the play band (z > 3) or frames the screen edges from
 * the foreground (z < -6), so no shape ever hides a fighter.
 * TODO_ART: procedural silhouettes until painted production layers exist.
 */
export interface Scenery {
  /** Platform surfaces, lips, tufts and the nearest background layers. */
  near: PaintedGeometry;
  /** Middle, far and distant layers; dropped on LOW. */
  far: PaintedGeometry;
  /** Out-of-focus foreground silhouettes with feathered edges. */
  front: PaintedGeometry;
  /** Additive halos around lanterns, crystals and windows. */
  glow: PaintedGeometry;
  /** Additive light shafts. */
  shafts: PaintedGeometry;
  /** Remembered slabs, drawn as pale ghosts until Rémanence makes them solid. */
  memory: PaintedGeometry;
  /**
   * Height the layers are painted from: chambers are painted as if their floor
   * stood at the route's ground level, then raised or lowered into place.
   */
  offset: number;
}
/** Depth of each painted layer. */
export const LAYERS = {
  rear: 3.2,
  ceiling: 4,
  back: 6.5,
  mid: 14,
  far: 26,
  distant: 44,
  front: -7,
} as const;
/**
 * Painted front face of the walkable slabs, just in front of the fighters (z = 0):
 * the pale lip then runs along their feet, as a drawn ground line would.
 */
const FACE = -0.5;
/** Back edge of the slab colliders. */
const BACK = 2.4;
/** Ground slabs continue as dark earth down to the bottom of the screen. */
const EARTH = -14;
/** Colours the painters read: the route's blend along x, or one chamber's tint. */
let tone: (x: number) => Tint = tintAt;
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const rgba = (c: RGB, a = 1): RGBA => [c[0], c[1], c[2], a];
/** An axis-aligned quad between two corners, slightly irregular. */
function g4(
  g: PaintedGeometry,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  z: number,
  paint: Paint,
): void {
  const a = Math.min(x0, x1),
    b = Math.max(x0, x1);
  g.band([a, (a + b) / 2, b], [y0, y0 - 0.03, y0], [y1, y1 + 0.02, y1], z, paint);
}
/**
 * Colour of a layer at a given depth (0 = nearest, 1 = distant): darkest near,
 * lifting towards the horizon far away, with mist pooling near the floor.
 */
export function layerPaint(
  depth: number,
  lift = 0,
  tintOf: (x: number) => Tint = (x) => tone(x),
): Paint {
  return (x, y) => {
    const t = tintOf(x);
    const base =
      depth < 0.5 ? mixRgb(t.near, t.mid, depth / 0.5) : mixRgb(t.mid, t.far, (depth - 0.5) / 0.5);
    const hazy = mixRgb(base, t.horizon, depth * depth * 0.45);
    const mist = (1 - smooth(-4, 8, y)) * (0.2 + 0.55 * depth) * t.haze;
    const misted = mixRgb(hazy, t.mist, mist);
    // Tops fade into the dark vault; `lift` brightens accents such as lips and capitals.
    const vault = mixRgb(misted, t.sky, smooth(9, 22, y) * 0.4 * (1 - depth * 0.5));
    return rgba(mixRgb(vault, t.lip, lift));
  };
}
/** The sector's light colour at `x`, scaled: lanterns, windows, halos. */
const glowAt = (x: number, strength: number): RGBA => {
  const l = tone(x).light;
  return [l[0] * strength, l[1] * strength, l[2] * strength, 1];
};
const lightPaint =
  (strength: number): Paint =>
  (x) =>
    glowAt(x, strength);
/** Samples `count + 1` positions across [x0, x1]. */
const steps = (x0: number, x1: number, step: number): number[] => {
  const count = Math.max(1, Math.round((x1 - x0) / step));
  return Array.from({ length: count + 1 }, (_, i) => x0 + ((x1 - x0) * i) / count);
};
export type Rng = () => number;
const jitter = (rng: Rng, amount: number): number => (rng() - 0.5) * 2 * amount;
export function column(
  g: PaintedGeometry,
  rng: Rng,
  x: number,
  z: number,
  bottom: number,
  top: number,
  width: number,
  paint: Paint,
  capital: Paint,
): void {
  const broken = rng() < 0.35;
  const end = broken ? top - (1 + rng() * 3) : top;
  const spine: Point[] = [];
  const widths: number[] = [];
  const count = Math.max(3, Math.round((end - bottom) / 0.9));
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const y = bottom + (end - bottom) * t;
    spine.push([x + jitter(rng, width * 0.04) + (broken ? t * t * 0.3 : 0), y]);
    const flare = t < 0.08 ? 1.35 : 1;
    const chip = broken && t > 0.85 ? 0.55 + rng() * 0.3 : 1;
    widths.push(width * flare * chip * (0.94 + rng() * 0.12));
  }
  g.ribbon(spine, widths, z, paint);
  if (!broken) {
    const cap = width * 1.6;
    g.band(
      [x - cap / 2, x, x + cap / 2],
      [end - 0.35, end - 0.4, end - 0.35],
      [end, end + 0.08, end],
      z - 0.05,
      capital,
    );
  }
}
export function arch(
  g: PaintedGeometry,
  rng: Rng,
  cx: number,
  spring: number,
  z: number,
  radius: number,
  thickness: number,
  paint: Paint,
  pointed: boolean,
): void {
  const gap = rng() < 0.3 ? 3 + Math.floor(rng() * 8) : -1;
  let spine: Point[] = [];
  let widths: number[] = [];
  const flush = (): void => {
    g.ribbon(spine, widths, z, paint);
    spine = [];
    widths = [];
  };
  for (let i = 0; i <= 16; i++) {
    if (i === gap || i === gap + 1) {
      if (spine.length > 1) flush();
      else spine = [];
      continue;
    }
    const a = Math.PI - (i / 16) * Math.PI;
    // A pointed arch is two circle arcs whose centres are pushed apart.
    const side = Math.cos(a) >= 0 ? 1 : -1;
    const offset = pointed ? radius * 0.35 * side : 0;
    const r = pointed ? radius * 1.35 : radius;
    const x = cx - offset + Math.cos(a) * (pointed ? r - radius * 0.35 : r) + offset * 2;
    const y = spring + Math.sin(a) * r * (pointed ? 0.95 : 1);
    spine.push([x, y]);
    widths.push(thickness * (0.9 + rng() * 0.2));
  }
  if (spine.length > 1) flush();
}
export function hang(
  g: PaintedGeometry,
  rng: Rng,
  x: number,
  top: number,
  z: number,
  length: number,
  width: number,
  paint: Paint,
  upward = false,
): void {
  const spine: Point[] = [];
  const widths: number[] = [];
  const bend = jitter(rng, length * 0.12);
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    spine.push([x + bend * t * t, top + (upward ? 1 : -1) * length * t]);
    widths.push(width * (1 - t) ** 0.85 * (0.85 + rng() * 0.3) + 0.01);
  }
  g.ribbon(spine, widths, z, paint);
}
export function vine(
  g: PaintedGeometry,
  rng: Rng,
  x: number,
  top: number,
  z: number,
  length: number,
  paint: Paint,
): void {
  const spine: Point[] = [];
  const widths: number[] = [];
  const sway = 0.2 + rng() * 0.5;
  const phase = rng() * 6;
  const count = Math.max(4, Math.round(length / 0.5));
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const px = x + Math.sin(phase + t * 5) * sway * t;
    const py = top - length * t;
    spine.push([px, py]);
    widths.push(0.11 * (1 - t * 0.6));
    // Small leaves alternate along the vine.
    if (i > 0 && i < count && rng() < 0.45) {
      const side = i % 2 ? 1 : -1;
      g.triangle(
        [px, py],
        [px + side * (0.25 + rng() * 0.2), py + 0.1],
        [px + side * 0.08, py - 0.18],
        z,
        paint,
      );
    }
  }
  g.ribbon(spine, widths, z, paint);
}
function rubble(
  g: PaintedGeometry,
  rng: Rng,
  x0: number,
  x1: number,
  z: number,
  base: number,
  height: number,
  paint: Paint,
): void {
  const xs = steps(x0, x1, 0.45);
  let h = rng();
  const tops = xs.map(() => {
    h = Math.max(0, Math.min(1, h + jitter(rng, 0.28)));
    return base + height * (0.2 + 0.8 * h);
  });
  g.band(
    xs,
    xs.map(() => base - 3),
    tops,
    z,
    paint,
  );
}
function lantern(
  g: PaintedGeometry,
  glow: PaintedGeometry,
  rng: Rng,
  x: number,
  top: number,
  z: number,
  length: number,
  chain: Paint,
): void {
  g.ribbon(
    [
      [x, top],
      [x + jitter(rng, 0.05), top - length],
    ],
    [0.05, 0.05],
    z,
    chain,
  );
  const y = top - length - 0.35;
  const bright = lightPaint(1.15);
  // A small cage around a lumerite flame.
  g.triangle([x - 0.2, y], [x, y + 0.42], [x + 0.2, y], z - 0.02, bright);
  g.triangle([x - 0.2, y], [x, y - 0.3], [x + 0.2, y], z - 0.02, bright);
  const size = 3.2 + rng() * 1.8;
  glow.sprite(x, y, size, size, z - 0.1, glowAt(x, 0.75));
}
function crystals(
  g: PaintedGeometry,
  glow: PaintedGeometry,
  rng: Rng,
  x: number,
  y: number,
  z: number,
): void {
  const count = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < count; i++) {
    const lean = jitter(rng, 0.5);
    const h = 0.5 + rng() * 1.1;
    const w = 0.12 + rng() * 0.12;
    const bx = x + jitter(rng, 0.45);
    g.triangle([bx - w, y], [bx + lean * h, y + h], [bx + w, y], z, lightPaint(0.95));
  }
  glow.sprite(x, y + 0.5, 3.2, 3.2, z - 0.1, glowAt(x, 0.45));
}
function window(
  g: PaintedGeometry,
  glow: PaintedGeometry,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  frame?: Paint,
): void {
  const xs = steps(x - w / 2, x + w / 2, w / 8);
  const tops = xs.map((px) => y + h - (Math.abs(px - x) ** 1.6 * (h * 0.45)) / (w / 2) ** 1.6);
  // Warm at the sill, fading upwards into the tracery.
  const pane: Paint = (px, py) => {
    const k = 0.75 - 0.35 * smooth(y, y + h, py);
    return glowAt(px, k);
  };
  g.band(
    xs,
    xs.map(() => y),
    tops,
    z + 0.05,
    pane,
  );
  // Mullion and transom in the colour of the stone.
  if (frame) {
    g.ribbon(
      [
        [x, y],
        [x, y + h * 0.97],
      ],
      [w * 0.09, w * 0.09],
      z,
      frame,
    );
    g.ribbon(
      [
        [x - w / 2, y + h * 0.45],
        [x + w / 2, y + h * 0.45],
      ],
      [w * 0.07, w * 0.07],
      z,
      frame,
    );
  }
  glow.sprite(x, y + h * 0.55, w * 3.2, h * 1.5, z - 0.1, glowAt(x, 0.3));
}
function gear(
  g: PaintedGeometry,
  rng: Rng,
  cx: number,
  cy: number,
  z: number,
  radius: number,
  paint: Paint,
): void {
  const ring: Point[] = [];
  const widths: number[] = [];
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    ring.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]);
    widths.push(radius * 0.18);
  }
  g.ribbon(ring, widths, z, paint);
  const teeth = 10 + Math.floor(rng() * 6);
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const r0 = radius * 1.05,
      r1 = radius * 1.28;
    const da = 0.12;
    g.triangle(
      [cx + Math.cos(a - da) * r0, cy + Math.sin(a - da) * r0],
      [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1],
      [cx + Math.cos(a + da) * r0, cy + Math.sin(a + da) * r0],
      z,
      paint,
    );
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + rng();
    g.ribbon(
      [
        [cx, cy],
        [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius],
      ],
      [radius * 0.14, radius * 0.1],
      z,
      paint,
    );
  }
}
function banner(
  g: PaintedGeometry,
  rng: Rng,
  x: number,
  top: number,
  z: number,
  length: number,
  width: number,
  paint: Paint,
): void {
  const spine: Point[] = [];
  const widths: number[] = [];
  const sway = jitter(rng, 0.15);
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    spine.push([x + sway * t * t, top - length * t]);
    widths.push(width);
  }
  g.ribbon(spine, widths, z, paint);
  const end = top - length;
  // Swallow-tailed end.
  g.triangle(
    [x + sway - width / 2, end],
    [x + sway - width / 2, end - width * 0.8],
    [x + sway, end],
    z,
    paint,
  );
  g.triangle(
    [x + sway + width / 2, end],
    [x + sway + width / 2, end - width * 0.8],
    [x + sway, end],
    z,
    paint,
  );
}
/** A cold brazier bowl on a stepped foot, still smouldering at the rim. */
function brazier(
  g: PaintedGeometry,
  glow: PaintedGeometry,
  rng: Rng,
  x: number,
  bottom: number,
  z: number,
  size: number,
  paint: Paint,
): void {
  const top = bottom + size * 2.2;
  g.ribbon(
    [
      [x, bottom],
      [x, top - size * 0.6],
    ],
    [size * 0.5, size * 0.25],
    z,
    paint,
  );
  const xs = steps(x - size, x + size, size / 6);
  g.band(
    xs,
    xs.map((px) => top - size * 0.7 * (1 - ((px - x) / size) ** 2)),
    xs.map(() => top),
    z,
    paint,
  );
  const embers = lightPaint(0.9);
  for (let i = 0; i < 4; i++) {
    const ex = x + jitter(rng, size * 0.7);
    g.triangle(
      [ex - 0.15, top],
      [ex + jitter(rng, 0.1), top + 0.25 + rng() * 0.3],
      [ex + 0.15, top],
      z - 0.02,
      embers,
    );
  }
  glow.sprite(x, top + 0.3, size * 4, size * 3, z - 0.1, glowAt(x, 0.6));
}
/** A dead tree: a leaning trunk that splits into bare, thinning branches. */
export function tree(
  g: PaintedGeometry,
  rng: Rng,
  x: number,
  bottom: number,
  z: number,
  height: number,
  paint: Paint,
): void {
  const grow = (from: Point, angle: number, length: number, width: number, depth: number): void => {
    const spine: Point[] = [];
    const widths: number[] = [];
    const bend = jitter(rng, 0.35);
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      const a = angle + bend * t;
      spine.push([from[0] + Math.cos(a) * length * t, from[1] + Math.sin(a) * length * t]);
      widths.push(width * (1 - t * 0.65));
    }
    g.ribbon(spine, widths, z, paint);
    if (depth <= 0) return;
    const end = spine.at(-1)!;
    const branches = 2 + (rng() < 0.4 ? 1 : 0);
    for (let i = 0; i < branches; i++)
      grow(
        end,
        angle + bend + jitter(rng, 0.8),
        length * (0.55 + rng() * 0.2),
        width * 0.4,
        depth - 1,
      );
  };
  grow([x, bottom], Math.PI / 2 + jitter(rng, 0.15), height * 0.45, 0.35 + height * 0.04, 3);
}
/** Walkable slabs: dark mass, pale irregular lip along the edge, tufts and roots. */
function dressPlatforms(g: PaintedGeometry, rng: Rng, data: ChunkData, mood: Mood): void {
  const groundPaint: Paint = (x, y) => {
    const t = tone(x);
    return rgba(mixRgb(t.ground, t.near, 0.25 + 0.1 * Math.sin(x * 1.7 + y)));
  };
  const facePaint =
    (top: number): Paint =>
    (x, y) => {
      const t = tone(x);
      const deep = mixRgb(t.near, [0, 0, 0], 0.55 * smooth(top - 1.4, top - 3, y));
      return rgba(mixRgb(deep, mixRgb(t.ground, t.lip, 0.12), smooth(top - 1.4, top, y)));
    };
  const lipPaint: Paint = (x, y) => {
    const t = tone(x);
    return rgba(mixRgb(t.lip, t.ground, 0.25 + 0.2 * Math.sin(x * 3.1 + y * 7)));
  };
  const tuftPaint: Paint = (x) => rgba(mixRgb(tone(x).lip, tone(x).ground, 0.45));
  const backTuft: Paint = (x) => rgba(mixRgb(tone(x).ground, tone(x).lip, 0.15));
  const rootPaint: Paint = (x) => rgba(mixRgb(tone(x).near, tone(x).ground, 0.3));
  const stonePaint: Paint = (x) => rgba(mixRgb(tone(x).ground, tone(x).lip, 0.22));
  for (const p of data.platforms) {
    if (p.memory) continue;
    const left = p.x - p.w / 2,
      right = p.x + p.w / 2,
      top = p.y + p.h / 2,
      bottom = p.y - p.h / 2;
    g.floor(left, right, top, FACE, BACK, groundPaint);
    const xs = steps(left, right, 1.5);
    const depth = bottom < -1.5 ? EARTH : bottom;
    // Rows so the gradient stays near the lip instead of spreading over the whole face.
    const rows = [depth, Math.max(depth, top - 3), Math.max(depth, top - 1.4), top];
    for (let r = 1; r < rows.length; r++)
      if (rows[r]! > rows[r - 1]!)
        g.band(
          xs,
          xs.map(() => rows[r - 1]!),
          xs.map(() => rows[r]!),
          FACE,
          facePaint(top),
        );
    // Side walls read a little in perspective on floating slabs.
    for (const x of [left, right]) g.wall(x, depth, top, FACE, BACK, facePaint(top));
    const lip = steps(left, right, 0.4);
    g.band(
      lip,
      lip.map(() => top - 0.1 - rng() * 0.14),
      lip.map((_, i) => (i === 0 || i === lip.length - 1 ? top : top + 0.03 + rng() * 0.07)),
      FACE - 0.03,
      lipPaint,
    );
    // Stones and roots embedded in the earth just under the lip.
    if (bottom < -1.5)
      for (let x = left + rng() * 2; x < right - 0.5; x += 1.2 + rng() * 2.5) {
        const y = top - 0.35 - rng() * 1.1;
        const r = 0.12 + rng() * 0.2;
        g.triangle(
          [x - r, y],
          [x + jitter(rng, r * 0.4), y + r * 1.2],
          [x + r, y - r * 0.2],
          FACE - 0.01,
          stonePaint,
        );
        if (rng() < 0.4)
          g.ribbon(
            [
              [x, y + 0.3],
              [x + 0.5 + rng() * 0.8, y - 0.2 - rng() * 0.5],
            ],
            [0.07, 0.02],
            FACE - 0.01,
            rootPaint,
          );
      }
    const density = 0.35 + mood.overgrowth;
    for (let x = left + 0.3; x < right - 0.3; x += 0.35 + (rng() * 1.1) / density) {
      // Front tufts stay short: they may brush the fighters' feet, never hide them.
      const h = 0.08 + rng() * 0.16 * (0.5 + mood.overgrowth);
      const lean = jitter(rng, 0.12);
      g.triangle([x - 0.06, top], [x + lean, top + h], [x + 0.06, top], FACE - 0.06, tuftPaint);
      if (rng() < 0.6)
        g.triangle(
          [x - 0.1, top],
          [x + lean * 2, top + h * 2.4],
          [x + 0.1, top],
          BACK - 0.1,
          backTuft,
        );
    }
    if (bottom > -1.5)
      for (let x = left + 0.4; x < right - 0.3; x += 0.5 + rng() * 1.2)
        hang(
          g,
          rng,
          x,
          bottom + 0.05,
          FACE - 0.02,
          0.3 + rng() * (0.6 + mood.overgrowth),
          0.22,
          rootPaint,
        );
  }
}
/** Slabs of the past: luminous surface, bright rim and threads of light dripping below. */
function paintMemories(g: PaintedGeometry, rng: Rng, data: ChunkData): void {
  const pale: Paint = (x) => {
    const t = tone(x);
    return rgba(mixRgb(t.mist, t.light, 0.45), 0.8);
  };
  const rim: Paint = (x) => glowAt(x, 1);
  const thread: Paint = (x, y) => {
    const t = tone(x);
    return rgba(mixRgb(t.mist, t.light, 0.6), 0.1 + 0.5 * smooth(-3, 0.5, y));
  };
  for (const p of data.platforms) {
    if (!p.memory) continue;
    const left = p.x - p.w / 2,
      right = p.x + p.w / 2,
      top = p.y + p.h / 2,
      bottom = p.y - p.h / 2;
    g.floor(left, right, top, FACE, BACK, pale);
    const xs = steps(left, right, 0.5);
    g.band(
      xs,
      xs.map(() => bottom),
      xs.map(() => top),
      FACE,
      pale,
    );
    g.band(
      xs,
      xs.map(() => top - 0.07),
      xs.map((_, i) => (i === 0 || i === xs.length - 1 ? top : top + 0.03 + rng() * 0.04)),
      FACE - 0.02,
      rim,
    );
    for (let x = left + 0.3; x < right; x += 0.4 + rng() * 0.7)
      g.ribbon(
        [
          [x, bottom],
          [x + jitter(rng, 0.1), bottom - 0.4 - rng() * 1.4],
        ],
        [0.06, 0.01],
        FACE - 0.01,
        thread,
      );
  }
}
/** Paints one room. Deterministic: the room's seed drives every random choice. */
export function paintScenery(data: ChunkData): Scenery {
  if (data.kind === 'chamber') {
    const tint = roomTint(data);
    tone = () => tint;
    try {
      return paintChamber(data);
    } finally {
      tone = tintAt;
    }
  }
  return paintRoute(data);
}
/** Inside one of the ranges, grown by `pad`. */
const within = (x: number, ranges: readonly { from: number; to: number }[], pad: number): boolean =>
  ranges.some((r) => x > r.from - pad && x < r.to + pad);
/** Splits a sampled band into runs that avoid the ranges (openings in a vault or a wall). */
function bandAround(
  g: PaintedGeometry,
  xs: readonly number[],
  bottoms: readonly number[],
  tops: readonly number[],
  z: number,
  paint: Paint,
  ranges: readonly { from: number; to: number }[],
): void {
  let run: number[] = [];
  const flush = (): void => {
    if (run.length > 1)
      g.band(
        run.map((i) => xs[i]!),
        run.map((i) => bottoms[i]!),
        run.map((i) => tops[i]!),
        z,
        paint,
      );
    run = [];
  };
  xs.forEach((x, i) => {
    if (within(x, ranges, 0)) flush();
    else run.push(i);
  });
  flush();
}
/** A shaft mouth: darkness deepening away from the opening, so a hole reads as a way. */
function throat(
  g: PaintedGeometry,
  from: number,
  to: number,
  edge: number,
  depth: number,
  z: number,
  vertical: boolean,
  /** Metres over which the darkness deepens; the rest of the way is black. */
  fadeLength = Math.abs(depth),
): void {
  const end = edge + Math.sign(depth) * fadeLength;
  const fade: Paint = (x, y) => {
    const t = tone(x);
    const k = vertical ? smooth(edge, end, y) : smooth(edge, end, x);
    return rgba(mixRgb(mixRgb(t.near, [0, 0, 0], 0.55), [0, 0, 0], k), 1);
  };
  if (vertical) {
    const xs = steps(from, to, 0.5);
    const a = Math.min(edge, edge + depth),
      b = Math.max(edge, edge + depth);
    const rows = steps(a, b, Math.abs(depth) / 6);
    for (let r = 1; r < rows.length; r++)
      g.band(
        xs,
        xs.map(() => rows[r - 1]!),
        xs.map(() => rows[r]!),
        z,
        fade,
      );
  } else {
    const a = Math.min(edge, edge + depth),
      b = Math.max(edge, edge + depth);
    const xs = steps(a, b, Math.abs(depth) / 8);
    g.band(
      xs,
      xs.map(() => from),
      xs.map(() => to),
      z,
      fade,
    );
  }
}
function paintRoute(data: ChunkData): Scenery {
  const mood = moods[data.id] ?? moods.awakening!;
  // Chambers meet the route through holes in its floor and openings in its vault.
  const holes = openings(data);
  const vault = holes.filter((h) => h.side === 'top'),
    floor = holes.filter((h) => h.side === 'bottom');
  const rng = random(data.seed * 7919 + 13);
  const near = new PaintedGeometry(),
    far = new PaintedGeometry(),
    front = new PaintedGeometry(),
    glow = new PaintedGeometry(),
    shafts = new PaintedGeometry();
  const x0 = data.start - 4,
    x1 = data.end + 4;
  const rear = layerPaint(0.05),
    back = layerPaint(0.18),
    backCap = layerPaint(0.18, 0.18),
    mid = layerPaint(0.45),
    midCap = layerPaint(0.45, 0.12),
    farPaint = layerPaint(0.72),
    distant = layerPaint(0.95);
  dressPlatforms(near, rng, data, mood);
  // Rubble hides the back edge of the floor and gives the ground an organic skyline.
  rubble(near, rng, x0, x1, LAYERS.rear, -0.6, 1.4, rear);
  // Cavern ceiling with hanging teeth, just behind the play band.
  const ceilingXs = steps(x0, x1, 0.6);
  let bump = rng();
  const low = ceilingXs.map(() => {
    bump = Math.max(0, Math.min(1, bump + jitter(rng, 0.25)));
    return 11.2 + bump * 1.6;
  });
  bandAround(
    near,
    ceilingXs,
    low,
    ceilingXs.map(() => 26),
    LAYERS.ceiling,
    layerPaint(0.08),
    vault.map((h) => ({ from: h.from - 0.8, to: h.to + 0.8 })),
  );
  for (let x = x0 + rng() * 2; x < x1; x += 1.4 + rng() * 3.2)
    if (!within(x, vault, 1.2))
      hang(
        near,
        rng,
        x,
        12,
        LAYERS.ceiling - 0.05,
        0.8 + rng() * 2.4,
        0.5 + rng() * 0.7,
        layerPaint(0.08),
      );
  // Overgrowth: vines and roots falling from the vault.
  const vines = Math.round(4 + mood.overgrowth * 12);
  for (let i = 0; i < vines; i++) {
    const x = x0 + rng() * (x1 - x0);
    if (within(x, vault, 1)) continue;
    vine(
      near,
      rng,
      x,
      12.5,
      LAYERS.ceiling - 0.1,
      2 + rng() * 5 * (0.4 + mood.overgrowth),
      layerPaint(0.1),
    );
  }
  // Architecture of the sector.
  const span = x1 - x0;
  if (mood.motif === 'vault' || mood.motif === 'gallery' || mood.motif === 'throne') {
    const pitch = mood.motif === 'gallery' ? 7 : 9;
    for (let x = x0 + 2 + rng() * 2; x < x1; x += pitch + rng() * 2) {
      column(near, rng, x, LAYERS.back, -3, 10.5 + rng() * 2, 1 + rng() * 0.5, back, backCap);
      if (mood.motif === 'gallery' && x + pitch / 2 < x1)
        window(near, glow, x + pitch / 2, 3.2, LAYERS.back + 0.3, 1.6, 5, back);
    }
    for (let x = x0 + rng() * 6; x < x1; x += 12 + rng() * 5) {
      const r = 4 + rng() * 2;
      column(far, rng, x - r, LAYERS.mid, -4, 9 + rng() * 2, 1.8, mid, midCap);
      arch(far, rng, x, 9.5 + rng(), LAYERS.mid, r, 0.9, mid, mood.motif !== 'vault');
    }
  }
  if (mood.motif === 'abyss') {
    // Broken bridge piers dropping into the void and roots hanging over it.
    for (let x = x0 + 3; x < x1; x += 8 + rng() * 5) {
      column(near, rng, x, LAYERS.back, -14, -1 + rng() * 3, 1.3, back, backCap);
      hang(near, rng, x + 2, 12, LAYERS.back, 4 + rng() * 6, 0.35, back);
    }
    for (let x = x0; x < x1; x += 3 + rng() * 5)
      hang(far, rng, x, -2 - rng() * 2, LAYERS.mid, 5 + rng() * 6, 1 + rng(), mid);
  }
  if (mood.motif === 'machinery') {
    for (let x = x0 + 4; x < x1; x += 11 + rng() * 5) {
      gear(near, rng, x, 6 + rng() * 3, LAYERS.back, 1.4 + rng() * 1.2, backCap);
      near.ribbon(
        [
          [x + 3, 12.5],
          [x + 3, 1 + rng() * 3],
        ],
        [0.12, 0.12],
        LAYERS.back,
        back,
      );
      gear(far, rng, x + 5, 7 + rng() * 4, LAYERS.mid, 3 + rng() * 2, midCap);
    }
    // Pipes crossing the vault.
    for (let i = 0; i < 2; i++) {
      const y = 7.5 + i * 2.2 + rng();
      const xs = steps(x0, x1, 2);
      near.band(
        xs,
        xs.map(() => y),
        xs.map(() => y + 0.45),
        LAYERS.back + 0.2,
        backCap,
      );
    }
  }
  if (mood.motif === 'throne') {
    // Colossal vessels of the old order, hung with banners.
    for (let x = x0 + 5; x < x1; x += 10 + rng() * 4) {
      banner(near, rng, x, 11.8, LAYERS.back - 0.2, 4 + rng() * 2.5, 0.8, backCap);
      const bx = x + 5;
      column(far, rng, bx, LAYERS.mid, -4, 13, 2.4, mid, midCap);
    }
  }
  if (mood.motif === 'cinders') {
    // Charred stacks rising into the smoke, braziers along the rubble line.
    for (let x = x0 + 2 + rng() * 3; x < x1; x += 9 + rng() * 4) {
      column(near, rng, x, LAYERS.back, -3, 6 + rng() * 5, 1.4 + rng() * 0.6, back, backCap);
      brazier(near, glow, rng, x + 4.5, -0.4, LAYERS.back - 0.3, 0.6 + rng() * 0.3, backCap);
    }
    for (let x = x0 + rng() * 5; x < x1; x += 7 + rng() * 6) {
      const h = 10 + rng() * 6;
      column(far, rng, x, LAYERS.mid, -4, h, 2.6 + rng(), mid, midCap);
      // Embers still glowing at the chimney tops.
      glow.sprite(x, h + 0.5, 5, 4, LAYERS.mid - 0.2, glowAt(x, 0.3));
    }
  }
  if (mood.motif === 'garden') {
    // Dead trees in two ranks and the trellised arches of a forgotten garden.
    for (let x = x0 + 1 + rng() * 3; x < x1; x += 5 + rng() * 4)
      tree(near, rng, x, -0.8, LAYERS.back, 7 + rng() * 4, back);
    for (let x = x0 + rng() * 4; x < x1; x += 4 + rng() * 5)
      tree(far, rng, x, -4, LAYERS.mid, 11 + rng() * 5, mid);
    for (let x = x0 + 6 + rng() * 4; x < x1; x += 16 + rng() * 6)
      arch(far, rng, x, 6 + rng(), LAYERS.mid - 0.4, 3.2, 0.35, midCap, true);
  }
  // Lanterns hanging from the vault.
  for (let i = 0; i < mood.lanterns; i++) {
    const x = x0 + ((i + 0.5 + jitter(rng, 0.3)) / mood.lanterns) * span;
    lantern(near, glow, rng, x, 12.2, LAYERS.back - 0.4, 2.5 + rng() * 4, back);
  }
  // Lumerite growths on the rubble.
  for (let x = x0 + rng() * 8; x < x1; x += 9 + rng() * 9)
    crystals(near, glow, rng, x, 0.2, LAYERS.rear - 0.1);
  // Far cavern: giant teeth from above, spires from below.
  for (let x = x0 - 6; x < x1 + 6; x += 3 + rng() * 4) {
    hang(far, rng, x, 22, LAYERS.far, 5 + rng() * 9, 2 + rng() * 2.5, farPaint);
    if (rng() < 0.6)
      hang(far, rng, x + 1.5, -12, LAYERS.far, 8 + rng() * 10, 2.5 + rng() * 2, farPaint, true);
  }
  // Distant towers of the forgotten city, lost in the haze.
  for (let x = x0 - 10; x < x1 + 10; x += 5 + rng() * 6) {
    const h = 14 + rng() * 22;
    const w = 2.5 + rng() * 4;
    const xs = [x - w / 2, x - w * 0.3, x + w * 0.3, x + w / 2];
    far.band(
      xs,
      xs.map(() => -20),
      [h - 2.5, h, h, h - 2.5],
      LAYERS.distant,
      distant,
    );
    far.triangle([x - 0.5, h], [x, h + 3 + rng() * 5], [x + 0.5, h], LAYERS.distant, distant);
    if (rng() < 0.5)
      window(far, glow, x + jitter(rng, w * 0.25), h * 0.5, LAYERS.distant, 0.5, 1.2);
  }
  // Out-of-focus foreground: dark mounds below, roots above.
  const ink: Paint = (x) => rgba(mixRgb(tone(x).near, [0, 0, 0], 0.7));
  for (let x = x0 + rng() * 4; x < x1; x += 7 + rng() * 8) {
    const w = 3 + rng() * 4;
    // A shaft in the floor stays in view.
    if (within(x, floor, w / 2 + 1.5)) continue;
    const xs = steps(x - w / 2, x + w / 2, 0.5);
    front.band(
      xs,
      xs.map(() => -6),
      xs.map(
        (px) => -2.2 + Math.cos(((px - x) / w) * Math.PI) * (0.6 + rng() * 0.8) + rng() * 0.15,
      ),
      LAYERS.front,
      ink,
    );
    // Soft-edged grass on top of the mound.
    for (let k = 0; k < 4; k++) {
      const gx = x + jitter(rng, w * 0.35);
      front.ribbon(
        [
          [gx, -1.8],
          [gx + jitter(rng, 0.4), -0.6 - rng() * 0.8],
        ],
        [0.3, 0.02],
        LAYERS.front,
        ink,
        0.18,
      );
    }
  }
  for (let x = x0 + rng() * 6; x < x1; x += 9 + rng() * 9) {
    const spine: Point[] = [];
    const widths: number[] = [];
    const length = 2 + rng() * 2.5;
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      spine.push([x + Math.sin(t * 3 + x) * 0.4, 14 - length * t]);
      widths.push(0.9 * (1 - t) + 0.05);
    }
    front.ribbon(spine, widths, LAYERS.front, ink, 0.35);
  }
  // Light shafts through the vault: brighter where a lantern-rich mood lives.
  for (let i = 0; i < 3; i++) {
    const x = data.start + 7 + i * 13 + jitter(rng, 2);
    shafts.sprite(x, 7, 3.2 + (i % 2) * 2, 24, 4.5, glowAt(x, 1), -0.36 - (i % 2) * 0.08);
  }
  // Shafts: darkness under the holes in the floor, light falling through the vault.
  // Behind the slabs' back edge (the play band stays the fighters' own), in front of the rubble.
  for (const hole of floor) throat(near, hole.from, hole.to, 0.05, -14, LAYERS.rear - 0.25, true);
  for (const hole of vault) {
    const x = (hole.from + hole.to) / 2;
    shafts.sprite(x, 9, hole.to - hole.from + 1.6, 16, 3.5, glowAt(x, 1.1), 0);
    throat(near, hole.from, hole.to, 11, 6, LAYERS.ceiling + 0.4, true);
  }
  paintAnchors(glow, data, 0);
  const memory = new PaintedGeometry();
  paintMemories(memory, rng, data);
  return { near, far, front, glow, shafts, memory, offset: 0 };
}
/** Anchors of the room glow softly. */
function paintAnchors(glow: PaintedGeometry, data: ChunkData, offset: number): void {
  for (const c of checkpoints)
    if (roomAt(c.x, c.y + 0.5)?.id === data.id)
      glow.sprite(c.x, c.y + 1.7 - offset, 4.5, 4.5, 0.9, glowAt(c.x, 0.5));
}
/**
 * Cracked walls and shutters. A cracked wall is the room's own stone, its cracks a
 * shade paler than the rest: a wall worth striking for those who look. A shutter
 * is a grille of dark bars under a lintel; its lever stands on the far side.
 */
export function paintSeal(seal: Seal): PaintedGeometry {
  const room = roomAt(seal.x, seal.y);
  const tint = room?.kind === 'chamber' ? roomTint(room) : null;
  if (tint) tone = () => tint;
  try {
    const g = new PaintedGeometry();
    const rng = random(seal.id.length * 977 + Math.round(seal.x * 13));
    sealShape(g, rng, seal, 0);
    return g;
  } finally {
    tone = tintAt;
  }
}
function sealShape(g: PaintedGeometry, rng: Rng, seal: Seal, offset: number): void {
  const left = seal.x - seal.w / 2,
    right = seal.x + seal.w / 2,
    bottom = seal.y - seal.h / 2 - offset,
    top = seal.y + seal.h / 2 - offset;
  const xs = steps(left, right, 0.25);
  if (seal.kind === 'cracked') {
    const stone: Paint = (x, y) => {
      const t = tone(x);
      return rgba(mixRgb(t.near, t.ground, 0.45 + 0.08 * Math.sin(x * 5 + y * 3)));
    };
    const crack: Paint = (x) => rgba(mixRgb(tone(x).ground, tone(x).lip, 0.5));
    g.band(
      xs,
      xs.map(() => bottom),
      xs.map(() => top),
      FACE - 0.05,
      stone,
    );
    // A branching crack from top to bottom, and a few short ones.
    let x = seal.x + jitter(rng, seal.w * 0.2);
    const spine: Point[] = [];
    for (let y = top; y >= bottom; y -= Math.max(0.2, seal.h / 9)) {
      spine.push([x, y]);
      x = Math.max(left + 0.05, Math.min(right - 0.05, x + jitter(rng, 0.18)));
    }
    g.ribbon(
      spine,
      spine.map(() => 0.05),
      FACE - 0.08,
      crack,
    );
    for (let i = 0; i < 4; i++) {
      const [cx, cy] = spine[1 + Math.floor(rng() * Math.max(1, spine.length - 2))]!;
      g.ribbon(
        [
          [cx, cy],
          [cx + jitter(rng, 0.4), cy - 0.2 - rng() * 0.4],
        ],
        [0.04, 0.015],
        FACE - 0.08,
        crack,
      );
    }
    return;
  }
  const iron: Paint = (x) => rgba(mixRgb(tone(x).near, [0, 0, 0], 0.35));
  const brass: Paint = (x) => rgba(mixRgb(tone(x).ground, tone(x).lip, 0.4));
  const horizontal = seal.w > seal.h;
  const span = horizontal ? seal.w : seal.h;
  const count = Math.max(3, Math.round(span / 0.32));
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    if (horizontal) {
      const x = left + t * seal.w;
      g.ribbon(
        [
          [x, bottom],
          [x, top],
        ],
        [0.09, 0.09],
        FACE - 0.05,
        iron,
      );
    } else {
      const y = bottom + t * seal.h;
      g.ribbon(
        [
          [left, y],
          [right, y],
        ],
        [0.09, 0.09],
        FACE - 0.05,
        iron,
      );
    }
  }
  // Frame in tarnished brass.
  const frame = (a: Point, b: Point): void => g.ribbon([a, b], [0.14, 0.14], FACE - 0.07, brass);
  frame([left, top], [right, top]);
  frame([left, bottom], [right, bottom]);
  frame([left, bottom], [left, top]);
  frame([right, bottom], [right, top]);
  if (seal.lever) {
    const lx = seal.lever.x,
      ly = seal.lever.y - offset;
    g.ribbon(
      [
        [lx, ly],
        [lx, ly + 0.9],
      ],
      [0.12, 0.08],
      FACE - 0.05,
      iron,
    );
    g.ribbon(
      [
        [lx, ly + 0.85],
        [lx + 0.35, ly + 1.25],
      ],
      [0.08, 0.06],
      FACE - 0.06,
      brass,
    );
    g.triangle(
      [lx + 0.25, ly + 1.2],
      [lx + 0.38, ly + 1.42],
      [lx + 0.48, ly + 1.2],
      FACE - 0.07,
      lightPaint(1.2),
    );
  }
}
/** Depth of a chamber's far wall: behind its pillars, in front of the sky. */
const CHAMBER_WALL = 20;
/** Metres the rock and the far wall reach past a chamber's box, beyond any view of it. */
const ROCK = 14;
/** Depth of a doorway's darkness: just behind the fighters, in front of everything else. */
const DOORWAY = 0.6;
/**
 * A closed chamber: rock all around, a far wall of dressed stone, pillars and
 * arches in two depths, the sector's own ornaments, and openings where its doors
 * lead on. Painted with its floor at height 0, then moved into place (`offset`).
 */
function paintChamber(data: ChunkData): Scenery {
  const mood = moods[data.id] ?? moods[sectorOf(data).id] ?? moods.awakening!;
  const rng = random(data.seed * 7919 + 13);
  const near = new PaintedGeometry(),
    far = new PaintedGeometry(),
    front = new PaintedGeometry(),
    glow = new PaintedGeometry(),
    shafts = new PaintedGeometry();
  const base = data.bottom + SHELL;
  const L = data.start,
    R = data.end;
  // Inner faces of the walls and of the vault, in painting coordinates.
  const left = L + SHELL,
    right = R - SHELL,
    vaultY = data.top - SHELL - base;
  const doors = data.doors.map((d) =>
    d.side === 'left' || d.side === 'right' ? { ...d, from: d.from - base, to: d.to - base } : d,
  );
  const side = (s: string) => doors.filter((d) => d.side === s);
  const rear = layerPaint(0.05),
    back = layerPaint(0.2),
    backCap = layerPaint(0.2, 0.18),
    mid = layerPaint(0.45),
    midCap = layerPaint(0.45, 0.12);
  // The far wall: dressed stone in courses, mist pooling at its foot.
  const wallXs = steps(L - ROCK, R + ROCK, 1);
  const rows = steps(-ROCK, vaultY + ROCK, 2);
  const stone = layerPaint(0.62);
  for (let r = 1; r < rows.length; r++)
    far.band(
      wallXs,
      wallXs.map(() => rows[r - 1]!),
      wallXs.map(() => rows[r]!),
      CHAMBER_WALL,
      stone,
    );
  const joint = layerPaint(0.62, 0.07);
  for (let y = 0.9; y < vaultY + 4; y += 1.1 + rng() * 0.3) {
    for (let x = L - 2 + rng() * 2; x < R + 2; x += 2.5 + rng() * 2) {
      const w = 1.6 + rng() * 1.6;
      far.ribbon(
        [
          [x, y],
          [x + w, y + jitter(rng, 0.05)],
        ],
        [0.06, 0.06],
        CHAMBER_WALL - 0.05,
        joint,
      );
    }
  }
  // Pillars and arches: tall ones far away, the motif of the sector nearer.
  const pitch = mood.motif === 'gallery' ? 7 : 9;
  for (let x = left + 2 + rng() * 3; x < right - 1; x += pitch + rng() * 3) {
    column(far, rng, x, LAYERS.mid, -2, vaultY + 1, 1.5 + rng() * 0.4, mid, midCap);
    const r = Math.min(pitch / 2, (vaultY - 1) / 2.4);
    if (x + pitch < right && r > 1.2)
      arch(far, rng, x + pitch / 2, Math.max(2, vaultY - r - 0.8), LAYERS.mid, r, 0.7, mid, true);
  }
  for (let x = left + 1 + rng() * 4; x < right - 1; x += 6 + rng() * 5) {
    switch (mood.motif) {
      case 'gallery':
        column(near, rng, x, LAYERS.back, -1, Math.min(vaultY, 10), 0.9, back, backCap);
        if (x + 3 < right && vaultY > 5)
          window(near, glow, x + 3, 2.6, LAYERS.back + 0.3, 1.4, 4, back);
        break;
      case 'machinery':
        gear(
          near,
          rng,
          x,
          Math.min(vaultY - 2, 3 + rng() * vaultY * 0.6),
          LAYERS.back,
          1 + rng(),
          backCap,
        );
        break;
      case 'abyss':
      case 'garden':
        hang(near, rng, x, vaultY, LAYERS.back, 2 + rng() * Math.min(8, vaultY * 0.5), 0.5, back);
        break;
      case 'throne':
        banner(
          near,
          rng,
          x,
          vaultY - 0.2,
          LAYERS.back - 0.2,
          Math.min(5, vaultY * 0.5),
          0.8,
          backCap,
        );
        break;
      default:
        column(near, rng, x, LAYERS.back, -1, Math.min(vaultY, 9) - rng() * 2, 1, back, backCap);
    }
  }
  // Floor of the chamber and its own slabs, dressed like the route's.
  const floorPieces = cutRange(L, R, side('bottom')).map(([a, b]) => ({
    x: (a + b) / 2,
    y: -15,
    w: b - a,
    h: 30,
    memory: false,
  }));
  const local = {
    ...data,
    platforms: [...floorPieces, ...data.platforms.map((p) => ({ ...p, y: p.y - base }))],
  };
  dressPlatforms(near, rng, local, mood);
  rubble(near, rng, left, right, LAYERS.rear, -0.6, 1.2, rear);
  for (let x = left + 2 + rng() * 4; x < right - 1; x += 7 + rng() * 8)
    if (!within(x, side('bottom'), 1.5)) crystals(near, glow, rng, x, 0.2, LAYERS.rear - 0.1);
  // Rock all around: walls and vault, open at the doors.
  const rock: Paint = (x, y) => {
    const t = tone(x);
    return rgba(
      mixRgb(mixRgb(t.near, [0, 0, 0], 0.35), t.ground, 0.12 + 0.05 * Math.sin(x * 2.1 + y * 1.3)),
    );
  };
  const rim: Paint = (x) => rgba(mixRgb(tone(x).ground, tone(x).lip, 0.35));
  /** Stone set in the rock: lighter by the room, darker deeper in. */
  const block =
    (depth: number): Paint =>
    (x) => {
      const t = tone(x);
      const face = mixRgb(t.near, t.ground, 0.55);
      return rgba(mixRgb(face, [0, 0, 0], Math.min(0.85, depth / 3)));
    };
  const wallSide = (inner: number, outer: number, doorsHere: typeof doors): void => {
    const xs = steps(Math.min(inner, outer), Math.max(inner, outer), 0.7);
    for (const [a, b] of cutRange(-ROCK, vaultY + ROCK, doorsHere)) {
      near.band(
        xs,
        xs.map(() => a),
        xs.map(() => b),
        FACE - 0.02,
        rock,
      );
      // Ragged inner edge, catching a little light.
      const ys = steps(Math.max(a, -0.2), Math.min(b, vaultY + 0.2), 0.6);
      if (ys.length > 1)
        near.ribbon(
          ys.map((y) => [inner + jitter(rng, 0.05), y] as Point),
          ys.map(() => 0.1 + rng() * 0.06),
          FACE - 0.04,
          rim,
        );
      // Blocks of dressed stone in the rock near the room, fading into the dark.
      const into = outer > inner ? 1 : -1;
      for (let y = Math.max(a, -1) + rng() * 0.8; y < Math.min(b, vaultY + 1) - 0.4;) {
        const h = 0.5 + rng() * 0.6,
          depth = 0.3 + rng() * 2.2,
          w = 0.6 + rng() * 0.9;
        const x0 = inner + into * depth;
        g4(near, x0, y, x0 + into * w, y + h, FACE - 0.03, block(depth));
        y += h + 0.15 + rng() * 0.5;
      }
    }
    // A dark passage runs through the rock, just behind the fighters, to its far side;
    // its sill catches the light and a glow waits at its far end.
    for (const door of doorsHere) {
      const into = outer > inner ? 1 : -1;
      const lip = steps(Math.min(inner, inner + into * 4), Math.max(inner, inner + into * 4), 0.4);
      near.band(
        lip,
        lip.map(() => door.from - 0.12),
        lip.map(() => door.from + 0.04 + rng() * 0.04),
        FACE - 0.03,
        (x) => {
          const t = tone(x);
          const pale = mixRgb(t.ground, t.lip, 0.35);
          return rgba(mixRgb(pale, [0, 0, 0], smooth(0, 4, Math.abs(x - inner))));
        },
      );
      glow.sprite(
        inner + into * 4.5,
        (door.from + door.to) / 2,
        3,
        door.to - door.from + 1,
        DOORWAY + 0.05,
        glowAt(inner, 0.22),
      );
      throat(
        near,
        door.from - 1,
        door.to + 0.6,
        inner,
        (outer > inner ? 1 : -1) * (ROCK + SHELL),
        DOORWAY,
        false,
        5,
      );
    }
  };
  wallSide(left, L - ROCK, side('left'));
  wallSide(right, R + ROCK, side('right'));
  const vaultXs = steps(L - ROCK, R + ROCK, 0.6);
  let bump = rng();
  const lows = vaultXs.map(() => {
    bump = Math.max(0, Math.min(1, bump + jitter(rng, 0.25)));
    return vaultY - 0.1 - bump * 0.35;
  });
  bandAround(
    near,
    vaultXs,
    lows,
    vaultXs.map(() => vaultY + ROCK),
    FACE - 0.03,
    rock,
    side('top'),
  );
  for (let x = left + rng(); x < right; x += 1.2 + rng() * 2.6)
    if (!within(x, side('top'), 0.6))
      hang(near, rng, x, vaultY, FACE - 0.05, 0.4 + rng() * 1.3, 0.35 + rng() * 0.3, rock);
  const vines = Math.round((2 + mood.overgrowth * 8) * ((right - left) / 30));
  for (let i = 0; i < vines; i++) {
    const x = left + rng() * (right - left);
    if (!within(x, side('top'), 0.8))
      vine(
        near,
        rng,
        x,
        vaultY,
        LAYERS.rear - 0.2,
        1.5 + rng() * Math.min(6, vaultY * 0.4),
        layerPaint(0.1),
      );
  }
  for (const door of side('top')) {
    throat(near, door.from, door.to, vaultY - 1, ROCK + 1, DOORWAY, true, 6);
    const x = (door.from + door.to) / 2;
    shafts.sprite(x, vaultY - 5, door.to - door.from + 1.4, 12, 3, glowAt(x, 1.1), 0);
  }
  for (const door of side('bottom'))
    throat(near, door.from, door.to, 0.25, -(ROCK + 0.25), DOORWAY, true, 6);
  // Lanterns hang from the vault; a slanting shaft falls from a crack high up.
  const lanterns = Math.max(1, Math.round((mood.lanterns * (right - left)) / 40));
  for (let i = 0; i < lanterns; i++) {
    const x = left + ((i + 0.5 + jitter(rng, 0.3)) / lanterns) * (right - left);
    if (!within(x, side('top'), 1))
      lantern(
        near,
        glow,
        rng,
        x,
        vaultY,
        LAYERS.back - 0.4,
        1.5 + rng() * Math.min(4, vaultY * 0.3),
        back,
      );
  }
  const sx = left + (right - left) * (0.3 + rng() * 0.4);
  shafts.sprite(sx, vaultY * 0.55, 2.6, vaultY * 1.3, 4.5, glowAt(sx, 0.8), -0.3);
  // Out-of-focus roots and teeth framing the top of the view.
  const ink: Paint = (x) => rgba(mixRgb(tone(x).near, [0, 0, 0], 0.7));
  for (let x = left + rng() * 6; x < right; x += 8 + rng() * 9) {
    const spine: Point[] = [];
    const widths: number[] = [];
    const length = 1.5 + rng() * 2;
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      spine.push([x + Math.sin(t * 3 + x) * 0.3, vaultY + 1.2 - length * t]);
      widths.push(0.8 * (1 - t) + 0.05);
    }
    front.ribbon(spine, widths, LAYERS.front, ink, 0.35);
  }
  paintAnchors(glow, data, base);
  const memory = new PaintedGeometry();
  paintMemories(memory, rng, local);
  return { near, far, front, glow, shafts, memory, offset: base };
}
/** Cuts door ranges out of the span [a, b]. */
function cutRange(
  a: number,
  b: number,
  doors: readonly { from: number; to: number }[],
): [number, number][] {
  const spans: [number, number][] = [];
  let from = a;
  for (const door of [...doors].sort((p, q) => p.from - q.from)) {
    if (door.from > from) spans.push([from, Math.min(door.from, b)]);
    from = Math.max(from, door.to);
  }
  if (b > from) spans.push([from, b]);
  return spans.filter(([p, q]) => q - p > 0.01);
}
