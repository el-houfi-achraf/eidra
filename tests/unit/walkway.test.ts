import { describe, expect, it } from 'vitest';
import { checkpoints, chunks, gates, stageGate, stages } from '../../game-data/zones/laboratory';
import { roomAt, solidsOf, worldSolids } from '../../src/world/Rooms';
import type { Solid } from '../../src/enemies/Terrain';

interface Slab extends Solid {
  memory?: boolean;
}
/** Every slab of a room, remembered ones included, and its walls, floor and vault. */
const slabsOf = (room: (typeof chunks)[number]): Slab[] => [
  ...room.platforms,
  ...solidsOf(room).filter((s) => !room.platforms.includes(s as never)),
];
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
    for (const room of chunks) {
      const slabs = slabsOf(room);
      for (const slab of slabs) {
        const under = slabs.filter(
          (floor) =>
            floor !== slab &&
            !floor.memory &&
            top(floor) <= bottom(slab) &&
            Math.abs(floor.x - slab.x) < (floor.w + slab.w) / 2 - 0.01,
        );
        if (!under.length) continue;
        const gap = bottom(slab) - Math.max(...under.map(top));
        if (gap > WAIST && gap < EIDRA_HEAD + 0.12)
          blocking.push(`${room.id}: slab at x ${slab.x}, ${gap.toFixed(2)} m over the floor`);
      }
    }
    expect(blocking).toEqual([]);
  });
  it('keeps every ledge over the walkway within a single jump of the floor or a step', () => {
    for (const room of chunks) {
      const slabs = slabsOf(room);
      for (const slab of slabs.filter((s) => !s.memory && s.w < 12)) {
        const floor = slabs
          .filter((f) => f !== slab && top(f) <= bottom(slab) && Math.abs(f.x - slab.x) < f.w / 2)
          .sort((a, b) => top(b) - top(a))[0];
        if (!floor || top(slab) - top(floor) <= 0.3 || top(slab) - top(floor) > 2.6) continue;
        // A ledge a little out of reach is fine when a step beside it leads up to it.
        const gap = (a: Slab, b: Slab): number =>
          Math.max(0, Math.abs(a.x - b.x) - (a.w + b.w) / 2);
        const step = slabs.some(
          (s) =>
            s !== slab &&
            s.memory === slab.memory &&
            top(s) < top(slab) &&
            top(slab) - top(s) <= ONE_JUMP &&
            top(s) - top(floor) <= ONE_JUMP &&
            gap(s, slab) <= 3,
        );
        if (!step)
          expect(top(slab) - top(floor), `${room.id}: slab at x ${slab.x}`).toBeLessThanOrEqual(
            ONE_JUMP,
          );
      }
    }
  });
  it('places anchors on solid ground, the route’s more than 2 m from a sealed exit', () => {
    const exits = gates.filter((gate) => stages.some((stage) => gate.id === stageGate(stage.id)));
    expect(exits.length).toBe(stages.length);
    for (const anchor of checkpoints) {
      const room = roomAt(anchor.x, anchor.y + 0.5);
      expect(room, anchor.id).not.toBeNull();
      expect(
        worldSolids.some(
          (s) => Math.abs(s.x - anchor.x) < s.w / 2 && Math.abs(top(s) - anchor.y) < 0.01,
        ),
        anchor.id,
      ).toBe(true);
      if (room!.kind === 'route')
        for (const exit of exits)
          expect(Math.abs(exit.x - anchor.x), `${anchor.id} / ${exit.id}`).toBeGreaterThan(2);
    }
    expect(new Set(checkpoints.map((c) => c.id)).size).toBe(checkpoints.length);
  });
});
