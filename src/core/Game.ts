import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { createEngine } from './engine';
import { GameStateMachine } from './GameState';
import { reportError } from './errors';
import { Presentation } from '../world/Presentation';
import { initializePhysics } from '../physics/PhysicsWorld';
import { World } from '../world/World';
import { GameSession } from './GameSession';
import { InputManager } from '../player/InputManager';
import { InputAction } from '../player/InputAction';
import { Hud } from '../ui/Hud';
import { MenuUI } from '../ui/MenuUI';
import { AudioManager } from '../audio/AudioManager';
import { SaveManager } from '../save/SaveManager';
import type { SaveData } from '../save/SaveManager';
import { defaultSettings } from '../config/settings';
import type { Settings } from '../config/settings';
import { DebugOverlay } from '../debug/DebugOverlay';
import type { AbilityId } from '../../game-data/abilities/abilities';
import type { DebugAPI } from '../debug/types';
export class Game {
  private engine!: AbstractEngine;
  private presentation!: Presentation;
  private world!: World;
  private session!: GameSession;
  private hud!: Hud;
  private state = new GameStateMachine();
  private input: InputManager;
  private ui: MenuUI;
  private save = new SaveManager();
  private audio = new AudioManager();
  private settings: Settings = defaultSettings();
  private debug: DebugOverlay | undefined;
  private accumulator = 0;
  private elapsed = 0;
  private saves: (SaveData | null)[] = [null, null, null];
  private running = true;
  private endingPending = false;
  private endShown = false;
  private saving: Promise<void> = Promise.resolve();
  private lifecycle = new AbortController();
  constructor(private canvas: HTMLCanvasElement) {
    this.input = new InputManager(canvas);
    this.ui = new MenuUI({
      start: (slot) => this.start(slot),
      load: (data) => this.start(data.slot, data),
      resume: () => this.resume(),
      menu: () => void this.showMenu(),
      settings: (value) => this.applySettings(value),
      save: () => this.saveNow(),
      advance: () => this.advanceDialogue(),
      respawn: () => this.respawn(),
    });
  }
  async boot(): Promise<void> {
    this.ui.loading();
    this.engine = await createEngine(this.canvas);
    this.presentation = new Presentation(this.engine);
    await initializePhysics(this.presentation.scene);
    this.world = new World(this.presentation.scene, this.presentation.palette);
    this.session = new GameSession(this.presentation.scene, this.world, {
      notice: (text) => this.ui.notice(text),
      burst: (x, y, kind) => this.presentation.effects.burst(x, y, kind),
      sound: (id, x, y) => {
        this.audio.play(id, x ?? this.session.actor.x, y ?? this.session.actor.y);
        if (this.settings.subtitles && ['memory', 'save', 'parry'].includes(id))
          this.ui.caption(
            id === 'parry' ? '[ La céramique résonne. ]' : '[ La Lumérite chante doucement. ]',
          );
      },
      shake: (value) => this.presentation.camera.shake(value),
      save: () => this.saveNow(false),
      dialogue: () => this.startDialogue(),
      death: () => this.die(),
      ending: () => {
        this.endingPending = true;
      },
    });
    this.hud = new Hud(this.presentation.scene);
    try {
      this.settings = await this.save.loadSettings();
      this.saves = await this.save.list();
    } catch (error) {
      reportError(error);
      this.ui.notice('Les sauvegardes existantes n’ont pas pu être lues. Elles sont conservées.');
    }
    this.applySettings(this.settings, false);
    this.world.update(10, false, false, false);
    this.session.player.teleport(10, 1.2);
    if (new URLSearchParams(location.search).get('debug') === '1') {
      this.debug = new DebugOverlay(this.presentation.scene);
      this.installDebug();
    }
    this.state.change('MAIN_MENU');
    this.ui.main(this.saves, this.settings);
    const signal = this.lifecycle.signal;
    window.addEventListener('resize', () => this.engine.resize(), { signal });
    window.addEventListener(
      'blur',
      () => {
        if (this.state.state === 'PLAYING') this.pause();
      },
      { signal },
    );
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden && this.state.state === 'PLAYING') this.pause();
      },
      { signal },
    );
    window.addEventListener(
      'pagehide',
      () => {
        if (['PLAYING', 'PAUSED'].includes(this.state.state)) this.saveNow(false);
      },
      { signal },
    );
    this.engine.runRenderLoop(() => this.frame());
    await this.presentation.scene.whenReadyAsync();
    document.body.dataset.ready = 'true';
    document.body.dataset.state = this.state.state;
  }
  private frame(): void {
    if (!this.running) return;
    try {
      const cpuStart = performance.now();
      const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.1);
      this.elapsed += dt;
      this.input.poll();
      if (this.state.state === 'PLAYING') {
        if (this.input.consume(InputAction.Pause)) this.pause();
        else if (this.input.consume(InputAction.Map)) {
          this.state.change('PAUSED');
          this.ui.map(this.session);
          this.input.reset();
        } else {
          this.accumulator += dt;
          let steps = 0;
          while (this.accumulator >= 1 / 60 && steps++ < 6 && this.state.state === 'PLAYING') {
            this.session.update(1 / 60, this.input, this.settings);
            this.accumulator -= 1 / 60;
          }
          this.ui.update(this.session, this.input.bindings);
        }
      } else {
        this.accumulator = 0;
        if (
          this.state.state === 'CUTSCENE' &&
          (this.input.consume(InputAction.Interact) || this.input.consume(InputAction.Jump))
        )
          this.advanceDialogue();
        else if (this.state.state === 'PAUSED' && this.input.consume(InputAction.Pause))
          this.resume();
      }
      if (
        this.input.gamepadConnected &&
        ['MAIN_MENU', 'PAUSED', 'GAME_OVER', 'ENDING'].includes(this.state.state)
      )
        this.ui.navigate(this.input.menuDirection, this.input.consume(InputAction.Jump));
      const menu = this.state.state === 'MAIN_MENU' || this.state.state === 'BOOT';
      this.presentation.render(dt, this.session, this.settings, menu);
      this.hud.update(this.session, ['PLAYING', 'PAUSED'].includes(this.state.state));
      this.audio.listen(this.session.actor.x, this.session.actor.y);
      this.audio.update(dt, this.settings, this.session.bossActive, this.state.state !== 'PLAYING');
      this.debug?.recordCPU(performance.now() - cpuStart);
      this.debug?.update(
        dt,
        `Enemies ${[...this.session.enemies.entities.values()].filter((e) => e.actor.health > 0).length} • physics ${this.world.bodyCount}\nChunks ${this.world.stream.loaded.size} • echoes ${Number(Boolean(this.session.abilities.echo))}\nMemory ${this.session.abilities.energy.toFixed(0)} • state ${this.state.state}\nPlayer ${this.session.player.motion.grounded ? 'GROUNDED' : 'AIR'} (${this.session.actor.x.toFixed(2)}, ${this.session.actor.y.toFixed(2)})\nSave v2 • elapsed ${this.elapsed.toFixed(0)}s`,
      );
      document.body.dataset.state = this.state.state;
    } catch (error) {
      this.running = false;
      this.engine.stopRenderLoop();
      reportError(error, true);
    }
  }
  private start(slot: number, data?: SaveData): void {
    this.state.change('LOADING');
    this.ui.loading();
    this.endShown = false;
    this.endingPending = false;
    try {
      if (data) this.session.load(data);
      else this.session.newGame(slot);
      this.state.change('PLAYING');
      this.ui.playing();
      this.input.reset();
      this.input.focus();
      this.accumulator = 0;
      this.saveNow(false);
      void this.audio.start().catch((error) => {
        console.error('[EIDRA] Audio initialization failed', error);
        this.ui.notice('Le son n’a pas pu être chargé. Le voyage reste accessible.');
      });
      if (!data)
        this.ui.notice(
          'A / D ou flèches : marcher · Espace : sauter · J ou clic : attaquer · E : interagir',
        );
    } catch (error) {
      this.state.change('MAIN_MENU');
      this.ui.main(this.saves, this.settings);
      reportError(error);
    }
  }
  private pause(): void {
    this.state.change('PAUSED');
    this.input.reset();
    this.ui.pause(this.settings);
  }
  private resume(): void {
    if (this.state.state === 'ENDING') {
      this.session.player.teleport(190, 1.2);
      this.endShown = true;
    }
    this.state.change('PLAYING');
    this.ui.playing();
    this.input.reset();
    this.input.focus();
  }
  private async showMenu(): Promise<void> {
    if (this.state.state === 'PLAYING') this.state.change('PAUSED');
    if (this.state.state === 'CUTSCENE') this.state.change('ENDING');
    this.state.change('MAIN_MENU');
    this.input.reset();
    this.world.update(10, false, true, false);
    this.session.player.teleport(10, 1.2);
    try {
      await this.saving;
      this.saves = await this.save.list();
    } catch (error) {
      reportError(error);
    }
    this.ui.main(this.saves, this.settings);
  }
  private respawn(): void {
    this.state.change('LOADING');
    this.session.respawn();
    this.state.change('PLAYING');
    this.ui.playing();
    this.input.reset();
    this.input.focus();
    this.ui.notice('Vous vous reconstituez au dernier ancrage.');
  }
  private die(): void {
    if (this.state.state !== 'PLAYING') return;
    this.state.change('GAME_OVER');
    this.input.reset();
    this.ui.death();
  }
  private startDialogue(): void {
    if (this.state.state === 'PLAYING') {
      this.state.change('CUTSCENE');
      this.input.reset();
      this.ui.dialogue(this.session);
    }
  }
  private advanceDialogue(): void {
    if (this.state.state !== 'CUTSCENE') return;
    if (this.session.narrative.advance()) {
      this.ui.dialogue(this.session);
      this.input.reset();
      return;
    }
    this.saveNow(false);
    if (this.endingPending && !this.endShown) {
      this.endingPending = false;
      this.state.change('ENDING');
      this.ui.ending(this.session);
    } else {
      this.state.change('PLAYING');
      this.ui.playing();
      this.input.reset();
      this.input.focus();
    }
  }
  private saveNow(notify = true): void {
    if (!this.session) return;
    const data = this.session.snapshot(this.settings);
    // Respawns never load onto a temporary memory bridge or into an active boss.
    if (this.session.abilities.remanence || this.session.bossActive) {
      const safe = { awakening: 7, mira: 73, threshold: 160 }[this.session.checkpoint];
      data.position = { x: safe ?? 7, y: 1.2 };
    }
    this.saving = this.saving.then(async () => {
      try {
        await this.save.save(data);
        this.saves[data.slot - 1] = data;
        if (notify) this.ui.notice('Mémoire ancrée. Sauvegarde enregistrée.');
      } catch (error) {
        reportError(error);
        this.ui.notice('Échec de sauvegarde : votre progression n’a pas été enregistrée.');
      }
    });
  }
  private applySettings(value: Settings, persist = true): void {
    this.settings = value;
    this.input.setBindings(value.bindings);
    this.presentation?.applySettings(value);
    if (!value.subtitles) this.ui.caption('');
    this.world?.setQuality(value.preset);
    this.canvas.style.filter = `brightness(${value.brightness}) contrast(${value.contrast})`;
    document.body.classList.toggle('reduced-motion', value.reducedMotion);
    document.body.classList.toggle('chromatic', value.chromaticAberration);
    if (persist) void this.save.saveSettings(value).catch((error) => reportError(error));
  }
  private installDebug(): void {
    const api: DebugAPI = {
      snapshot: () => ({
        state: this.state.state,
        player: {
          x: this.session.player.position.x,
          y: this.session.player.position.y,
          health: this.session.actor.health,
          grounded: this.session.player.motion.grounded,
          dashing: this.session.player.motion.dashTime > 0,
        },
        abilities: [...this.session.abilities.unlocked],
        energy: this.session.abilities.energy,
        remanence: this.session.abilities.remanence,
        echo: this.session.abilities.echo,
        checkpoint: this.session.checkpoint,
        chunks: [...this.world.stream.loaded.keys()],
        enemies: [...this.session.enemies.entities.values()].map((e) => ({
          id: e.actor.id,
          x: e.actor.x,
          y: e.actor.y,
          health: e.actor.health,
          state: e.fsm.state,
        })),
        boss: {
          health: this.session.enemies.boss.health,
          state: this.session.enemies.director.state,
          phase: this.session.enemies.director.phase,
        },
        settings: structuredClone(this.settings),
        memories: [...this.session.narrative.memories],
        flags: [...this.session.narrative.flags],
        gamepad: this.input.gamepadConnected,
        meshes: this.presentation.scene.meshes.length,
        bodies: this.world.bodyCount,
        renderer: this.engine.isWebGPU ? 'WebGPU' : 'WebGL2',
        fps: this.engine.getFps(),
        metrics: this.debug?.metrics ?? null,
      }),
      teleport: (x, y = 1.2) => {
        if (!Number.isFinite(x) || !Number.isFinite(y))
          throw new Error('Invalid debug coordinates');
        this.world.update(x, this.session.abilities.remanence, true, false);
        this.session.player.teleport(x, y);
      },
      unlock: (id: AbilityId) => {
        this.session.abilities.unlock(id);
      },
      damage: (amount: number) => {
        this.session.actor.invulnerable = 0;
        this.session.actor.health = Math.max(0, this.session.actor.health - Math.max(0, amount));
      },
      setBossHealth: (value: number) => {
        this.session.enemies.boss.health = Math.max(
          0,
          Math.min(this.session.enemies.boss.maxHealth, value),
        );
      },
      save: () => {
        this.saveNow();
        return this.saving;
      },
    };
    window.eidra = api;
  }
  async dispose(): Promise<void> {
    this.running = false;
    this.engine.stopRenderLoop();
    this.lifecycle.abort();
    this.debug?.dispose();
    this.hud.dispose();
    this.session.dispose();
    this.world.dispose();
    this.input.dispose();
    this.ui.dispose();
    this.audio.dispose();
    this.presentation.dispose();
    this.engine.dispose();
    await this.saving;
    await this.save.close();
    delete window.eidra;
  }
}
