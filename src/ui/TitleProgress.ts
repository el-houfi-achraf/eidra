import type { SaveData } from '../save/SaveManager';
import { chapterAt, chapters } from '../../game-data/ui/title';
import type { Chapter } from '../../game-data/ui/title';
import { fundamentalMemories } from '../../game-data/dialogue/story';
import { bossThemes, musicTracks, sectorScores } from '../../game-data/audio/music';
import type { TrackId } from '../../game-data/audio/music';
import { chunks } from '../../game-data/zones/laboratory';
import { bossRoster } from '../../game-data/bosses/roster';
/** What the title screen tells of the journey so far, read from the save slots. */
export interface TitleProgress {
  /** The save « Continuer » resumes: the most recent one. */
  latest: SaveData | null;
  /** Fragments recovered in that save, out of the seven of the story. */
  fragments: number;
  total: number;
  /** Chapter of the latest save; the first one before any journey. */
  chapter: Chapter;
  /** Chapters any save has reached, in order; always at least the first. */
  reached: Chapter[];
  /** Memories recovered in any save: the gallery keeps what was once seen. */
  memories: Set<string>;
  /** Themes heard in any save, in the order of the score; the title theme always. */
  themes: TrackId[];
}
export function titleProgress(saves: readonly (SaveData | null)[]): TitleProgress {
  const filled = saves.filter((s): s is SaveData => s !== null);
  const latest = [...filled].sort((a, b) => b.savedAt - a.savedAt)[0] ?? null;
  const memories = new Set(filled.flatMap((s) => s.memories));
  // A chapter is reached by a save standing in it or having discovered one of its sectors.
  const heard = new Set<TrackId>(['title']);
  const reached = new Set<Chapter>([chapters[0]!]);
  for (const save of filled) {
    reached.add(chapterAt(save.position.x));
    for (const area of save.discoveredAreas) {
      const score = sectorScores[area];
      if (score) heard.add(score.music);
      const sector = chunks.find((c) => c.id === area);
      if (sector) reached.add(chapterAt(sector.start));
    }
    for (const boss of save.bosses) {
      const theme = bossThemes[boss];
      if (theme) heard.add(theme);
    }
  }
  return {
    latest,
    fragments: latest
      ? latest.memories.filter((id) => (fundamentalMemories as readonly string[]).includes(id))
          .length
      : 0,
    total: fundamentalMemories.length,
    chapter: latest ? chapterAt(latest.position.x) : chapters[0]!,
    reached: chapters.filter((c) => reached.has(c)),
    memories,
    themes: (Object.keys(musicTracks) as TrackId[]).filter((id) => heard.has(id)),
  };
}
/** « GALERIE DES VEILLEURS » → « Galerie des veilleurs ». */
const sentence = (name: string): string => name.charAt(0) + name.slice(1).toLowerCase();
/** Where a theme is heard: the title, a boss fight or a region of the route. */
export function trackOrigin(id: TrackId): string {
  if (id === 'title') return 'Thème principal';
  const boss = bossRoster.find((b) => bossThemes[b.id] === id);
  if (boss) return `Combat · ${sentence(boss.name)}`;
  const sector = chunks.find((c) => sectorScores[c.id]?.music === id);
  return sector ? `Région · ${sentence(sector.name)}` : 'Partition';
}
