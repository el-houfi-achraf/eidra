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
    name: 'Memory Step',
    description:
      'Un Écho rejoue vos cinq dernières secondes. Il peut tenir un sceau à votre place.',
  },
  'double-jump': { name: 'Seconde impulsion', description: 'Un souvenir porte le prochain saut.' },
  'time-fracture': { name: 'Time Fracture', description: 'Ralentir les entités marquées.' },
  'soul-shift': { name: 'Soul Shift', description: 'Basculer l’état d’un environnement.' },
  transposition: { name: 'Transposition', description: 'Rejoindre la mémoire complète d’un lieu.' },
} as const;
