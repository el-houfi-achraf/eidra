import { z } from 'zod';
import type { PatternKind } from '../bosses/schema';
/**
 * Sound effects, as cues the game asks for by name. Each cue has generated variants
 * (`audio/sfx/<id>-<n>.ogg`, MP3 fallback, see tools/generate_audio.py) picked so the
 * same one never plays twice in a row, a random pitch spread, a minimum interval so
 * simultaneous blows do not stack into one loud spike, and optionally a music duck
 * for the heaviest impacts. TODO_ART: synthesized placeholders.
 */
export const CueSchema = z.object({
  variants: z.number().int().min(1).max(8),
  /** Gain relative to the effects volume. */
  volume: z.number().min(0).max(1.5).default(1),
  /** Random pitch spread, ± cents. */
  pitch: z.number().min(0).max(400).default(0),
  /** Heard from where it happens (panned, softer far away) or right in the ears. */
  spatial: z.boolean().default(true),
  bus: z.enum(['sfx', 'ui']).default('sfx'),
  /** Seconds before the cue may sound again. */
  cooldown: z.number().min(0).max(2).default(0.03),
  /** Voices that may ring at once. */
  voices: z.number().int().min(1).max(8).default(3),
  /** 0..1: how far the music dips under this cue. */
  duck: z.number().min(0).max(1).default(0),
  /** Closed caption shown with subtitles on, for sounds that carry meaning. */
  caption: z.string().optional(),
});
export type Cue = z.infer<typeof CueSchema>;
const cues = {
  // Eidra
  swing: { variants: 3, pitch: 70, volume: 0.8, cooldown: 0.05 },
  'swing-heavy': { variants: 1, pitch: 40 },
  riposte: { variants: 1, pitch: 20 },
  hit: { variants: 3, pitch: 90, cooldown: 0.04, voices: 4 },
  'hit-armor': { variants: 2, pitch: 60, cooldown: 0.05 },
  kill: { variants: 2, pitch: 60, duck: 0.25 },
  hurt: { variants: 1, pitch: 30, spatial: false, cooldown: 0.2, duck: 0.55 },
  parry: {
    variants: 1,
    pitch: 25,
    spatial: false,
    duck: 0.3,
    caption: '[ La céramique résonne. ]',
  },
  dash: { variants: 2, pitch: 60, spatial: false },
  jump: { variants: 2, pitch: 80, spatial: false, volume: 0.7 },
  'double-jump': { variants: 1, pitch: 40, spatial: false },
  land: { variants: 2, pitch: 80, spatial: false, volume: 0.75, cooldown: 0.08 },
  'land-heavy': { variants: 1, pitch: 40, spatial: false, cooldown: 0.15 },
  'step-stone': {
    variants: 4,
    pitch: 120,
    spatial: false,
    volume: 0.55,
    cooldown: 0.08,
    voices: 2,
  },
  'step-ash': { variants: 4, pitch: 120, spatial: false, volume: 0.55, cooldown: 0.08, voices: 2 },
  'step-moss': { variants: 4, pitch: 120, spatial: false, volume: 0.5, cooldown: 0.08, voices: 2 },
  focus: { variants: 1, spatial: false, voices: 1, cooldown: 0.2 },
  heal: { variants: 1, spatial: false },
  'card-throw': { variants: 2, pitch: 100, volume: 0.8, spatial: false, voices: 4 },
  'card-hit': { variants: 1, pitch: 120, voices: 4 },
  'card-burst': { variants: 1, pitch: 30, spatial: false },
  pogo: { variants: 1, pitch: 60, spatial: false },
  shard: { variants: 3, pitch: 50, spatial: false, volume: 0.7, cooldown: 0.06, voices: 4 },
  remanence: { variants: 1, spatial: false, caption: '[ Un souvenir se réveille. ]' },
  echo: { variants: 1, spatial: false },
  'player-death': { variants: 1, spatial: false, duck: 1, cooldown: 1 },
  respawn: { variants: 1, spatial: false },
  memory: { variants: 1, spatial: false, duck: 0.4, caption: '[ Des voix lointaines murmurent. ]' },
  // Enemies
  'enemy-alert': { variants: 1, pitch: 120, volume: 0.6, cooldown: 0.25 },
  'enemy-windup': { variants: 2, pitch: 100, volume: 0.7, cooldown: 0.12 },
  'enemy-swing': { variants: 2, pitch: 80 },
  'enemy-shot': { variants: 2, pitch: 80, cooldown: 0.08 },
  // Bosses
  'boss-roar': {
    variants: 1,
    pitch: 30,
    duck: 0.6,
    cooldown: 0.5,
    caption: '[ Un rugissement fait trembler l’arène. ]',
  },
  'boss-windup': { variants: 1, pitch: 60, volume: 0.8, cooldown: 0.2 },
  'boss-swing': { variants: 1, pitch: 60 },
  'boss-slam': { variants: 1, pitch: 40, duck: 0.45, cooldown: 0.15 },
  'boss-charge': { variants: 1, pitch: 40 },
  'boss-blink': { variants: 1, pitch: 50 },
  'boss-rain': { variants: 1, pitch: 50 },
  'boss-volley': { variants: 1, pitch: 60 },
  'boss-nova': { variants: 1, pitch: 50, duck: 0.25, cooldown: 0.1 },
  'standard-plant': {
    variants: 1,
    pitch: 20,
    duck: 0.35,
    caption: '[ Une bannière est plantée dans le sol. ]',
  },
  'standard-pulse': { variants: 1, pitch: 30, volume: 0.8, cooldown: 0.3 },
  command: { variants: 1, duck: 0.6, spatial: false, caption: '[ « NE BOUGEZ PLUS » ]' },
  'gaze-punish': { variants: 1, pitch: 30, spatial: false },
  leap: { variants: 1, pitch: 50 },
  geyser: { variants: 2, pitch: 90, cooldown: 0.06, voices: 4 },
  mirror: { variants: 1, duck: 0.3, caption: '[ Le verre chante : des reflets apparaissent. ]' },
  'reflection-shatter': { variants: 1, pitch: 80 },
  'boss-death': { variants: 1, duck: 1, spatial: false, cooldown: 1 },
  // World
  vent: { variants: 1, pitch: 60, cooldown: 0.3, caption: '[ Le feu gronde. ]' },
  'gate-close': { variants: 1, pitch: 40, duck: 0.3, caption: '[ Une porte de pierre retombe. ]' },
  'gate-open': { variants: 1, pitch: 40, caption: '[ La pierre glisse et s’ouvre. ]' },
  anchor: { variants: 1, spatial: false, caption: '[ La Lumérite chante doucement. ]' },
  dialogue: { variants: 3, pitch: 150, spatial: false, bus: 'ui', volume: 0.6, cooldown: 0.05 },
  // Interface
  'ui-move': { variants: 1, pitch: 40, spatial: false, bus: 'ui', cooldown: 0.04 },
  'ui-confirm': { variants: 1, spatial: false, bus: 'ui' },
  'ui-back': { variants: 1, spatial: false, bus: 'ui' },
  'ui-open': { variants: 1, spatial: false, bus: 'ui' },
} as const satisfies Record<string, z.input<typeof CueSchema>>;
export type CueId = keyof typeof cues;
export const soundCues: Readonly<Record<CueId, Cue>> = Object.fromEntries(
  Object.entries(cues).map(([id, cue]) => [id, CueSchema.parse(cue)]),
) as Record<CueId, Cue>;
export const isCue = (id: string): id is CueId => id in soundCues;
/** Paths of a cue's variant, compressed first, fallback second. */
export function cueFiles(id: CueId, variant: number): string[] {
  return [`sfx/${id}-${variant}.ogg`, `sfx/${id}-${variant}.mp3`];
}
/**
 * Sounds of boss patterns: a telegraph when the windup starts, a blow when it lands
 * (every pulse of a nova or an eruption). Signatures have their own voices.
 */
export const patternCues: Readonly<Record<PatternKind, { windup?: CueId; strike?: CueId }>> = {
  sweep: { windup: 'boss-windup', strike: 'boss-swing' },
  slam: { windup: 'boss-windup', strike: 'boss-slam' },
  charge: { windup: 'boss-windup', strike: 'boss-charge' },
  rain: { windup: 'boss-windup', strike: 'boss-rain' },
  volley: { windup: 'boss-windup', strike: 'boss-volley' },
  blink: { windup: 'boss-blink', strike: 'boss-blink' },
  nova: { windup: 'boss-windup', strike: 'boss-nova' },
  standard: { windup: 'boss-windup', strike: 'standard-plant' },
  command: { windup: 'command' },
  eruption: { windup: 'boss-windup', strike: 'geyser' },
  leap: { windup: 'boss-windup', strike: 'leap' },
  mirror: { windup: 'mirror' },
};
