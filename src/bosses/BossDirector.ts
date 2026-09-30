import type { BossData, BossPattern, PatternKind } from '../../game-data/bosses/schema';
export type BossState =
  'dormant' | 'intro' | 'approach' | 'windup' | 'attack' | 'recover' | 'transition' | 'dead';
/** Seconds between two waves of a `nova`. */
export const NOVA_INTERVAL = 0.45;
/** Patterns released in pulses during their attack: seconds between two pulses. */
export const PULSES: Partial<Record<PatternKind, number>> = {
  nova: NOVA_INTERVAL,
  eruption: 0.14,
  command: 0.4,
};
/** Seconds a `leap` spends in the air. */
export const LEAP_TIME = 0.6;
/** First geyser of an `eruption`, metres in front of the boss. */
const ERUPTION_START = 1.6;
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
  /** True on the step a blow lands (every pulse of a `nova`, `eruption` or `command`). */
  trigger = false;
  /** Waves already released by the current `nova`. */
  waves = 0;
  direction = -1;
  /** Ground marks of a `rain` or an `eruption`; the arrival of a `blink` or a `leap`. */
  targets: number[] = [];
  private current: BossPattern;
  /** Pattern forced for the next turn of the rotation (debug, tests). */
  private queued: string | null = null;
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
    const pulse = PULSES[kind];
    if (pulse) return pulse * this.current.count + (kind === 'eruption' ? 0.3 : 0);
    return kind === 'charge'
      ? 0.7
      : kind === 'leap'
        ? LEAP_TIME
        : kind === 'standard' || kind === 'mirror'
          ? 0.4
          : 0.24;
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
    // Where the boss stands, from Eidra's position and the distance between them.
    const bossX = playerX - direction * distance;
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
          this.begin(this.current, direction, playerX, bossX);
        break;
      case 'windup':
        if (this.timer > this.windup) {
          this.enter('attack');
          this.trigger = true;
          this.waves = 1;
        }
        break;
      case 'attack': {
        // Pulsed patterns release their waves, geysers or checks in rhythm.
        const pulse = PULSES[this.current.kind];
        if (pulse && this.waves < this.current.count && this.timer >= this.waves * pulse) {
          this.trigger = true;
          this.waves++;
        }
        if (this.timer > this.strike) {
          const combo = this.current.combo;
          if (combo && this.phase >= combo.phase && this.chain < MAX_CHAIN) {
            this.chain++;
            const next = this.data.patterns.find((p) => p.id === combo.pattern)!;
            this.begin(next, direction, playerX, bossX);
          } else {
            this.targets = [];
            this.enter('recover');
          }
        }
        break;
      }
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
    if (this.queued) {
      const id = this.queued;
      this.queued = null;
      if (this.cycle().some((p) => p.id === id)) return this.select(id);
    }
    const cycle = this.cycle();
    this.rotation = (this.rotation + 1) % cycle.length;
    this.current = cycle[this.rotation]!;
  }
  /** Starts the windup of `pattern`, marking the ground if it needs it. */
  private begin(pattern: BossPattern, direction: number, playerX: number, bossX: number): void {
    this.current = pattern;
    this.direction = direction;
    const [low, high] = this.bounds;
    const clamp = (x: number): number => Math.max(low, Math.min(high, x));
    const x = Number.isFinite(playerX) ? playerX : (low + high) / 2;
    if (pattern.kind === 'eruption') {
      // A line of geysers racing from the boss towards Eidra, stopped by the walls.
      const from = Number.isFinite(bossX) ? bossX : x - direction * 4;
      this.targets = [];
      for (let i = 0; i < pattern.count; i++) {
        const at = from + direction * (ERUPTION_START + i * pattern.range);
        if (at < low || at > high) break;
        this.targets.push(at);
      }
      this.enter('windup');
      return;
    }
    if (pattern.kind === 'leap') {
      this.targets = [clamp(x)];
      this.enter('windup');
      return;
    }
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
  /** Makes `id` the next pattern: at once while approaching, else after this one. */
  queue(id: string): void {
    if (!this.cycle().some((p) => p.id === id))
      throw new Error(`Pattern ${id} is not in phase ${this.phase}'s rotation`);
    if (['dormant', 'intro', 'approach'].includes(this.state)) this.select(id);
    else this.queued = id;
  }
  private enter(state: BossState): void {
    this.state = state;
    this.timer = 0;
  }
}
