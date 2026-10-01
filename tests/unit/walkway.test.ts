import { describe, expect, it } from 'vitest';
import { checkpoints, chunks, gates, stageGate, stages } from '../../game-data/zones/laboratory';
import type { ChunkData } from '../../game-data/zones/laboratory';

type Slab = ChunkData['platforms'][number];
const slabs: Slab[] = chunks.flatMap((chunk) => chunk.platforms);
const top = (s: Slab): number => s.y + s.h / 2;
const bottom = (s: Slab): number => s.y - s.h / 2;
/** Eidra's capsule: 1.7 m standing on the floor, plus Havok's contact margin. */
const EIDRA_HEAD = 1.83;
/** Highest top her single jump lands on (feet apex 2.62 m), with some slack. */
const ONE_JUMP = 2.45;
/** Below her waist a slab reads as a step to climb, not as a ledge overhead. */
const WAIST = 1;

describe('walkway', () => {
  it('never hangs a slab between Eidra’s waist and head over the ground she walks on', () => {
    // A slab in that band looks like a ledge to walk under, yet stops her dead.
    const blocking: string[] = [];
    for (const slab of slabs) {
      const under = slabs.filter(
        (floor) =>
          floor !== slab &&
          !floor.memory &&
          top(floor) <= bottom(slab) &&
          Math.abs(floor.x - slab.x) < (floor.w + slab.w) / 2,
      );
      if (!under.length) continue;
      const gap = bottom(slab) - Math.max(...under.map(top));
      if (gap > WAIST && gap < EIDRA_HEAD + 0.12)
        blocking.push(`slab at x ${slab.x}, ${gap.toFixed(2)} m over the floor`);
    }
    expect(blocking).toEqual([]);
  });
  it('keeps every ledge over the walkway within a single jump of the floor', () => {
    for (const slab of slabs.filter((s) => !s.memory && top(s) > 0.3 && top(s) < 4)) {
      const floor = slabs.find(
        (f) => f !== slab && top(f) <= bottom(slab) && Math.abs(f.x - slab.x) < f.w / 2,
      );
      // Ledges that only a double jump or another ledge reaches are allowed above 2.45 m.
      if (floor && top(slab) - top(floor) <= 2.6)
        expect(top(slab) - top(floor), `slab at x ${slab.x}`).toBeLessThanOrEqual(ONE_JUMP);
    }
  });
  it('places anchors on solid ground, more than 2 m from a sealed exit', () => {
    const exits = gates.filter((gate) => stages.some((stage) => gate.id === stageGate(stage.id)));
    expect(exits.length).toBe(stages.length);
    for (const anchor of checkpoints) {
      expect(
        slabs.some((s) => !s.memory && Math.abs(s.x - anchor.x) < s.w / 2 && top(s) === 0),
        anchor.id,
      ).toBe(true);
      for (const exit of exits)
        expect(Math.abs(exit.x - anchor.x), `${anchor.id} / ${exit.id}`).toBeGreaterThan(2);
    }
    expect(new Set(checkpoints.map((c) => c.id)).size).toBe(checkpoints.length);
  });
});
