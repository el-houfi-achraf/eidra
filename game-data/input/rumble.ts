import { z } from 'zod';
const RumbleSchema = z.object({
  /** Low-frequency motor, 0..1. */
  strong: z.number().min(0).max(1),
  /** High-frequency motor, 0..1. */
  weak: z.number().min(0).max(1),
  /** Milliseconds. */
  duration: z.number().int().positive().max(1000),
});
export type Rumble = z.infer<typeof RumbleSchema>;
/**
 * Vibration felt for each gameplay cue, scaled by the player's vibration setting.
 * Cues without an entry stay silent in the hands: footsteps, jumps, menus.
 */
export const rumbleCues: Readonly<Record<string, Rumble>> = Object.fromEntries(
  Object.entries({
    hit: { strong: 0, weak: 0.35, duration: 60 },
    parry: { strong: 0.2, weak: 0.65, duration: 90 },
    hurt: { strong: 0.7, weak: 0.5, duration: 220 },
    heavy: { strong: 0.9, weak: 0.6, duration: 280 },
    victory: { strong: 0.6, weak: 0.8, duration: 600 },
    death: { strong: 1, weak: 1, duration: 450 },
  }).map(([cue, rumble]) => [cue, RumbleSchema.parse(rumble)]),
);
