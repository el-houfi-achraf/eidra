import { ChromaticAberrationPostProcess } from '@babylonjs/core/PostProcesses/chromaticAberrationPostProcess';
import '@babylonjs/core/Particles/webgl2ParticleSystem';
import '@babylonjs/core/Particles/computeShaderParticleSystem';
import { Scene } from '@babylonjs/core/scene';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { GPUParticleSystem } from '@babylonjs/core/Particles/gpuParticleSystem';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Palette } from './Palette';
import { CameraRig } from '../camera/CameraRig';
import { CharacterView } from '../animation/CharacterView';
import { EffectPool } from '../vfx/EffectPool';
import type { GameSession } from '../core/GameSession';
import { presets } from '../config/settings';
import type { Settings } from '../config/settings';
export class Presentation {
  readonly scene: Scene;
  readonly palette: Palette;
  readonly camera: CameraRig;
  readonly effects: EffectPool;
  readonly hero: CharacterView;
  readonly echo: CharacterView;
  readonly mira: CharacterView;
  private enemyViews = new Map<string, { view: CharacterView; ring: Mesh }>();
  private boss: CharacterView;
  private bossCue: Mesh;
  private slash: Mesh;
  private projectileViews: Mesh[] = [];
  private glow: GlowLayer;
  private sun: DirectionalLight;
  private shadow: ShadowGenerator | null = null;
  private dust: ParticleSystem | GPUParticleSystem;
  private dustTexture: RawTexture;
  private time = 0;
  private preset = '';
  private chromatic: ChromaticAberrationPostProcess | null = null;
  constructor(engine: AbstractEngine) {
    this.scene = new Scene(engine);
    const scene = this.scene;
    scene.clearColor = new Color4(0.022, 0.057, 0.065, 1);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogColor = new Color3(0.025, 0.073, 0.079);
    scene.fogDensity = 0.016;
    this.palette = new Palette(scene);
    const p = this.palette;
    this.camera = new CameraRig(scene);
    const sky = new HemisphericLight('cold-sky', new Vector3(-0.2, 1, -0.3), scene);
    sky.intensity = 0.8;
    sky.diffuse = new Color3(0.65, 0.83, 0.79);
    sky.groundColor = new Color3(0.15, 0.2, 0.21);
    this.sun = new DirectionalLight('remembered-light', new Vector3(-0.3, -0.8, 0.5), scene);
    this.sun.position.set(10, 18, -12);
    this.sun.intensity = 1.7;
    this.sun.diffuse = new Color3(0.79, 0.84, 0.68);
    this.glow = new GlowLayer('lumerite-bloom', scene, {
      mainTextureRatio: 0.4,
      blurKernelSize: 24,
    });
    this.glow.intensity = 0.5;
    this.hero = new CharacterView(scene, p, 'eidra');
    this.echo = new CharacterView(scene, p, 'echo');
    this.mira = new CharacterView(scene, p, 'mira');
    this.boss = new CharacterView(scene, p, 'boss');
    this.effects = new EffectPool(scene, p);
    this.slash = MeshBuilder.CreateTorus(
      'blade-arc',
      { diameter: 2.7, thickness: 0.035, tessellation: 40 },
      scene,
    );
    this.slash.rotation.x = Math.PI / 2;
    this.slash.material = p.ivory;
    this.slash.setEnabled(false);
    this.bossCue = MeshBuilder.CreateBox(
      'guardian-telegraph',
      { width: 1, height: 0.035, depth: 4 },
      scene,
    );
    this.bossCue.material = p.danger;
    this.bossCue.setEnabled(false);
    for (let i = 0; i < 20; i++) {
      const m = MeshBuilder.CreatePolyhedron('pooled-projectile', { type: 1, size: 0.18 }, scene);
      m.material = p.danger;
      m.setEnabled(false);
      this.projectileViews.push(m);
    }
    const pixels = new Uint8Array(16 * 16 * 4);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const offset = (y * 16 + x) * 4;
        pixels[offset] = 200;
        pixels[offset + 1] = 255;
        pixels[offset + 2] = 229;
        pixels[offset + 3] = Math.max(0, 1 - Math.hypot(x - 7.5, y - 7.5) / 7.5) ** 2 * 255;
      }
    this.dustTexture = RawTexture.CreateRGBATexture(pixels, 16, 16, scene, false, false);
    this.dust = GPUParticleSystem.IsSupported
      ? new GPUParticleSystem('memory-dust', { capacity: 150 }, scene)
      : new ParticleSystem('memory-dust', 150, scene);
    this.dust.particleTexture = this.dustTexture;
    this.dust.emitter = new Vector3(10, 4, 2);
    this.dust.minEmitBox = new Vector3(-20, -3, -5);
    this.dust.maxEmitBox = new Vector3(20, 9, 10);
    this.dust.color1 = new Color4(0.6, 0.85, 0.73, 0.3);
    this.dust.color2 = new Color4(0.8, 0.8, 0.55, 0.3);
    this.dust.colorDead = new Color4(0.2, 0.4, 0.35, 0);
    this.dust.minSize = 0.025;
    this.dust.maxSize = 0.07;
    this.dust.minLifeTime = 5;
    this.dust.maxLifeTime = 12;
    this.dust.emitRate = 6;
    this.dust.direction1 = new Vector3(-0.1, 0.08, 0);
    this.dust.direction2 = new Vector3(0.1, 0.22, 0);
    this.dust.minEmitPower = 0.2;
    this.dust.maxEmitPower = 0.6;
    this.dust.start();
  }
  applySettings(settings: Settings): void {
    const p = presets[settings.preset];
    this.scene.getEngine().setHardwareScalingLevel(1 / p.scale);
    this.scene.fogDensity = p.fog;
    this.scene.fogMode = settings.preset === 'LOW' ? Scene.FOGMODE_LINEAR : Scene.FOGMODE_EXP2;
    this.scene.fogStart = 25;
    this.scene.fogEnd = 80;
    if (settings.chromaticAberration && !settings.reducedMotion && !this.chromatic) {
      const engine = this.scene.getEngine();
      this.chromatic = new ChromaticAberrationPostProcess(
        'subtle-aberration',
        engine.getRenderWidth(),
        engine.getRenderHeight(),
        1,
        this.camera.camera,
      );
      this.chromatic.aberrationAmount = 3;
      this.chromatic.radialIntensity = 0.2;
    }
    if ((!settings.chromaticAberration || settings.reducedMotion) && this.chromatic) {
      this.chromatic.dispose();
      this.chromatic = null;
    }
    this.glow.isEnabled = p.post;
    this.glow.intensity = settings.reducedMotion ? 0.3 : 0.5;
    this.dust.emitRate = settings.reducedMotion ? 0 : p.particles / 6;
    if (this.dust instanceof GPUParticleSystem) this.dust.activeParticleCount = p.particles;
    this.scene.getEngine().resize();
    if (this.preset !== settings.preset) {
      this.preset = settings.preset;
      this.shadow?.dispose();
      this.shadow = p.shadows ? new ShadowGenerator(p.shadows, this.sun) : null;
      if (this.shadow) {
        this.shadow.usePercentageCloserFiltering = true;
        for (const mesh of [...this.hero.meshes, ...this.boss.meshes])
          this.shadow.addShadowCaster(mesh);
      }
    }
  }
  render(dt: number, session: GameSession, settings: Settings, menu: boolean): void {
    this.time += dt;
    const p = session.player.position,
      m = session.player.motion;
    this.camera.update(
      dt,
      menu ? 10 : p.x,
      menu ? 1 : p.y,
      m.facing,
      session.bossActive,
      settings,
      menu,
    );
    this.hero.update(
      menu ? 10 : p.x,
      menu ? 1.1 : p.y,
      m.facing,
      this.time,
      menu ? 0 : m.vx,
      session.combat.attackTime,
      session.actor.invulnerable > 0 && Math.sin(this.time * 40) > 0,
      settings.reducedMotion,
    );

    const echo = session.abilities.echo;
    this.echo.root.setEnabled(Boolean(echo) && !menu);
    if (echo)
      this.echo.update(
        echo.x,
        echo.y,
        echo.facing,
        this.time,
        1,
        echo.attacking ? 0.1 : 0,
        false,
        settings.reducedMotion,
      );
    this.mira.root.setEnabled(p.x > 45 && p.x < 105);
    if (p.x > 45 && p.x < 105)
      this.mira.update(
        76,
        1.15 + Math.sin(this.time) * 0.07,
        -1,
        this.time,
        0,
        0,
        false,
        settings.reducedMotion,
      );
    for (const [id, entity] of session.enemies.entities) {
      let visual = this.enemyViews.get(id);
      if (!visual) {
        const kind = entity.kind as 'watcher' | 'wisp' | 'sentinel' | 'keeper';
        const view = new CharacterView(this.scene, this.palette, kind);
        const ring = MeshBuilder.CreateTorus(
          'enemy-telegraph',
          { diameter: 2, thickness: 0.06, tessellation: 32 },
          this.scene,
        );
        ring.material = this.palette.danger;
        visual = { view, ring };
        this.enemyViews.set(id, visual);
        for (const mesh of view.meshes) this.shadow?.addShadowCaster(mesh);
      }
      const a = entity.actor,
        warning = entity.fsm.state === 'ALERT';
      visual.view.update(
        a.x,
        a.y + (entity.kind === 'wisp' ? Math.sin(this.time * 2) * 0.2 : 0),
        entity.facing,
        this.time,
        entity.fsm.state === 'CHASE' ? 2 : 0,
        entity.fsm.state === 'ATTACK' ? 0.1 : 0,
        a.invulnerable > 0,
        settings.reducedMotion,
      );
      visual.view.root.setEnabled(a.health > 0);
      visual.view.meshes[1]!.material = warning ? this.palette.danger : this.palette.ivory;
      visual.ring.position.set(a.x, 0.07, 0);
      visual.ring.scaling.setAll(1 + (warning ? entity.fsm.timer / entity.data.windup : 0));
      visual.ring.setEnabled(warning && a.health > 0);
    }
    for (const [id, visual] of this.enemyViews)
      if (!session.enemies.entities.has(id)) {
        visual.view.dispose();
        visual.ring.dispose();
        this.enemyViews.delete(id);
      }
    const boss = session.enemies.boss,
      director = session.enemies.director;
    this.boss.root.setEnabled(p.x > 145 && boss.health > 0);
    if (p.x > 145 && boss.health > 0) {
      this.boss.update(
        boss.x,
        boss.y,
        director.direction,
        this.time,
        director.state === 'approach' ? 2 : 0,
        director.state === 'attack' ? 0.15 : 0,
        boss.invulnerable > 0,
        settings.reducedMotion,
      );
      this.boss.meshes[1]!.material =
        director.state === 'windup' ? this.palette.danger : this.palette.ivory;
    }
    const warning = director.state === 'windup';
    this.bossCue.setEnabled(warning && session.bossActive);
    if (warning) {
      this.bossCue.position.set(boss.x + director.direction * 2, 0.055, 0);
      this.bossCue.scaling.x =
        director.pattern.id === 'slam' ? 22 : director.pattern.id === 'charge' ? 14 : 8;
      this.bossCue.visibility = 0.2 + (director.timer / director.pattern.windup) * 0.55;
    }
    this.slash.setEnabled(session.combat.active);
    this.slash.position.set(p.x + m.facing * 0.75, p.y, -0.2);
    this.slash.scaling.y = 0.55;
    this.slash.rotation.z = session.combat.attackTime * 9 * m.facing;
    this.projectileViews.forEach((mesh, index) => {
      const shot = session.enemies.projectiles[index];
      mesh.setEnabled(Boolean(shot));
      if (shot) {
        mesh.position.set(shot.x, shot.y, 0);
        mesh.rotation.z = this.time * 8;
      }
    });
    this.effects.update(dt);
    this.dust.emitter = new Vector3(this.camera.camera.position.x, 4, 2);
    this.sun.position.x = p.x + 8;
    session.world.render(this.time, session.inventory.collectibles, session.narrative.flags);
    this.scene.render();
  }
  dispose(): void {
    this.effects.dispose();
    this.dust.dispose();
    this.dustTexture.dispose();
    this.scene.dispose();
  }
}
