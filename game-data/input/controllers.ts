import { z } from 'zod';
/**
 * Controllers, whatever their make. Every pad is normalised to the W3C "standard"
 * layout (buttons 0–16), whose indices name positions, not letters:
 *   0 south · 1 east · 2 west · 3 north · 4/5 bumpers · 6/7 triggers · 8 select
 *   9 start · 10/11 stick clicks · 12–15 d-pad up/down/left/right · 16 home.
 * Extra buttons keep their raw index + 17; generic axes become virtual buttons
 * from index 32 (two per axis, + then −), so any input can still be bound.
 */
export const FamilySchema = z.enum(['xbox', 'playstation', 'nintendo', 'generic']);
export type PadFamily = z.infer<typeof FamilySchema>;
export const familyNames: Record<PadFamily, string> = {
  xbox: 'Xbox',
  playstation: 'PlayStation',
  nintendo: 'Nintendo',
  generic: 'Générique',
};
/** Glyph of each standard button, per family; arrows are shared. */
export const padGlyphs: Record<PadFamily, readonly string[]> = {
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS', 'RS'],
  playstation: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Create', 'Options', 'L3', 'R3'],
  // Positional, as browsers report Nintendo pads: the south button is labelled B.
  nintendo: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'LS', 'RS'],
  generic: ['B1', 'B2', 'B3', 'B4', 'L1', 'R1', 'L2', 'R2', 'Select', 'Start', 'L3', 'R3'],
};
export const homeGlyphs: Record<PadFamily, string> = {
  xbox: 'Xbox',
  playstation: 'PS',
  nintendo: 'Home',
  generic: 'Home',
};
/** Left stick or d-pad directions, bindable like buttons. */
export const DirectionSchema = z.enum(['up', 'down', 'left', 'right']);
export type Direction = z.infer<typeof DirectionSchema>;
export const directionGlyphs: Record<Direction, string> = {
  up: '▲',
  down: '▼',
  left: '◀',
  right: '▶',
};
/** A pad binding: a normalised button (`b7`) or a direction (`up`). */
export const PadTokenSchema = z.union([z.string().regex(/^b\d{1,2}$/), DirectionSchema]);
export type PadToken = z.infer<typeof PadTokenSchema>;
const ProfileSchema = z.object({
  id: z.string(),
  /** Vendor ids (4 hex digits) and name fragments that select the profile. */
  vendors: z.array(z.string().regex(/^[0-9a-f]{4}$/)).default([]),
  names: z.array(z.string()).default([]),
  family: FamilySchema.optional(),
  /** Raw button index → standard index. Unlisted buttons map to raw + 17. */
  buttons: z.record(z.string(), z.number().int().min(0)),
  /** Analog triggers reported as axes (resting at −1). */
  triggers: z.array(z.object({ axis: z.number().int(), button: z.number().int() })).default([]),
  /** Two axes reporting the d-pad as −1 / 0 / 1. */
  dpad: z.object({ x: z.number().int(), y: z.number().int() }).optional(),
});
export type PadProfile = z.infer<typeof ProfileSchema>;
const identity = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [String(i), i]));
/**
 * Layouts of pads the browser does not map to the standard layout (Firefox and
 * Linux report many pads raw, in evdev order). Anything else falls back to
 * `generic`: identity buttons, left stick on axes 0/1, POV hats detected on the fly.
 */
export const padProfiles = [
  {
    id: 'evdev-xbox',
    vendors: ['045e'],
    names: ['xbox', 'x-box', 'xinput'],
    family: 'xbox',
    buttons: { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 8, 7: 9, 8: 16, 9: 10, 10: 11 },
    triggers: [
      { axis: 2, button: 6 },
      { axis: 5, button: 7 },
    ],
    dpad: { x: 6, y: 7 },
  },
  {
    id: 'evdev-playstation',
    vendors: ['054c'],
    names: ['dualsense', 'dualshock', 'playstation'],
    family: 'playstation',
    buttons: { 0: 0, 1: 1, 2: 3, 3: 2, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 16, 11: 10, 12: 11 },
    triggers: [
      { axis: 2, button: 6 },
      { axis: 5, button: 7 },
    ],
    dpad: { x: 6, y: 7 },
  },
  { id: 'generic', buttons: identity },
].map((profile) => ProfileSchema.parse(profile));
/** Vendor ids and name fragments of each family, for glyphs. */
export const familyMatchers: Record<
  Exclude<PadFamily, 'generic'>,
  { vendors: string[]; names: string[] }
> = {
  xbox: { vendors: ['045e'], names: ['xbox', 'x-box', 'xinput', 'microsoft'] },
  playstation: {
    vendors: ['054c'],
    names: ['playstation', 'dualsense', 'dualshock', 'sony'],
  },
  nintendo: { vendors: ['057e'], names: ['nintendo', 'switch', 'joy-con', 'pro controller'] },
};
/** Actions a pad drives; left, right and pause stay on the stick, d-pad and start. */
export const PadBindingsSchema = z.record(z.string(), PadTokenSchema);
/**
 * Default layout, in the spirit of the classic hand-drawn action-platformers:
 * jump on the south button, strike on the west, focus on the east, dash on the right
 * trigger, talk and rest by pushing up.
 */
export const defaultPadBindings = {
  jump: 'b0',
  attack: 'b2',
  heal: 'b1',
  remanence: 'b3',
  parry: 'b4',
  echo: 'b5',
  charge: 'b6',
  dash: 'b7',
  map: 'b8',
  pause: 'b9',
  interact: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
} as const satisfies Record<string, PadToken>;
/** Menu buttons are positional and never remapped: south confirms, east goes back. */
export const menuButtons = { confirm: 0, back: 1, previous: 4, next: 5, start: 9 } as const;
