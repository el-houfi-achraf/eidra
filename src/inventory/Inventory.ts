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
}
