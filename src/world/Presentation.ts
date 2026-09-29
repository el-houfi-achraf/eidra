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
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { ImageProcessingPostProcess } from '@babylonjs/core/PostProcesses/imageProcessingPostProcess';
import { FxaaPostProcess } from '@babylonjs/core/PostProcesses/fxaaPostProcess';
import type { PostProcess } from '@babylonjs/core/PostProcesses/postProcess';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { GPUParticleSystem } from '@babylonjs/core/Particles/gpuParticleSystem';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import type { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Palette } from './Palette';
import { Backdrop } from './Backdrop';
import { CameraRig } from '../camera/CameraRig';
import { CharacterView } from '../animation/CharacterView';
import type { CharacterKind } from '../animation/CharacterView';
import { EffectPool } from '../vfx/EffectPool';
import { SlashArc } from '../vfx/SlashArc';
import { Afterimages } from '../vfx/Afterimages';
import { Motes } from '../vfx/Motes';
import { LightRays } from '../vfx/LightRays';
import { bossPose, enemyPose, heroPose } from '../animation/Poses';
import { damp } from '../core/math';
import { proceduralTexture } from '../vfx/textures';
import type { GameSession } from '../core/GameSession';
import { presets } from '../config/settings';
import type { Settings } from '../config/settings';
const FOG = new Color3(0.025, 0.073, 0.079);
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
  private rainMarkers: { floor: Mesh; beam: Mesh }[] = [];
  private slash: SlashArc;
  private afterimages: Afterimages;
  private motes: Motes;
  private rays: LightRays;
  private backdrop: Backdrop;
  private projectileViews: Mesh[] = [];
  private glow: GlowLayer;
  private sun: DirectionalLight;
  private shadow: ShadowGenerator | null = null;
  private dust: ParticleSystem | GPUParticleSystem;
  private dustTexture: RawTexture;
  private time = 0;
  private preset = '';
  private chain = '';
  private postProcesses: PostProcess[] = [];
  // Visual-only bookkeeping derived from the simulation.
  private flashes = new Map<string, number>();
  private dying = new Map<string, number>();
  private lastAttackTime = 0;
  private wasGrounded = true;
  private airVy = 0;
  private land = 0;
  private heroHit = 0;
  private hurt = 0;
  private lastHealth = 0;
  private gatherClock = 0;
  private bossState = 'dormant';
  private bossAlive = false;
  private bossDissolve = 1;
  private emitter = new Vector3(10, 4, 2);
  // Hero life cycle: shattering on death, reforming from light at the anchor.
  private shatter = -1;
  private reform = 0;
  private kneel = 0;
  /** Set while Eidra rests at an anchor (altar open): she kneels. */
  resting = false;
  private stepDistance = 0;
  private lastHeroX = Number.NaN;
  private wasDashing = false;
  constructor(engine: AbstractEngine) {
    this.scene = new Scene(engine);
    const scene = this.scene;
    scene.clearColor = new Color4(FOG.r, FOG.g, FOG.b, 1);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogColor = FOG;
    scene.fogDensity = 0.016;
    // Cinematic grade, applied once per pixel by a full-screen pass (see applySettings).
    const grade = scene.imageProcessingConfiguration;
    grade.isEnabled = true;
    grade.toneMappingEnabled = true;
    grade.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    grade.exposure = 1.35;
    grade.contrast = 1.18;
    grade.vignetteEnabled = true;
    grade.vignetteBlendMode = ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;
    grade.vignetteWeight = 2.4;
    grade.vignetteStretch = 0.35;
    grade.vignetteColor = new Color4(0, 0, 0, 0);
    this.palette = new Palette(scene);
    const p = this.palette;
    this.camera = new CameraRig(scene);
    this.backdrop = new Backdrop(scene, FOG);
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
      blurKernelSize: 32,
    });
    this.glow.intensity = 0.65;
    this.hero = new CharacterView(scene, p, 'eidra');
    this.echo = new CharacterView(scene, p, 'echo');
    this.mira = new CharacterView(scene, p, 'mira');
    this.boss = new CharacterView(scene, p, 'boss');
    this.effects = new EffectPool(scene, p);
    this.slash = new SlashArc(scene, p);
    this.afterimages = new Afterimages(scene, p);
    this.motes = new Motes(scene, p);
    this.rays = new LightRays(scene);
    this.bossCue = MeshBuilder.CreateBox(
      'guardian-telegraph',
      { width: 1, height: 0.035, depth: 4 },
      scene,
    );
    this.bossCue.material = p.danger;
    this.bossCue.setEnabled(false);
    for (let i = 0; i < 5; i++) {
      const floor = MeshBuilder.CreateBox(
        'rain-marker',
        { width: 1.3, height: 0.04, depth: 3.4 },
        scene,
      );
      floor.material = p.danger;
      const beam = MeshBuilder.CreateBox(
        'rain-beam',
        { width: 0.07, height: 14, depth: 0.07 },
        scene,
      );
      beam.material = p.danger;
      for (const mesh of [floor, beam]) {
        mesh.isPickable = false;
        mesh.setEnabled(false);
      }
      this.rainMarkers.push({ floor, beam });
    }
    for (let i = 0; i < 20; i++) {
      const m = MeshBuilder.CreatePolyhedron('pooled-projectile', { type: 1, size: 0.18 }, scene);
      m.material = p.danger;
      m.isPickable = false;
      m.setEnabled(false);
      this.projectileViews.push(m);
    }
    this.dustTexture = proceduralTexture(scene, 16, 16, (u, v) => {
      const a = Math.max(0, 1 - Math.hypot(u - 0.5, v - 0.5) / 0.5) ** 2;
      return [0.78, 1, 0.9, a];
    });
    this.dust = GPUParticleSystem.IsSupported
      ? new GPUParticleSystem('memory-dust', { capacity: 150 }, scene)
      : new ParticleSystem('memory-dust', 150, scene);
    this.dust.particleTexture = this.dustTexture;
    this.dust.emitter = this.emitter;
    this.dust.minEmitBox = new Vector3(-24, -3, -8);
    this.dust.maxEmitBox = new Vector3(24, 10, 10);
    this.dust.color1 = new Color4(0.6, 0.85, 0.73, 0.3);
    this.dust.color2 = new Color4(0.8, 0.8, 0.55, 0.3);
    this.dust.colorDead = new Color4(0.2, 0.4, 0.35, 0);
    this.dust.minSize = 0.025;
    this.dust.maxSize = 0.08;
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
    this.scene.fogEnd = 110;
    // Post-process chain, rebuilt in a fixed order when it changes: grade → FXAA → aberration.
    // A single grading pass measured cheaper than per-fragment grading on this overdraw-heavy
    // scene (PERFORMANCE). LOW keeps the ungraded, MSAA-only path of the original prelude.
    const graded = settings.preset !== 'LOW';
    const chromatic = settings.chromaticAberration && !settings.reducedMotion;
    const chain = `${settings.preset}|${chromatic}`;
    if (chain !== this.chain) {
      this.chain = chain;
      for (const pass of this.postProcesses) pass.dispose(this.camera.camera);
      this.postProcesses = [];
      this.scene.imageProcessingConfiguration.isEnabled = graded;
      const camera = this.camera.camera;
      if (graded) {
        const grade = new ImageProcessingPostProcess('cinematic-grade', 1, camera);
        // MEDIUM trades MSAA for FXAA; HIGH and ULTRA keep multisampled edges.
        grade.samples = settings.preset === 'MEDIUM' ? 1 : 4;
        this.postProcesses.push(grade);
        if (settings.preset === 'MEDIUM')
          this.postProcesses.push(new FxaaPostProcess('edge-smoothing', 1, camera));
      }
      if (chromatic) {
        const engine = this.scene.getEngine();
        const aberration = new ChromaticAberrationPostProcess(
          'subtle-aberration',
          engine.getRenderWidth(),
          engine.getRenderHeight(),
          1,
          camera,
        );
        aberration.aberrationAmount = 3;
        aberration.radialIntensity = 0.2;
        this.postProcesses.push(aberration);
      }
    }
    this.backdrop.setEnabled(graded);
    this.glow.isEnabled = p.post;
    this.glow.intensity = settings.reducedMotion ? 0.35 : 0.65;
    this.effects.density = p.effects;
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
  /** Called when a blow lands on an enemy: white flash and, for finishers, a zoom punch. */
  enemyHit(id: string, finisher: boolean, x: number, y: number): void {
    this.flashes.set(id, 0.09);
    if (finisher) {
      this.camera.punch(0.05);
      this.effects.ring(x, y, 'gold', 2.6, 0.3);
    }
  }
  enemyDefeated(x: number, y: number, shards: number): void {
    this.motes.spray(x, y, shards * 2, this.palette.gold);
    this.effects.ring(x, y, 'memory', 3.5, 0.45);
  }
  parried(x: number, y: number): void {
    this.effects.ring(x, y, 'gold', 5, 0.5);
    this.camera.punch(0.09);
    this.heroHit = 0.08;
  }
  healed(x: number, y: number): void {
    this.effects.ring(x, y, 'heal', 3, 0.5);
  }
  /** Radiant blades for a recovered power, a fallen guardian or a lit anchor. */
  radiance(x: number, y: number, kind: 'gold' | 'memory', size = 6): void {
    this.rays.play(x, y, kind === 'gold' ? this.palette.gold : this.palette.crystal, size);
    this.effects.ring(x, y, kind, size * 0.8, 0.7);
    this.camera.punch(0.06);
  }
  /** Death: the ceramic mask cracks and Eidra scatters into shards and light. */
  shatterHero(x: number, y: number): void {
    this.shatter = 0;
    this.reform = 0;
    this.effects.burst(x, y + 0.3, 'heal', 18);
    this.effects.burst(x, y, 'memory', 12);
    this.effects.ring(x, y, 'heal', 5, 0.6);
    this.camera.punch(0.12);
    this.camera.shake(0.5);
  }
  /** Respawn: Eidra gathers back out of light at the anchor. */
  reformHero(x: number, y: number): void {
    this.shatter = -1;
    this.reform = 1;
    this.camera.snap(x, y);
    this.effects.ring(x, y, 'memory', 4, 0.8);
    for (let i = 0; i < 6; i++) this.motes.gather(x, y, this.palette.crystal);
  }
  render(dt: number, session: GameSession, settings: Settings, menu: boolean): void {
    this.time += dt;
    const p = session.player.position,
      m = session.player.motion;
    const hx = menu ? 10 : p.x,
      hy = menu ? 1.1 : p.y;
    this.camera.update(
      dt,
      menu ? 10 : p.x,
      menu ? 1 : p.y,
      m.facing,
      menu ? null : session.arenas.active,
      settings,
      menu,
    );
    if (menu) this.shatter = -1;
    for (const [id, t] of this.flashes) this.flashes.set(id, t - dt);
    // Landing squash and dust, derived from the controller's grounded transitions.
    if (!m.grounded) this.airVy = Math.min(this.airVy, m.vy);
    if (m.grounded && !this.wasGrounded && !menu) {
      if (this.airVy < -9) {
        this.land = Math.min(1, -this.airVy / 22);
        this.effects.burst(p.x, p.y - 0.8, 'dust', this.airVy < -18 ? 10 : 6);
      }
      this.airVy = 0;
    }
    // Jump puffs, running dust and dash bursts, all read from the controller.
    if (!menu && !m.grounded && this.wasGrounded && m.vy > 3)
      this.effects.burst(p.x, p.y - 0.8, 'dust', 5);
    const moved = Number.isFinite(this.lastHeroX) ? Math.abs(p.x - this.lastHeroX) : 0;
    this.lastHeroX = p.x;
    if (!menu && m.grounded && Math.abs(m.vx) > 3 && moved < 1) {
      this.stepDistance += moved;
      if (this.stepDistance > 1.7) {
        this.stepDistance = 0;
        this.effects.burst(p.x - m.facing * 0.25, p.y - 0.8, 'dust', 2);
      }
    }
    const dashing = !menu && m.dashTime > 0;
    if (dashing && !this.wasDashing) {
      this.effects.ring(p.x, p.y, 'memory', 2.2, 0.25);
      if (m.grounded) this.effects.burst(p.x - m.facing * 0.4, p.y - 0.8, 'dust', 4);
    }
    this.wasDashing = dashing;
    this.wasGrounded = m.grounded;
    this.land = Math.max(0, this.land - dt * 5);
    if (this.shatter >= 0) this.shatter += dt;
    this.reform = Math.max(0, this.reform - dt / 0.8);
    this.kneel = damp(this.kneel, this.resting && !menu ? 1 : 0, 8, dt);
    // Damping never reaches zero: snap, so the walk cycle takes the legs back.
    if (this.kneel < 0.01) this.kneel = 0;
    // Player damage feedback: white flash and a red pulse in the vignette.
    const health = session.actor.health;
    if (!menu && health < this.lastHealth) {
      this.heroHit = 0.1;
      this.hurt = 1;
    }
    this.lastHealth = health;
    this.heroHit = Math.max(0, this.heroHit - dt);
    this.hurt = Math.max(0, this.hurt - dt * 2.2);
    const low = menu ? 0 : Math.max(0, 1 - health / (session.actor.maxHealth * 0.3));
    const pulse = low * (0.55 + 0.45 * Math.sin(this.time * 6));
    const danger = Math.min(1, Math.max(this.hurt, pulse));
    const grade = this.scene.imageProcessingConfiguration;
    grade.vignetteColor.set(0.55 * danger, 0.02 * danger, 0.01 * danger, 0);
    grade.vignetteWeight = 2.4 + danger * 2.5;
    // A new swing starts a fresh crescent.
    if (session.combat.attackTime > this.lastAttackTime + 0.01)
      this.slash.play(session.combat.attackKind, session.combat.empowered, session.combat.finisher);
    this.lastAttackTime = session.combat.attackTime;
    this.slash.update(dt, hx, hy, m.facing);
    this.afterimages.update(dt, !menu && m.dashTime > 0, hx, hy, m.facing);
    const channel = menu ? 0 : Math.min(1, session.focus.progress);
    this.gatherClock -= dt;
    if (channel > 0 && this.gatherClock <= 0) {
      this.gatherClock = 0.045;
      this.motes.gather(hx, hy, this.palette.crystal);
    }
    this.motes.update(dt, hx, hy);
    this.hero.update(
      hx,
      hy,
      m.facing,
      this.time,
      menu ? 0 : m.vx,
      session.combat.attackTime,
      session.actor.invulnerable > 0 && this.heroHit <= 0 && Math.sin(this.time * 40) > 0,
      settings.reducedMotion,
      {
        vy: menu ? 0 : m.vy,
        grounded: menu || m.grounded,
        land: this.land,
        hit: this.heroHit,
        channel,
        empowered: !menu && (session.combat.parry.riposte > 0 || session.combat.empowered),
        ...(menu
          ? {}
          : heroPose({
              attackTime: session.combat.attackTime,
              attackKind: session.combat.attackKind,
              dashing,
            })),
        kneel: this.kneel,
        dying: this.shatter >= 0 ? Math.min(1, this.shatter / 0.45) : this.reform,
      },
    );
    this.hero.root.setEnabled(this.shatter < 0.45);
    this.rays.follow(hx, hy);
    this.rays.update(dt, settings.reducedMotion);
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
    this.renderEnemies(dt, session, settings);
    this.renderBoss(dt, session, settings, p.x);
    this.projectileViews.forEach((mesh, index) => {
      const shot = session.enemies.projectiles[index];
      mesh.setEnabled(Boolean(shot));
      if (shot) {
        mesh.position.set(shot.x, shot.y, 0);
        const falling = shot.vx === 0 && shot.vy < 0;
        mesh.scaling.set(1, falling ? 3 : 1, 1);
        mesh.rotation.z = falling ? 0 : this.time * 8;
      }
    });
    this.effects.update(dt);
    this.emitter.set(this.camera.camera.position.x, 4, 2);
    this.backdrop.update(this.camera.camera.position.x, this.camera.camera.position.y);
    this.palette.shaft.alpha = settings.reducedMotion
      ? 0.5
      : 0.46 + Math.sin(this.time * 0.7) * 0.06 + Math.sin(this.time * 1.9) * 0.03;
    this.sun.position.x = p.x + 8;
    // Gates burst out of the floor in a spray of dust, and sink in a glimmer.
    for (const gate of session.world.takeGateChanges())
      if (Math.abs(gate.x - this.camera.camera.position.x) < this.camera.halfWidth + 2) {
        this.effects.burst(gate.x, 0.2, gate.closed ? 'dust' : 'gold', gate.closed ? 10 : 6);
        if (gate.closed) this.effects.burst(gate.x, 1.5, 'damage', 4);
      }
    session.world.render(this.time, session.inventory.collectibles, session.narrative.flags);
    this.scene.render();
  }
  private renderEnemies(dt: number, session: GameSession, settings: Settings): void {
    for (const [id, entity] of session.enemies.entities) {
      let visual = this.enemyViews.get(id);
      if (!visual) {
        const view = new CharacterView(this.scene, this.palette, entity.kind as CharacterKind);
        const ring = MeshBuilder.CreateTorus(
          'enemy-telegraph',
          { diameter: 2, thickness: 0.06, tessellation: 32 },
          this.scene,
        );
        ring.material = this.palette.danger;
        ring.isPickable = false;
        visual = { view, ring };
        this.enemyViews.set(id, visual);
        for (const mesh of view.meshes) this.shadow?.addShadowCaster(mesh);
      }
      const a = entity.actor,
        warning = entity.fsm.state === 'ALERT';
      // Defeated foes flash white and dissolve instead of vanishing.
      let dying = this.dying.get(id);
      if (a.health <= 0 && dying === undefined) dying = 0;
      if (a.health > 0) dying = undefined;
      if (dying !== undefined) {
        dying = Math.min(1, dying + dt / 0.4);
        this.dying.set(id, dying);
      } else this.dying.delete(id);
      const alive = a.health > 0 || (dying !== undefined && dying < 1);
      visual.view.root.setEnabled(alive);
      const flash = this.flashes.get(id) ?? 0;
      const { pose, attack } = enemyPose({
        state: entity.fsm.state,
        timer: entity.fsm.timer,
        windup: entity.data.windup,
        recover: entity.data.recover,
        ranged: entity.data.ranged,
        flash,
      });
      if (alive)
        visual.view.update(
          a.x,
          a.y + (entity.kind === 'wisp' ? Math.sin(this.time * 2) * 0.2 : 0),
          entity.facing,
          this.time,
          entity.fsm.state === 'CHASE' ? entity.data.speed : 0,
          attack,
          false,
          settings.reducedMotion,
          { ...pose, hit: flash, warning, dying: dying ?? 0, grounded: true },
        );
      visual.ring.position.set(a.x, 0.07, 0);
      visual.ring.scaling.setAll(1 + (warning ? entity.fsm.timer / entity.data.windup : 0));
      visual.ring.setEnabled(warning && a.health > 0);
    }
    for (const [id, visual] of this.enemyViews)
      if (!session.enemies.entities.has(id)) {
        visual.view.dispose();
        visual.ring.dispose();
        this.enemyViews.delete(id);
        this.dying.delete(id);
        this.flashes.delete(id);
      }
  }
  private renderBoss(dt: number, session: GameSession, settings: Settings, px: number): void {
    const boss = session.enemies.boss,
      director = session.enemies.director;
    if (director.state === 'transition' && this.bossState !== 'transition') {
      this.effects.ring(boss.x, 3, 'damage', 14, 0.9);
      this.camera.punch(0.1);
    }
    // Impact of a slam: dust rolls away from the Guardian's feet.
    if (
      director.state === 'attack' &&
      this.bossState !== 'attack' &&
      director.pattern.id === 'slam'
    ) {
      this.effects.burst(boss.x, 0.3, 'dust', 14);
      this.effects.ring(boss.x, 0.6, 'damage', 6, 0.4);
    }
    this.bossState = director.state;
    // Only a defeat witnessed this session dissolves; a loaded victory stays hidden.
    if (boss.health <= 0 && this.bossAlive) this.bossDissolve = 0;
    this.bossAlive = boss.health > 0;
    this.bossDissolve = Math.min(1, this.bossDissolve + dt / 1.2);
    const dying = boss.health > 0 ? 0 : this.bossDissolve;
    const visible = px > 145 && (boss.health > 0 || dying < 1);
    this.boss.root.setEnabled(visible);
    const { pose, attack } = bossPose({
      state: director.state,
      timer: director.timer,
      pattern: director.pattern.id,
      windup: director.pattern.windup * (director.phase === 2 ? 0.85 : 1),
      recover: director.pattern.recover,
    });
    if (visible)
      this.boss.update(
        boss.x,
        boss.y,
        director.direction,
        this.time,
        director.state === 'approach' ? 2.4 : 0,
        attack,
        false,
        settings.reducedMotion,
        {
          ...pose,
          warning:
            director.state === 'windup' ||
            director.state === 'transition' ||
            (director.state === 'intro' && director.timer > 1.4),
          channel: director.state === 'transition' ? 1 : 0,
          hit: this.flashes.get(boss.id) ?? 0,
          dying,
          grounded: true,
        },
      );
    const warning = director.state === 'windup';
    const rain = warning && director.pattern.id === 'rain';
    this.bossCue.setEnabled(warning && !rain && session.bossActive);
    if (warning && !rain) {
      this.bossCue.position.set(boss.x + director.direction * 2, 0.055, 0);
      this.bossCue.scaling.x =
        director.pattern.id === 'slam' ? 22 : director.pattern.id === 'charge' ? 14 : 8;
      this.bossCue.visibility = 0.2 + (director.timer / director.pattern.windup) * 0.55;
    }
    this.rainMarkers.forEach((marker, i) => {
      const x = director.targets[i];
      const show = rain && x !== undefined && session.bossActive;
      marker.floor.setEnabled(show);
      marker.beam.setEnabled(show);
      if (show) {
        const t = director.timer / director.pattern.windup;
        marker.floor.position.set(x, 0.06, 0);
        marker.floor.visibility = 0.3 + t * 0.6;
        marker.beam.position.set(x, 7, 0.4);
        marker.beam.visibility = 0.12 + t * 0.35 + Math.sin(this.time * 30) * 0.05;
      }
    });
  }
  dispose(): void {
    this.effects.dispose();
    this.slash.dispose();
    this.afterimages.dispose();
    this.motes.dispose();
    this.rays.dispose();
    this.backdrop.dispose();
    this.dust.dispose();
    this.dustTexture.dispose();
    this.scene.dispose();
  }
}
