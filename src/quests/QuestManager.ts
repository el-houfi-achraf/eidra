import { questData } from '../../game-data/quests/quests';
export class QuestManager {
  completed = new Set<string>();
  update(flags: ReadonlySet<string>): string[] {
    const changed: string[] = [];
    for (const q of questData) {
      if (
        !this.completed.has(q.id) &&
        q.requires.every((f) => flags.has(f)) &&
        q.complete.every((f) => flags.has(f))
      ) {
        this.completed.add(q.id);
        changed.push(q.id);
      }
    }
    return changed;
  }
  objective(flags: ReadonlySet<string>): string {
    const q = questData.find(
      (q) =>
        !this.completed.has(q.id) && q.requires.every((f) => flags.has(f)) && q.type === 'main',
    );
    return q?.title ?? 'Explorer Nhalis librement';
  }
}
