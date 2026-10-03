import type { Pose } from './CharacterView';
import type { EnemyState } from '../ai/EnemyFSM';
import { LEAP_TIME, NOVA_INTERVAL, PULSES } from '../bosses/BossDirector';
import type { BossState } from '../bosses/BossDirector';
import type { Movement, PatternKind } from '../../game-data/bosses/schema';
import type { AttackKind } from '../combat/CombatSystem';
/**
 * Readable, exaggerated key poses derived from simulation state: every blow is
 * anticipated (lean back, weapon raised, crouch), struck (lunge, stretch) and
 * followed through (slump). Pure functions, so the presentation stays a view.
 */
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const easeOut = (t: number): number => 1 - (1 - t) ** 3;
/** Seconds an enemy stays in its ATTACK state (EnemyFSM). */
const STRIKE = 0.2;
export interface Posed {
  pose: Pose;
  /** Blade sweep value for CharacterView: seconds left of a 0.32 s swing. */
  attack: number;
}
export interface EnemyPoseInput {
  state: EnemyState;
  timer: number;
  windup: number;
  recover: number;
  ranged: boolean;
  /** Seconds of hit flash left: the body recoils from the blow. */
  flash: number;
}
export function enemyPose(e: EnemyPoseInput): Posed {
  const recoil = clamp01(e.flash / 0.09);
  let lean = -0.3 * recoil,
    offset = -0.12 * recoil,
    lift = 0,
    squash = 0,
    raise = 0,
    tremble = 0,
    attack = 0;
  if (e.state === 'DETECT') {
    // Startled hop when the player is noticed.
    const hop = Math.sin(clamp01(e.timer / 0.25) * Math.PI);
    lift = 0.28 * hop;
    squash = -0.08 * hop;
  } else if (e.state === 'CHASE') lean += 0.12;
  else if (e.state === 'ALERT') {
    const t = clamp01(e.timer / e.windup),
      k = easeOut(t);
    if (e.ranged) {
      lift = 0.3 * k;
      lean -= 0.15 * k;
    } else {
      squash = 0.15 * k;
      lean -= 0.24 * k;
      raise = k;
    }
    // The last instants shiver: the blow is about to land.
    tremble = t > 0.7 ? 0.03 : 0;
  } else if (e.state === 'ATTACK') {
    const a = clamp01(e.timer / STRIKE);
    if (e.ranged) {
      offset -= 0.3 * (1 - a);
      lean -= 0.2 * (1 - a);
    } else {
      lean += 0.38 * (1 - 0.5 * a);
      offset += 0.4 * easeOut(clamp01(a * 2));
      squash = -0.1 * (1 - a);
      attack = 0.32 * (1 - a);
    }
  } else if (e.state === 'RECOVER') {
    const t = clamp01(e.timer / e.recover);
    lean += 0.16 * (1 - t);
    squash = 0.07 * (1 - t);
  }
  return { pose: { lean, offset, lift, squash, raise, tremble }, attack };
}
export interface BossPoseInput {
  state: BossState;
  timer: number;
  kind: PatternKind;
  /** Effective windup of the current pattern (shortened by phase and chaining). */
  windup: number;
  recover: number;
  /** Length of the introduction, seconds. */
  intro?: number;
}
export function bossPose(b: BossPoseInput): Posed {
  const pose: Pose = {};
  let attack = 0;
  if (b.state === 'intro') {
    // Rises from a crouch, shudders, then lifts its arms.
    const t = clamp01(b.timer / (b.intro ?? 2.2));
    pose.squash = 0.4 * (1 - easeOut(clamp01(t * 1.6)));
    pose.tremble = 0.05 * (1 - t);
    pose.raise = clamp01((t - 0.65) / 0.25);
  } else if (b.state === 'windup') {
    const k = easeOut(clamp01(b.timer / b.windup));
    if (b.kind === 'sweep') {
      pose.lean = -0.3 * k;
      pose.raise = k;
      pose.squash = 0.06 * k;
    } else if (b.kind === 'slam' || b.kind === 'nova') {
      pose.squash = -0.16 * k;
      pose.lift = 0.6 * k;
      pose.lean = -0.12 * k;
      pose.raise = k;
      // The nova gathers with a growing shiver.
      pose.tremble = b.kind === 'nova' ? 0.05 * k : 0;
    } else if (b.kind === 'charge') {
      pose.squash = 0.2 * k;
      pose.lean = 0.3 * k;
      pose.tremble = k > 0.9 ? 0.04 : 0;
    } else if (b.kind === 'volley') {
      // Draws back, arms high, before casting the fan of shards.
      pose.lean = -0.25 * k;
      pose.lift = 0.35 * k;
      pose.raise = k;
      pose.tremble = 0.02 * k;
    } else if (b.kind === 'blink') {
      // Folds inward as it fades out.
      pose.squash = 0.3 * k;
      pose.tremble = 0.03;
    } else if (b.kind === 'standard') {
      // Heaves the banner overhead before driving it into the floor.
      pose.lean = -0.2 * k;
      pose.lift = 0.25 * k;
      pose.raise = k;
      pose.tremble = 0.02 * k;
    } else if (b.kind === 'command') {
      // Draws itself up, perfectly still: the order is about to fall.
      pose.squash = -0.16 * k;
      pose.lift = 0.3 * k;
      pose.raise = 0.6 * k;
    } else if (b.kind === 'eruption') {
      // Gathers the embers low, shaking, a fist over the floor.
      pose.squash = 0.26 * k;
      pose.lean = 0.2 * k;
      pose.tremble = 0.05 * k;
    } else if (b.kind === 'leap') {
      // A deep crouch, coiled, before the bound.
      pose.squash = 0.34 * k;
      pose.lean = 0.16 * k;
      pose.tremble = k > 0.85 ? 0.03 : 0;
    } else if (b.kind === 'mirror') {
      // Stretches and shimmers as the reflections detach.
      pose.squash = -0.1 * k;
      pose.lift = 0.3 * k;
      pose.raise = k;
      pose.tremble = 0.04 * k;
    } else {
      pose.lift = 1.3 * k;
      pose.raise = k;
      pose.tremble = 0.02;
    }
  } else if (b.state === 'attack') {
    const a = clamp01(b.timer / strikeTime(b.kind));
    if (b.kind === 'sweep') {
      pose.lean = 0.42 * (1 - 0.5 * a);
      pose.offset = 0.7 * easeOut(clamp01(a * 2));
      attack = 0.32 * (1 - a);
    } else if (b.kind === 'slam') {
      pose.squash = 0.3 * (1 - a);
      pose.lean = 0.1;
    } else if (b.kind === 'nova') {
      // One stamp per wave.
      const beat = (b.timer % NOVA_INTERVAL) / NOVA_INTERVAL;
      pose.squash = 0.28 * (1 - beat);
      pose.tremble = 0.03;
    } else if (b.kind === 'charge') {
      pose.lean = 0.45;
      pose.squash = 0.12;
      pose.tremble = 0.02;
    } else if (b.kind === 'volley') {
      pose.lean = 0.3 * (1 - a);
      pose.offset = -0.3 * (1 - a);
      attack = 0.32 * (1 - a);
    } else if (b.kind === 'standard') {
      // Drives the pole down.
      pose.squash = 0.26 * (1 - a);
      pose.lean = 0.2;
      pose.raise = 1 - a;
    } else if (b.kind === 'command') {
      // Rigid, staring: only a faint quiver.
      pose.squash = -0.12;
      pose.lift = 0.3;
      pose.raise = 0.6;
      pose.tremble = 0.015;
    } else if (b.kind === 'eruption') {
      // The fist is in the ground while the line of fire races away.
      pose.squash = 0.22;
      pose.lean = 0.28;
      pose.tremble = 0.04;
    } else if (b.kind === 'leap') {
      // Stretched in flight, the blade raised for the landing.
      pose.squash = -0.2 * (1 - a);
      pose.lean = 0.3;
      pose.raise = 1;
    } else if (b.kind === 'mirror') {
      pose.squash = -0.18 * (1 - a);
      pose.lift = 0.3 * (1 - a);
    } else if (b.kind === 'blink') {
      // Unfolds where it lands.
      pose.squash = -0.18 * (1 - a);
    } else {
      pose.lift = 1.3 * (1 - a);
      pose.raise = 1 - a;
    }
  } else if (b.state === 'recover') {
    const t = clamp01(b.timer / b.recover);
    pose.lean = 0.18 * (1 - t);
    pose.squash = 0.1 * (1 - t);
  } else if (b.state === 'transition') {
    pose.lift = 0.7 * easeOut(clamp01(b.timer / 0.5));
    pose.raise = 1;
    pose.tremble = 0.07;
  }
  return { pose, attack };
}
/** Seconds the attack state of a pattern lasts (mirrors BossDirector.strike, one count). */
function strikeTime(kind: PatternKind): number {
  const pulse = PULSES[kind];
  if (pulse) return pulse;
  return kind === 'charge'
    ? 0.7
    : kind === 'leap'
      ? LEAP_TIME
      : kind === 'standard' || kind === 'mirror'
        ? 0.4
        : 0.24;
}
export interface GaitInput {
  movement: Movement;
  state: BossState;
  /** Seconds in the current state (the gait cycle while approaching). */
  timer: number;
  /** Clock of the scene, for idle floating. */
  time: number;
  /** 0..1 progress of a bound in the air, when one is under way. */
  leap?: number | null;
}
export interface Gait {
  pose: Pose;
  /** A foot or the whole body hits the floor on this frame's phase: 0..1 per step. */
  step: number;
}
/**
 * How each boss carries itself: the Keeper marches in heavy steps, the Guardian
 * hovers, the Sentinelle bounds and Ilyra glides. Added to its key pose.
 */
export function gaitPose(g: GaitInput): Gait {
  const approach = g.state === 'approach';
  const idle = g.state !== 'dormant' && g.state !== 'dead';
  switch (g.movement) {
    case 'march': {
      if (!approach) return { pose: {}, step: 0 };
      // Same cadence as the stride factor of the enemy manager.
      const beat = (g.timer * 1.4) % 1;
      const surge = Math.abs(Math.sin(beat * Math.PI));
      return { pose: { squash: 0.09 * (1 - surge), lean: 0.08 * surge }, step: beat };
    }
    case 'hover':
      return {
        pose: idle ? { lift: 0.45 + Math.sin(g.time * 1.6) * 0.14, lean: approach ? 0.08 : 0 } : {},
        step: 0,
      };
    case 'glide':
      return {
        pose: idle
          ? {
              lift: 0.22 + Math.sin(g.time * 2.2) * 0.07,
              lean: approach ? 0.16 : 0,
              squash: approach ? -0.04 : 0,
            }
          : {},
        step: 0,
      };
    case 'leap': {
      if (g.leap !== null && g.leap !== undefined) {
        // One high arc from the take-off to the mark.
        const arc = Math.sin(clamp01(g.leap) * Math.PI);
        return { pose: { lift: 4.2 * arc, squash: -0.15 * arc }, step: 0 };
      }
      if (!approach) return { pose: {}, step: 0 };
      // Bounds: airborne for most of the cycle, a crouch on each landing.
      const phase = (g.timer % 0.75) / 0.75;
      if (phase < 0.55) {
        const hop = Math.sin((phase / 0.55) * Math.PI);
        return { pose: { lift: 0.9 * hop, squash: -0.12 * hop, lean: 0.12 }, step: phase };
      }
      return { pose: { squash: 0.18 * (1 - (phase - 0.55) / 0.45) }, step: phase };
    }
  }
}
/** Sums a key pose and a gait: offsets add up, the gait never overrides a blow. */
export function withGait(pose: Pose, gait: Pose): Pose {
  return {
    ...pose,
    lift: (pose.lift ?? 0) + (gait.lift ?? 0),
    squash: (pose.squash ?? 0) + (gait.squash ?? 0),
    lean: (pose.lean ?? 0) + (gait.lean ?? 0),
  };
}
export interface HeroPoseInput {
  attackTime: number;
  attackKind: AttackKind;
  dashing: boolean;
  /** Swing of the three-hit staff combo (1, 2 or 3). */
  combo?: number;
  /** 0..1 progress of a charged blow being held. */
  charge?: number;
}
/** Staff angles: 0 upright, positive behind, negative towards the facing side. */
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
/**
 * Eidra's key poses with her staff: a low sweep, a rising arc and a lunging thrust
 * for the combo; the staff raised overhead while a charge gathers, then brought down
 * as the cards burst; pointed straight down for the pogo, swept overhead from behind
 * to the front for a strike upwards; trailed back in a dash.
 */
export function heroPose(h: HeroPoseInput): Pose {
  if (h.dashing) return { lean: 0.32, squash: 0.12, swing: 1.2 };
  if (h.attackTime <= 0) {
    const charge = h.charge ?? 0;
    if (charge <= 0) return {};
    const k = easeOut(charge);
    return {
      swing: 0.3 + 2.4 * k,
      lean: -0.14 * k,
      squash: 0.06 * k,
      tremble: charge >= 1 ? 0.02 : 0,
    };
  }
  const duration = h.attackKind === 'charged' ? 0.58 : 0.32;
  const t = clamp01(1 - h.attackTime / duration);
  const arc = Math.sin(t * Math.PI);
  // The blow lands early in the swing, then the staff settles.
  const strike = easeOut(clamp01(t * 1.6));
  switch (h.attackKind) {
    case 'down':
      return { lean: 0.55 * arc, squash: -0.08 * arc, swing: Math.PI, reach: -0.12 };
    case 'up':
      // Overhead: she leans back and the staff sweeps over her crown.
      return {
        lean: -0.2 * arc,
        lift: 0.08 * arc,
        squash: -0.05 * arc,
        swing: mix(1.5, -0.7, strike),
      };
    case 'charged':
      return {
        lean: 0.3 * arc,
        offset: 0.25 * arc,
        squash: 0.08 * arc,
        swing: mix(2.7, -1.7, strike),
      };
    case 'aerial':
      return { lean: 0.22 * arc, swing: mix(1.3, -2.7, strike) };
    case 'dash':
      return { lean: 0.35 * arc, offset: 0.3 * arc, swing: -1.57, reach: 0.55 * arc };
    default:
      if (h.combo === 2)
        // Rising arc: from low in front up past the shoulder.
        return {
          lean: 0.12 * arc,
          offset: 0.1 * arc,
          lift: 0.05 * arc,
          swing: mix(-2.5, -0.1, strike),
        };
      if (h.combo === 3)
        // Thrust: drawn back, then driven forward with a lunge.
        return {
          lean: 0.3 * arc,
          offset: 0.35 * arc,
          squash: 0.05 * arc,
          swing: -1.52,
          reach: mix(-0.18, 0.5, strike),
        };
      // Sweep: from behind the shoulder, low across the front.
      return { lean: 0.18 * arc, offset: 0.14 * arc, swing: mix(0.9, -1.9, strike) };
  }
}
