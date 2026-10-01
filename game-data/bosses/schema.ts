import { z } from 'zod';
/**
 * How a pattern strikes:
 * - `sweep`: wide melee arc in front of the boss;
 * - `slam`: impact that sends one ground wave each way (jump it);
 * - `charge`: rush across the arena, hurting all along the path;
 * - `rain`: projectiles fall on `count` ground marks around Eidra;
 * - `volley`: `count` shards aimed at Eidra in a fan;
 * - `blink`: vanish and reappear behind Eidra (a mark shows where);
 * - `nova`: `count` successive pairs of ground waves, to jump in rhythm.
 * Signature abilities, one per boss:
 * - `standard`: a banner planted where the boss stands sends ground waves both ways
 *   every 1.3 s for `duration` seconds;
 * - `command`: `count` checks 0.4 s apart; each time Eidra has moved since the last,
 *   a shard falls on her (stand still to be spared);
 * - `eruption`: `count` fire geysers burst one after another along the floor towards
 *   Eidra, `range` metres apart;
 * - `leap`: a bound through the air onto Eidra's marked position, waves on landing;
 * - `mirror`: the boss splits into `count` reflections that shoot for `duration`
 *   seconds; each shatters in one blow, and striking the real one dispels them.
 */
export const PatternKindSchema = z.enum([
  'sweep',
  'slam',
  'charge',
  'rain',
  'volley',
  'blink',
  'nova',
  'standard',
  'command',
  'eruption',
  'leap',
  'mirror',
]);
/**
 * How a boss moves between blows: `march` in heavy steps, `hover` above the ground,
 * `leap` in bounds, `glide` like a drifting veil.
 */
export const MovementSchema = z.enum(['march', 'hover', 'leap', 'glide']);
export type Movement = z.infer<typeof MovementSchema>;
export type PatternKind = z.infer<typeof PatternKindSchema>;
export const PatternSchema = z.object({
  id: z.string(),
  kind: PatternKindSchema,
  /** First phase in which the pattern joins the rotation. */
  phase: z.number().int().min(1).max(3).default(1),
  windup: z.number().positive(),
  recover: z.number().positive(),
  damage: z.number().nonnegative(),
  range: z.number().positive(),
  /** Marks, shards, wave pairs, geysers, checks or reflections released. */
  count: z.number().int().min(1).default(1),
  /** Seconds a lasting effect remains (a planted banner, reflections). */
  duration: z.number().positive().optional(),
  /** Pattern chained straight after this one (shorter windup), from the given phase. */
  combo: z.object({ pattern: z.string(), phase: z.number().int().min(1).max(3) }).optional(),
  /** Only reached as a combo follow-up, never picked from the rotation. */
  followUp: z.boolean().default(false),
  /** Telegraph written in the boss bar during the windup. */
  cue: z.string(),
});
export type BossPattern = z.infer<typeof PatternSchema>;
export const BossSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    subtitle: z.string(),
    /** Character appearance used by the presentation. */
    appearance: z.string(),
    /** Arena (zone data) that holds the fight. */
    arena: z.string(),
    health: z.number().positive(),
    /** Damage dealt by touching the body. */
    contact: z.number().nonnegative(),
    spawn: z.object({ x: z.number(), y: z.number() }),
    radius: z.number().positive(),
    height: z.number().positive(),
    /** Approach speed in the first phase, metres per second. */
    speed: z.number().positive(),
    movement: MovementSchema.default('march'),
    /** Armoured introduction, in seconds. */
    intro: z.number().positive(),
    /** Armoured roar between phases, in seconds. */
    transition: z.number().nonnegative(),
    /** Health ratios at which each later phase begins, descending. */
    phases: z.array(z.number().gt(0).lt(1)).max(2),
    /** Windup multiplier per phase: below 1, telegraphs shorten and the boss speeds up. */
    haste: z.array(z.number().positive()).min(1),
    patterns: z.array(PatternSchema).min(2),
  })
  .superRefine((boss, ctx) => {
    if (boss.haste.length !== boss.phases.length + 1)
      ctx.addIssue({ code: 'custom', message: `${boss.id}: one haste value per phase` });
    for (let i = 1; i < boss.phases.length; i++)
      if (boss.phases[i]! >= boss.phases[i - 1]!)
        ctx.addIssue({ code: 'custom', message: `${boss.id}: phase thresholds must descend` });
    const ids = new Set(boss.patterns.map((p) => p.id));
    if (ids.size !== boss.patterns.length)
      ctx.addIssue({ code: 'custom', message: `${boss.id}: pattern ids must be unique` });
    for (const pattern of boss.patterns)
      if (pattern.combo && !ids.has(pattern.combo.pattern))
        ctx.addIssue({
          code: 'custom',
          message: `${boss.id}: unknown combo ${pattern.combo.pattern}`,
        });
    for (const pattern of boss.patterns)
      if ((pattern.kind === 'standard' || pattern.kind === 'mirror') && !pattern.duration)
        ctx.addIssue({ code: 'custom', message: `${boss.id}: ${pattern.id} needs a duration` });
    for (let phase = 1; phase <= boss.phases.length + 1; phase++)
      if (!boss.patterns.some((p) => !p.followUp && p.phase <= phase))
        ctx.addIssue({ code: 'custom', message: `${boss.id}: phase ${phase} has no pattern` });
  });
export type BossData = z.infer<typeof BossSchema>;
