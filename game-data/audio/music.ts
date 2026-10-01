import { z } from 'zod';
/**
 * The score of the journey (tools/audio/music.py): a theme per region, one per boss,
 * a title theme and short stingers, plus an ambience bed per region. Every sector
 * names its music, ambience and the ground Eidra walks on (footsteps).
 * TODO_ART: synthesized placeholders until a recorded score exists.
 */
const LoopSchema = z.object({
  /** Gain relative to the music (or effects, for ambiences) volume. */
  volume: z.number().min(0).max(1.5).default(1),
});
export const musicTracks = {
  title: LoopSchema.parse({ volume: 0.9 }),
  lumerite: LoopSchema.parse({ volume: 1 }),
  mira: LoopSchema.parse({ volume: 0.95 }),
  machinery: LoopSchema.parse({ volume: 0.9 }),
  ashes: LoopSchema.parse({ volume: 0.95 }),
  garden: LoopSchema.parse({ volume: 1 }),
  keeper: LoopSchema.parse({ volume: 0.85 }),
  guardian: LoopSchema.parse({ volume: 0.85 }),
  warden: LoopSchema.parse({ volume: 0.85 }),
  ilyra: LoopSchema.parse({ volume: 0.85 }),
};
export type TrackId = keyof typeof musicTracks;
export const ambienceBeds = {
  laboratory: LoopSchema.parse({ volume: 0.8 }),
  ashes: LoopSchema.parse({ volume: 0.75 }),
  garden: LoopSchema.parse({ volume: 0.8 }),
};
export type AmbienceId = keyof typeof ambienceBeds;
export const stingerCues = {
  victory: LoopSchema.parse({ volume: 0.9 }),
  ability: LoopSchema.parse({ volume: 0.85 }),
  rest: LoopSchema.parse({ volume: 0.7 }),
  death: LoopSchema.parse({ volume: 0.85 }),
  act: LoopSchema.parse({ volume: 0.85 }),
};
export type StingerId = keyof typeof stingerCues;
export const SurfaceSchema = z.enum(['stone', 'ash', 'moss']);
export type Surface = z.infer<typeof SurfaceSchema>;
const ScoreSchema = z.object({
  music: z.enum(Object.keys(musicTracks) as [TrackId, ...TrackId[]]),
  ambience: z.enum(Object.keys(ambienceBeds) as [AmbienceId, ...AmbienceId[]]),
  surface: SurfaceSchema,
});
export type SectorScore = z.infer<typeof ScoreSchema>;
/** Keyed by sector id; a unit test requires one entry per sector of the route. */
export const sectorScores: Readonly<Record<string, SectorScore>> = Object.fromEntries(
  Object.entries({
    awakening: { music: 'lumerite', ambience: 'laboratory', surface: 'stone' },
    watchers: { music: 'mira', ambience: 'laboratory', surface: 'stone' },
    palimpsest: { music: 'lumerite', ambience: 'laboratory', surface: 'stone' },
    counterweight: { music: 'machinery', ambience: 'laboratory', surface: 'stone' },
    obedience: { music: 'machinery', ambience: 'laboratory', surface: 'stone' },
    'cinder-gate': { music: 'ashes', ambience: 'ashes', surface: 'ash' },
    'ember-fields': { music: 'ashes', ambience: 'ashes', surface: 'ash' },
    rift: { music: 'ashes', ambience: 'ashes', surface: 'ash' },
    brazier: { music: 'ashes', ambience: 'ashes', surface: 'ash' },
    'denial-garden': { music: 'garden', ambience: 'garden', surface: 'moss' },
  }).map(([id, score]) => [id, ScoreSchema.parse(score)]),
);
/** Theme of each boss, by boss id; a unit test requires one per boss of the roster. */
export const bossThemes: Readonly<Record<string, TrackId>> = {
  keeper: 'keeper',
  'faceless-guardian': 'guardian',
  'cinder-warden': 'warden',
  ilyra: 'ilyra',
};
export const loopFiles = (folder: 'music' | 'ambience' | 'stingers', id: string): string[] => [
  `${folder}/${id}.ogg`,
  `${folder}/${id}.mp3`,
];
