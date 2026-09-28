import { guardianData } from '../../game-data/bosses/guardian';
import type { BossPattern } from '../../game-data/bosses/guardian';
export type BossState =
  'dormant' | 'intro' | 'approach' | 'windup' | 'attack' | 'recover' | 'transition' | 'dead';
export class BossDirector {
  state: BossState = 'dormant';
  timer = 0;
  phase = 1;
  patternIndex = 0;
  trigger = false;
  direction = -1;
  /** Ground positions marked during a `rain` windup. */
  targets: number[] = [];
  get pattern(): BossPattern {
    const available = guardianData.patterns.filter((p) => p.phase <= this.phase);
    return available[this.patternIndex % available.length]!;
  }
  /** The guardian ignores damage while it is introduced and while it changes phase. */
  get armored(): boolean {
    return this.state === 'intro' || this.state === 'transition';
  }
  activate(): void {
    if (this.state === 'dormant') {
      this.state = 'intro';
      this.timer = 0;
    }
  }
  update(
    dt: number,
    health: number,
    distance: number,
    direction: number,
    stagger = 0,
    playerX = Number.NaN,
  ): void {
    this.trigger = false;
    if (health <= 0) {
      this.state = 'dead';
      this.targets = [];
      return;
    }
    if (this.state === 'dormant') return;
    const phase = health <= guardianData.health * guardianData.phaseThreshold ? 2 : 1;
    if (phase > this.phase) {
      this.phase = phase;
      this.targets = [];
      this.enter('transition');
      return;
    }
    if (stagger > 0 && !this.armored) {
      if (this.state !== 'recover') this.enter('recover');
      return;
    }
    this.timer += dt;
    switch (this.state) {
      case 'intro':
        if (this.timer > 2.2) this.enter('approach');
        break;
      case 'approach':
        if (distance < 4 || this.timer > 2) {
          this.direction = direction;
          this.enter('windup');
          this.targets =
            this.pattern.id === 'rain' && Number.isFinite(playerX)
              ? [-2, -1, 0, 1, 2].map((i) =>
                  Math.max(167, Math.min(197, playerX + i * this.pattern.range)),
                )
              : [];
        }
        break;
      case 'windup':
        if (this.timer > this.pattern.windup * (this.phase === 2 ? 0.85 : 1)) {
          this.enter('attack');
          this.trigger = true;
        }
        break;
      case 'attack':
        if (this.timer > (this.pattern.id === 'charge' ? 0.7 : 0.24)) {
          this.targets = [];
          this.enter('recover');
        }
        break;
      case 'recover':
        if (this.timer > this.pattern.recover) {
          this.patternIndex++;
          this.enter('approach');
        }
        break;
      case 'transition':
        if (this.timer > guardianData.transition) {
          this.patternIndex++;
          this.enter('approach');
        }
        break;
      case 'dead':
        break;
    }
  }
  private enter(state: BossState): void {
    this.state = state;
    this.timer = 0;
  }
}
