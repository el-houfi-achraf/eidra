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
    enemies: [{ id: 'watcher-2', kind: 'watcher', x: 113, patrol: [108.5, 119.5] }],
  },
  {
    id: 'counterweight',
    name: 'CHAMBRE DU CONTREPOIDS',
    start: 120,
    end: 160,
    seed: 77,
    platforms: [
      { x: 140, y: -1, w: 40, h: 2 },
      { x: 149, y: 2, w: 4, h: 0.5 },
    ],
    enemies: [{ id: 'keeper', kind: 'keeper', x: 154 }],
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
  { id: 'seris', x: 147, y: 3.2, kind: 'memory', label: 'Fragment de Seris' },
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
