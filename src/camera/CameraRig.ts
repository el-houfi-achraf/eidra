import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { damp } from '../core/math';
import type { Settings } from '../config/settings';
export class CameraRig {
  readonly camera: FreeCamera;
  private x = 10;
  private y = 3;
  private trauma = 0;
  private clock = 0;
  constructor(private scene: Scene) {
    this.camera = new FreeCamera('controlled-camera', new Vector3(10, 6, -32), scene);
    this.camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 150;
  }
  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
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
    const targetX = menu ? 10 : boss ? 178 : Math.max(9, x + facing * 2.3);
    this.x = damp(this.x, targetX, menu ? 2 : 4.5 * settings.cameraSensitivity, dt);
    this.y = damp(this.y, menu ? 3.8 : Math.max(3.5, y + 1.5), 3.2, dt);
    const shake = settings.reducedMotion ? 0 : this.trauma ** 2 * settings.shake * 0.25;
    this.camera.position.set(this.x + Math.sin(this.clock * 81) * shake, this.y + 4.8, -32);
    this.camera.setTarget(new Vector3(this.x, this.y, 0));
    const halfHeight = boss ? 8.7 : menu ? 10 : 7.2;
    const ratio = this.scene.getEngine().getAspectRatio(this.camera);
    this.camera.orthoTop = halfHeight;
    this.camera.orthoBottom = -halfHeight;
    this.camera.orthoLeft = -halfHeight * ratio;
    this.camera.orthoRight = halfHeight * ratio;
  }
}
