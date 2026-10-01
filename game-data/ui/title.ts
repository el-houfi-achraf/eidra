import { z } from 'zod';
import { MoodSchema } from '../zones/moods';
import { route, routeChunks } from '../zones/laboratory';
import { musicTracks } from '../audio/music';
import type { TrackId } from '../audio/music';
/**
 * The title screen: its words, the chapters it can show, the news it announces
 * and the dawn-lit ruin painted behind it (TitleStage). Purely presentational.
 */
export const titleScreen = {
  subtitle: 'SHARDS OF SILENCE',
  tagline: 'Certains souvenirs attendent qu’on les laisse partir.',
} as const;
/**
 * The ruin behind the title: a dawn through broken arches, warm on the horizon,
 * cold teal above, in the same layered language as the sectors (moods.ts).
 * TODO_ART: procedural silhouettes until a painted key art exists.
 */
export const titleMood = MoodSchema.parse({
  fog: '#18343a',
  sky: '#0c2632',
  horizon: '#e4cf9c',
  far: '#4f7d80',
  mid: '#2b4c4f',
  near: '#0f1d20',
  ground: '#1b2a28',
  lip: '#5f7f55',
  mist: '#7fa7a3',
  light: '#f3dca2',
  motif: 'gallery',
  overgrowth: 1,
  lanterns: 0,
  haze: 0.12,
});
/** Extra colours of the title vista. */
export const titleColors = {
  foliage: '#3f6b3b',
  foliageLight: '#6f9a4f',
  stone: '#202f31',
  flowers: '#e8f1ef',
  ring: '#e9a83a',
  crystal: '#8fd3ff',
} as const;
const ChapterSchema = z.object({
  id: z.string(),
  /** As printed on the card: « CHAPITRE 00 ». */
  number: z.string().regex(/^\d{2}$/),
  title: z.string(),
  tagline: z.string(),
  /** First abscissa of the route belonging to the chapter. */
  from: z.number(),
  /** Last abscissa (the end of the route for the last chapter). */
  to: z.number(),
  /** Sector whose colours paint the chapter's thumbnail. */
  sector: z.string(),
  /** Theme heard during the chapter's preview. */
  theme: z.enum(Object.keys(musicTracks) as [TrackId, ...TrackId[]]),
});
export type Chapter = z.infer<typeof ChapterSchema>;
/** What the title screen adds to each act of the route (same order as route.acts). */
const chapterWords = [
  {
    id: 'laboratory',
    tagline: 'Quelque chose se souvient de vous.',
    sector: 'awakening',
    theme: 'lumerite',
  },
  {
    id: 'ashes',
    tagline: 'Ce qui brûle se souvient aussi.',
    sector: 'ember-fields',
    theme: 'ashes',
  },
] as const;
/** One chapter per act of the route; a unit test checks none is missing. */
export const chapters: readonly Chapter[] = route.acts.map((act, i) =>
  ChapterSchema.parse({
    ...chapterWords[i],
    number: String(i).padStart(2, '0'),
    title: act.title,
    from: act.from,
    to: route.acts[i + 1]?.from ?? routeChunks.at(-1)!.end,
  }),
);
/** The chapter a point of the route belongs to. */
export const chapterAt = (x: number): Chapter =>
  chapters.filter((c) => x >= c.from).at(-1) ?? chapters[0]!;
const NewsSchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
});
/** What changed lately, newest first: the bell of the title screen lists them. */
export const news = [
  {
    id: 'score',
    title: 'Une bande-son originale',
    text: 'Un thème par région et par boss, des ambiances et des bruitages en couches.',
  },
  {
    id: 'bosses',
    title: 'Quatre boss, quatre capacités',
    text: 'Étendard, Commandement, Bond et Reflets : chacun se bat à sa manière.',
  },
  {
    id: 'eidra',
    title: 'La nouvelle Eidra',
    text: 'Un bâton doré, des cartes de résonance et de nouveaux mouvements.',
  },
  {
    id: 'pads',
    title: 'Toutes les manettes',
    text: 'Xbox, PlayStation, Nintendo et manettes génériques, réassignables.',
  },
].map((item) => NewsSchema.parse(item));
/** Words of the credits page. */
export const credits = [
  ['Conception, monde et récit', 'EIDRA — d’après le brief de son auteur'],
  ['Musique et bruitages', 'Partition originale générée (tools/generate_audio.py)'],
  ['Moteur', 'Babylon.js 9, Havok, TypeScript'],
  ['Polices', 'Cinzel, Cormorant Garamond, Inter — SIL Open Font License'],
] as const;
