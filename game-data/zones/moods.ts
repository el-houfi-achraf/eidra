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
  motif: z.enum(['vault', 'gallery', 'abyss', 'machinery', 'throne']),
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
};
export const moods: Readonly<Record<string, Mood>> = Object.fromEntries(
  Object.entries(raw).map(([id, mood]) => [id, MoodSchema.parse(mood)]),
);
