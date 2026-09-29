import { arenas } from '../../game-data/zones/laboratory';
import type { Arena } from '../../game-data/zones/laboratory';
export interface ArenaEvent {
  type: 'sealed' | 'cleared';
  arena: Arena;
}
/**
 * Guarded chambers. The far gate of an arena stays closed while its guardian
 * lives; crossing the trigger seals the near gate too, until the guardian falls.
 */
export class ArenaDirector {
  active: Arena | null = null;
  constructor(private list: readonly Arena[] = arenas) {}
  update(x: number, defeated: (guardian: string) => boolean): ArenaEvent | null {
    if (this.active) {
      if (!defeated(this.active.guardian)) return null;
      const arena = this.active;
      this.active = null;
      return { type: 'cleared', arena };
    }
    for (const arena of this.list)
      if (!defeated(arena.guardian) && x > arena.trigger && x < arena.right) {
        this.active = arena;
        return { type: 'sealed', arena };
      }
    return null;
  }
  closedGates(defeated: (guardian: string) => boolean): string[] {
    const closed: string[] = [];
    for (const arena of this.list) {
      if (defeated(arena.guardian)) continue;
      closed.push(`${arena.id}-right`);
      if (this.active?.id === arena.id) closed.push(`${arena.id}-left`);
    }
    return closed;
  }
  reset(): void {
    this.active = null;
  }
}
