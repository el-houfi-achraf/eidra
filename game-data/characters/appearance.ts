import { z } from 'zod';
const Hex = z.string().regex(/^#[0-9a-f]{6}$/i);
/**
 * Visual archetypes of the prelude cast. Every silhouette is authored here as
 * data (hood, pleated cloak, ceramic mask, eyes, accessories) and assembled by
 * `CharacterView`; gameplay never reads these values.
 * TODO_ART: procedural puppets until rigged Blender characters exist.
 */
export const AppearanceSchema = z.object({
  scale: z.number().positive(),
  /** Pleated bell cloak with a pointed hem. */
  cloak: z
    .object({
      top: z.number().positive(),
      hem: z.number().positive(),
      shoulder: z.number(),
      bottom: z.number(),
      pleats: z.number().int().min(3).max(14),
      hemDepth: z.number().nonnegative(),
      color: Hex,
      lining: Hex,
    })
    .nullable(),
  /** Hood around the mask; `tip` is the height of its point and `lean` its sweep backwards. */
  hood: z
    .object({
      radius: z.number().positive(),
      tip: z.number(),
      lean: z.number(),
      color: Hex,
      trim: Hex.optional(),
    })
    .nullable(),
  mask: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    y: z.number(),
    color: Hex,
    eyes: z.enum(['twin', 'single', 'triple', 'hollow', 'closed', 'none']),
    crack: z.boolean(),
  }),
  /** Short capelet over the shoulders. */
  collar: z.object({ color: Hex, points: z.number().int().min(3) }).nullable(),
  /** A flowing strip animated by a secondary-motion chain. */
  scarf: z
    .object({ color: Hex, length: z.number().positive(), width: z.number().positive() })
    .nullable(),
  /** Studs down the front edge of the cloak. */
  studs: z.object({ color: Hex, count: z.number().int().min(1).max(10) }).nullable(),
  legs: z.object({ length: z.number().positive(), color: Hex }).nullable(),
  /** Circlet of thorns worn over the hood. */
  crown: z
    .object({ color: Hex, spikes: z.number().int().min(4).max(16) })
    .nullable()
    .default(null),
  /** Long strands of hair falling from the hood, animated like the scarf. */
  hair: z
    .object({
      color: Hex,
      strands: z.number().int().min(1).max(5),
      length: z.number().positive(),
    })
    .nullable()
    .default(null),
  /** Tattered cape streaming from the shoulders, in ragged animated strips. */
  mantle: z
    .object({
      color: Hex,
      strips: z.number().int().min(1).max(5),
      length: z.number().positive(),
    })
    .nullable()
    .default(null),
  /** Painted spatter across the cloak, denser towards the hem. */
  spatter: Hex.nullable().default(null),
  /** Floating cards orbiting the character (Eidra's resonance made visible). */
  cards: z.object({ color: Hex, trim: Hex }).nullable().default(null),
  weapon: z.enum(['blade', 'staff', 'halberd', 'greatblade', 'none']),
  accessory: z.enum(['none', 'urn', 'banner', 'halo', 'rings', 'veil']),
  accent: Hex,
  /** Translucent memory figures (the Echo, Mira). */
  ghost: z.boolean(),
  /** Eye and core glow: Lumérite for allies, amber for hostile memories, crimson for Eidra. */
  glow: z.enum(['lumerite', 'amber', 'crimson']),
});
export type Appearance = z.infer<typeof AppearanceSchema>;
/**
 * Eidra: dark hood crowned with golden thorns, white mask with crimson eyes, long
 * black hair, an ivory robe spattered with red over a tattered crimson cape, an
 * ornate golden staff, and her resonance as red cards orbiting her.
 */
const eidra = {
  scale: 1,
  cloak: {
    top: 0.19,
    hem: 0.56,
    shoulder: 0.36,
    bottom: -0.6,
    pleats: 9,
    hemDepth: 0.2,
    color: '#dcd0bb',
    lining: '#5c0f17',
  },
  hood: { radius: 0.3, tip: 0.98, lean: 0.16, color: '#1f1315' },
  mask: { width: 0.2, height: 0.24, y: 0.6, color: '#f4efe8', eyes: 'twin', crack: true },
  collar: { color: '#3a1117', points: 7 },
  scarf: null,
  studs: { color: '#d9b25e', count: 5 },
  legs: { length: 0.42, color: '#1d0c0f' },
  crown: { color: '#d9b25e', spikes: 11 },
  hair: { color: '#140c0e', strands: 3, length: 1.05 },
  mantle: { color: '#4a0c14', strips: 3, length: 1.15 },
  spatter: '#8e1822',
  cards: { color: '#9e1b27', trim: '#e0b85c' },
  weapon: 'staff',
  accessory: 'none',
  accent: '#e23a44',
  ghost: false,
  glow: 'crimson',
} as const;
export const appearances = {
  eidra: AppearanceSchema.parse(eidra),
  // Her Echo: the same silhouette as a translucent memory, without the orbiting cards.
  echo: AppearanceSchema.parse({ ...eidra, ghost: true, cards: null, mantle: null }),
  mira: AppearanceSchema.parse({
    scale: 1.05,
    cloak: {
      top: 0.16,
      hem: 0.62,
      shoulder: 0.34,
      bottom: -0.78,
      pleats: 9,
      hemDepth: 0.18,
      color: '#8fd6c1',
      lining: '#d7f5ea',
    },
    hood: { radius: 0.28, tip: 0.92, lean: -0.05, color: '#a4e1cf' },
    mask: { width: 0.19, height: 0.23, y: 0.6, color: '#f6f1e2', eyes: 'closed', crack: false },
    collar: null,
    scarf: { color: '#e9fff6', length: 1.2, width: 0.1 },
    studs: null,
    legs: null,
    weapon: 'none',
    accessory: 'halo',
    accent: '#d7ad69',
    ghost: true,
    glow: 'lumerite',
  }),
  watcher: AppearanceSchema.parse({
    scale: 1.05,
    cloak: {
      top: 0.16,
      hem: 0.44,
      shoulder: 0.34,
      bottom: -0.44,
      pleats: 5,
      hemDepth: 0.16,
      color: '#3d4a47',
      lining: '#7a5636',
    },
    hood: { radius: 0.26, tip: 1.32, lean: -0.18, color: '#323d3b' },
    mask: { width: 0.17, height: 0.26, y: 0.62, color: '#d9d1bb', eyes: 'single', crack: true },
    collar: { color: '#7d6a4d', points: 4 },
    scarf: null,
    studs: null,
    legs: { length: 0.44, color: '#0d1111' },
    weapon: 'halberd',
    accessory: 'none',
    accent: '#ff914d',
    ghost: false,
    glow: 'amber',
  }),
  wisp: AppearanceSchema.parse({
    scale: 0.8,
    cloak: null,
    hood: null,
    mask: { width: 0.24, height: 0.27, y: 0.2, color: '#e3dccb', eyes: 'hollow', crack: true },
    collar: null,
    scarf: null,
    studs: null,
    legs: null,
    weapon: 'none',
    accessory: 'veil',
    accent: '#ff914d',
    ghost: false,
    glow: 'amber',
  }),
  sentinel: AppearanceSchema.parse({
    scale: 1.3,
    cloak: {
      top: 0.28,
      hem: 0.62,
      shoulder: 0.32,
      bottom: -0.5,
      pleats: 8,
      hemDepth: 0.1,
      color: '#433d37',
      lining: '#7d4a2e',
    },
    hood: { radius: 0.29, tip: 0.86, lean: 0.05, color: '#38332d' },
    mask: { width: 0.21, height: 0.2, y: 0.56, color: '#cfc5ae', eyes: 'triple', crack: false },
    collar: { color: '#6f5a3e', points: 5 },
    scarf: null,
    studs: { color: '#b08a4c', count: 4 },
    legs: { length: 0.36, color: '#0e0d0c' },
    weapon: 'greatblade',
    accessory: 'urn',
    accent: '#ff914d',
    ghost: false,
    glow: 'amber',
  }),
  keeper: AppearanceSchema.parse({
    scale: 1.6,
    cloak: {
      top: 0.2,
      hem: 0.56,
      shoulder: 0.36,
      bottom: -0.48,
      pleats: 9,
      hemDepth: 0.14,
      color: '#52303a',
      lining: '#b8924f',
    },
    hood: { radius: 0.29, tip: 1.2, lean: 0.12, color: '#42262e', trim: '#c9a55f' },
    mask: { width: 0.2, height: 0.25, y: 0.6, color: '#e7dcc2', eyes: 'twin', crack: true },
    collar: { color: '#c9a55f', points: 7 },
    scarf: null,
    studs: { color: '#e0bf73', count: 6 },
    legs: { length: 0.42, color: '#120c0d' },
    weapon: 'greatblade',
    accessory: 'banner',
    accent: '#ff914d',
    ghost: false,
    glow: 'amber',
  }),
  boss: AppearanceSchema.parse({
    scale: 2.7,
    cloak: {
      top: 0.3,
      hem: 0.66,
      shoulder: 0.36,
      bottom: -0.52,
      pleats: 10,
      hemDepth: 0.12,
      color: '#384644',
      lining: '#8c8164',
    },
    hood: null,
    mask: { width: 0.25, height: 0.34, y: 0.66, color: '#ebe3cc', eyes: 'none', crack: true },
    collar: { color: '#8c8164', points: 8 },
    scarf: null,
    studs: null,
    legs: { length: 0.34, color: '#0d1111' },
    weapon: 'none',
    accessory: 'rings',
    accent: '#ff914d',
    ghost: false,
    glow: 'amber',
  }),
  // Act II — ash beast bent low: wide ragged cloak, single ember eye, bare claws.
  crawler: AppearanceSchema.parse({
    scale: 0.85,
    cloak: {
      top: 0.3,
      hem: 0.66,
      shoulder: 0.2,
      bottom: -0.42,
      pleats: 6,
      hemDepth: 0.2,
      color: '#3a2a24',
      lining: '#b0502a',
    },
    hood: { radius: 0.3, tip: 0.62, lean: 0.55, color: '#2e211c' },
    mask: { width: 0.22, height: 0.16, y: 0.38, color: '#cbb89c', eyes: 'single', crack: true },
    collar: null,
    scarf: null,
    studs: null,
    legs: { length: 0.3, color: '#140c09' },
    weapon: 'none',
    accessory: 'none',
    accent: '#ff7a3a',
    ghost: false,
    glow: 'amber',
  }),
  // Act II — thrower with a burning urn on its back.
  ember: AppearanceSchema.parse({
    scale: 1,
    cloak: {
      top: 0.18,
      hem: 0.48,
      shoulder: 0.34,
      bottom: -0.5,
      pleats: 7,
      hemDepth: 0.12,
      color: '#4a2f22',
      lining: '#e0773a',
    },
    hood: { radius: 0.27, tip: 1.05, lean: -0.1, color: '#3b251b', trim: '#e0773a' },
    mask: { width: 0.18, height: 0.24, y: 0.6, color: '#e2d3b6', eyes: 'hollow', crack: false },
    collar: { color: '#8a4a28', points: 5 },
    scarf: { color: '#f0a060', length: 0.8, width: 0.12 },
    studs: null,
    legs: { length: 0.42, color: '#120a07' },
    weapon: 'none',
    accessory: 'urn',
    accent: '#ff7a3a',
    ghost: false,
    glow: 'amber',
  }),
  // Act II elite — charred armour, three eyes, a greatblade longer than its bearer.
  warden: AppearanceSchema.parse({
    scale: 1.85,
    cloak: {
      top: 0.3,
      hem: 0.64,
      shoulder: 0.34,
      bottom: -0.5,
      pleats: 10,
      hemDepth: 0.14,
      color: '#2b2220',
      lining: '#c0562c',
    },
    hood: { radius: 0.3, tip: 0.9, lean: 0.05, color: '#231b19', trim: '#e08a4a' },
    mask: { width: 0.22, height: 0.22, y: 0.58, color: '#d8c6a4', eyes: 'triple', crack: true },
    collar: { color: '#e08a4a', points: 8 },
    scarf: null,
    studs: { color: '#e08a4a', count: 7 },
    legs: { length: 0.38, color: '#0c0807' },
    weapon: 'greatblade',
    accessory: 'none',
    accent: '#ff7a3a',
    ghost: false,
    glow: 'amber',
  }),
  // Act II boss — tall pale veiled figure, eyes shut, trailing veils like petals.
  ilyra: AppearanceSchema.parse({
    scale: 2.3,
    cloak: {
      top: 0.14,
      hem: 0.6,
      shoulder: 0.36,
      bottom: -0.62,
      pleats: 12,
      hemDepth: 0.2,
      color: '#e6d4d6',
      lining: '#b3707e',
    },
    hood: { radius: 0.26, tip: 0.98, lean: -0.08, color: '#dcc6c9', trim: '#e9c98a' },
    mask: { width: 0.2, height: 0.27, y: 0.62, color: '#fbf4ee', eyes: 'closed', crack: true },
    collar: { color: '#e9c98a', points: 9 },
    scarf: null,
    studs: null,
    legs: null,
    weapon: 'blade',
    accessory: 'veil',
    accent: '#ffb1c0',
    ghost: false,
    glow: 'amber',
  }),
};
export type CharacterKind = keyof typeof appearances;
