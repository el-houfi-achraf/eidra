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
}
export class EnemyFSM {
  state: EnemyState = 'IDLE';
  timer = 0;
  attackTriggered = false;
  constructor(readonly data: EnemyData) {}
  update(dt: number, board: Blackboard): void {
    this.attackTriggered = false;
    if (board.health <= 0) {
      this.enter('DEAD');
      return;
    }
    if (board.stagger > 0) {
      this.enter('STAGGER');
      return;
    }
    this.timer += dt;
    switch (this.state) {
      case 'IDLE':
      case 'PATROL':
        if (board.distance < this.data.detection) this.enter('DETECT');
        else if (this.timer > 2) this.enter(this.state === 'IDLE' ? 'PATROL' : 'IDLE');
        break;
      case 'DETECT':
        if (this.timer > 0.25) this.enter('CHASE');
        break;
      case 'CHASE':
        if (board.homeDistance > 17) this.enter('RETURN');
        else if (board.distance <= this.data.range) this.enter('ALERT');
        break;
      case 'ALERT':
        if (this.timer >= this.data.windup) {
          this.enter('ATTACK');
          this.attackTriggered = true;
        }
        break;
      case 'ATTACK':
        if (this.timer > 0.2) this.enter('RECOVER');
        break;
      case 'RECOVER':
        if (this.timer > this.data.recover) this.enter('CHASE');
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
