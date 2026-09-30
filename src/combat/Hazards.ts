import type { Hazard } from '../../game-data/zones/laboratory';
export type VentState = 'idle' | 'warning' | 'burning';
/** Seconds of visible warning before a vent bursts. */
export const VENT_WARNING = 0.7;
/** Height of a fire column, metres. */
export const VENT_HEIGHT = 7;
/** Seconds since the vent's cycle began, in [0, period). */
const phase = (vent: Hazard, time: number): number => {
  const t = (time - vent.offset) % vent.period;
  return t < 0 ? t + vent.period : t;
};
/**
 * Ember vents burst `active` seconds out of every `period`, after a short glowing
 * warning. Pure: gameplay and presentation read the same session clock.
 */
export function ventState(vent: Hazard, time: number): VentState {
  const t = phase(vent, time);
  if (t < vent.active) return 'burning';
  return t > vent.period - VENT_WARNING ? 'warning' : 'idle';
}
/** 0..1 progress through the current state, for the visuals. */
export function ventProgress(vent: Hazard, time: number): number {
  const t = phase(vent, time);
  if (t < vent.active) return t / vent.active;
  const warning = vent.period - VENT_WARNING;
  return t > warning ? (t - warning) / VENT_WARNING : 0;
}
/** A burning column overlaps a body centred at (x, y). */
export function scorches(
  vent: Hazard,
  time: number,
  x: number,
  y: number,
  radius: number,
): boolean {
  return (
    ventState(vent, time) === 'burning' &&
    Math.abs(x - vent.x) < vent.width / 2 + radius &&
    y < VENT_HEIGHT
  );
}
