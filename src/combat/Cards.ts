import { cardData } from '../../game-data/abilities/abilities';
import type { CardData } from '../../game-data/abilities/abilities';
import type { Combatant, Hitbox } from './CombatSystem';
import { HurtboxSystem } from './CombatSystem';
export interface CardShot {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds left before the card fades out. */
  life: number;
}
/**
 * Thrown cards: straight, fast, stopped by walls and closed gates, spent on the
 * first body they strike. Pure logic; the presentation draws `shots`.
 */
export class CardSystem {
  shots: CardShot[] = [];
  cooldown = 0;
  private next = 1;
  constructor(readonly data: CardData = cardData) {}
  get ready(): boolean {
    return this.cooldown === 0;
  }
  /** Throws one card, or a fan during a riposte. */
  throw(x: number, y: number, facing: number, fan: boolean): CardShot[] {
    const count = fan ? this.data.fan : 1;
    const thrown: CardShot[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i - (count - 1) / 2) * this.data.spread;
      thrown.push({
        id: this.next++,
        x,
        y,
        vx: Math.cos(angle) * this.data.speed * facing,
        vy: Math.sin(angle) * this.data.speed,
        life: this.data.range / this.data.speed,
      });
    }
    this.shots.push(...thrown);
    this.cooldown = this.data.cooldown;
    return thrown;
  }
  /** Moves every card; `blocked` tells whether a point lies inside a wall. */
  update(dt: number, blocked: (x: number, y: number) => boolean): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    for (const shot of this.shots) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      if (blocked(shot.x, shot.y)) shot.life = 0;
    }
    this.shots = this.shots.filter((shot) => shot.life > 0);
  }
  /** The blow a card deals where it flies. */
  hitbox(shot: CardShot): Hitbox {
    return {
      x: shot.x,
      y: shot.y,
      width: 0.5,
      height: 0.5,
      damage: this.data.damage,
      stagger: 0.2,
      force: 2.5,
      direction: Math.sign(shot.vx) || 1,
    };
  }
  /** The first card touching `target`, which is spent. */
  strike(target: Combatant): CardShot | null {
    const hurtbox = new HurtboxSystem();
    const shot = this.shots.find((s) => s.life > 0 && hurtbox.overlaps(this.hitbox(s), target));
    if (shot) shot.life = 0;
    return shot ?? null;
  }
  reset(): void {
    this.shots = [];
    this.cooldown = 0;
  }
}
