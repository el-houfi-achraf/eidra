import { focusData } from '../../game-data/abilities/abilities';
import type { FocusData } from '../../game-data/abilities/abilities';
import type { Combatant } from '../combat/CombatSystem';
/**
 * Recueillement. Landing blows fills a resonance gauge; holding the focus input
 * while standing still spends one segment to restore health. Taking damage
 * interrupts the channel, so healing is a risk/reward decision in combat.
 */
export class FocusSystem {
  resonance = 0;
  channel = 0;
  constructor(readonly data: FocusData = focusData) {}
  gain(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.resonance = Math.min(this.data.capacity, this.resonance + amount);
  }
  get segments(): number {
    return Math.floor(this.resonance / this.data.cost);
  }
  get progress(): number {
    return this.channel / this.data.channel;
  }
  get channeling(): boolean {
    return this.channel > 0;
  }
  canFocus(target: Combatant): boolean {
    return (
      this.resonance >= this.data.cost && target.health > 0 && target.health < target.maxHealth
    );
  }
  /** Advances the channel; returns the health restored when it completes. */
  update(dt: number, holding: boolean, allowed: boolean, target: Combatant): number {
    if (!holding || !allowed || !this.canFocus(target)) {
      this.channel = 0;
      return 0;
    }
    this.channel += dt;
    if (this.channel < this.data.channel) return 0;
    this.channel = 0;
    this.resonance -= this.data.cost;
    const healed = Math.min(this.data.heal, target.maxHealth - target.health);
    target.health += healed;
    return healed;
  }
  interrupt(): void {
    this.channel = 0;
  }
  reset(): void {
    this.resonance = 0;
    this.channel = 0;
  }
}
