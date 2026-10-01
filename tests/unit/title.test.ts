import { describe, expect, it } from 'vitest';
import { chapterAt, chapters, credits, news, titleMood } from '../../game-data/ui/title';
import { route } from '../../game-data/zones/laboratory';
import { moods } from '../../game-data/zones/moods';
import { musicTracks } from '../../game-data/audio/music';
import type { TrackId } from '../../game-data/audio/music';
import { SaveSchema } from '../../src/save/SaveManager';
import type { SaveData } from '../../src/save/SaveManager';
import { SettingsSchema, defaultSettings } from '../../src/config/settings';
import { titleProgress, trackOrigin } from '../../src/ui/TitleProgress';
import { thumbnail } from '../../src/ui/TitleArt';
import { MusicDirector } from '../../src/audio/MusicDirector';

const save = (slot: number, changes: Partial<SaveData> = {}): SaveData =>
  SaveSchema.parse({
    saveVersion: 2,
    slot,
    savedAt: 1000 * slot,
    position: { x: 10, y: 1 },
    checkpoint: 'awakening',
    abilities: [],
    health: 100,
    healthUpgrades: 0,
    collectibles: [],
    shards: 0,
    bosses: [],
    quests: [],
    discoveredAreas: ['awakening'],
    memories: [],
    flags: [],
    settings: defaultSettings(),
    playtime: 60,
    ...changes,
  });

describe('title data', () => {
  it('gives every act of the route its chapter, end to end', () => {
    expect(chapters.map((c) => c.title)).toEqual(route.acts.map((a) => a.title));
    expect(chapters.map((c) => c.number)).toEqual(['00', '01']);
    chapters.forEach((chapter, i) => {
      expect(chapter.to).toBeGreaterThan(chapter.from);
      if (i > 0) expect(chapter.from).toBe(chapters[i - 1]!.to);
      // Its thumbnail and its preview have colours and a theme.
      expect(moods[chapter.sector], chapter.sector).toBeDefined();
      expect(musicTracks[chapter.theme]).toBeDefined();
    });
    expect(chapterAt(10).id).toBe('laboratory');
    expect(chapterAt(chapters[1]!.from + 1).id).toBe('ashes');
    expect(chapterAt(-90).id).toBe('laboratory');
  });
  it('names every theme of the score and where it plays', () => {
    for (const id of Object.keys(musicTracks) as TrackId[]) {
      expect(musicTracks[id].title.length, id).toBeGreaterThan(0);
      expect(trackOrigin(id), id).not.toBe('Partition');
    }
    expect(trackOrigin('title')).toBe('Thème principal');
    expect(trackOrigin('guardian')).toBe('Combat · Gardien sans visage');
    expect(trackOrigin('mira')).toBe('Région · Galerie des veilleurs');
  });
  it('announces news with distinct ids and credits the typefaces', () => {
    expect(new Set(news.map((n) => n.id)).size).toBe(news.length);
    expect(credits.some(([role]) => role === 'Polices')).toBe(true);
  });
  it('paints thumbnails in the colours of a sector, with ids of their own', () => {
    const lab = thumbnail(moods.awakening!, 'laboratory', 'chapter');
    expect(lab).toContain(moods.awakening!.sky);
    expect(lab).toContain('thumb-laboratory-sky');
    expect(thumbnail(titleMood, 'score', 'score')).not.toContain('thumb-laboratory');
  });
});

describe('title progress', () => {
  it('starts at the first chapter, with the title theme only, before any journey', () => {
    const p = titleProgress([null, null, null]);
    expect(p.latest).toBeNull();
    expect(p.fragments).toBe(0);
    expect(p.total).toBe(7);
    expect(p.chapter.id).toBe('laboratory');
    expect(p.reached.map((c) => c.id)).toEqual(['laboratory']);
    expect(p.themes).toEqual(['title']);
    expect(p.memories.size).toBe(0);
  });
  it('continues the latest save and gathers what every save has seen', () => {
    const early = save(1, {
      savedAt: 5000,
      memories: ['kael', 'seris', 'not-a-fragment'],
      discoveredAreas: ['awakening', 'watchers'],
      bosses: ['keeper'],
    });
    const later = save(3, {
      savedAt: 9000,
      position: { x: 260, y: 2 },
      memories: ['ilyan'],
      discoveredAreas: ['awakening', 'cinder-gate'],
    });
    const p = titleProgress([early, null, later]);
    expect(p.latest).toBe(later);
    // Fragments of the save « Continuer » resumes, story fragments only.
    expect(p.fragments).toBe(1);
    expect(p.chapter.id).toBe('ashes');
    expect(p.reached.map((c) => c.id)).toEqual(['laboratory', 'ashes']);
    // The gallery keeps every memory once found; the score, every theme once heard.
    expect([...p.memories].sort()).toEqual(['ilyan', 'kael', 'not-a-fragment', 'seris']);
    expect(p.themes).toEqual(['title', 'lumerite', 'mira', 'ashes', 'keeper']);
  });
  it('reaches a chapter through a sector discovered there, wherever the save stands', () => {
    const p = titleProgress([save(1, { discoveredAreas: ['awakening', 'cinder-gate'] })]);
    expect(p.chapter.id).toBe('laboratory');
    expect(p.reached.map((c) => c.id)).toEqual(['laboratory', 'ashes']);
  });
});

describe('title screen settings and music', () => {
  it('names the local profile, safely for older settings', () => {
    expect(SettingsSchema.parse({}).profileName).toBe('Voyageur');
    expect(SettingsSchema.parse({ profileName: '  Achraf ' }).profileName).toBe('Achraf');
    expect(SettingsSchema.parse({ profileName: '' }).profileName).toBe('Voyageur');
    expect(SettingsSchema.parse({ profileName: 'x'.repeat(40) }).profileName).toBe('Voyageur');
    // A save written before the profile existed still loads.
    expect(save(1, { settings: SettingsSchema.parse({ master: 0.5 }) }).settings.profileName).toBe(
      'Voyageur',
    );
  });
  it('plays a chosen theme in the menus, and forgets it once the journey starts', () => {
    const d = new MusicDirector();
    const menu = (seconds: number) => {
      let mix = d.update(0, { scene: 'menu', x: 10, boss: null });
      for (let t = 0; t < seconds; t += 0.05)
        mix = d.update(0.05, { scene: 'menu', x: 10, boss: null });
      return mix;
    };
    expect(menu(4).music).toEqual({ title: 1 });
    d.listen('mira');
    expect(d.chosen).toBe('mira');
    expect(menu(8).music).toEqual({ mira: 1 });
    d.update(0.05, { scene: 'playing', x: 10, boss: null });
    expect(d.chosen).toBeNull();
    d.listen('keeper');
    d.listen(null);
    expect(menu(8).music).toEqual({ title: 1 });
  });
});
