import type { AbilityId } from '../../game-data/abilities/abilities';
export interface MemoryFrame {
  x: number;
  y: number;
  facing: number;
  attacking: boolean;
}
export class AbilitySystem {
  unlocked = new Set<AbilityId>();
  energy = 100;
  remanence = false;
  echoCooldown = 0;
  echo: MemoryFrame | null = null;
  private history: MemoryFrame[] = [];
  private playback: MemoryFrame[] = [];
  private sampleClock = 0;
  private echoClock = 0;
  unlock(id: AbilityId): boolean {
    if (this.unlocked.has(id)) return false;
    this.unlocked.add(id);
    return true;
  }
  toggleRemanence(): boolean {
    if (!this.unlocked.has('remanence')) return false;
    if (this.remanence) {
      this.remanence = false;
      return true;
    }
    if (this.energy < 10) return false;
    this.remanence = true;
    return true;
  }
  createEcho(): boolean {
    if (
      !this.unlocked.has('memory-step') ||
      this.echoCooldown > 0 ||
      this.energy < 25 ||
      this.history.length < 10
    )
      return false;
    this.energy -= 25;
    this.echoCooldown = 8;
    this.playback = this.history.map((frame) => ({ ...frame }));
    this.echoClock = 0;
    this.echo = this.playback[0] ?? null;
    return true;
  }
  update(dt: number, frame: MemoryFrame): void {
    this.echoCooldown = Math.max(0, this.echoCooldown - dt);
    this.energy = Math.max(0, Math.min(100, this.energy + dt * (this.remanence ? -10 : 11)));
    if (this.energy === 0) this.remanence = false;
    this.sampleClock += dt;
    while (this.sampleClock >= 0.05) {
      this.sampleClock -= 0.05;
      this.history.push({ ...frame });
      if (this.history.length > 100) this.history.shift();
    }
    if (this.playback.length) {
      this.echoClock += dt;
      const i = Math.min(this.playback.length - 1, Math.floor(this.echoClock / 0.05));
      this.echo = this.playback[i] ?? null;
      if (this.echoClock > this.playback.length * 0.05 + 2) {
        this.playback = [];
        this.echo = null;
      }
    }
  }
  resetTransient(): void {
    this.energy = 100;
    this.remanence = false;
    this.echo = null;
    this.history = [];
    this.playback = [];
    this.echoCooldown = 0;
    this.sampleClock = 0;
    this.echoClock = 0;
  }
}
