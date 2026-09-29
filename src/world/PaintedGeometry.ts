import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { Scene } from '@babylonjs/core/scene';
export type RGBA = readonly [number, number, number, number];
export type Point = readonly [number, number];
/** Colour of a painted vertex from its world position. */
export type Paint = (x: number, y: number) => RGBA;
/** Seeded generator (mulberry32): the same seed always paints the same set. */
export function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** World units per repetition of the painted noise texture. */
const UV_SCALE = 0.3;
/**
 * Flat, unlit shapes for the painted layers: every primitive is a strip, so
 * concave silhouettes (roots, broken pillars, cavern ceilings) never need a
 * general triangulator. Vertices carry their colour; UVs are planar in world
 * space so one tiling brush texture covers every layer seamlessly.
 */
export class PaintedGeometry {
  readonly positions: number[] = [];
  readonly colors: number[] = [];
  readonly uvs: number[] = [];
  readonly indices: number[] = [];
  get vertexCount(): number {
    return this.positions.length / 3;
  }
  get triangleCount(): number {
    return this.indices.length / 3;
  }
  private vertex(
    x: number,
    y: number,
    z: number,
    color: RGBA,
    u = x * UV_SCALE,
    v = y * UV_SCALE,
  ): number {
    this.positions.push(x, y, z);
    this.colors.push(color[0], color[1], color[2], color[3]);
    this.uvs.push(u, v);
    return this.vertexCount - 1;
  }
  /** Two triangles; painted materials are double-sided, so winding does not matter. */
  private face(a: number, b: number, c: number, d: number): void {
    this.indices.push(a, b, c, a, c, d);
  }
  /**
   * Strip of varying width along a spine (pillars, roots, vines, stalactites).
   * With `feather`, an outer rim fades to transparent: soft, out-of-focus edges.
   */
  ribbon(
    spine: readonly Point[],
    widths: readonly number[],
    z: number,
    paint: Paint,
    feather = 0,
  ): void {
    if (spine.length < 2) return;
    const rows: number[][] = [];
    for (let i = 0; i < spine.length; i++) {
      const [x, y] = spine[i]!;
      const prev = spine[Math.max(0, i - 1)]!,
        next = spine[Math.min(spine.length - 1, i + 1)]!;
      const dx = next[0] - prev[0],
        dy = next[1] - prev[1];
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length,
        ny = dx / length;
      const half = Math.max(0, widths[Math.min(i, widths.length - 1)]!) / 2;
      const color = paint(x, y);
      const row = [
        this.vertex(x + nx * half, y + ny * half, z, color),
        this.vertex(x - nx * half, y - ny * half, z, color),
      ];
      if (feather > 0) {
        const clear: RGBA = [color[0], color[1], color[2], 0];
        const outer = half + feather;
        row.unshift(this.vertex(x + nx * outer, y + ny * outer, z, clear));
        row.push(this.vertex(x - nx * outer, y - ny * outer, z, clear));
      }
      rows.push(row);
    }
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1]!,
        b = rows[i]!;
      for (let k = 0; k < a.length - 1; k++) this.face(a[k]!, a[k + 1]!, b[k + 1]!, b[k]!);
    }
  }
  /** Horizontal band between a lower and an upper height profile (rubble, lips, ceilings). */
  band(
    xs: readonly number[],
    bottoms: readonly number[],
    tops: readonly number[],
    z: number,
    paint: Paint,
  ): void {
    let previous: [number, number] | null = null;
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i]!,
        bottom = bottoms[i]!,
        top = Math.max(bottom, tops[i]!);
      const pair: [number, number] = [
        this.vertex(x, bottom, z, paint(x, bottom)),
        this.vertex(x, top, z, paint(x, top)),
      ];
      if (previous) this.face(previous[0], pair[0], pair[1], previous[1]);
      previous = pair;
    }
  }
  /** Single blade or thorn. */
  triangle(a: Point, b: Point, c: Point, z: number, paint: Paint): void {
    const ia = this.vertex(a[0], a[1], z, paint(a[0], a[1]));
    const ib = this.vertex(b[0], b[1], z, paint(b[0], b[1]));
    const ic = this.vertex(c[0], c[1], z, paint(c[0], c[1]));
    this.indices.push(ia, ib, ic);
  }
  /** Horizontal surface between two depths (the walkable tops of slabs). */
  floor(x0: number, x1: number, y: number, z0: number, z1: number, paint: Paint): void {
    const a = this.vertex(x0, y, z0, paint(x0, y), x0 * UV_SCALE, z0 * UV_SCALE);
    const b = this.vertex(x1, y, z0, paint(x1, y), x1 * UV_SCALE, z0 * UV_SCALE);
    const c = this.vertex(x1, y, z1, paint(x1, y), x1 * UV_SCALE, z1 * UV_SCALE);
    const d = this.vertex(x0, y, z1, paint(x0, y), x0 * UV_SCALE, z1 * UV_SCALE);
    this.face(a, b, c, d);
  }
  /** Vertical surface facing along x (the sides of slabs). */
  wall(x: number, y0: number, y1: number, z0: number, z1: number, paint: Paint): void {
    const a = this.vertex(x, y0, z0, paint(x, y0), z0 * UV_SCALE, y0 * UV_SCALE);
    const b = this.vertex(x, y0, z1, paint(x, y0), z1 * UV_SCALE, y0 * UV_SCALE);
    const c = this.vertex(x, y1, z1, paint(x, y1), z1 * UV_SCALE, y1 * UV_SCALE);
    const d = this.vertex(x, y1, z0, paint(x, y1), z0 * UV_SCALE, y1 * UV_SCALE);
    this.face(a, b, c, d);
  }
  /** Textured quad with 0..1 UVs, for sprites such as halos and light shafts. */
  sprite(
    x: number,
    y: number,
    width: number,
    height: number,
    z: number,
    color: RGBA,
    rotation = 0,
  ): void {
    const c = Math.cos(rotation),
      s = Math.sin(rotation);
    const corner = (u: number, v: number): number => {
      const lx = (u - 0.5) * width,
        ly = (v - 0.5) * height;
      return this.vertex(x + lx * c - ly * s, y + lx * s + ly * c, z, color, u, v);
    };
    this.face(corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1));
  }
  build(scene: Scene, name: string): Mesh | null {
    if (this.indices.length === 0) return null;
    const data = new VertexData();
    data.positions = this.positions;
    data.colors = this.colors;
    data.uvs = this.uvs;
    data.indices = this.indices;
    const mesh = new Mesh(name, scene);
    data.applyToMesh(mesh);
    mesh.isPickable = false;
    return mesh;
  }
}
