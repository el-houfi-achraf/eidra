import {
  PhysicsCharacterController,
  CharacterSupportedState,
} from '@babylonjs/core/Physics/v2/characterController';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { MovementModel } from '../player/MovementModel';
import type { MovementIntent } from '../player/MovementModel';
export class PlayerController {
  readonly motion = new MovementModel();
  readonly character: PhysicsCharacterController;
  private gravity = new Vector3(0, -28, 0);
  private velocity = Vector3.Zero();
  /**
   * Havok keeps the contact manifold of the previous position after `setPosition`, so the
   * first support query after a teleport describes the old ground. That step is treated as
   * airborne; its integration refreshes the contacts at the new position.
   */
  private teleported = false;
  constructor(scene: Scene) {
    this.character = new PhysicsCharacterController(
      new Vector3(4, 1.2, 0),
      { capsuleHeight: 1.7, capsuleRadius: 0.33 },
      scene,
    );
    this.character.maxSlopeCosine = 0.65;
    this.character.maxStepHeight = 0.25;
  }
  get position(): Vector3 {
    return this.character.getPosition();
  }
  update(
    dt: number,
    intent: MovementIntent,
    canDash: boolean,
    doubleJump = false,
    knockback = 0,
  ): void {
    const support = this.character.checkSupport(dt, Vector3.Down());
    if (this.teleported) {
      support.supportedState = CharacterSupportedState.UNSUPPORTED;
      this.teleported = false;
    }
    this.motion.step(
      dt,
      intent,
      support.supportedState === CharacterSupportedState.SUPPORTED,
      canDash,
      doubleJump,
    );
    this.velocity.set(this.motion.vx + knockback, this.motion.vy, -this.position.z * 12);
    this.character.setVelocity(this.velocity);
    this.character.integrate(dt, support, this.gravity);
    const actual = this.character.getVelocity();
    if (actual.y < this.motion.vy && this.motion.vy > 0) this.motion.vy = actual.y;
  }
  teleport(x: number, y = 1.1): void {
    this.character.setPosition(new Vector3(x, y, 0));
    this.character.setVelocity(Vector3.Zero());
    this.motion.reset();
    this.teleported = true;
  }
  dispose(): void {
    this.character.dispose();
  }
}
