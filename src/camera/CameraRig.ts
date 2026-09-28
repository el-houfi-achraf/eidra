import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { damp } from '../core/math';
import type { Settings } from '../config/settings';
/** Distance between the camera and the play plane (z = 0). */
const DISTANCE = 32;
/**
 * 2.5D framing with a long-lens perspective camera. The play plane keeps the
 * same size as the former orthographic framing, while background and foreground
 * layers now scroll at their own speed: real parallax without extra systems.
 */
export class CameraRig {
  readonly camera: FreeCamera;
  private x = 10;
  private y = 3;
  private trauma = 0;
  private clock = 0;
  private zoom = 0;
  private halfHeight = 10;
  private target = new Vector3(10, 3, 0);
  constructor(private scene: Scene) {
    this.camera = new FreeCamera('controlled-camera', new Vector3(10, 6, -DISTANCE), scene);
    this.camera.mode = Camera.PERSPECTIVE_CAMERA;
    this.camera.fovMode = Camera.FOVMODE_VERTICAL_FIXED;
    this.camera.minZ = 0.5;
    this.camera.maxZ = 220;
  }
  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }
  /** Brief zoom towards the action on heavy blows and parries. */
  punch(amount: number): void {
    this.zoom = Math.min(0.12, this.zoom + amount);
  }
  update(
    dt: number,
    x: number,
    y: number,
    facing: number,
    boss: boolean,
    settings: Settings,
    menu = false,
  ): void {
    this.clock += dt;
    this.trauma = Math.max(0, this.trauma - dt * 2.5);
    this.zoom = settings.reducedMotion ? 0 : damp(this.zoom, 0, 7, dt);
    const targetX = menu ? 10 : boss ? 178 : Math.max(9, x + facing * 2.3);
    this.x = damp(this.x, targetX, menu ? 2 : 4.5 * settings.cameraSensitivity, dt);
    this.y = damp(this.y, menu ? 3.8 : Math.max(3.5, y + 1.5), 3.2, dt);
    const shake = settings.reducedMotion ? 0 : this.trauma ** 2 * settings.shake * 0.25;
    this.camera.position.set(
      this.x + Math.sin(this.clock * 81) * shake,
      this.y + 4.8 + Math.cos(this.clock * 67) * shake * 0.6,
      -DISTANCE,
    );
    this.target.set(this.x, this.y, 0);
    this.camera.setTarget(this.target);
    this.halfHeight = damp(this.halfHeight, boss ? 8.7 : menu ? 10 : 7.2, 2.5, dt);
    const half = this.halfHeight * (1 - this.zoom);
    this.camera.fov = 2 * Math.atan(half / Math.hypot(DISTANCE, 4.8));
  }
  /** World-space half width of the view on the play plane, for culling and spawning. */
  get halfWidth(): number {
    return this.halfHeight * this.scene.getEngine().getAspectRatio(this.camera);
  }
}
