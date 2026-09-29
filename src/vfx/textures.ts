import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Scene } from '@babylonjs/core/scene';
/**
 * Small procedural RGBA textures generated once at load. They replace external
 * art for gradients (sky, light shafts, soft sprites) until the production pipeline.
 * TODO_ART: replace with painted KTX2 textures once the art pipeline is equipped.
 */
export function proceduralTexture(
  scene: Scene,
  width: number,
  height: number,
  shade: (u: number, v: number) => readonly [number, number, number, number],
  wrap = false,
): RawTexture {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = shade((x + 0.5) / width, (y + 0.5) / height);
      const offset = (y * width + x) * 4;
      pixels[offset] = Math.round(Math.max(0, Math.min(1, r)) * 255);
      pixels[offset + 1] = Math.round(Math.max(0, Math.min(1, g)) * 255);
      pixels[offset + 2] = Math.round(Math.max(0, Math.min(1, b)) * 255);
      pixels[offset + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
    }
  const texture = RawTexture.CreateRGBATexture(
    pixels,
    width,
    height,
    scene,
    false,
    false,
    Texture.BILINEAR_SAMPLINGMODE,
  );
  texture.wrapU = wrap ? Texture.WRAP_ADDRESSMODE : Texture.CLAMP_ADDRESSMODE;
  texture.wrapV = wrap ? Texture.WRAP_ADDRESSMODE : Texture.CLAMP_ADDRESSMODE;
  return texture;
}
/**
 * Tileable fractal value noise in 0..1: `period` cells per side at the first
 * octave, each octave doubling the frequency, so the texture wraps seamlessly.
 */
export function tileableNoise(
  seed: number,
  period: number,
  octaves: number,
): (u: number, v: number) => number {
  const lattice = (ix: number, iy: number, p: number): number => {
    const x = ((ix % p) + p) % p,
      y = ((iy % p) + p) % p;
    let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return (h ^ (h >>> 16)) / 4294967296;
  };
  const value = (u: number, v: number, p: number): number => {
    const x = u * p,
      y = v * p;
    const ix = Math.floor(x),
      iy = Math.floor(y);
    const fx = x - ix,
      fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx),
      sy = fy * fy * (3 - 2 * fy);
    const a = lattice(ix, iy, p),
      b = lattice(ix + 1, iy, p),
      c = lattice(ix, iy + 1, p),
      d = lattice(ix + 1, iy + 1, p);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  return (u, v) => {
    let sum = 0,
      weight = 0,
      amplitude = 1;
    for (let o = 0; o < octaves; o++) {
      sum += value(u, v, period << o) * amplitude;
      weight += amplitude;
      amplitude *= 0.5;
    }
    return sum / weight;
  };
}
/** Mixes two colours given as [r, g, b] triples. */
export const mix = (
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
export const smooth = (edge0: number, edge1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};
