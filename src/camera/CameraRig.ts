import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { damp } from '../core/math';
import type { Settings } from '../config/settings';
import type { Bounds } from '../world/Rooms';
/** Distance between the camera and the play plane (z = 0). */
const DISTANCE = 32;
/** Metres the view drops while a dialogue is on screen. */
const TALK_LIFT = 1.2;
/**
 * Centre of a view of half-size (halfWidth, halfHeight) kept inside `bounds`: a
 * chamber's walls frame the screen as the room's own edges. A room smaller than
 * the view is centred.
 */
export function confine(
  x: number,
  y: number,
  bounds: Bounds,
  halfWidth: number,
  halfHeight: number,
): [number, number] {
  const fit = (v: number, low: number, high: number, half: number): number =>
    high - low <= half * 2 ? (low + high) / 2 : Math.max(low + half, Math.min(high - half, v));
  return [
    fit(x, bounds.left, bounds.right, halfWidth),
    fit(y, bounds.bottom, bounds.top, halfHeight),
  ];
}
/** A fixed framing: centre of the view and half its height on the play plane, metres. */
export interface Frame {
  x: number;
  y: number;
  halfHeight: number;
}
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
  /** During a dialogue the view drops a little, so the speakers stand above its box. */
  talking = false;
  private lift = 0;
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
  /** Cuts straight to a new framing (respawn, a door), instead of sweeping across the level. */
  snap(x: number, y: number, facing = 1, bounds: Bounds | null = null): void {
    [this.x, this.y] = this.aim(x, y, facing, bounds);
  }
  /** Where the view centres on Eidra: ahead of her, a little above, inside a chamber. */
  private aim(
    x: number,
    y: number,
    facing: number,
    bounds: Bounds | null,
    lift = 0,
  ): [number, number] {
    if (!bounds) return [Math.max(9, x + facing * 2.3), Math.max(3.5, y + 1.5) - lift];
    const aspect = this.scene.getEngine().getAspectRatio(this.camera) || 16 / 9;
    return confine(
      x + facing * 2.3,
      y + 1.5 - lift,
      bounds,
      this.halfHeight * aspect,
      this.halfHeight,
    );
  }
  /** Cuts straight to a framing (the title vista, a chapter preview). */
  hold(frame: Frame): void {
    this.x = frame.x;
    this.y = frame.y;
    this.halfHeight = frame.halfHeight;
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
    /** A sealed arena: the camera frames the whole chamber instead of following. */
    arena: { left: number; right: number } | null,
    settings: Settings,
    /** In the menus the camera holds a framing (the title vista, a chapter preview). */
    menu: Frame | null = null,
    /** A chamber: the view stays within its walls. */
    bounds: Bounds | null = null,
  ): void {
    this.clock += dt;
    this.trauma = Math.max(0, this.trauma - dt * 2.5);
    this.zoom = settings.reducedMotion ? 0 : damp(this.zoom, 0, 7, dt);
    const aspect = this.scene.getEngine().getAspectRatio(this.camera) || 16 / 9;
    this.lift = damp(this.lift, this.talking && !menu ? TALK_LIFT : 0, 3, dt);
    const [aimX, aimY] = this.aim(x, y, facing, bounds, this.lift);
    const targetX = menu ? menu.x : arena ? (arena.left + arena.right) / 2 : aimX;
    this.x = damp(this.x, targetX, menu ? 2 : 4.5 * settings.cameraSensitivity, dt);
    this.y = damp(this.y, menu ? menu.y : aimY, 3.2, dt);
    const shake = settings.reducedMotion ? 0 : this.trauma ** 2 * settings.shake * 0.25;
    this.camera.position.set(
      this.x + Math.sin(this.clock * 81) * shake,
      this.y + 4.8 + Math.cos(this.clock * 67) * shake * 0.6,
      -DISTANCE,
    );
    this.target.set(this.x, this.y, 0);
    this.camera.setTarget(this.target);
    // Wide chambers pull the camera back until both gates are in view.
    const framed = arena ? Math.max(7.2, ((arena.right - arena.left) / 2 + 0.8) / aspect) : 7.2;
    this.halfHeight = damp(this.halfHeight, menu ? menu.halfHeight : framed, 2.5, dt);
    const half = this.halfHeight * (1 - this.zoom);
    this.camera.fov = 2 * Math.atan(half / Math.hypot(DISTANCE, 4.8));
  }
  /** World-space half width of the view on the play plane, for culling and spawning. */
  get halfWidth(): number {
    return this.halfHeight * this.scene.getEngine().getAspectRatio(this.camera);
  }
}
