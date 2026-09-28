import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { Scene } from '@babylonjs/core/scene';
export type Vec3 = readonly [number, number, number];
export type RGB = readonly [number, number, number];
export const hexToRgb = (hex: string): RGB => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
};
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalize = (a: Vec3): Vec3 => {
  const length = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
};
/** Triangle wave in [0, 1] with peaks where cos(x) = 1: pointed pleat tips on a hem. */
const peaks = (x: number): number => 1 - Math.abs(((((x / (Math.PI * 2)) % 1) + 1) % 1) - 0.5) * 2;
export interface LatheOptions {
  segments: number;
  color: (ring: number, segment: number) => RGB;
  /** Axis position. */
  center?: Vec3;
  /** Radial folds that deepen towards the last ring. */
  pleats?: number;
  pleatDepth?: number;
  /** Pointed drop of the last ring, one point per pleat. */
  hemDepth?: number;
  /** Horizontal sweep of each ring along x, as a function of 0 (first ring) to 1 (last). */
  lean?: (t: number) => number;
  /** Squashes the revolution in depth. */
  depth?: number;
  /** Faces point towards the axis (inner linings). */
  inward?: boolean;
}
/**
 * Accumulates flat-coloured triangles for a stylised puppet and bakes a three-tone
 * toon shade into the vertex colours. Normals are welded by position so Babylon's
 * outline renderer draws a continuous ink contour around faceted shapes.
 */
export class PuppetGeometry {
  private positions: number[] = [];
  private colors: RGB[] = [];
  private normals: Vec3[] = [];
  /** Adds a triangle whose front face points away from `origin`. */
  tri(a: Vec3, b: Vec3, c: Vec3, color: RGB, origin: Vec3, inward = false): void {
    let n = cross(sub(a, b), sub(c, b));
    if (Math.hypot(n[0], n[1], n[2]) < 1e-9) return;
    const centroid: Vec3 = [
      (a[0] + b[0] + c[0]) / 3,
      (a[1] + b[1] + c[1]) / 3,
      (a[2] + b[2] + c[2]) / 3,
    ];
    const outward = sub(centroid, origin);
    // Babylon treats (a - b) x (c - b) as the front-face normal.
    if (dot(n, outward) * (inward ? -1 : 1) < 0) {
      [b, c] = [c, b];
      n = [-n[0], -n[1], -n[2]];
    }
    this.positions.push(...a, ...b, ...c);
    this.colors.push(color);
    this.normals.push(normalize(n));
  }
  quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, color: RGB, origin: Vec3, inward = false): void {
    this.tri(a, b, c, color, origin, inward);
    this.tri(a, c, d, color, origin, inward);
  }
  /** Surface of revolution around the vertical axis; `profile` lists [radius, y] rings. */
  lathe(profile: readonly (readonly [number, number])[], options: LatheOptions): void {
    const [cx, , cz] = options.center ?? [0, 0, 0];
    const rings: Vec3[][] = profile.map(([radius, y], i) => {
      const t = profile.length > 1 ? i / (profile.length - 1) : 0;
      const shift = options.lean?.(t) ?? 0;
      return Array.from({ length: options.segments }, (_, j) => {
        const angle = (j / options.segments) * Math.PI * 2;
        const fold = options.pleats ? Math.cos(options.pleats * angle) : 0;
        const r = radius * (1 + (options.pleatDepth ?? 0) * t * fold);
        const drop =
          i === profile.length - 1 && options.pleats
            ? (options.hemDepth ?? 0) * peaks(options.pleats * angle)
            : 0;
        return [
          cx + shift + Math.cos(angle) * r,
          y - drop,
          cz + Math.sin(angle) * r * (options.depth ?? 1),
        ] as const;
      });
    });
    for (let i = 0; i < rings.length - 1; i++)
      for (let j = 0; j < options.segments; j++) {
        const k = (j + 1) % options.segments;
        const a = rings[i]![j]!,
          b = rings[i]![k]!,
          c = rings[i + 1]![k]!,
          d = rings[i + 1]![j]!;
        const y = (a[1] + c[1]) / 2;
        const shift = options.lean?.((i + 0.5) / (rings.length - 1)) ?? 0;
        this.quad(a, b, c, d, options.color(i, j), [cx + shift, y, cz], options.inward);
      }
  }
  ellipsoid(center: Vec3, radii: Vec3, color: RGB, rings = 6, segments = 10): void {
    const point = (i: number, j: number): Vec3 => {
      const phi = (i / rings) * Math.PI;
      const theta = (j / segments) * Math.PI * 2;
      return [
        center[0] + Math.sin(phi) * Math.cos(theta) * radii[0],
        center[1] + Math.cos(phi) * radii[1],
        center[2] + Math.sin(phi) * Math.sin(theta) * radii[2],
      ];
    };
    for (let i = 0; i < rings; i++)
      for (let j = 0; j < segments; j++)
        this.quad(
          point(i, j),
          point(i, j + 1),
          point(i + 1, j + 1),
          point(i + 1, j),
          color,
          center,
        );
  }
  /** Axis-aligned box rotated around z by `angle` about its centre. */
  box(center: Vec3, size: Vec3, color: RGB, angle = 0): void {
    const [hx, hy, hz] = [size[0] / 2, size[1] / 2, size[2] / 2];
    const c = Math.cos(angle),
      s = Math.sin(angle);
    const p = (x: number, y: number, z: number): Vec3 => [
      center[0] + x * c - y * s,
      center[1] + x * s + y * c,
      center[2] + z,
    ];
    const v = [
      p(-hx, -hy, -hz),
      p(hx, -hy, -hz),
      p(hx, hy, -hz),
      p(-hx, hy, -hz),
      p(-hx, -hy, hz),
      p(hx, -hy, hz),
      p(hx, hy, hz),
      p(-hx, hy, hz),
    ];
    for (const [a, b, cc, d] of [
      [0, 1, 2, 3],
      [5, 4, 7, 6],
      [4, 0, 3, 7],
      [1, 5, 6, 2],
      [3, 2, 6, 7],
      [4, 5, 1, 0],
    ] as const)
      this.quad(v[a]!, v[b]!, v[cc]!, v[d]!, color, center);
  }
  /** Flat polygon facing the camera (-z), e.g. eyes, cracks and flags. */
  plate(points: readonly (readonly [number, number])[], z: number, color: RGB): void {
    const origin: Vec3 = [
      points.reduce((sum, p) => sum + p[0], 0) / points.length,
      points.reduce((sum, p) => sum + p[1], 0) / points.length,
      z + 1,
    ];
    for (let i = 1; i < points.length - 1; i++)
      this.tri(
        [points[0]![0], points[0]![1], z],
        [points[i]![0], points[i]![1], z],
        [points[i + 1]![0], points[i + 1]![1], z],
        color,
        origin,
      );
  }
  get triangles(): number {
    return this.normals.length;
  }
  /**
   * Builds the mesh. `light` points towards the key light; faces receive one of
   * three tones, and a soft vertical gradient grounds the silhouette.
   */
  build(scene: Scene, name: string, light: Vec3 = [-0.45, 0.75, -0.5], shade = true): Mesh {
    const l = normalize(light);
    const count = this.positions.length / 3;
    let minY = Infinity,
      maxY = -Infinity;
    for (let i = 1; i < this.positions.length; i += 3) {
      minY = Math.min(minY, this.positions[i]!);
      maxY = Math.max(maxY, this.positions[i]!);
    }
    const colors: number[] = [];
    this.normals.forEach((n, face) => {
      const d = dot(n, l);
      const tone = !shade ? 1 : d > 0.3 ? 1 : d > -0.25 ? 0.8 : 0.62;
      const [r, g, b] = this.colors[face]!;
      for (let k = 0; k < 3; k++) {
        const y = this.positions[(face * 3 + k) * 3 + 1]!;
        const ground = shade ? 0.82 + 0.18 * ((y - minY) / Math.max(1e-6, maxY - minY)) : 1;
        colors.push(r * tone * ground, g * tone * ground, b * tone * ground, 1);
      }
    });
    // Weld normals by position so the outline shell stays closed around hard edges.
    const welded = new Map<string, [number, number, number]>();
    const key = (i: number): string =>
      `${this.positions[i * 3]!.toFixed(4)},${this.positions[i * 3 + 1]!.toFixed(4)},${this.positions[i * 3 + 2]!.toFixed(4)}`;
    for (let i = 0; i < count; i++) {
      const n = this.normals[Math.floor(i / 3)]!;
      const sum = welded.get(key(i)) ?? [0, 0, 0];
      sum[0] += n[0];
      sum[1] += n[1];
      sum[2] += n[2];
      welded.set(key(i), sum);
    }
    const normals: number[] = [];
    for (let i = 0; i < count; i++) normals.push(...normalize(welded.get(key(i))!));
    const data = new VertexData();
    data.positions = this.positions;
    data.indices = Array.from({ length: count }, (_, i) => i);
    data.normals = normals;
    data.colors = colors;
    const mesh = new Mesh(name, scene);
    data.applyToMesh(mesh, false);
    mesh.isPickable = false;
    return mesh;
  }
}
