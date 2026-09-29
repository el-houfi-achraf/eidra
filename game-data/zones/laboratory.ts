import { z } from 'zod';
const PlatformSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  memory: z.boolean().default(false),
});
const SpawnSchema = z.object({
  id: z.string(),
  kind: z.enum(['watcher', 'wisp', 'sentinel', 'keeper']),
  x: z.number(),
  y: z.number().default(1),
  patrol: z.tuple([z.number(), z.number()]).optional(),
});
export const ChunkSchema = z.object({
  id: z.string(),
  name: z.string(),
  start: z.number(),
  end: z.number(),
  platforms: z.array(PlatformSchema),
  enemies: z.array(SpawnSchema),
  seed: z.number(),
});
export const chunks = [
  {
    id: 'awakening',
    name: 'CHAMBRE D’ÉVEIL',
    start: 0,
    end: 40,
    seed: 17,
    platforms: [
      { x: 20, y: -1, w: 40, h: 2 },
      { x: 16, y: 1.2, w: 4, h: 0.5 },
      { x: 21, y: 2.8, w: 3, h: 0.5 },
      { x: 26, y: 4.3, w: 3, h: 0.5, memory: true },
      { x: 31, y: 5.1, w: 5, h: 0.5, memory: true },
    ],
    enemies: [{ id: 'watcher-1', kind: 'watcher', x: 34 }],
  },
  {
    id: 'watchers',
    name: 'GALERIE DES VEILLEURS',
    start: 40,
    end: 80,
    seed: 31,
    platforms: [
      { x: 60, y: -1, w: 40, h: 2 },
      { x: 50, y: 1.7, w: 5, h: 0.5 },
      { x: 61, y: 3.5, w: 4, h: 0.5 },
    ],
    enemies: [
      { id: 'wisp-1', kind: 'wisp', x: 53, y: 3.2 },
      { id: 'sentinel-1', kind: 'sentinel', x: 64 },
    ],
  },
  {
    id: 'palimpsest',
    name: 'LE PONT DU SOUVENIR',
    start: 80,
    end: 120,
    seed: 57,
    platforms: [
      { x: 84, y: -1, w: 8, h: 2 },
      { x: 114, y: -1, w: 12, h: 2 },
      { x: 91, y: -0.15, w: 4, h: 0.5, memory: true },
      { x: 98, y: 0.6, w: 4, h: 0.5, memory: true },
      { x: 105, y: -0.15, w: 4, h: 0.5, memory: true },
    ],
    // The bank's first metres stay clear: a safe landing after the bridge.
    enemies: [{ id: 'watcher-2', kind: 'watcher', x: 114, patrol: [112, 119.5] }],
  },
  {
    id: 'counterweight',
    name: 'CHAMBRE DU CONTREPOIDS',
    start: 120,
    end: 160,
    seed: 77,
    platforms: [
      { x: 140, y: -1, w: 40, h: 2 },
      // Ledge of Seris's fragment, in the antechamber before the Keeper's arena, so the
      // Keeper (2.97 m tall) never has to walk under a slab lower than its head.
      { x: 144.5, y: 2, w: 3, h: 0.5 },
    ],
    enemies: [{ id: 'keeper', kind: 'keeper', x: 154, patrol: [149, 157.2] }],
  },
  {
    id: 'obedience',
    name: 'LE SEUIL DE L’OBÉISSANCE',
    start: 160,
    end: 201,
    seed: 99,
    platforms: [{ x: 180, y: -1, w: 42, h: 2 }],
    enemies: [],
  },
].map((value) => ChunkSchema.parse(value));
export type ChunkData = z.infer<typeof ChunkSchema>;
export const checkpoints = [
  { id: 'awakening', x: 7, name: 'Ancrage de l’éveil' },
  { id: 'mira', x: 73, name: 'Ancrage de Mira' },
  { id: 'threshold', x: 160, name: 'Ancrage du seuil' },
];
export const landmarks = [
  { id: 'dash', x: 18, y: 1.2, kind: 'ability', label: 'Élan de Lumérite' },
  { id: 'mira', x: 76, y: 1, kind: 'npc', label: 'Mira' },
  { id: 'remanence', x: 80.5, y: 1.4, kind: 'ability', label: 'Rémanence' },
  { id: 'memory-step', x: 119, y: 1.4, kind: 'ability', label: 'Memory Step' },
  { id: 'kael', x: 31, y: 6.2, kind: 'memory', label: 'Fragment de Kael' },
  { id: 'seris', x: 144.5, y: 3.2, kind: 'memory', label: 'Fragment de Seris' },
] as const;

export const shortcuts = [
  {
    id: 'maintenance-west',
    x: 23,
    y: 4.1,
    toX: 123,
    toY: 1.2,
    label: 'Conduit de maintenance — Contrepoids',
    requires: 'echo-gate-open',
  },
  {
    id: 'maintenance-east',
    x: 123,
    y: 1.2,
    toX: 22,
    toY: 4.2,
    label: 'Conduit de maintenance — Chambre d’éveil',
    requires: 'echo-gate-open',
  },
] as const;

const ArenaSchema = z.object({
  id: z.string(),
  /** Enemy id of the fight's guardian, or `faceless-guardian` for the boss. */
  guardian: z.string(),
  name: z.string(),
  subtitle: z.string(),
  /** Crossing this abscissa seals the arena behind the player. */
  trigger: z.number(),
  /** Gate positions: `left` closes behind the player, `right` bars the way on. */
  left: z.number(),
  right: z.number(),
  /** Horizontal range the guardian's centre may occupy. */
  roam: z.tuple([z.number(), z.number()]),
});
export type Arena = z.infer<typeof ArenaSchema>;
/**
 * Guarded chambers. The far gate stays shut until the guardian falls; the near gate
 * seals behind the player once the fight starts, so a guardian cannot be walked past.
 */
export const arenas = [
  {
    id: 'last-order',
    guardian: 'keeper',
    name: 'LE PORTEUR DU DERNIER ORDRE',
    subtitle: 'Il garde encore le seuil',
    trigger: 149.5,
    left: 147.5,
    right: 158.6,
    roam: [149, 157.2],
  },
  {
    id: 'obedience',
    guardian: 'faceless-guardian',
    name: 'GARDIEN SANS VISAGE',
    subtitle: 'Celui qui n’a jamais désobéi',
    trigger: 166,
    left: 164,
    right: 196,
    roam: [167, 192],
  },
].map((arena) => ArenaSchema.parse(arena));
const StageSchema = z.object({
  /** Sector whose exit is sealed. */
  id: z.string(),
  /** Enemies to defeat before the way on opens. */
  guardians: z.array(z.string()).min(1),
  /** Abscissa of the sealed exit. */
  gate: z.number(),
  /** Shown when the passage opens. */
  name: z.string(),
});
export type Stage = z.infer<typeof StageSchema>;
/**
 * Stages of the laboratory. Each sector's exit stays sealed until its guardians have
 * fallen; the Keeper and the Faceless Guardian seal their own arenas above.
 */
export const stages = [
  { id: 'awakening', guardians: ['watcher-1'], gate: 39, name: 'Chambre d’éveil' },
  // Before Mira's anchor: the anchor is the reward for clearing the gallery.
  { id: 'watchers', guardians: ['wisp-1', 'sentinel-1'], gate: 70, name: 'Galerie des veilleurs' },
  // Inside the sector, within reach of Memory Step's reliquary (x = 119).
  { id: 'palimpsest', guardians: ['watcher-2'], gate: 119.8, name: 'Pont du souvenir' },
].map((stage) => StageSchema.parse(stage));
export const stageGate = (id: string): string => `stage-${id}`;
export const gates = [
  { id: 'echo', x: 141 },
  ...stages.map((stage) => ({ id: stageGate(stage.id), x: stage.gate })),
  ...arenas.flatMap((arena) => [
    { id: `${arena.id}-left`, x: arena.left },
    { id: `${arena.id}-right`, x: arena.right },
  ]),
];
/** Gates that bar progress: they only close in front of a player who has not crossed them. */
export const progressGates: ReadonlySet<string> = new Set([
  ...stages.map((stage) => stageGate(stage.id)),
  ...arenas.map((arena) => `${arena.id}-right`),
]);
