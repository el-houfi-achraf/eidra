import { z } from 'zod';
import { enemyKinds } from '../enemies/roster';
import { ashArenas, ashCheckpoints, ashChunks, ashLandmarks, ashPits, ashStages } from './ashes';
import { depthChambers, depthCheckpoints, depthLandmarks, depthSeals } from './depths';
/**
 * The world as rooms on a 2D plane (D036). The route rooms follow one another along
 * x: Act I, the laboratory (below), then Act II, the Failles de cendre (`ashes.ts`).
 * Chambers hang above and below them (`depths.ts`), joined by doors.
 */
const PlatformSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  memory: z.boolean().default(false),
});
const SpawnSchema = z.object({
  id: z.string(),
  kind: z.enum(enemyKinds),
  x: z.number(),
  y: z.number().default(1),
  patrol: z.tuple([z.number(), z.number()]).optional(),
});
/** Fire column bursting in rhythm: `active` seconds out of every `period`. */
const HazardSchema = z.object({
  id: z.string(),
  x: z.number(),
  /** Floor the column bursts from. */
  y: z.number().default(0),
  width: z.number().positive(),
  period: z.number().positive(),
  active: z.number().positive(),
  offset: z.number().nonnegative(),
  damage: z.number().positive(),
});
export type Hazard = z.infer<typeof HazardSchema>;
/** Lowest and highest points of a route room: below `ROUTE_BOTTOM`, Eidra has fallen. */
export const ROUTE_BOTTOM = -5;
export const ROUTE_TOP = 11;
/**
 * Gates rise from the floor into the vault: no ledge of a route room lets Eidra
 * leap over one (the counterweight's climb passes nine metres up beside its seal).
 */
export const GATE_HEIGHT = ROUTE_TOP + 1;
/**
 * An opening in a chamber's walls: a range of y on the left or right side, a range
 * of x on the top or bottom. It leads into whichever room lies across that side.
 */
const DoorSchema = z
  .object({
    side: z.enum(['left', 'right', 'top', 'bottom']),
    from: z.number(),
    to: z.number(),
  })
  .refine((door) => door.to - door.from >= 1.6, 'a door lets Eidra through');
export type Door = z.infer<typeof DoorSchema>;
/**
 * A slab barring a way until it opens for good (saved as `open:<id>`): a cracked
 * wall gives way under blows; a shutter slides open from its lever, on the far side.
 */
const SealSchema = z
  .object({
    id: z.string(),
    kind: z.enum(['cracked', 'shutter']).default('cracked'),
    x: z.number(),
    y: z.number(),
    w: z.number().positive(),
    h: z.number().positive(),
    /** Blows a cracked wall takes. */
    hits: z.number().int().positive().default(3),
    /** Where Eidra pulls a shutter's lever. */
    lever: z.object({ x: z.number(), y: z.number() }).optional(),
  })
  .refine((seal) => seal.kind === 'cracked' || seal.lever, 'a shutter has a lever');
export type Seal = z.infer<typeof SealSchema>;
export const sealFlag = (id: string): string => `open:${id}`;
/**
 * A room. Route rooms run along x, between `start` and `end`, from `ROUTE_BOTTOM`
 * to `ROUTE_TOP`, open to their neighbours on either side. Chambers are closed
 * boxes (`start`..`end` × `bottom`..`top`) whose walls open only at their doors.
 */
export const ChunkSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    kind: z.enum(['route', 'chamber']).default('route'),
    /** Route room whose mood, music and ground a chamber shares; a route room is its own. */
    sector: z.string().optional(),
    start: z.number(),
    end: z.number(),
    bottom: z.number().default(ROUTE_BOTTOM),
    top: z.number().default(ROUTE_TOP),
    doors: z.array(DoorSchema).default([]),
    /** Hidden behind a cracked wall: the map shows nothing of it until it is found. */
    secret: z.boolean().default(false),
    platforms: z.array(PlatformSchema),
    enemies: z.array(SpawnSchema),
    hazards: z.array(HazardSchema).default([]),
    seed: z.number(),
  })
  .refine((chunk) => chunk.hazards.every((h) => h.active < h.period), 'vents must rest')
  .refine((chunk) => chunk.end > chunk.start && chunk.top > chunk.bottom, 'a room has a size')
  .refine((chunk) => chunk.kind === 'chamber' || chunk.doors.length === 0, 'route rooms are open');
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
      // Past Kael's fragment, remembered steps climb to the crypt over the room.
      { x: 35.6, y: 7.05, w: 2, h: 0.3, memory: true },
      { x: 37.8, y: 8.85, w: 1.8, h: 0.3, memory: true },
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
      // Past Mira, the floor opens on the well down to the archives (78 to 80).
      { x: 59, y: -1, w: 38, h: 2 },
      // Head-high slabs clear Eidra (1.83 m) and stay within one jump (top 2.3 m).
      { x: 50, y: 2.15, w: 5, h: 0.3 },
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
      { x: 144.5, y: 2.15, w: 3, h: 0.3 },
      // Ledges up to the opening in the vault (135 to 138): the way to the cage. The
      // lowest clears Eidra's head, so the walk to the seal stays free; no ledge hangs
      // over the edge another is leapt from (lanes, as in `depths.ts`).
      { x: 132.9, y: 2.15, w: 2.2, h: 0.3 },
      { x: 136.85, y: 3.825, w: 2.2, h: 0.3 },
      { x: 139.5, y: 5.5, w: 2.2, h: 0.3 },
      { x: 135.75, y: 7.175, w: 2.2, h: 0.3 },
    ],
    // The Porteur du dernier ordre is a boss (game-data/bosses/keeper.ts).
    enemies: [],
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
  ...ashChunks,
  ...depthChambers,
].map((value) => ChunkSchema.parse(value));
export type ChunkData = z.infer<typeof ChunkSchema>;
/** The rooms along x, in order: the route of both acts. */
export const routeChunks = chunks.filter((chunk) => chunk.kind === 'route');
/**
 * Cracked walls and shutters of the world. They belong to no single room: one
 * stands in a doorway and must be seen, and solid, from both sides of it.
 */
export const seals = depthSeals.map((seal) => SealSchema.parse(seal));
const CheckpointSchema = z.object({
  id: z.string(),
  x: z.number(),
  /** Top of the floor the anchor stands on. */
  y: z.number().default(0),
  name: z.string(),
});
export type Checkpoint = z.infer<typeof CheckpointSchema>;
export const checkpoints: Checkpoint[] = [
  { id: 'awakening', x: 7, name: 'Ancrage de l’éveil' },
  { id: 'mira', x: 73, name: 'Ancrage de Mira' },
  // Before the Keeper: a defeat no longer sends Eidra back across the memory bridge.
  // Short of the seal and of the climb to the cage, before the Keeper.
  { id: 'counterweight', x: 127, name: 'Ancrage du contrepoids' },
  { id: 'threshold', x: 160, name: 'Ancrage du seuil' },
  ...depthCheckpoints,
  ...ashCheckpoints,
].map((value) => CheckpointSchema.parse(value));
/**
 * Powers, fragments, reliquaries and Mira. Act I spaces its three powers out: the
 * Élan, the Rémanence and the Écho mémoriel wait in its chambers (`depths.ts`).
 */
export const landmarks = [
  { id: 'mira', x: 76, y: 1, kind: 'npc', label: 'Mira' },
  { id: 'kael', x: 31, y: 6.2, kind: 'memory', label: 'Fragment de Kael' },
  { id: 'seris', x: 144.5, y: 3.2, kind: 'memory', label: 'Fragment de Seris' },
  ...depthLandmarks,
  ...ashLandmarks,
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
  /** Title card when the guardian falls. */
  victory: z.string(),
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
    victory: 'LE DERNIER ORDRE S’ÉTEINT',
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
    victory: 'L’ORDRE EST ROMPU',
    trigger: 166,
    left: 164,
    right: 196,
    roam: [167, 192],
  },
  ...ashArenas,
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
  // Inside the sector, within reach of the Écho mémoriel's reliquary (x = 119).
  { id: 'palimpsest', guardians: ['watcher-2'], gate: 119.8, name: 'Pont du souvenir' },
  ...ashStages,
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
const PitSchema = z.object({ from: z.number(), to: z.number(), safe: z.number() });
/** Falling between `from` and `to` returns Eidra to the solid ground at `safe`. */
export const pits = [{ from: 88, to: 109, safe: 84 }, ...ashPits].map((pit) =>
  PitSchema.parse(pit),
);
/** Story beats tied to the route. */
export const route = {
  /**
   * Where a new journey wakes: beside the first anchor but out of its reach, so the
   * first prompt on screen is the one to move.
   */
  wake: 4.4,
  /** Mira's farewell once the Guardian has fallen, then Act II. */
  aftermath: 197,
  act2: {
    x: 201.5,
    title: 'ACTE II — LES FAILLES DE CENDRE',
    subtitle: 'La porte de Nhalis est ouverte',
  },
  /** Beyond Ilyra's arena: the end of the act. */
  finale: { boss: 'ilyra', x: 408.5, returnX: 400 },
  /** Each act gets its own page of the map, from the first sector it contains. */
  acts: [
    { title: 'Le laboratoire de l’éveil', from: 0 },
    { title: 'Les Failles de cendre', from: ashChunks[0]!.start },
  ],
} as const;
/** The act a point of the route belongs to. */
export const actAt = (x: number): (typeof route.acts)[number] =>
  route.acts.filter((act) => x >= act.from).at(-1) ?? route.acts[0];
