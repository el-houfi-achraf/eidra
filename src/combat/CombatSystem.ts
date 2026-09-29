import type { Point } from '../core/math';
export interface Combatant extends Point {
  id: string;
  health: number;
  maxHealth: number;
  invulnerable: number;
  stagger: number;
  knockback: number;
  radius: number;
  height: number;
}
export interface Hitbox extends Point {
  width: number;
  height: number;
  damage: number;
  stagger: number;
  force: number;
  direction: number;
  /** Body contact: a parry cannot deflect it. */
  unblockable?: boolean;
}
export const makeCombatant = (
  id: string,
  health: number,
  x = 0,
  y = 1,
  radius = 0.5,
  height = 1.8,
): Combatant => ({
  id,
  health,
  maxHealth: health,
  x,
  y,
  radius,
  height,
  invulnerable: 0,
  stagger: 0,
  knockback: 0,
});
export class HurtboxSystem {
  overlaps(hit: Hitbox, target: Combatant): boolean {
    return (
      Math.abs(hit.x - target.x) < hit.width / 2 + target.radius &&
      Math.abs(hit.y - target.y) < hit.height / 2 + target.height / 2
    );
  }
}
export class InvulnerabilitySystem {
  update(target: Combatant, dt: number): void {
    target.invulnerable = Math.max(0, target.invulnerable - dt);
  }
}
export class StaggerSystem {
  update(target: Combatant, dt: number): void {
    target.stagger = Math.max(0, target.stagger - dt);
  }
}
export class KnockbackSystem {
  update(target: Combatant, dt: number): void {
    target.knockback *= Math.exp(-12 * dt);
  }
}
export class DamageSystem {
  apply(target: Combatant, hit: Hitbox, grace = 0.15): number {
    if (
      target.health <= 0 ||
      target.invulnerable > 0 ||
      hit.damage <= 0 ||
      !Number.isFinite(hit.damage)
    )
      return 0;
    const dealt = Math.min(target.health, hit.damage);
    target.health -= dealt;
    target.invulnerable = grace;
    target.stagger = Math.max(target.stagger, hit.stagger);
    target.knockback = hit.force * hit.direction;
    return dealt;
  }
}
export class HitboxSystem {
  private hits = new Set<string>();
  reset(): void {
    this.hits.clear();
  }
  test(hit: Hitbox, target: Combatant): boolean {
    if (this.hits.has(target.id) || !new HurtboxSystem().overlaps(hit, target)) return false;
    this.hits.add(target.id);
    return true;
  }
}
export class ComboSystem {
  index = 0;
  private remaining = 0;
  next(): number {
    this.index = this.remaining > 0 ? (this.index % 3) + 1 : 1;
    this.remaining = 0.8;
    return this.index;
  }
  update(dt: number): void {
    this.remaining = Math.max(0, this.remaining - dt);
  }
}
export class DodgeSystem {
  apply(target: Combatant, dashing: boolean): void {
    if (dashing) target.invulnerable = Math.max(target.invulnerable, 0.04);
  }
}
export class ParrySystem {
  window = 0;
  cooldown = 0;
  /** Seconds left to land an empowered riposte after a successful parry. */
  riposte = 0;
  start(): boolean {
    if (this.cooldown > 0) return false;
    this.window = 0.17;
    this.cooldown = 0.7;
    return true;
  }
  update(dt: number): void {
    this.window = Math.max(0, this.window - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.riposte = Math.max(0, this.riposte - dt);
  }
  tryParry(attacker: Combatant): boolean {
    if (this.window <= 0) return false;
    this.window = 0;
    this.cooldown = 0;
    this.riposte = 1;
    attacker.stagger = 1.1;
    return true;
  }
}
/**
 * Freezes the simulation for a few frames when a blow lands. The frozen time is
 * consumed from the fixed step, so inputs stay buffered and nothing is skipped.
 */
export class HitStop {
  remaining = 0;
  trigger(duration: number): void {
    if (!Number.isFinite(duration) || duration <= 0) return;
    this.remaining = Math.max(this.remaining, Math.min(0.2, duration));
  }
  /** Returns true while the current step is frozen. */
  freeze(dt: number): boolean {
    if (this.remaining <= 0) return false;
    // Snap float residue so a 50 ms stop at 60 Hz freezes exactly three steps.
    this.remaining = this.remaining - dt < 1e-4 ? 0 : this.remaining - dt;
    return true;
  }
  reset(): void {
    this.remaining = 0;
  }
}
/** Remembers a press for a short window so it fires as soon as the action is ready. */
export class ActionBuffer {
  remaining = 0;
  constructor(private window = 0.2) {}
  press(): void {
    this.remaining = this.window;
  }
  update(dt: number): void {
    this.remaining = Math.max(0, this.remaining - dt);
  }
  take(ready: boolean): boolean {
    if (this.remaining <= 0 || !ready) return false;
    this.remaining = 0;
    return true;
  }
  reset(): void {
    this.remaining = 0;
  }
}
export type AttackKind = 'light' | 'charged' | 'aerial' | 'dash' | 'down';
export class CombatSystem {
  readonly damage = new DamageSystem();
  readonly hitboxes = new HitboxSystem();
  readonly combo = new ComboSystem();
  readonly dodge = new DodgeSystem();
  readonly parry = new ParrySystem();
  readonly hitStop = new HitStop();
  readonly attackBuffer = new ActionBuffer(0.22);
  private invulnerability = new InvulnerabilitySystem();
  private stagger = new StaggerSystem();
  private knockback = new KnockbackSystem();
  attackTime = 0;
  cooldown = 0;
  attackKind: AttackKind = 'light';
  comboIndex = 0;
  /** The current swing is a riposte: doubled damage and a heavier stagger. */
  empowered = false;
  private duration = 0;
  begin(kind: AttackKind): boolean {
    if (this.cooldown > 0) return false;
    this.attackKind = kind;
    this.empowered = this.parry.riposte > 0;
    this.parry.riposte = 0;
    this.comboIndex = kind === 'down' ? this.comboIndex : this.combo.next();
    this.duration = kind === 'charged' ? 0.58 : 0.32;
    this.attackTime = this.duration;
    this.cooldown = this.duration;
    this.hitboxes.reset();
    return true;
  }
  update(dt: number, actors: Combatant[]): void {
    this.attackTime = Math.max(0, this.attackTime - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.attackBuffer.update(dt);
    this.combo.update(dt);
    this.parry.update(dt);
    for (const actor of actors) {
      this.invulnerability.update(actor, dt);
      this.stagger.update(actor, dt);
      this.knockback.update(actor, dt);
    }
  }
  get attacking(): boolean {
    return this.attackTime > 0;
  }
  get active(): boolean {
    const elapsed = this.duration - this.attackTime;
    return (
      this.attackTime > 0 &&
      elapsed > 0.06 &&
      elapsed < (this.attackKind === 'charged' ? 0.4 : 0.22)
    );
  }
  /** A finisher is the third combo swing, a charged blow or a riposte. */
  get finisher(): boolean {
    return (
      this.attackKind === 'charged' ||
      this.empowered ||
      (this.comboIndex === 3 && this.attackKind !== 'down')
    );
  }
  strike(player: Combatant, facing: number): Hitbox {
    const charged = this.attackKind === 'charged';
    const multiplier = this.empowered ? 2 : 1;
    if (this.attackKind === 'down')
      return {
        x: player.x,
        y: player.y - 1.25,
        width: 1.7,
        height: 1.8,
        damage: 12 * multiplier,
        stagger: 0.15 + (this.empowered ? 0.4 : 0),
        force: 0,
        direction: facing,
      };
    return {
      x: player.x + facing * (charged ? 1.4 : 1),
      y: player.y,
      width: charged ? 3.3 : 2.4,
      height: 2.5,
      damage: (charged ? 32 : this.comboIndex === 3 ? 18 : 12) * multiplier,
      stagger: (charged ? 0.6 : 0.15) + (this.empowered ? 0.4 : 0),
      force: charged ? 6 : 2,
      direction: facing,
    };
  }
  reset(): void {
    this.attackTime = 0;
    this.cooldown = 0;
    this.empowered = false;
    this.parry.window = 0;
    this.parry.cooldown = 0;
    this.parry.riposte = 0;
    this.hitStop.reset();
    this.attackBuffer.reset();
    this.hitboxes.reset();
  }
}
