import { describe, expect, it } from 'vitest';
import { shrineLooks } from '../../game-data/abilities/abilities';
import { checkpoints, landmarks } from '../../game-data/zones/laboratory';
import { roomAt, solidsOf } from '../../src/world/Rooms';
import { shrinePlan } from '../../src/world/Shrine';

describe('powers wait in shrines of their own, never like an anchor (D037)', () => {
  const powers = landmarks.filter((m) => m.kind === 'ability');
  it('gives every power placed in the world a shrine of its own colour', () => {
    expect(powers.map((m) => m.id).sort()).toEqual(Object.keys(shrineLooks).sort());
    const colours = Object.values(shrineLooks).map((look) => look.color);
    expect(new Set(colours).size).toBe(colours.length);
  });
  it('sets each shrine on the ground under its power: rune, column of light, orb and rings', () => {
    for (const m of powers) {
      const room = roomAt(m.x, m.y)!;
      const plan = shrinePlan(m.id, m.x, m.y, solidsOf(room))!;
      expect(plan, m.id).not.toBeNull();
      // The rune lies on a real floor, a little more than a metre under the orb.
      const under = m.y - plan.ground;
      expect(under, m.id).toBeGreaterThan(0.9);
      expect(under, m.id).toBeLessThan(1.6);
      expect(plan.rings).toHaveLength(shrineLooks[m.id as keyof typeof shrineLooks].rings);
      expect(plan.beamHeight).toBeGreaterThan(3);
    }
  });
  it('builds none for anchors, fragments or reliquaries', () => {
    for (const m of landmarks.filter((l) => l.kind !== 'ability'))
      expect(shrinePlan(m.id, m.x, m.y, []), m.id).toBeNull();
    for (const c of checkpoints) expect(shrinePlan(c.id, c.x, c.y, []), c.id).toBeNull();
  });
  it('never sets a power beside an anchor: each stands on its own', () => {
    for (const m of powers)
      for (const c of checkpoints)
        expect(Math.hypot(m.x - c.x, m.y - (c.y ?? 0)), `${m.id} / ${c.id}`).toBeGreaterThan(6);
  });
});
