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
  'up',
  'double',
  'cast',
]);
export type HintAction = z.infer<typeof HintActionSchema>;
const HintSchema = z.object({
  id: z.string(),
  action: HintActionSchema,
  text: z.string(),
  /** Horizontal band of the route where the hint may appear. */
  from: z.number().default(0),
  to: z.number().default(0),
  /** Or the room where it appears, instead of a band of the route. */
  room: z.string().optional(),
  /** Abilities that must be recovered first. */
  requires: z.array(z.string()).default([]),
  /** Flag after which the hint is pointless. */
  until: z.string().optional(),
  /** Only while Eidra is hurt and can afford a Recueillement. */
  wounded: z.boolean().default(false),
  /** Only once Eidra holds enough resonance to throw a card. */
  cards: z.boolean().default(false),
  /**
   * Seconds on screen before an ignored hint retires by itself: a prompt the player
   * keeps not following must not sit on the screen for the rest of the journey.
   */
  linger: z.number().positive().default(18),
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
    linger: 12,
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
    room: 'elans',
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
    id: 'remanence-roots',
    action: 'remanence',
    text: 'Rémanence — rappeler les marches oubliées',
    room: 'roots',
    requires: ['remanence'],
  },
  // The first flyers within reach: wax moths hovering over the drowned archives.
  {
    id: 'up',
    action: 'up',
    text: 'Haut + attaque : frapper au-dessus de soi',
    room: 'archives',
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
  {
    id: 'double',
    action: 'double',
    text: 'En l’air : sauter à nouveau pour atteindre les corniches',
    from: 276,
    to: 300,
    requires: ['double-jump'],
  },
  // Taught once Eidra has earned two cards' worth of resonance, anywhere after the gallery.
  {
    id: 'cast',
    action: 'cast',
    text: 'Toucher : lancer une carte · maintenir : se recueillir',
    from: 40,
    to: 411,
    cards: true,
    linger: 12,
  },
].map((hint) => HintSchema.parse(hint));
