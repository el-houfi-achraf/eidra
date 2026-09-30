import type { BossData, BossPattern } from '../../game-data/bosses/schema';
export type BossState =
  'dormant' | 'intro' | 'approach' | 'windup' | 'attack' | 'recover' | 'transition' | 'dead';
/** Seconds between two waves of a `nova`. */
export const NOVA_INTERVAL = 0.45;
/** Chained follow-ups wind up faster than a fresh pattern. */
export const COMBO_HASTE = 0.6;
/** Longest chain of follow-ups before the boss must recover. */
const MAX_CHAIN = 3;
/**
 * Data-driven boss behaviour: an introduction, a rotation of telegraphed patterns
 * that widens with each phase, chained follow-ups, and armoured roars between
 * phases. Pure logic: the enemy manager moves the body and spawns the blows.
 */
export class BossDirector {
  state: BossState = 'dormant';
  timer = 0;
  phase = 1;
  /** Position in the rotation of the current phase. */
  rotation = 0;
  /** Follow-ups chained since the last recovery. */
  chain = 0;
  /** True on the step a blow lands (every wave of a `nova`). */
  trigger = false;
  /** Waves already released by the current `nova`. */
  waves = 0;
  direction = -1;
  /** Ground marks of a `rain`, or the arrival point of a `blink`. */
  targets: number[] = [];
  private current: BossPattern;
  constructor(
    readonly data: BossData,
    /** Horizontal bounds of the arena, for marks and blinks. */
    private bounds: readonly [number, number],
  ) {
    this.current = this.cycle()[0]!;
  }
  get pattern(): BossPattern {
    return this.current;
  }
  /** Windup of the current pattern, shortened by the phase and by chaining. */
  get windup(): number {
    const haste = this.data.haste[this.phase - 1] ?? 1;
    return this.current.windup * haste * (this.chain > 0 ? COMBO_HASTE : 1);
  }
  /** Approach speed, quicker in later phases. */
  get speed(): number {
    return this.data.speed / (this.data.haste[this.phase - 1] ?? 1);
  }
  /** Seconds the attack state lasts once released. */
  get strike(): number {
    const kind = this.current.kind;
    return kind === 'charge' ? 0.7 : kind === 'nova' ? NOVA_INTERVAL * this.current.count : 0.24;
  }
  /** The boss ignores damage while it is introduced and while it changes phase. */
  get armored(): boolean {
    return this.state === 'intro' || this.state === 'transition';
  }
  /** Patterns of the rotation available in the current phase. */
  cycle(): BossPattern[] {
    return this.data.patterns.filter((p) => !p.followUp && p.phase <= this.phase);
  }
  activate(): void {
    if (this.state === 'dormant') this.enter('intro');
  }
  phaseFor(health: number): number {
    return 1 + this.data.phases.filter((ratio) => health <= this.data.health * ratio).length;
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
    const phase = this.phaseFor(health);
    if (phase > this.phase) {
      this.phase = phase;
      this.targets = [];
      this.chain = 0;
      this.enter('transition');
      return;
    }
    if (stagger > 0 && !this.armored) {
      if (this.state !== 'recover') {
        this.chain = 0;
        this.targets = [];
        this.enter('recover');
      }
      return;
    }
    this.timer += dt;
    switch (this.state) {
      case 'intro':
        if (this.timer > this.data.intro) this.enter('approach');
        break;
      case 'approach':
        if (distance < 4 || this.timer > 2 * (this.data.haste[this.phase - 1] ?? 1))
          this.begin(this.current, direction, playerX);
        break;
      case 'windup':
        if (this.timer > this.windup) {
          this.enter('attack');
          this.trigger = true;
          this.waves = 1;
        }
        break;
      case 'attack':
        // A nova releases its waves in rhythm.
        if (
          this.current.kind === 'nova' &&
          this.waves < this.current.count &&
          this.timer >= this.waves * NOVA_INTERVAL
        ) {
          this.trigger = true;
          this.waves++;
        }
        if (this.timer > this.strike) {
          const combo = this.current.combo;
          if (combo && this.phase >= combo.phase && this.chain < MAX_CHAIN) {
            this.chain++;
            const next = this.data.patterns.find((p) => p.id === combo.pattern)!;
            this.begin(next, direction, playerX);
          } else {
            this.targets = [];
            this.enter('recover');
          }
        }
        break;
      case 'recover':
        if (this.timer > this.current.recover) {
          this.chain = 0;
          this.advance();
          this.enter('approach');
        }
        break;
      case 'transition':
        if (this.timer > this.data.transition) {
          this.advance();
          this.enter('approach');
        }
        break;
      case 'dead':
        break;
    }
  }
  /** Moves to the next pattern of the current phase's rotation. */
  private advance(): void {
    const cycle = this.cycle();
    this.rotation = (this.rotation + 1) % cycle.length;
    this.current = cycle[this.rotation]!;
  }
  /** Starts the windup of `pattern`, marking the ground if it needs it. */
  private begin(pattern: BossPattern, direction: number, playerX: number): void {
    this.current = pattern;
    this.direction = direction;
    const [low, high] = this.bounds;
    const clamp = (x: number): number => Math.max(low, Math.min(high, x));
    const x = Number.isFinite(playerX) ? playerX : (low + high) / 2;
    if (pattern.kind === 'rain') {
      const half = (pattern.count - 1) / 2;
      this.targets = Array.from({ length: pattern.count }, (_, i) =>
        clamp(x + (i - half) * pattern.range),
      );
    } else if (pattern.kind === 'blink') {
      // Reappears on the far side of Eidra, or on the near side when a wall is behind her.
      const behind = x + direction * pattern.range;
      this.targets = [
        behind >= low && behind <= high ? behind : clamp(x - direction * pattern.range),
      ];
    } else this.targets = [];
    this.enter('windup');
  }
  /** Chooses the pattern the rotation starts from (tests and debug). */
  select(id: string): void {
    const cycle = this.cycle();
    const index = cycle.findIndex((p) => p.id === id);
    if (index < 0) throw new Error(`Pattern ${id} is not in phase ${this.phase}'s rotation`);
    this.rotation = index;
    this.current = cycle[index]!;
  }
  private enter(state: BossState): void {
    this.state = state;
    this.timer = 0;
  }
}
