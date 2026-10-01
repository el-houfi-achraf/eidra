/**
 * Act II — Les Failles de cendre. Raw data, validated by `laboratory.ts`, which
 * appends it to Act I so the world stays one continuous route along x.
 *
 * - La Porte de Nhalis: the anchor after the Guardian, two ash crawlers.
 * - Les Champs de braise: ember vents to time, a ranged Porte-braise, Ilyan's
 *   fragment on the ledges and the Seconde impulsion (double jump).
 * - La Faille: a chasm crossed only with the double jump, haunted by two wisps,
 *   Vaela's fragment above the highest ledge.
 * - Le Brasier: the arena of the Sentinelle de cendre (elite).
 * - Le Jardin du déni: Ilyra's arena, then the end of the act.
 */
export const ashChunks = [
  {
    id: 'cinder-gate',
    name: 'LA PORTE DE NHALIS',
    start: 201,
    end: 241,
    seed: 113,
    platforms: [
      { x: 221, y: -1, w: 40, h: 2 },
      { x: 214, y: 2.15, w: 3, h: 0.3 },
      { x: 228, y: 2.2, w: 4, h: 0.5 },
    ],
    enemies: [
      { id: 'crawler-1', kind: 'crawler', x: 218 },
      { id: 'crawler-2', kind: 'crawler', x: 233 },
    ],
  },
  {
    id: 'ember-fields',
    name: 'LES CHAMPS DE BRAISE',
    start: 241,
    end: 281,
    seed: 131,
    platforms: [
      { x: 261, y: -1, w: 40, h: 2 },
      { x: 250, y: 2.15, w: 4, h: 0.3 },
      { x: 257.5, y: 3.6, w: 3, h: 0.5 },
      { x: 268, y: 2.15, w: 4, h: 0.3 },
    ],
    enemies: [
      { id: 'ember-1', kind: 'ember', x: 253 },
      { id: 'crawler-3', kind: 'crawler', x: 263 },
      { id: 'sentinel-2', kind: 'sentinel', x: 272 },
    ],
    // Fire columns in rhythm: cross between two bursts.
    hazards: [
      { id: 'vent-1', x: 246, width: 1.4, period: 3.2, active: 1.1, offset: 0, damage: 18 },
      { id: 'vent-2', x: 255, width: 1.4, period: 3.2, active: 1.1, offset: 1.1, damage: 18 },
      { id: 'vent-3', x: 264.5, width: 1.4, period: 3.2, active: 1.1, offset: 2.2, damage: 18 },
    ],
  },
  {
    id: 'rift',
    name: 'LA FAILLE',
    start: 281,
    end: 321,
    seed: 149,
    platforms: [
      { x: 284, y: -1, w: 6, h: 2 },
      // Each second ledge is higher than one jump: the Seconde impulsion is required.
      { x: 290.5, y: 0.8, w: 2.4, h: 0.5 },
      { x: 295.5, y: 3.4, w: 2.4, h: 0.5 },
      { x: 301, y: 1.6, w: 2.4, h: 0.5 },
      { x: 306.5, y: 4.4, w: 2.4, h: 0.5 },
      { x: 311.5, y: 2, w: 2.4, h: 0.5 },
      { x: 318, y: -1, w: 6, h: 2 },
    ],
    enemies: [
      { id: 'wisp-2', kind: 'wisp', x: 298, y: 6 },
      { id: 'wisp-3', kind: 'wisp', x: 309, y: 7 },
    ],
  },
  {
    id: 'brazier',
    name: 'LE BRASIER',
    start: 321,
    end: 361,
    seed: 167,
    platforms: [{ x: 341, y: -1, w: 40, h: 2 }],
    // The Sentinelle de cendre is a boss (game-data/bosses/warden.ts).
    enemies: [],
    hazards: [
      { id: 'vent-4', x: 340.5, width: 1.6, period: 4, active: 1.2, offset: 0.5, damage: 20 },
    ],
  },
  {
    id: 'denial-garden',
    name: 'LE JARDIN DU DÉNI',
    start: 361,
    end: 411,
    seed: 181,
    platforms: [{ x: 386, y: -1, w: 50, h: 2 }],
    enemies: [],
  },
];
export const ashCheckpoints = [
  { id: 'nhalis', x: 205, name: 'Ancrage de Nhalis' },
  // Before the vents: a fall to the fire columns no longer costs the walk from the gate.
  { id: 'embers', x: 242.5, name: 'Ancrage des braises' },
  { id: 'rift', x: 283.5, name: 'Ancrage de la Faille' },
  // Before the Sentinelle: a defeat does not send Eidra back across the rift.
  { id: 'brazier', x: 322.5, name: 'Ancrage du Brasier' },
  { id: 'garden', x: 364, name: 'Ancrage du Jardin' },
];
export const ashLandmarks = [
  { id: 'ilyan', x: 257.5, y: 4.9, kind: 'memory', label: 'Fragment d’Ilyan' },
  { id: 'double-jump', x: 277, y: 1.4, kind: 'ability', label: 'Seconde impulsion' },
  { id: 'vaela', x: 306.5, y: 5.9, kind: 'memory', label: 'Fragment de Vaela' },
] as const;
export const ashArenas = [
  {
    id: 'brazier',
    guardian: 'cinder-warden',
    name: 'LA SENTINELLE DE CENDRE',
    subtitle: 'Elle garde encore les braises',
    victory: 'LES BRAISES S’ÉTEIGNENT',
    trigger: 326.5,
    left: 324,
    right: 358,
    roam: [326, 356],
  },
  {
    id: 'denial',
    guardian: 'ilyra',
    name: 'ILYRA',
    subtitle: 'Celle qui refusait de voir',
    victory: 'ELLE OUVRE LES YEUX',
    trigger: 372,
    left: 369.5,
    right: 407.5,
    roam: [372, 405],
  },
];
export const ashStages = [
  { id: 'cinder-gate', guardians: ['crawler-1', 'crawler-2'], gate: 239, name: 'Porte de Nhalis' },
  // The Seconde impulsion lies before the exit: the rift behind it needs it.
  {
    id: 'ember-fields',
    guardians: ['ember-1', 'crawler-3', 'sentinel-2'],
    gate: 279.5,
    name: 'Champs de braise',
  },
  { id: 'rift', guardians: ['wisp-2', 'wisp-3'], gate: 320, name: 'La Faille' },
];
/** Falling into the rift returns Eidra to its near bank. */
export const ashPits = [{ from: 287, to: 315, safe: 284.5 }];
