import { z } from 'zod';
export const HintActionSchema = z.enum([
  'move',
  'jump',
  'attack',
  'dash',
  'parry',
  'heal',
  'remanence',
  'echo',
  'down',
]);
export type HintAction = z.infer<typeof HintActionSchema>;
const HintSchema = z.object({
  id: z.string(),
  action: HintActionSchema,
  text: z.string(),
  /** Horizontal band of the laboratory where the hint may appear. */
  from: z.number(),
  to: z.number(),
  /** Abilities that must be recovered first. */
  requires: z.array(z.string()).default([]),
  /** Flag after which the hint is pointless. */
  until: z.string().optional(),
  /** Only while Eidra is hurt and can afford a Recueillement. */
  wounded: z.boolean().default(false),
});
export type TutorialHint = z.infer<typeof HintSchema>;
/**
 * Contextual prompts, in priority order. A hint retires as soon as the player
 * performs its action anywhere; completion is stored as a `tutorial:<id>` flag,
 * so it survives saves without changing the save format.
 */
export const tutorialHints = [
  { id: 'move', action: 'move', text: 'Se déplacer', from: 0, to: 16 },
  {
    id: 'heal',
    action: 'heal',
    text: 'Maintenir pour se recueillir et refermer ses fêlures',
    from: 0,
    to: 201,
    wounded: true,
  },
  {
    id: 'jump',
    action: 'jump',
    text: 'Sauter — maintenir pour monter plus haut',
    from: 12,
    to: 24,
  },
  {
    id: 'dash',
    action: 'dash',
    text: 'Élan — traverser les attaques sans être touchée',
    from: 18,
    to: 40,
    requires: ['dash'],
  },
  { id: 'attack', action: 'attack', text: 'Frapper', from: 26, to: 40 },
  {
    id: 'parry',
    action: 'parry',
    text: 'Parer juste avant l’impact, puis riposter',
    from: 56,
    to: 70,
  },
  {
    id: 'remanence',
    action: 'remanence',
    text: 'Rémanence — faire réapparaître le pont oublié',
    from: 82,
    to: 92,
    requires: ['remanence'],
  },
  {
    id: 'down',
    action: 'down',
    text: 'En l’air : bas + attaque pour rebondir sur un ennemi',
    from: 108,
    to: 121,
  },
  {
    id: 'echo',
    action: 'echo',
    text: 'Rester sur le sceau, puis laisser un Écho le tenir',
    from: 125,
    to: 140,
    requires: ['memory-step'],
    until: 'echo-gate-open',
  },
].map((hint) => HintSchema.parse(hint));
