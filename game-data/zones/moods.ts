import { z } from 'zod';
const Hex = z.string().regex(/^#[0-9a-f]{6}$/i);
/**
 * Colour identity and set dressing of each sector. Every area has its own
 * palette, as painted layers seen through atmospheric haze: `near` shapes are
 * the darkest, `far` ones melt towards the `horizon`, `mist` pools at the bottom
 * and `light` tints lanterns, halos, shafts and floating dust.
 * TODO_ART: procedural silhouettes until painted production layers exist.
 */
export const MoodSchema = z.object({
  fog: Hex,
  sky: Hex,
  horizon: Hex,
  far: Hex,
  mid: Hex,
  near: Hex,
  ground: Hex,
  lip: Hex,
  mist: Hex,
  light: Hex,
  /** Architecture of the middle layers. */
  motif: z.enum(['vault', 'gallery', 'abyss', 'machinery', 'throne', 'cinders', 'garden']),
  /** 0..1 density of hanging roots, vines and tufts. */
  overgrowth: z.number().min(0).max(1),
  /** Hanging lanterns across the sector. */
  lanterns: z.number().int().min(0).max(12),
  /** 0..1 opacity of the drifting mist bands. */
  haze: z.number().min(0).max(1),
});
export type Mood = z.infer<typeof MoodSchema>;
/** Keyed by sector id; the unit tests require one mood per laboratory sector. */
const raw: Record<string, Mood> = {
  // Cold lumerite vault where Eidra wakes.
  awakening: {
    fog: '#0a2326',
    sky: '#03090b',
    horizon: '#1f4a45',
    far: '#2d5c59',
    mid: '#173a3b',
    near: '#0a2123',
    ground: '#10302f',
    lip: '#78b3a3',
    mist: '#3f7d72',
    light: '#a8ffe4',
    motif: 'vault',
    overgrowth: 0.45,
    lanterns: 4,
    haze: 0.45,
  },
  // Steel-blue gallery lit by the Watchers' amber lamps.
  watchers: {
    fog: '#0c1828',
    sky: '#03070d',
    horizon: '#243f60',
    far: '#304f72',
    mid: '#1a2e47',
    near: '#0a1626',
    ground: '#13223a',
    lip: '#8fa9ca',
    mist: '#3f5d84',
    light: '#ffc98a',
    motif: 'gallery',
    overgrowth: 0.25,
    lanterns: 6,
    haze: 0.4,
  },
  // Pale, misty void under the bridge of remembrance.
  palimpsest: {
    fog: '#14302b',
    sky: '#05100e',
    horizon: '#548f80',
    far: '#5f9587',
    mid: '#2d5c53',
    near: '#0f2f2a',
    ground: '#1a3c36',
    lip: '#bdebd9',
    mist: '#8ecab7',
    light: '#eafff6',
    motif: 'abyss',
    overgrowth: 0.7,
    lanterns: 3,
    haze: 0.7,
  },
  // Rusted bronze machinery around the counterweight.
  counterweight: {
    fog: '#1b130d',
    sky: '#080503',
    horizon: '#5c3d22',
    far: '#5e4431',
    mid: '#36281b',
    near: '#19110b',
    ground: '#291e15',
    lip: '#cba471',
    mist: '#7c5b3b',
    light: '#ffc27a',
    motif: 'machinery',
    overgrowth: 0.3,
    lanterns: 5,
    haze: 0.5,
  },
  // Indigo throne hall of obedience, lit in pale gold.
  obedience: {
    fog: '#120e22',
    sky: '#05030b',
    horizon: '#3e316b',
    far: '#41386b',
    mid: '#251f44',
    near: '#0e0a1e',
    ground: '#1b1633',
    lip: '#dbc48c',
    mist: '#5b4e8c',
    light: '#f5dca0',
    motif: 'throne',
    overgrowth: 0.15,
    lanterns: 8,
    haze: 0.35,
  },
  // Act II — charred threshold where Nhalis kept watch, embers in the dark.
  'cinder-gate': {
    fog: '#1c0e0a',
    sky: '#070302',
    horizon: '#5a2618',
    far: '#5c2f22',
    mid: '#321810',
    near: '#150906',
    ground: '#26130d',
    lip: '#d49a6a',
    mist: '#7a3a24',
    light: '#ffab5e',
    motif: 'cinders',
    overgrowth: 0.1,
    lanterns: 4,
    haze: 0.45,
  },
  // Burning fields: the glow of the vents fills the vault with red.
  'ember-fields': {
    fog: '#260d07',
    sky: '#0a0302',
    horizon: '#7a2a12',
    far: '#76301a',
    mid: '#41170b',
    near: '#1b0704',
    ground: '#2f110a',
    lip: '#f0a868',
    mist: '#a0421e',
    light: '#ff9a48',
    motif: 'cinders',
    overgrowth: 0.05,
    lanterns: 3,
    haze: 0.55,
  },
  // Cold ash falling into the chasm: grey violet void, faint embers below.
  rift: {
    fog: '#1a1418',
    sky: '#060406',
    horizon: '#5a4450',
    far: '#5c4952',
    mid: '#30252c',
    near: '#120d10',
    ground: '#241b20',
    lip: '#cfb2b0',
    mist: '#7f6470',
    light: '#ffc9a0',
    motif: 'abyss',
    overgrowth: 0.2,
    lanterns: 2,
    haze: 0.75,
  },
  // The Brazier: a furnace hall around the Sentinelle de cendre.
  brazier: {
    fog: '#2a0c05',
    sky: '#0b0301',
    horizon: '#8c2c0c',
    far: '#7d2f14',
    mid: '#461407',
    near: '#1d0602',
    ground: '#321008',
    lip: '#ffb070',
    mist: '#b04818',
    light: '#ff8a3a',
    motif: 'cinders',
    overgrowth: 0,
    lanterns: 6,
    haze: 0.5,
  },
  // Ilyra's garden of denial: pale dead trees under a rose-grey light.
  'denial-garden': {
    fog: '#1c1420',
    sky: '#07050a',
    horizon: '#6a4a68',
    far: '#6e566e',
    mid: '#3a2b3c',
    near: '#150e17',
    ground: '#281d2b',
    lip: '#e8c8d8',
    mist: '#9a7894',
    light: '#ffd8e8',
    motif: 'garden',
    overgrowth: 0.8,
    lanterns: 5,
    haze: 0.6,
  },
};
export const moods: Readonly<Record<string, Mood>> = Object.fromEntries(
  Object.entries(raw).map(([id, mood]) => [id, MoodSchema.parse(mood)]),
);
