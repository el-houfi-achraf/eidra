import { offeringData } from '../../game-data/items/offerings';
export class Inventory {
  shards = 0;
  healthUpgrades = 0;
  collectibles = new Set<string>();
  collect(id: string, shards = 1): boolean {
    if (this.collectibles.has(id)) return false;
    this.collectibles.add(id);
    this.shards += Math.max(0, Math.floor(shards));
    return true;
  }
  spend(amount: number): boolean {
    if (!Number.isInteger(amount) || amount < 0 || this.shards < amount) return false;
    this.shards -= amount;
    return true;
  }
  /** Cost of the next anchor offering, or null once every offering is made. */
  get offeringCost(): number | null {
    return offeringData.costs[this.healthUpgrades] ?? null;
  }
  /** Spends shards for a permanent vitality upgrade. */
  offer(): boolean {
    const cost = this.offeringCost;
    if (cost === null || !this.spend(cost)) return false;
    this.healthUpgrades++;
    return true;
  }
  get maxHealth(): number {
    return 100 + this.healthUpgrades * offeringData.vitality;
  }
}
