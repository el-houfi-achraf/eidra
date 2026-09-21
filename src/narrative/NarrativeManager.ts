import { dialogues, fundamentalMemories } from '../../game-data/dialogue/story';
import type { DialogueId } from '../../game-data/dialogue/story';
export type Ending = 'SILENCE' | 'ETERNITY' | 'REMEMBER, THEN LET GO';
export class NarrativeManager {
  flags = new Set<string>();
  memories = new Set<string>();
  active: DialogueId | null = null;
  lineIndex = 0;
  start(id: DialogueId): void {
    this.active = id;
    this.lineIndex = 0;
  }
  get line(): string {
    return this.active ? (dialogues[this.active].lines[this.lineIndex] ?? '') : '';
  }
  get speaker(): string {
    return this.active ? dialogues[this.active].speaker : '';
  }
  advance(): boolean {
    if (!this.active) return false;
    this.lineIndex++;
    if (this.lineIndex >= dialogues[this.active].lines.length) {
      this.flags.add(dialogues[this.active].flag);
      this.active = null;
      return false;
    }
    return true;
  }
  canEnd(ending: Ending): boolean {
    return (
      ending !== 'REMEMBER, THEN LET GO' || fundamentalMemories.every((id) => this.memories.has(id))
    );
  }
  remember(id: string): boolean {
    if (this.memories.has(id)) return false;
    this.memories.add(id);
    return true;
  }
}
