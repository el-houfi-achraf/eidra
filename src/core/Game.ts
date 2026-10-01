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
import { abilityData } from '../../game-data/abilities/abilities';
import type { AbilityId } from '../../game-data/abilities/abilities';
import type { DebugAPI } from '../debug/types';
import { arenas, route } from '../../game-data/zones/laboratory';
import { familyNames } from '../../game-data/input/controllers';
import { rumbleCues } from '../../game-data/input/rumble';
import { soundCues } from '../../game-data/audio/sounds';
import type { AudioScene } from '../audio/MusicDirector';
import { sectorOf } from '../world/Rooms';
/** The camera's flight over a chapter from the title screen: metres, m/s. */
const FLYOVER = { lead: 6, length: 64, speed: 2.6, y: 4.4, halfHeight: 7.6 } as const;
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
  /** The map is the page shown while paused. */
  private mapOpen = false;
  private deathTimer = 0;
  private saving: Promise<void> = Promise.resolve();
  private lifecycle = new AbortController();
  /** A chapter flown over behind the title screen. */
  private flyover: { x: number; to: number; done: () => void } | null = null;
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
      offer: () => this.offer(),
      capturePad: (done) => this.input.capture(done),
      cancelPadCapture: () => this.input.cancelCapture(),
      pad: () => ({ info: this.input.pad, glyph: (token) => this.input.padLabel(token) }),
      rumbleTest: () => this.input.rumble(rumbleCues['boss-slam']!),
      listen: (theme) => {
        void this.audio.start().catch((error: unknown) => reportError(error));
        this.audio.director.listen(theme);
      },
      preview: (chapter, done) => {
        this.flyover = {
          x: chapter.from + FLYOVER.lead,
          to: Math.min(chapter.to - FLYOVER.lead, chapter.from + FLYOVER.length),
          done,
        };
        void this.audio.start().catch((error: unknown) => reportError(error));
        this.audio.director.listen(chapter.theme);
      },
      endPreview: () => this.endFlyover(),
    });
    // The score starts with the first gesture (browsers keep audio asleep until then),
    // so the title theme plays in the menus.
    const wake = (): void => {
      void this.audio.start().catch((error: unknown) => reportError(error));
    };
    for (const type of ['pointerdown', 'keydown'] as const)
      window.addEventListener(type, wake, { once: true, signal: this.lifecycle.signal });
    // Menus answer with soft ticks: moving the focus, confirming.
    const root = document.getElementById('interface');
    root?.addEventListener(
      'focusin',
      (event) => {
        if ((event.target as HTMLElement).matches('button, input, select'))
          this.audio.play('ui-move');
      },
      { signal: this.lifecycle.signal },
    );
    root?.addEventListener(
      'click',
      (event) => {
        if ((event.target as HTMLElement).closest('button')) this.audio.play('ui-confirm');
      },
      { signal: this.lifecycle.signal },
    );
    this.input.onConnection((info, connected) => {
      this.ui.notice(
        connected
          ? `Manette connectée : ${info.name} (${familyNames[info.family]}).`
          : `Manette déconnectée : ${info.name}.`,
      );
      // Losing the controller mid-fight pauses the journey, as on a console.
      if (!connected && this.state.state === 'PLAYING' && this.input.device === 'gamepad')
        this.pause();
      this.ui.refreshPad();
    });
  }
  async boot(): Promise<void> {
    this.ui.loading();
    this.engine = await createEngine(this.canvas);
    this.presentation = new Presentation(this.engine);
    await initializePhysics(this.presentation.scene);
    this.world = new World(this.presentation.scene, this.presentation.palette);
    this.session = new GameSession(this.presentation.scene, this.world, {
      notice: (text, topic) => this.ui.notice(text, topic),
      burst: (x, y, kind) => this.presentation.effects.burst(x, y, kind),
      sound: (id, x, y) => {
        this.audio.play(id, x ?? this.session.actor.x, y ?? this.session.actor.y);
        const rumble = rumbleCues[id];
        if (rumble) this.input.rumble(rumble);
        const caption = soundCues[id].caption;
        if (this.settings.subtitles && caption) this.ui.caption(caption);
      },
      stopSound: (id) => this.audio.stop(id),
      stinger: (id) => this.audio.stinger(id),
      shake: (value) => this.presentation.camera.shake(value),
      save: () => this.saveNow(false),
      dialogue: () => this.startDialogue(),
      death: () => this.die(),
      ending: () => {
        this.endingPending = true;
      },
      title: (kind, title, subtitle) => this.ui.title(kind, title, subtitle),
      unlock: (id) => {
        const action = {
          dash: InputAction.Dash,
          remanence: InputAction.Remanence,
          'memory-step': InputAction.Echo,
          'double-jump': InputAction.Jump,
        }[id as string];
        const data = abilityData[id];
        this.ui.abilityBanner(data.name, data.description, action ? this.input.label(action) : '—');
        this.presentation.radiance(this.session.actor.x, this.session.actor.y, 'memory', 6);
      },
      altar: () => this.openAltar(),
      enter: (room) => this.presentation.enter(room),
    });
    this.hud = new Hud(this.presentation.scene);
    const events = this.session.events;
    events.on('ENEMY_DAMAGED', (e) => {
      this.hud.number(
        e.x,
        e.y,
        String(Math.round(e.amount)),
        e.finisher ? '#ffd58e' : '#f1ecdc',
        e.finisher,
      );
      this.hud.enemyDamaged(e.id);
      this.presentation.enemyHit(e.id, e.finisher, e.x, e.y);
    });
    events.on('ENEMY_DEFEATED', (e) => {
      this.presentation.enemyDefeated(e.x, e.y, e.shards);
      // Arena guardians leave a radiant burst where they fell.
      if (arenas.some((a) => a.guardian === e.id) && !this.session.enemies.encounter(e.id))
        this.presentation.radiance(e.x, e.y + 0.6, 'gold', 8);
    });
    events.on('BOSS_DEFEATED', (e) => {
      const boss = this.session.enemies.encounter(e.id)?.actor;
      if (boss) this.presentation.radiance(boss.x, boss.y + 0.8, 'gold', 11);
    });
    events.on('PLAYER_DAMAGED', (e) =>
      this.hud.number(
        this.session.actor.x,
        this.session.actor.y + 1.1,
        `-${Math.round(e.amount)}`,
        '#ff9a7a',
      ),
    );
    events.on('PLAYER_HEALED', (e) => {
      this.hud.number(
        this.session.actor.x,
        this.session.actor.y + 1.1,
        `+${Math.round(e.amount)}`,
        '#aef5d8',
        true,
      );
      this.presentation.healed(this.session.actor.x, this.session.actor.y);
    });
    events.on('PARRIED', (e) => {
      this.presentation.parried(e.x, e.y);
      this.hud.number(e.x, e.y + 1.3, 'PARADE', '#ffd58e', true);
    });
    try {
      this.settings = await this.save.loadSettings();
      this.saves = await this.save.list();
    } catch (error) {
      reportError(error);
      this.ui.notice('Les sauvegardes existantes n’ont pas pu être lues. Elles sont conservées.');
    }
    this.applySettings(this.settings, false);
    this.world.update(10, 1.2, false, new Set());
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
          this.mapOpen = true;
          this.input.reset();
        } else {
          this.accumulator += dt;
          let steps = 0;
          while (this.accumulator >= 1 / 60 && steps++ < 6 && this.state.state === 'PLAYING') {
            this.session.update(1 / 60, this.input, this.settings);
            this.accumulator -= 1 / 60;
          }
          this.ui.update(this.session, (action) => this.input.label(action), this.settings.hints);
        }
      } else {
        this.accumulator = 0;
        if (
          this.state.state === 'CUTSCENE' &&
          (this.input.consume(InputAction.Interact) ||
            this.input.consume(InputAction.Jump) ||
            this.input.menu.confirm)
        )
          this.advanceDialogue();
        else if (this.state.state === 'PAUSED' && this.input.consume(InputAction.Pause))
          this.resume();
        // The map button closes the map it opened.
        else if (
          this.state.state === 'PAUSED' &&
          this.mapOpen &&
          this.input.consume(InputAction.Map)
        )
          this.resume();
      }
      if (['MAIN_MENU', 'PAUSED', 'GAME_OVER', 'ENDING'].includes(this.state.state))
        this.ui.navigate(this.input.menu);
      this.ui.setDevice(this.input.device, this.input.family);
      const menu = this.state.state === 'MAIN_MENU' || this.state.state === 'BOOT';
      if (!menu && this.flyover) this.endFlyover();
      const flight = this.flyover;
      if (flight) {
        flight.x += dt * FLYOVER.speed;
        this.world.update(flight.x, FLYOVER.y, false, new Set());
        if (flight.x >= flight.to) {
          this.endFlyover();
          flight.done();
        }
      }
      this.presentation.talking = this.state.state === 'CUTSCENE';
      this.presentation.render(
        dt,
        this.session,
        this.settings,
        menu,
        flight ? { x: flight.x, y: FLYOVER.y, halfHeight: FLYOVER.halfHeight } : null,
      );
      this.hud.update(
        this.session,
        ['PLAYING', 'PAUSED'].includes(this.state.state),
        dt,
        this.settings.reducedMotion,
      );
      this.hud.veil(this.presentation.veil);
      this.audio.listen(this.session.actor.x, this.session.actor.y);
      if (['MAIN_MENU', 'PAUSED', 'GAME_OVER'].includes(this.state.state) && this.input.menu.back)
        this.audio.play('ui-back');
      this.audio.update(dt, this.settings, {
        scene: this.audioScene,
        x: this.session.actor.x,
        // A chamber plays its sector's theme, wherever it lies along x.
        sector: this.session.inRoute ? null : sectorOf(this.session.room).id,
        boss: this.session.activeBoss?.data.id ?? null,
      });
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
      this.presentation.reformHero(this.session.player.position.x, this.session.player.position.y);
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
    } catch (error) {
      this.state.change('MAIN_MENU');
      this.ui.main(this.saves, this.settings);
      reportError(error);
    }
  }
  /** What the score should follow, from the state of the game. */
  private get audioScene(): AudioScene {
    const scene: Partial<Record<string, AudioScene>> = {
      BOOT: 'menu',
      MAIN_MENU: 'menu',
      PAUSED: 'paused',
      GAME_OVER: 'dead',
      ENDING: 'ending',
    };
    return scene[this.state.state] ?? 'playing';
  }
  private pause(): void {
    this.audio.play('ui-open');
    this.mapOpen = false;
    this.state.change('PAUSED');
    this.input.reset();
    this.ui.pause(this.settings, this.session, (action) => this.input.label(action));
  }
  private resume(): void {
    this.mapOpen = false;
    this.presentation.resting = false;
    if (this.state.state === 'ENDING') {
      this.world.update(
        route.finale.returnX,
        1.2,
        this.session.abilities.remanence,
        this.session.relocate(route.finale.returnX),
      );
      this.session.player.teleport(route.finale.returnX, 1.2);
      this.endShown = true;
    }
    this.state.change('PLAYING');
    this.ui.playing();
    this.input.reset();
    this.input.focus();
  }
  /** Back from a chapter preview: the title theme, the world streamed where play starts. */
  private endFlyover(): void {
    if (!this.flyover) return;
    this.flyover = null;
    this.audio.director.listen(null);
    this.world.update(10, 1.2, false, new Set());
  }
  private async showMenu(): Promise<void> {
    window.clearTimeout(this.deathTimer);
    this.presentation.resting = false;
    if (this.state.state === 'PLAYING') this.state.change('PAUSED');
    if (this.state.state === 'CUTSCENE') this.state.change('ENDING');
    this.state.change('MAIN_MENU');
    this.input.reset();
    this.world.update(10, 1.2, false, new Set());
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
    window.clearTimeout(this.deathTimer);
    this.state.change('LOADING');
    this.session.respawn();
    this.presentation.reformHero(this.session.player.position.x, this.session.player.position.y);
    this.audio.play('respawn');
    this.state.change('PLAYING');
    this.ui.playing();
    this.input.reset();
    this.input.focus();
    this.ui.notice('Vous vous reconstituez au dernier ancrage.');
  }
  private die(): void {
    if (this.state.state !== 'PLAYING') return;
    this.input.rumble(rumbleCues['player-death']!);
    this.audio.play('player-death');
    this.audio.stinger('death');
    this.state.change('GAME_OVER');
    this.input.reset();
    // The mask shatters first; the death panel follows once the shards have flown.
    this.presentation.shatterHero(this.session.actor.x, this.session.actor.y);
    window.clearTimeout(this.deathTimer);
    this.deathTimer = window.setTimeout(
      () => {
        if (this.state.state === 'GAME_OVER') this.ui.death();
      },
      this.settings.reducedMotion ? 350 : 1300,
    );
  }
  private startDialogue(): void {
    if (this.state.state === 'PLAYING') {
      this.state.change('CUTSCENE');
      this.input.reset();
      this.audio.play('dialogue');
      this.ui.dialogue(this.session, (action) => this.input.label(action));
    }
  }
  private openAltar(): void {
    if (this.state.state !== 'PLAYING') return;
    this.state.change('PAUSED');
    // Eidra kneels before the anchor while the offering is open.
    this.presentation.resting = true;
    this.presentation.radiance(this.session.actor.x, this.session.actor.y + 0.4, 'gold', 3.5);
    this.input.reset();
    this.ui.altar(this.session);
  }
  private offer(): void {
    if (this.state.state !== 'PAUSED') return;
    if (this.session.offer())
      this.ui.notice(`Offrande acceptée. Vitalité portée à ${this.session.actor.maxHealth}.`);
    this.ui.altar(this.session);
  }
  private advanceDialogue(): void {
    if (this.state.state !== 'CUTSCENE') return;
    if (this.ui.finishLine()) return;
    if (this.session.narrative.advance()) {
      this.audio.play('dialogue');
      this.ui.dialogue(this.session, (action) => this.input.label(action));
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
    this.input.setPad({
      bindings: value.padBindings,
      deadzone: value.deadzone,
      vibration: value.vibration,
      glyphs: value.glyphs,
    });
    this.presentation?.applySettings(value);
    if (!value.subtitles) this.ui.caption('');
    this.world?.setQuality(value.preset);
    this.canvas.style.filter = `brightness(${value.brightness}) contrast(${value.contrast})`;
    document.body.classList.toggle('reduced-motion', value.reducedMotion);
    this.ui.setReducedMotion(value.reducedMotion);
    document.body.classList.toggle('chromatic', value.chromaticAberration);
    if (persist) void this.save.saveSettings(value).catch((error) => reportError(error));
  }
  private installDebug(): void {
    const bossSnapshot = (id: string) => {
      const encounter = this.session.enemies.encounter(id)!;
      const director = encounter.director;
      return {
        id,
        health: encounter.actor.health,
        state: director.state,
        phase: director.phase,
        pattern: director.pattern.id,
        targets: [...director.targets],
        movement: encounter.data.movement,
        x: encounter.actor.x,
        effects: {
          standard: encounter.standard?.x ?? null,
          geysers: encounter.geysers.map((g) => g.x),
          reflections: encounter.reflections.map((r) => r.actor.x),
          gaze: encounter.gaze !== null,
          leaping: encounter.leap !== null,
        },
      };
    };
    const api: DebugAPI = {
      snapshot: () => ({
        state: this.state.state,
        player: {
          x: this.session.player.position.x,
          y: this.session.player.position.y,
          vy: this.session.player.motion.vy,
          health: this.session.actor.health,
          maxHealth: this.session.actor.maxHealth,
          grounded: this.session.player.motion.grounded,
          dashing: this.session.player.motion.dashTime > 0,
          invulnerable: this.session.actor.invulnerable,
        },
        resonance: this.session.focus.resonance,
        cards: this.session.cards.shots.map((c) => ({ x: c.x, y: c.y })),
        shards: this.session.inventory.shards,
        healthUpgrades: this.session.inventory.healthUpgrades,
        abilities: [...this.session.abilities.unlocked],
        energy: this.session.abilities.energy,
        remanence: this.session.abilities.remanence,
        echo: this.session.abilities.echo,
        checkpoint: this.session.checkpoint,
        chunks: [...this.world.stream.loaded.keys()],
        room: this.session.room.id,
        shown: [...this.world.stream.shown.keys()],
        discovered: [...this.session.discovered],
        veil: this.presentation.veil,
        enemies: [...this.session.enemies.entities.values()].map((e) => ({
          id: e.actor.id,
          x: e.actor.x,
          y: e.actor.y,
          health: e.actor.health,
          state: e.fsm.state,
        })),
        boss: bossSnapshot('faceless-guardian'),
        bosses: this.session.enemies.bosses.map((b) => bossSnapshot(b.data.id)),
        gates: [...this.session.closedGates()],
        settings: structuredClone(this.settings),
        memories: [...this.session.narrative.memories],
        flags: [...this.session.narrative.flags],
        gamepad: this.input.gamepadConnected,
        device: this.input.device,
        pad: this.input.pad
          ? {
              name: this.input.pad.name,
              family: this.input.pad.family,
              profile: this.input.pad.profile?.id ?? 'standard',
            }
          : null,
        audio: this.audio.state(),
        meshes: this.presentation.scene.meshes.length,
        bodies: this.world.bodyCount,
        renderer: this.engine.isWebGPU ? 'WebGPU' : 'WebGL2',
        fps: this.engine.getFps(),
        metrics: this.debug?.metrics ?? null,
      }),
      teleport: (x, y = 1.2) => {
        if (!Number.isFinite(x) || !Number.isFinite(y))
          throw new Error('Invalid debug coordinates');
        this.world.update(x, y, this.session.abilities.remanence, this.session.relocate(x));
        this.session.player.teleport(x, y);
      },
      unlock: (id: AbilityId) => {
        this.session.abilities.unlock(id);
      },
      damage: (amount: number) => {
        this.session.actor.invulnerable = 0;
        this.session.actor.health = Math.max(0, this.session.actor.health - Math.max(0, amount));
      },
      setResonance: (value: number) => {
        if (!Number.isFinite(value)) throw new Error('Invalid debug resonance');
        this.session.focus.resonance = Math.max(
          0,
          Math.min(this.session.focus.data.capacity, value),
        );
      },
      addShards: (amount: number) => {
        if (!Number.isInteger(amount) || amount < 0) throw new Error('Invalid debug shard amount');
        this.session.inventory.shards += amount;
      },
      setBossHealth: (value: number, id = 'faceless-guardian') => {
        const boss = this.session.enemies.encounter(id)?.actor;
        if (!boss || !Number.isFinite(value)) throw new Error(`Invalid debug boss ${id}`);
        boss.health = Math.max(0, Math.min(boss.maxHealth, value));
      },
      forceBossPattern: (id: string, pattern: string) => {
        const encounter = this.session.enemies.encounter(id);
        if (!encounter) throw new Error(`Invalid debug boss ${id}`);
        encounter.director.queue(pattern);
      },
      setEnemyHealth: (id: string, value: number) => {
        const enemy = this.session.enemies.entities.get(id)?.actor;
        if (!enemy || !Number.isFinite(value)) throw new Error(`Invalid debug enemy ${id}`);
        enemy.health = Math.max(0, Math.min(enemy.maxHealth, value));
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
    window.clearTimeout(this.deathTimer);
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
