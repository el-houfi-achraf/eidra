import { guardianData } from '../../game-data/bosses/guardian';
import type { BossPattern } from '../../game-data/bosses/guardian';
export class BossDirector {
  state: 'dormant' | 'intro' | 'approach' | 'windup' | 'attack' | 'recover' | 'dead' = 'dormant';
  timer = 0;
  phase = 1;
  patternIndex = 0;
  trigger = false;
  direction = -1;
  get pattern(): BossPattern {
    return guardianData.patterns[this.patternIndex % guardianData.patterns.length]!;
  }
  activate(): void {
    if (this.state === 'dormant') {
      this.state = 'intro';
      this.timer = 0;
    }
  }
  update(dt: number, health: number, distance: number, direction: number, stagger = 0): void {
    this.trigger = false;
    if (health <= 0) {
      this.state = 'dead';
      return;
    }
    if (this.state === 'dormant') return;
    if (stagger > 0) {
      if (this.state !== 'recover') this.enter('recover');
      return;
    }
    this.phase = health <= guardianData.health * guardianData.phaseThreshold ? 2 : 1;
    this.timer += dt;
    switch (this.state) {
      case 'intro':
        if (this.timer > 2.2) this.enter('approach');
        break;
      case 'approach':
        if (distance < 4 || this.timer > 2) {
          this.direction = direction;
          this.enter('windup');
        }
        break;
      case 'windup':
        if (this.timer > this.pattern.windup * (this.phase === 2 ? 0.85 : 1)) {
          this.enter('attack');
          this.trigger = true;
        }
        break;
      case 'attack':
        if (this.timer > (this.pattern.id === 'charge' ? 0.7 : 0.24)) this.enter('recover');
        break;
      case 'recover':
        if (this.timer > this.pattern.recover) {
          this.patternIndex++;
          this.enter('approach');
        }
        break;
      case 'dead':
        break;
    }
  }
  private enter(state: typeof this.state): void {
    this.state = state;
    this.timer = 0;
  }
}
