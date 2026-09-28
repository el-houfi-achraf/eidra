import { z } from 'zod';
const OfferingSchema = z.object({
  vitality: z.number().int().positive(),
  costs: z.array(z.number().int().positive()).min(1),
});
/**
 * Anchor offerings. Each offering spends Lumérite shards for a permanent increase
 * of maximum health, persisted through the existing `healthUpgrades` save field.
 */
export const offeringData = OfferingSchema.parse({
  vitality: 20,
  costs: [10, 20, 35],
});
export type OfferingData = z.infer<typeof OfferingSchema>;
