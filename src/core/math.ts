export const clamp = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, n));
export const approach = (value: number, target: number, step: number): number =>
  value < target ? Math.min(value + step, target) : Math.max(value - step, target);
export const damp = (value: number, target: number, rate: number, dt: number): number =>
  value + (target - value) * (1 - Math.exp(-rate * dt));
export interface Point {
  x: number;
  y: number;
}
export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
