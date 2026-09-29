import { describe, expect, it } from 'vitest';
import { chunks } from '../../game-data/zones/laboratory';
import { moods, MoodSchema } from '../../game-data/zones/moods';
import { BLEND, tintAt, hexToRgb } from '../../src/world/Mood';
import { PaintedGeometry, random } from '../../src/world/PaintedGeometry';
import { LAYERS, paintScenery } from '../../src/world/Scenery';
import { tileableNoise } from '../../src/vfx/textures';

const vertices = (g: PaintedGeometry): { x: number; y: number; z: number; a: number }[] =>
  Array.from({ length: g.vertexCount }, (_, i) => ({
    x: g.positions[i * 3]!,
    y: g.positions[i * 3 + 1]!,
    z: g.positions[i * 3 + 2]!,
    a: g.colors[i * 4 + 3]!,
  }));

describe('area moods', () => {
  it('gives every laboratory sector a valid colour identity', () => {
    for (const chunk of chunks) {
      expect(moods[chunk.id], chunk.id).toBeDefined();
      expect(() => MoodSchema.parse(moods[chunk.id])).not.toThrow();
    }
    expect(hexToRgb('#ff8000')).toEqual([1, 128 / 255, 0]);
  });
  it('keeps each sector pure in its middle and cross-fades smoothly at borders', () => {
    for (const chunk of chunks) {
      const middle = tintAt((chunk.start + chunk.end) / 2);
      expect(middle.fog).toEqual(hexToRgb(moods[chunk.id]!.fog));
    }
    // No visible jump anywhere along the laboratory.
    for (let x = -5; x < 205; x += 0.05) {
      const a = tintAt(x).fog,
        b = tintAt(x + 0.05).fog;
      for (let k = 0; k < 3; k++) expect(Math.abs(a[k]! - b[k]!)).toBeLessThan(0.01);
    }
    // At a border both neighbours weigh the same.
    const border = chunks[1]!.start;
    const halfway = tintAt(border).fog;
    const left = hexToRgb(moods[chunks[0]!.id]!.fog),
      right = hexToRgb(moods[chunks[1]!.id]!.fog);
    for (let k = 0; k < 3; k++) expect(halfway[k]).toBeCloseTo((left[k]! + right[k]!) / 2, 5);
    expect(tintAt(border - BLEND).fog).toEqual(left);
  });
});

describe('painted geometry', () => {
  it('builds strips with feathered, transparent rims', () => {
    const g = new PaintedGeometry();
    const paint = (): readonly [number, number, number, number] => [0.5, 0.5, 0.5, 1];
    g.ribbon(
      [
        [0, 0],
        [0, 2],
        [0, 4],
      ],
      [1, 1, 1],
      3,
      paint,
    );
    expect(g.vertexCount).toBe(6);
    expect(g.triangleCount).toBe(4);
    const soft = new PaintedGeometry();
    soft.ribbon(
      [
        [0, 0],
        [0, 2],
      ],
      [1, 1],
      3,
      paint,
      0.3,
    );
    expect(soft.vertexCount).toBe(8);
    expect(vertices(soft).filter((v) => v.a === 0)).toHaveLength(4);
    // A width of 1 plus a 0.3 feather on each side.
    expect(Math.max(...vertices(soft).map((v) => Math.abs(v.x)))).toBeCloseTo(0.8);
  });
  it('bands between two profiles and never inverts them', () => {
    const g = new PaintedGeometry();
    g.band([0, 1, 2], [0, 0, 0], [1, -1, 2], 5, () => [1, 1, 1, 1]);
    const ys = vertices(g).map((v) => v.y);
    expect(ys).toEqual([0, 1, 0, 0, 0, 2]);
    expect(g.triangleCount).toBe(4);
  });
  it('draws the same set from the same seed', () => {
    const a = random(42),
      b = random(42);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
    const values = Array.from({ length: 1000 }, random(7));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
  });
  it('wraps the brush and mist noise seamlessly', () => {
    const noise = tileableNoise(3, 4, 4);
    for (let v = 0; v < 1; v += 0.13) {
      expect(noise(0, v)).toBeCloseTo(noise(1, v), 6);
      expect(noise(v, 0)).toBeCloseTo(noise(v, 1), 6);
    }
  });
});

describe('painted scenery', () => {
  const sets = chunks.map((chunk) => ({ chunk, scenery: paintScenery(chunk) }));
  it('is deterministic for a sector', () => {
    const again = paintScenery(chunks[0]!);
    expect(again.near.positions).toEqual(sets[0]!.scenery.near.positions);
    expect(again.far.colors).toEqual(sets[0]!.scenery.far.colors);
  });
  it('keeps every sector within its geometry budget', () => {
    for (const { chunk, scenery } of sets) {
      const total = [
        scenery.near,
        scenery.far,
        scenery.front,
        scenery.glow,
        scenery.shafts,
        scenery.memory,
      ]
        .map((g) => g.triangleCount)
        .reduce((sum, n) => sum + n, 0);
      expect(total, chunk.id).toBeGreaterThan(500);
      expect(total, chunk.id).toBeLessThan(12000);
    }
  });
  it('never paints over the fighters: only slab dressing enters the play band', () => {
    for (const { chunk, scenery } of sets) {
      const slabs = chunk.platforms.filter((p) => !p.memory);
      for (const v of vertices(scenery.near))
        if (v.z < LAYERS.rear - 0.3) {
          const onSlab = slabs.some(
            (p) => v.x >= p.x - p.w / 2 - 0.8 && v.x <= p.x + p.w / 2 + 0.8,
          );
          expect(onSlab, `${chunk.id} (${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z})`).toBe(true);
          // In front of the fighters, dressing stays below their knees.
          if (v.z < 0)
            expect(
              slabs.some(
                (p) =>
                  v.x >= p.x - p.w / 2 - 0.8 &&
                  v.x <= p.x + p.w / 2 + 0.8 &&
                  v.y <= p.y + p.h / 2 + 0.3,
              ),
              `${chunk.id} front dressing at (${v.x.toFixed(2)}, ${v.y.toFixed(2)})`,
            ).toBe(true);
        }
      for (const v of vertices(scenery.far)) expect(v.z).toBeGreaterThanOrEqual(LAYERS.mid - 0.5);
      // The out-of-focus foreground only frames the top and bottom edges.
      for (const v of vertices(scenery.front)) {
        expect(v.z).toBeLessThan(-6);
        expect(v.y <= -0.4 || v.y >= 9, `${chunk.id} front at y ${v.y.toFixed(2)}`).toBe(true);
      }
    }
  });
  it('paints remembered slabs only where memory platforms exist', () => {
    for (const { chunk, scenery } of sets) {
      const memories = chunk.platforms.filter((p) => p.memory);
      expect(scenery.memory.vertexCount > 0).toBe(memories.length > 0);
    }
  });
});
