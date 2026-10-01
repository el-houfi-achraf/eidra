import type { EnemyData } from '../../game-data/enemies/roster';
export type EnemyState =
  | 'IDLE'
  | 'PATROL'
  | 'ALERT'
  | 'DETECT'
  | 'CHASE'
  | 'ATTACK'
  | 'RECOVER'
  | 'STAGGER'
  | 'RETURN'
  | 'DEAD';
export interface Blackboard {
  distance: number;
  homeDistance: number;
  health: number;
  stagger: number;
  /** Full health, to know when the enemy enrages. */
  maxHealth?: number;
}
/** Seconds an enemy stays in its ATTACK state. */
export const STRIKE = 0.2;
/** A chained blow winds up this much faster than the first. */
export const FOLLOW_UP = 0.45;
/** Enraged windups and recoveries shrink by this factor. */
export const ENRAGED_HASTE = 0.7;
/** Seconds a startled enemy takes to react; an ambusher takes longer to rise. */
export const STARTLE = 0.25;
export const RISE = 0.7;
export class EnemyFSM {
  state: EnemyState = 'IDLE';
  timer = 0;
  attackTriggered = false;
  /** Blows landed in the current combo. */
  strikes = 0;
  enraged = false;
  constructor(readonly data: EnemyData) {}
  /** Blows in a combo; an enraged elite adds one. */
  get combo(): number {
    return this.data.combo + (this.enraged && this.data.combo > 1 ? 1 : 0);
  }
  /** Windup of the next blow: follow-ups and rage shorten it. */
  get windup(): number {
    return (
      this.data.windup * (this.enraged ? ENRAGED_HASTE : 1) * (this.strikes > 0 ? FOLLOW_UP : 1)
    );
  }
  get recover(): number {
    return this.data.recover * (this.enraged ? ENRAGED_HASTE : 1);
  }
  /** Chase speed multiplier. */
  get pace(): number {
    return this.enraged ? 1.3 : 1;
  }
  /** An ambusher still lying as a carving: it neither moves nor hurts until it rises. */
  get dormant(): boolean {
    return this.data.ambush && this.state === 'IDLE';
  }
  update(dt: number, board: Blackboard): void {
    this.attackTriggered = false;
    if (
      this.data.enrage > 0 &&
      board.maxHealth &&
      board.health <= board.maxHealth * this.data.enrage
    )
      this.enraged = true;
    if (board.health <= 0) {
      this.enter('DEAD');
      return;
    }
    if (board.stagger > 0) {
      this.strikes = 0;
      this.enter('STAGGER');
      return;
    }
    this.timer += dt;
    switch (this.state) {
      case 'IDLE':
      case 'PATROL':
        if (board.distance < this.data.detection) this.enter('DETECT');
        // An ambusher lies still: no idle wandering betrays it.
        else if (this.timer > 2 && !this.data.ambush)
          this.enter(this.state === 'IDLE' ? 'PATROL' : 'IDLE');
        break;
      case 'DETECT':
        if (this.timer > (this.data.ambush ? RISE : STARTLE)) this.enter('CHASE');
        break;
      case 'CHASE':
        if (board.homeDistance > 17) this.enter('RETURN');
        else if (board.distance <= this.data.range) this.enter('ALERT');
        break;
      case 'ALERT':
        if (this.timer >= this.windup) {
          this.strikes++;
          this.enter('ATTACK');
          this.attackTriggered = true;
        }
        break;
      case 'ATTACK':
        // A combo commits: the next blow winds up at once, wherever Eidra went.
        if (this.timer > STRIKE) {
          if (this.strikes < this.combo) this.enter('ALERT');
          else {
            this.strikes = 0;
            this.enter('RECOVER');
          }
        }
        break;
      case 'RECOVER':
        if (this.timer > this.recover) this.enter('CHASE');
        break;
      case 'STAGGER':
        this.enter('RECOVER');
        break;
      case 'RETURN':
        if (board.homeDistance < 0.5) this.enter('IDLE');
        break;
      case 'DEAD':
        break;
    }
  }
  private enter(state: EnemyState): void {
    if (this.state !== state) {
      this.state = state;
      this.timer = 0;
    }
  }
}
