import { z } from 'zod';
export const PatternSchema = z.object({
  id: z.enum(['sweep', 'slam', 'charge']),
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
  patterns: z.array(PatternSchema).min(2),
});
export const guardianData = BossSchema.parse({
  id: 'faceless-guardian',
  name: 'GARDIEN SANS VISAGE',
  subtitle: 'Celui qui n’a jamais désobéi',
  health: 320,
  phaseThreshold: 0.5,
  patterns: [
    { id: 'sweep', windup: 1.1, recover: 1.2, damage: 22, range: 4.5 },
    { id: 'slam', windup: 1.45, recover: 1.5, damage: 28, range: 11 },
    { id: 'charge', windup: 1.2, recover: 1.5, damage: 24, range: 3 },
  ],
});
export type BossPattern = z.infer<typeof PatternSchema>;
