import { z } from 'zod';
export const abilityIds = [
  'dash',
  'remanence',
  'memory-step',
  'double-jump',
  'time-fracture',
  'soul-shift',
  'transposition',
] as const;
export const AbilityIdSchema = z.enum(abilityIds);
export type AbilityId = z.infer<typeof AbilityIdSchema>;
export const abilityData = {
  dash: {
    name: 'Élan de Lumérite',
    description: 'Une brève esquive. Traversez le danger au bon moment.',
  },
  remanence: {
    name: 'Rémanence',
    description: 'Le passé reprend forme. Révélez les plateformes oubliées.',
  },
  'memory-step': {
    name: 'Écho mémoriel',
    description:
      'Un Écho rejoue vos cinq dernières secondes. Il peut tenir un sceau à votre place.',
  },
  'double-jump': { name: 'Seconde impulsion', description: 'Un souvenir porte le prochain saut.' },
  'time-fracture': { name: 'Fracture du temps', description: 'Ralentir les entités marquées.' },
  'soul-shift': { name: 'Bascule d’âme', description: 'Basculer l’état d’un environnement.' },
  transposition: { name: 'Transposition', description: 'Rejoindre la mémoire complète d’un lieu.' },
} as const;
const FocusSchema = z.object({
  capacity: z.number().positive(),
  cost: z.number().positive(),
  heal: z.number().positive(),
  channel: z.number().positive(),
  gainPerHit: z.number().nonnegative(),
  gainOnParry: z.number().nonnegative(),
});
/** Recueillement: resonance earned by landing blows is spent to mend the ceramic body. */
export const focusData = FocusSchema.parse({
  capacity: 99,
  cost: 33,
  heal: 32,
  channel: 0.8,
  gainPerHit: 11,
  gainOnParry: 22,
});
export type FocusData = z.infer<typeof FocusSchema>;
const CardSchema = z.object({
  /** Resonance spent per throw; each orbiting card shows `perCard` resonance. */
  cost: z.number().positive(),
  perCard: z.number().positive(),
  damage: z.number().positive(),
  /** Metres per second and metres travelled before a card fades. */
  speed: z.number().positive(),
  range: z.number().positive(),
  /** Cards and spread (radians) of the fan thrown during a riposte. */
  fan: z.number().int().min(2),
  spread: z.number().positive(),
  cooldown: z.number().nonnegative(),
  /** A press shorter than this throws; a longer one keeps channelling Recueillement. */
  tap: z.number().positive(),
});
/**
 * Eidra's cards: her resonance, made visible as cards orbiting her. A short press of
 * the Recueillement input throws one; the same press held channels a heal, so every
 * card is a choice between striking from afar and mending.
 */
export const cardData = CardSchema.parse({
  cost: 22,
  perCard: 11,
  damage: 16,
  speed: 18,
  range: 13,
  fan: 3,
  spread: 0.2,
  cooldown: 0.35,
  tap: 0.2,
});
export type CardData = z.infer<typeof CardSchema>;
