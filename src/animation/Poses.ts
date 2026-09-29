import type { Pose } from './CharacterView';
import type { EnemyState } from '../ai/EnemyFSM';
import type { BossState } from '../bosses/BossDirector';
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
  pattern: string;
  /** Effective windup of the current pattern (shortened in phase 2). */
  windup: number;
  recover: number;
}
export function bossPose(b: BossPoseInput): Posed {
  const pose: Pose = {};
  let attack = 0;
  if (b.state === 'intro') {
    // Rises from a crouch, shudders, then lifts its arms.
    const t = clamp01(b.timer / 2.2);
    pose.squash = 0.4 * (1 - easeOut(clamp01(t * 1.6)));
    pose.tremble = 0.05 * (1 - t);
    pose.raise = clamp01((t - 0.65) / 0.25);
  } else if (b.state === 'windup') {
    const k = easeOut(clamp01(b.timer / b.windup));
    if (b.pattern === 'sweep') {
      pose.lean = -0.3 * k;
      pose.raise = k;
      pose.squash = 0.06 * k;
    } else if (b.pattern === 'slam') {
      pose.squash = -0.16 * k;
      pose.lift = 0.6 * k;
      pose.lean = -0.12 * k;
      pose.raise = k;
    } else if (b.pattern === 'charge') {
      pose.squash = 0.2 * k;
      pose.lean = 0.3 * k;
      pose.tremble = k > 0.9 ? 0.04 : 0;
    } else {
      pose.lift = 1.3 * k;
      pose.raise = k;
      pose.tremble = 0.02;
    }
  } else if (b.state === 'attack') {
    const a = clamp01(b.timer / (b.pattern === 'charge' ? 0.7 : 0.24));
    if (b.pattern === 'sweep') {
      pose.lean = 0.42 * (1 - 0.5 * a);
      pose.offset = 0.7 * easeOut(clamp01(a * 2));
      attack = 0.32 * (1 - a);
    } else if (b.pattern === 'slam') {
      pose.squash = 0.3 * (1 - a);
      pose.lean = 0.1;
    } else if (b.pattern === 'charge') {
      pose.lean = 0.45;
      pose.squash = 0.12;
      pose.tremble = 0.02;
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
export interface HeroPoseInput {
  attackTime: number;
  attackKind: AttackKind;
  dashing: boolean;
}
export function heroPose(h: HeroPoseInput): Pose {
  if (h.dashing) return { lean: 0.32, squash: 0.12 };
  if (h.attackTime <= 0) return {};
  const duration = h.attackKind === 'charged' ? 0.58 : 0.32;
  const arc = Math.sin(clamp01(1 - h.attackTime / duration) * Math.PI);
  if (h.attackKind === 'down') return { lean: 0.55 * arc, squash: -0.08 * arc };
  if (h.attackKind === 'charged')
    return { lean: 0.3 * arc, offset: 0.25 * arc, squash: 0.08 * arc };
  if (h.attackKind === 'aerial') return { lean: 0.22 * arc };
  return { lean: 0.18 * arc, offset: 0.14 * arc };
}
