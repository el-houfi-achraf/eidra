import { tutorialHints } from '../../game-data/quests/tutorial';
import type { HintAction, TutorialHint } from '../../game-data/quests/tutorial';
export interface HintContext {
  x: number;
  abilities: ReadonlySet<string>;
  flags: ReadonlySet<string>;
  /** Hurt and able to afford a Recueillement. */
  wounded: boolean;
  /** Enough resonance to throw a card. */
  cards?: boolean;
}
export const hintFlag = (id: string): string => `tutorial:${id}`;
/** Chooses the contextual prompt to show and retires prompts once performed. */
export class TutorialDirector {
  active: TutorialHint | null = null;
  /** Seconds each hint has spent on screen. */
  private shown = new Map<string, number>();
  constructor(private hints: readonly TutorialHint[] = tutorialHints) {}
  update(context: HintContext): TutorialHint | null {
    this.active =
      this.hints.find(
        (hint) =>
          !context.flags.has(hintFlag(hint.id)) &&
          !(hint.until && context.flags.has(hint.until)) &&
          hint.requires.every((id) => context.abilities.has(id)) &&
          context.x >= hint.from &&
          context.x <= hint.to &&
          (!hint.wounded || context.wounded) &&
          (!hint.cards || context.cards === true),
      ) ?? null;
    return this.active;
  }
  /**
   * Counts the time the active hint stays on screen; once past its `linger`, it
   * retires as if learned (stored in `flags`, so it stays retired after a reload).
   * Returns true when the hint just retired.
   */
  linger(dt: number, flags: Set<string>): boolean {
    const hint = this.active;
    if (!hint) return false;
    const shown = (this.shown.get(hint.id) ?? 0) + dt;
    this.shown.set(hint.id, shown);
    if (shown < hint.linger) return false;
    flags.add(hintFlag(hint.id));
    this.active = null;
    return true;
  }
  /** Marks every hint teaching `action` as learned. Returns the ids newly completed. */
  perform(action: HintAction, flags: Set<string>): string[] {
    const done: string[] = [];
    for (const hint of this.hints)
      if (hint.action === action && !flags.has(hintFlag(hint.id))) {
        flags.add(hintFlag(hint.id));
        done.push(hint.id);
      }
    if (this.active && done.includes(this.active.id)) this.active = null;
    return done;
  }
}
