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
  weapon: z.enum(['blade', 'halberd', 'greatblade', 'none']),
  accessory: z.enum(['none', 'urn', 'banner', 'halo', 'rings', 'veil']),
  accent: Hex,
  /** Translucent memory figures (the Echo, Mira). */
  ghost: z.boolean(),
  /** Eye and core glow: Lumérite for allies, amber for hostile memories. */
  glow: z.enum(['lumerite', 'amber']),
});
export type Appearance = z.infer<typeof AppearanceSchema>;
const eidra = {
  scale: 1,
  cloak: {
    top: 0.2,
    hem: 0.54,
    shoulder: 0.36,
    bottom: -0.46,
    pleats: 7,
    hemDepth: 0.13,
    color: '#2f5561',
    lining: '#7fb5a8',
  },
  hood: { radius: 0.3, tip: 1.12, lean: 0.22, color: '#284a54', trim: '#c9a55f' },
  mask: { width: 0.2, height: 0.24, y: 0.6, color: '#efe8d4', eyes: 'twin', crack: true },
  collar: { color: '#c9a55f', points: 6 },
  scarf: { color: '#d9f1e5', length: 1, width: 0.15 },
  studs: { color: '#e4c77f', count: 5 },
  legs: { length: 0.42, color: '#0b1618' },
  weapon: 'blade',
  accessory: 'none',
  accent: '#8effdb',
  ghost: false,
  glow: 'lumerite',
} as const;
export const appearances = {
  eidra: AppearanceSchema.parse(eidra),
  echo: AppearanceSchema.parse({ ...eidra, ghost: true, scarf: null }),
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
};
export type CharacterKind = keyof typeof appearances;
