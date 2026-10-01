import { approach } from '../core/math';
export interface MovementIntent {
  axis: number;
  jump: boolean;
  jumpHeld: boolean;
  dash: boolean;
  walk: boolean;
}
export class MovementModel {
  vx = 0;
  vy = 0;
  facing = 1;
  grounded = false;
  dashTime = 0;
  dashCooldown = 0;
  private coyote = 0;
  private buffer = 0;
  private jumpCount = 0;
  /** Jumps since leaving the ground (2 after a Seconde impulsion). */
  get jumps(): number {
    return this.jumpCount;
  }
  private lift = 0;
  step(
    dt: number,
    intent: MovementIntent,
    supported: boolean,
    canDash = true,
    doubleJump = false,
  ): void {
    this.grounded = supported && this.vy <= 0.1;
    this.coyote = this.grounded ? 0.11 : Math.max(0, this.coyote - dt);
    this.buffer = intent.jump ? 0.12 : Math.max(0, this.buffer - dt);
    const wasDashing = this.dashTime > 0;
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.dashTime = Math.max(0, this.dashTime - dt);
    this.lift = Math.max(0, this.lift - dt);
    if (Math.abs(intent.axis) > 0.1) this.facing = Math.sign(intent.axis);
    if (this.grounded) {
      this.jumpCount = 0;
      this.vy = -1;
    }
    if (intent.dash && canDash && this.dashCooldown === 0) {
      this.dashTime = 0.19;
      this.dashCooldown = 0.7;
    }
    if (this.dashTime > 0) {
      this.vx = this.facing * 17;
      this.vy = 0;
      return;
    }
    // A completed dash returns to running speed before air steering takes over.
    // Retaining dash velocity made narrow landings drift several extra metres.
    if (wasDashing) this.vx = Math.max(-6.8, Math.min(6.8, this.vx));
    this.vx = approach(this.vx, intent.axis * (intent.walk ? 3 : 6.8), (supported ? 58 : 32) * dt);
    if (this.buffer > 0 && (this.coyote > 0 || (doubleJump && this.jumpCount < 2))) {
      this.vy = 11.8;
      this.coyote = 0;
      this.buffer = 0;
      this.jumpCount++;
      this.grounded = false;
    }
    // Releasing jump shortens the arc, except during a pogo bounce which has a fixed height.
    if (!intent.jumpHeld && this.vy > 5 && this.lift === 0) this.vy = 5;
    this.vy = Math.max(-24, this.vy - 28 * dt);
  }
  /**
   * A downward strike that connects launches the character upwards and refreshes
   * the dash, so enemies and projectiles can be used as stepping stones.
   */
  bounce(speed = 10.5, hold = 0.22): void {
    this.vy = speed;
    // Seconds the rise ignores a released jump: the bounce has its own height.
    this.lift = hold;
    this.dashCooldown = 0;
    this.dashTime = 0;
    this.grounded = false;
    this.coyote = 0;
    this.jumpCount = Math.min(this.jumpCount, 1);
  }
  reset(): void {
    this.lift = 0;
    this.vx = 0;
    this.vy = 0;
    this.buffer = 0;
    this.coyote = 0;
    this.dashTime = 0;
    this.dashCooldown = 0;
    this.jumpCount = 0;
  }
}
