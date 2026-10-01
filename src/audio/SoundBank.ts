/**
 * Choices behind each sound: which variant plays (never the same twice in a row),
 * whether a cue may sound again yet, and a pitch nudge. Pure, so it can be tested.
 */
export class VariantPicker {
  private last = new Map<string, number>();
  /** A variant 1..count, different from the previous one when there is a choice. */
  pick(id: string, count: number, random: () => number = Math.random): number {
    if (count <= 1) return 1;
    const previous = this.last.get(id);
    let variant = 1 + Math.floor(random() * (previous === undefined ? count : count - 1));
    if (previous !== undefined && variant >= previous) variant++;
    this.last.set(id, variant);
    return variant;
  }
}
export class Cooldowns {
  private until = new Map<string, number>();
  /** True (and the cue is armed again) once `cooldown` seconds have passed since it last sounded. */
  take(id: string, now: number, cooldown: number): boolean {
    if (now < (this.until.get(id) ?? -Infinity)) return false;
    this.until.set(id, now + cooldown);
    return true;
  }
}
/** A random pitch offset within ± `spread` cents. */
export function pitchSpread(spread: number, random: () => number = Math.random): number {
  return spread > 0 ? (random() * 2 - 1) * spread : 0;
}
