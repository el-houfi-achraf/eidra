import { describe, it, expect } from 'vitest';
import { MovementModel } from '../../src/player/MovementModel';
import { clamp, damp, approach } from '../../src/core/math';
const idle = { axis: 0, jump: false, jumpHeld: true, dash: false, walk: false };
describe('Movement', () => {
  it('accelerates without exceeding run speed', () => {
    const m = new MovementModel();
    for (let i = 0; i < 60; i++) m.step(1 / 60, { ...idle, axis: 1 }, true);
    expect(m.vx).toBe(6.8);
  });
  it('allows a coyote jump but not infinite air jumps', () => {
    const m = new MovementModel();
    m.step(1 / 60, idle, true);
    m.step(0.04, { ...idle, jump: true }, false);
    expect(m.vy).toBeGreaterThan(8);
    for (let i = 0; i < 50; i++) m.step(1 / 60, idle, false);
    m.step(1 / 60, { ...idle, jump: true }, false);
    expect(m.vy).toBeLessThan(0);
  });
  it('buffers a jump before landing', () => {
    const m = new MovementModel();
    m.vy = -2;
    m.step(0.02, { ...idle, jump: true }, false);
    m.step(0.02, idle, true);
    expect(m.vy).toBeGreaterThan(10);
  });
  it('gates dash and enforces cooldown', () => {
    const m = new MovementModel();
    m.step(0.01, { ...idle, dash: true }, true, false);
    expect(m.dashTime).toBe(0);
    m.step(0.01, { ...idle, dash: true }, true, true);
    expect(m.vx).toBe(17);
    m.step(0.22, idle, false);
    m.step(0.01, { ...idle, dash: true }, true);
    expect(m.dashTime).toBe(0);
  });
  it('restores air control immediately after a dash ends', () => {
    const m = new MovementModel();
    m.step(1 / 60, { ...idle, dash: true }, false);
    while (m.dashTime > 0) m.step(1 / 60, idle, false);
    expect(m.vx).toBeLessThanOrEqual(6.8);
    for (let i = 0; i < 15; i++) m.step(1 / 60, idle, false);
    expect(m.vx).toBe(0);
  });
  it('math helpers are bounded and frame-rate independent', () => {
    expect(clamp(3, 0, 2)).toBe(2);
    expect(approach(1, 2, 10)).toBe(2);
    expect(damp(0, 10, 3, 1)).toBeCloseTo(damp(damp(0, 10, 3, 0.5), 10, 3, 0.5));
  });
});
