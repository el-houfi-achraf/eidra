import { stages } from '../../game-data/zones/laboratory';
import type { Stage } from '../../game-data/zones/laboratory';
/** Saved flag of a cleared stage (the save format already persists flags). */
export const stageFlag = (id: string): string => `stage:${id}`;
/** Metres around a progress gate where Eidra keeps the side she came from. */
export const HYSTERESIS = 2;
/**
 * Progression through the laboratory's stages: a sector's exit opens once its
 * guardians have fallen, and stays open (a saved flag) even when enemies return
 * after a death. Progress gates only bar the way forward: a player who already
 * stands beyond one (an older save, a respawn) is never shut out behind it.
 */
export class StageProgress {
  private sides = new Map<string, number>();
  constructor(private list: readonly Stage[] = stages) {}
  /** Marks newly cleared stages in `flags` and returns them. */
  clear(flags: Set<string>, defeated: (id: string) => boolean): Stage[] {
    const cleared: Stage[] = [];
    for (const stage of this.list)
      if (!flags.has(stageFlag(stage.id)) && stage.guardians.every(defeated)) {
        flags.add(stageFlag(stage.id));
        cleared.push(stage);
      }
    return cleared;
  }
  sealed(flags: ReadonlySet<string>): Stage[] {
    return this.list.filter((stage) => !flags.has(stageFlag(stage.id)));
  }
  remaining(stage: Stage, defeated: (id: string) => boolean): number {
    return stage.guardians.filter((id) => !defeated(id)).length;
  }
  /** Updates the side of each gate Eidra stands on; near a gate she keeps the previous one. */
  locate(x: number, gates: readonly { id: string; x: number }[]): void {
    for (const gate of gates)
      if (!this.sides.has(gate.id) || Math.abs(x - gate.x) > HYSTERESIS)
        this.sides.set(gate.id, x < gate.x ? -1 : 1);
  }
  /** Eidra stands beyond this gate, so it no longer bars her way. */
  beyond(id: string): boolean {
    return (this.sides.get(id) ?? -1) > 0;
  }
  /** Forget the sides after a teleport, a respawn or a load. */
  reset(): void {
    this.sides.clear();
  }
}
