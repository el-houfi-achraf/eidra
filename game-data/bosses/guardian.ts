import { z } from 'zod';
export const PatternSchema = z.object({
  id: z.enum(['sweep', 'slam', 'charge', 'rain']),
  /** First phase in which the pattern joins the rotation. */
  phase: z.number().int().min(1).max(2).default(1),
  windup: z.number().positive(),
  recover: z.number().positive(),
  damage: z.number().positive(),
  range: z.number().positive(),
});
const BossSchema = z.object({
  id: z.string(),
  name: z.string(),
  subtitle: z.string(),
  health: z.number().positive(),
  phaseThreshold: z.number().min(0).max(1),
  /** Damage dealt by touching the guardian's body. */
  contact: z.number().nonnegative(),
  /** Invulnerable roar between phases, in seconds. */
  transition: z.number().nonnegative(),
  patterns: z.array(PatternSchema).min(2),
});
export const guardianData = BossSchema.parse({
  id: 'faceless-guardian',
  name: 'GARDIEN SANS VISAGE',
  subtitle: 'Celui qui n’a jamais désobéi',
  health: 320,
  phaseThreshold: 0.5,
  contact: 18,
  transition: 1.6,
  patterns: [
    { id: 'sweep', windup: 1.1, recover: 1.2, damage: 22, range: 4.5 },
    { id: 'slam', windup: 1.45, recover: 1.5, damage: 28, range: 11 },
    { id: 'charge', windup: 1.2, recover: 1.5, damage: 24, range: 3 },
    // Phase two: shards of the vault ceiling fall where the ground is marked.
    { id: 'rain', windup: 1.25, recover: 1.1, damage: 20, range: 2.6, phase: 2 },
  ],
});
export type BossPattern = z.infer<typeof PatternSchema>;
