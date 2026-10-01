/**
 * Act I — the chambers of the laboratory (D036): the depths under the gallery and
 * the bridge, and the lofts above the route. Raw data, validated by `laboratory.ts`.
 *
 * The way through: from Mira's anchor Eidra drops down the well into the drowned
 * archives (an anchor), wins the Élan in the chamber beside them, dashes over the
 * copyists' chasm, goes down the drowned stair to the Rémanence, climbs the roots
 * of memory back to the archives (a grate opens from below) and the well back to
 * the gallery. Beyond the bridge, the counterweight's ledges lead up into the lofts,
 * the cage and the belfry, to the Écho mémoriel; the lofts run back west above the
 * gallery to Mira's anchor and to the crypt over the room where Eidra woke.
 */
/** Thickness of a chamber's walls (`SHELL` in `src/world/Rooms.ts`). */
const SHELL = 0.6;
/** Highest rise between two steps of a stair: well inside one jump (2.49 m). */
const RISE = 1.7;
interface Slab {
  x: number;
  y: number;
  w: number;
  h: number;
  memory?: boolean;
}
/** A thin slab whose top stands at `top`. */
const ledge = (x: number, top: number, w: number, memory = false): Slab => ({
  x,
  y: top - 0.15,
  w,
  h: 0.3,
  memory,
});
/** Floor top of a chamber whose box starts at `bottom`. */
const floor = (bottom: number): number => bottom + SHELL;
/** A door in a side wall, from a sill up to head room and a little more. */
const side = (s: 'left' | 'right', sill: number) => ({ side: s, from: sill, to: sill + 3.2 });
/**
 * A zigzag stair from a floor up to a last step at `to`: a low first step, then
 * equal rises of at most `RISE`, alternating between two columns so no step
 * hangs over another at head height. The last step stands on column `last`.
 */
function stairs(
  columns: { a: [number, number]; b: [number, number] },
  base: number,
  to: number,
  last: 'a' | 'b',
  memory = false,
): Slab[] {
  const first = base + 1;
  const n = Math.max(1, Math.ceil((to - first) / RISE));
  const rise = (to - first) / n;
  const other = last === 'a' ? 'b' : 'a';
  return Array.from({ length: n + 1 }, (_, k) => {
    const [left, right] = columns[(n - k) % 2 === 0 ? last : other];
    return ledge((left + right) / 2, first + k * rise, right - left, memory);
  });
}
/** Tops of a stair, for doors whose sill must meet one of its steps. */
const tops = (slabs: Slab[]): number[] => slabs.map((s) => s.y + s.h / 2);

// ── The depths ─────────────────────────────────────────────────────────────
const DEEP = -30;
const BED = -52;
const wellLower = stairs({ a: [74.6, 77.4], b: [80.6, 83.4] }, floor(DEEP), -17.6, 'a', true);
const wellUpper = stairs({ a: [74.6, 77.4], b: [80.6, 83.4] }, -16, -6.1, 'a', true);
const archiveStair = stairs({ a: [47, 50.2], b: [52.4, 55.6] }, floor(DEEP), -19.4, 'a');
const drownedStair = stairs({ a: [110.6, 113.4], b: [116, 119.4] }, floor(BED), -29.4, 'a');
/** The drowned chapel opens off a step of the drowned stair, on the right wall. */
const chapelSill = tops(drownedStair)[4]!;
const roots = stairs({ a: [57.2, 59.8], b: [62.5, 65.5] }, floor(BED), -32.6, 'a', true);

// ── The lofts ──────────────────────────────────────────────────────────────
const LOFT = 11;
const loftStair = stairs({ a: [108.6, 112.2], b: [114, 117.2] }, floor(LOFT), 27.6, 'a');
const cageStair = stairs({ a: [142.6, 145.4], b: [138.4, 141.4] }, floor(LOFT), 29.4, 'a');
const belfryStair = stairs({ a: [128.6, 132.2], b: [133.6, 137.2] }, floor(33), 41.6, 'a');

export const depthChambers = [
  // ── Under the gallery: the well, the archives, their secret study, the Élan ──
  {
    id: 'mira-well',
    name: 'LE PUITS DE MIRA',
    kind: 'chamber',
    sector: 'watchers',
    start: 74,
    end: 84,
    bottom: DEEP,
    top: -2,
    seed: 101,
    doors: [
      { side: 'top', from: 78, to: 80 },
      side('left', floor(DEEP)),
      side('right', floor(DEEP)),
    ],
    platforms: [
      // A ledge breaks the fall halfway down; the rest of the climb is remembered.
      ledge(79, -16, 2.4),
      ...wellLower,
      ...wellUpper,
      // Under the gallery's hole: from here a leap carries Eidra back up.
      ledge(79, -4.5, 1.8, true),
    ],
    enemies: [],
  },
  {
    id: 'archives',
    name: 'LES ARCHIVES ENGLOUTIES',
    kind: 'chamber',
    sector: 'watchers',
    start: 44,
    end: 74,
    bottom: DEEP,
    top: -14,
    seed: 103,
    doors: [
      side('right', floor(DEEP)),
      side('left', floor(DEEP)),
      side('left', -19.4),
      { side: 'bottom', from: 57, to: 60 },
    ],
    platforms: [
      ...archiveStair.slice(0, -1),
      // The last step runs to the left wall: a cracked wall there hides a study.
      ledge(47.4, -19.4, 5.6),
      ledge(66, -27.1, 3),
      ledge(70.4, -25.3, 3),
      ledge(66, -23.5, 3),
    ],
    enemies: [
      { id: 'husk-1', kind: 'husk', x: 62.5, y: floor(DEEP) + 1, patrol: [60.5, 64] },
      { id: 'moth-1', kind: 'moth', x: 63, y: floor(DEEP) + 5 },
      { id: 'moth-2', kind: 'moth', x: 51.3, y: -23.2 },
    ],
  },
  {
    id: 'sealed-study',
    name: 'LE CABINET SCELLÉ',
    kind: 'chamber',
    sector: 'watchers',
    secret: true,
    start: 30,
    end: 44,
    bottom: -20,
    top: -6,
    seed: 107,
    doors: [side('right', -19.4)],
    platforms: [ledge(38.5, -17.1, 3), ledge(34, -15.3, 3), ledge(38.5, -13.5, 2.4)],
    enemies: [{ id: 'gisant-1', kind: 'gisant', x: 35.5, y: -18.4 }],
  },
  {
    id: 'elans',
    name: 'LA SALLE DES ÉLANS',
    kind: 'chamber',
    sector: 'watchers',
    start: 26,
    end: 44,
    bottom: DEEP,
    top: -20,
    seed: 109,
    doors: [side('right', floor(DEEP)), side('left', floor(DEEP))],
    platforms: [{ x: 36, y: floor(DEEP) + 0.75, w: 1.2, h: 1.5 }],
    enemies: [
      { id: 'mite-1', kind: 'mite', x: 32.5, y: floor(DEEP) + 1 },
      { id: 'mite-2', kind: 'mite', x: 34, y: floor(DEEP) + 1 },
      { id: 'mite-3', kind: 'mite', x: 38.5, y: floor(DEEP) + 1 },
      { id: 'watcher-3', kind: 'watcher', x: 41, y: floor(DEEP) + 1, patrol: [38, 42.8] },
    ],
  },
  {
    // Beyond the Élan: a chasm only a dash crosses, and a reliquary on the far side.
    id: 'dash-trial',
    name: 'L’ÉPREUVE DE L’ÉLAN',
    kind: 'chamber',
    sector: 'watchers',
    start: 8,
    end: 26,
    bottom: DEEP,
    top: -18,
    seed: 113,
    doors: [side('right', floor(DEEP)), { side: 'bottom', from: 13, to: 20.6 }],
    platforms: [ledge(10.6, floor(DEEP) + 2.3, 2.4)],
    enemies: [{ id: 'lantern-1', kind: 'lantern', x: 16.8, y: -23.5 }],
  },
  // ── Under the bridge: the chasm, the drowned stair, the Rémanence, the roots ──
  {
    id: 'scriptorium',
    name: 'LE GOUFFRE DES COPISTES',
    kind: 'chamber',
    sector: 'palimpsest',
    start: 84,
    end: 110,
    bottom: DEEP,
    top: -14,
    seed: 127,
    doors: [
      side('left', floor(DEEP)),
      side('right', floor(DEEP)),
      // Eight metres of nothing: the Élan carries Eidra over, nothing else does.
      { side: 'bottom', from: 93, to: 101 },
    ],
    platforms: [ledge(88, floor(DEEP) + 2.3, 2.4), ledge(106, floor(DEEP) + 2.3, 2.4)],
    enemies: [
      { id: 'watcher-4', kind: 'watcher', x: 90.5, y: floor(DEEP) + 1, patrol: [85.5, 92.4] },
      { id: 'moth-3', kind: 'moth', x: 105, y: floor(DEEP) + 5 },
    ],
  },
  {
    id: 'drowned-stair',
    name: 'L’ESCALIER NOYÉ',
    kind: 'chamber',
    sector: 'palimpsest',
    start: 110,
    end: 120,
    bottom: BED,
    top: -14,
    seed: 131,
    doors: [side('left', -29.4), side('left', floor(BED)), side('right', chapelSill)],
    platforms: drownedStair,
    enemies: [
      { id: 'moth-4', kind: 'moth', x: 115, y: -40 },
      { id: 'moth-5', kind: 'moth', x: 114.5, y: -24 },
      { id: 'lantern-2', kind: 'lantern', x: 114.7, y: -45.5 },
    ],
  },
  {
    id: 'sunken-chapel',
    name: 'LA CHAPELLE NOYÉE',
    kind: 'chamber',
    sector: 'palimpsest',
    start: 120,
    end: 136,
    bottom: chapelSill - SHELL,
    top: chapelSill + 11.4,
    seed: 137,
    doors: [side('left', chapelSill)],
    platforms: [ledge(133.4, chapelSill + 2.3, 3)],
    enemies: [
      { id: 'gisant-2', kind: 'gisant', x: 127, y: chapelSill + 1 },
      { id: 'gisant-3', kind: 'gisant', x: 130.5, y: chapelSill + 1 },
    ],
  },
  {
    id: 'remanence-sanctum',
    name: 'LE SANCTUAIRE DE LA RÉMANENCE',
    kind: 'chamber',
    sector: 'palimpsest',
    start: 86,
    end: 110,
    bottom: BED,
    top: -36,
    seed: 139,
    doors: [side('right', floor(BED)), side('left', floor(BED))],
    platforms: [
      // Once remembered, steps lead up to an offering left on a high shelf.
      ledge(94.4, floor(BED) + 2.3, 2.4, true),
      ledge(98.8, floor(BED) + 4.0, 2.4, true),
      ledge(94.4, floor(BED) + 5.7, 2.4, true),
      ledge(99.4, floor(BED) + 7.4, 3.2),
    ],
    enemies: [
      { id: 'husk-2', kind: 'husk', x: 103, y: floor(BED) + 1, patrol: [101, 107] },
      { id: 'mite-4', kind: 'mite', x: 105.5, y: floor(BED) + 1 },
      { id: 'mite-5', kind: 'mite', x: 107, y: floor(BED) + 1 },
    ],
  },
  {
    id: 'roots',
    name: 'LES RACINES DU SOUVENIR',
    kind: 'chamber',
    sector: 'palimpsest',
    start: 56,
    end: 86,
    bottom: BED,
    top: DEEP,
    seed: 149,
    doors: [side('right', floor(BED)), { side: 'top', from: 57, to: 60 }],
    // Remembered steps up to the grate under the archives, and its lever.
    platforms: [...roots, ledge(74, floor(BED) + 2.3, 3), ledge(79, floor(BED) + 4.1, 3)],
    enemies: [
      { id: 'moth-6', kind: 'moth', x: 74, y: floor(BED) + 5.5 },
      { id: 'mite-6', kind: 'mite', x: 81, y: floor(BED) + 1 },
      { id: 'mite-7', kind: 'mite', x: 83, y: floor(BED) + 1 },
    ],
  },
  // ── Above the route: crypt, nave and loft over the first rooms ──
  {
    id: 'cradle-crypt',
    name: 'LA CRYPTE DES BERCEAUX',
    kind: 'chamber',
    sector: 'awakening',
    start: 22,
    end: 40,
    bottom: LOFT,
    top: 25,
    seed: 151,
    doors: [
      { side: 'bottom', from: 32.5, to: 35.5 },
      side('right', floor(LOFT)),
      side('left', floor(LOFT)),
    ],
    platforms: [ledge(37.6, floor(LOFT) + 2.3, 3), ledge(26.4, floor(LOFT) + 2.3, 3)],
    enemies: [{ id: 'gisant-4', kind: 'gisant', x: 29.5, y: floor(LOFT) + 1 }],
  },
  {
    id: 'oculus',
    name: 'L’OCULUS DE L’ÉVEIL',
    kind: 'chamber',
    sector: 'awakening',
    secret: true,
    start: 8,
    end: 22,
    bottom: LOFT,
    top: 23,
    seed: 157,
    doors: [side('right', floor(LOFT))],
    platforms: [ledge(15, floor(LOFT) + 2.3, 3)],
    enemies: [],
  },
  {
    id: 'high-nave',
    name: 'LA NEF HAUTE',
    kind: 'chamber',
    sector: 'watchers',
    start: 40,
    end: 62,
    bottom: LOFT,
    top: 27,
    seed: 163,
    doors: [side('left', floor(LOFT)), side('right', floor(LOFT))],
    platforms: [
      ledge(46, floor(LOFT) + 2.3, 3),
      ledge(50.6, floor(LOFT) + 4.1, 3),
      ledge(46, floor(LOFT) + 5.9, 3),
      ledge(55.6, floor(LOFT) + 5.9, 3),
    ],
    enemies: [
      { id: 'watcher-5', kind: 'watcher', x: 53, y: floor(LOFT) + 1, patrol: [49, 60] },
      { id: 'moth-7', kind: 'moth', x: 53, y: floor(LOFT) + 5 },
      { id: 'lantern-3', kind: 'lantern', x: 58, y: 22.5 },
    ],
  },
  {
    id: 'lantern-loft',
    name: 'LA LOGE DES LANTERNES',
    kind: 'chamber',
    sector: 'watchers',
    start: 62,
    end: 80,
    bottom: LOFT,
    top: 25,
    seed: 167,
    doors: [
      side('left', floor(LOFT)),
      side('right', floor(LOFT)),
      // A drop onto Mira's anchor: the lofts come back to the gallery here.
      { side: 'bottom', from: 71, to: 73 },
    ],
    platforms: [ledge(66, floor(LOFT) + 2.3, 3), ledge(77, floor(LOFT) + 2.3, 3)],
    enemies: [
      { id: 'lantern-4', kind: 'lantern', x: 69, y: 20.5 },
      { id: 'mite-8', kind: 'mite', x: 75, y: floor(LOFT) + 1 },
    ],
  },
  // ── Over the bridge and the counterweight: archives, lofts, cage, belfry ──
  {
    id: 'hanging-archives',
    name: 'LES ARCHIVES SUSPENDUES',
    kind: 'chamber',
    sector: 'palimpsest',
    start: 80,
    end: 108,
    bottom: LOFT,
    top: 27,
    seed: 173,
    doors: [
      side('left', floor(LOFT)),
      side('right', floor(LOFT)),
      // The floor gave way over the bridge: whoever falls lands by the rift below.
      { side: 'bottom', from: 86, to: 102 },
    ],
    platforms: [
      ledge(89.5, floor(LOFT), 2.4, true),
      ledge(99.2, floor(LOFT), 2.4, true),
      ledge(104.4, floor(LOFT) + 2.3, 2.4),
    ],
    enemies: [
      { id: 'moth-8', kind: 'moth', x: 94, y: floor(LOFT) + 4.5 },
      { id: 'lantern-5', kind: 'lantern', x: 104, y: 21 },
    ],
  },
  {
    id: 'noa-lodge',
    name: 'LA LOGE DE NOA',
    kind: 'chamber',
    sector: 'palimpsest',
    secret: true,
    start: 96,
    end: 108,
    bottom: 27,
    top: 37,
    seed: 179,
    doors: [side('right', floor(27))],
    platforms: [ledge(103, floor(27) + 2.3, 2.6)],
    enemies: [],
  },
  {
    id: 'counterweight-loft',
    name: 'LES COMBLES DU CONTREPOIDS',
    kind: 'chamber',
    sector: 'counterweight',
    start: 108,
    end: 128,
    bottom: LOFT,
    top: 33,
    seed: 181,
    doors: [side('left', floor(LOFT)), side('right', floor(LOFT)), side('left', 27.6)],
    platforms: loftStair,
    enemies: [
      { id: 'husk-3', kind: 'husk', x: 123, y: floor(LOFT) + 1, patrol: [120, 127] },
      { id: 'moth-9', kind: 'moth', x: 121, y: floor(LOFT) + 5 },
    ],
  },
  {
    id: 'cage',
    name: 'LA CAGE DU CONTREPOIDS',
    kind: 'chamber',
    sector: 'counterweight',
    start: 128,
    end: 146,
    bottom: LOFT,
    top: 33,
    seed: 191,
    doors: [
      { side: 'bottom', from: 135, to: 138 },
      side('left', floor(LOFT)),
      { side: 'top', from: 139, to: 142 },
    ],
    // Up the cage to the belfry; the last step is narrow, under the opening.
    platforms: [...cageStair, ledge(140.5, 31, 2.2)],
    enemies: [
      { id: 'lantern-6', kind: 'lantern', x: 131.5, y: 24 },
      { id: 'moth-10', kind: 'moth', x: 133, y: floor(LOFT) + 5 },
    ],
  },
  {
    id: 'belfry',
    name: 'LE BEFFROI',
    kind: 'chamber',
    sector: 'counterweight',
    start: 128,
    end: 146,
    bottom: 33,
    top: 55,
    seed: 193,
    doors: [{ side: 'bottom', from: 139, to: 142 }, side('left', 41.6)],
    platforms: belfryStair,
    enemies: [
      { id: 'moth-11', kind: 'moth', x: 138, y: 47 },
      { id: 'lantern-7', kind: 'lantern', x: 143, y: 49 },
    ],
  },
  {
    id: 'echo-sanctum',
    name: 'LE SANCTUAIRE DE L’ÉCHO',
    kind: 'chamber',
    sector: 'counterweight',
    start: 108,
    end: 128,
    bottom: 41,
    top: 55,
    seed: 197,
    doors: [side('right', floor(41))],
    platforms: [ledge(116, floor(41) + 2.3, 3), ledge(121, floor(41) + 4.1, 3)],
    enemies: [
      { id: 'gisant-5', kind: 'gisant', x: 118.5, y: floor(41) + 1 },
      { id: 'mite-9', kind: 'mite', x: 114, y: floor(41) + 1 },
      { id: 'mite-10', kind: 'mite', x: 113, y: floor(41) + 1 },
    ],
  },
];
export const depthCheckpoints = [
  { id: 'archives', x: 72, y: floor(DEEP), name: 'Ancrage des archives' },
];
export const depthLandmarks = [
  { id: 'dash', x: 29.5, y: floor(DEEP) + 1.2, kind: 'ability', label: 'Élan de Lumérite' },
  {
    id: 'remanence',
    x: 90,
    y: floor(BED) + 1.4,
    kind: 'ability',
    label: 'Rémanence',
  },
  {
    id: 'memory-step',
    x: 111.5,
    y: floor(41) + 1.4,
    kind: 'ability',
    label: 'Écho mémoriel',
  },
  { id: 'deren', x: 32, y: -18.2, kind: 'memory', label: 'Fragment de Deren' },
  { id: 'aren', x: 25.5, y: floor(LOFT) + 1.2, kind: 'memory', label: 'Fragment d’Aren' },
  { id: 'noa', x: 99, y: floor(27) + 1.2, kind: 'memory', label: 'Fragment de Noa' },
  {
    id: 'cache-trial',
    x: 10.6,
    y: floor(DEEP) + 3.5,
    kind: 'cache',
    label: 'Reliquaire d’éclats',
    shards: 12,
  },
  {
    id: 'cache-chapel',
    x: 133.4,
    y: chapelSill + 3.5,
    kind: 'cache',
    label: 'Reliquaire d’éclats',
    shards: 15,
  },
  {
    id: 'cache-sanctum',
    x: 99.4,
    y: floor(BED) + 8.6,
    kind: 'cache',
    label: 'Reliquaire d’éclats',
    shards: 10,
  },
  {
    id: 'cache-oculus',
    x: 11,
    y: floor(LOFT) + 1.2,
    kind: 'cache',
    label: 'Reliquaire d’éclats',
    shards: 15,
  },
] as const;
export const depthSeals = [
  // A cracked wall at the top of the archives' stair hides the sealed study.
  { id: 'study-wall', kind: 'cracked', x: 44.3, y: -17.8, w: 0.6, h: 3.2 },
  // The grate between the archives and the roots: its lever is below, in the roots.
  {
    id: 'roots-grate',
    kind: 'shutter',
    x: 58.5,
    y: DEEP,
    w: 3,
    h: 1.2,
    lever: { x: 58, y: -32.6 },
  },
  // Walls of the two secret lofts.
  { id: 'oculus-wall', kind: 'cracked', x: 22, y: floor(LOFT) + 1.6, w: 1.2, h: 3.2 },
  { id: 'noa-wall', kind: 'cracked', x: 108, y: 29.2, w: 1.2, h: 3.2 },
];
