import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateAudioEngineAsync } from '@babylonjs/core/AudioV2/webAudio/webAudioEngine';
import {
  CreateAudioBusAsync,
  CreateSoundAsync,
  CreateStreamingSoundAsync,
} from '@babylonjs/core/AudioV2/abstractAudio/audioEngineV2';
import type { AudioEngineV2 } from '@babylonjs/core/AudioV2/abstractAudio/audioEngineV2';
import type { AudioBus } from '@babylonjs/core/AudioV2/abstractAudio/audioBus';
import type { StaticSound } from '@babylonjs/core/AudioV2/abstractAudio/staticSound';
import type { StreamingSound } from '@babylonjs/core/AudioV2/abstractAudio/streamingSound';
import type { Settings } from '../config/settings';
import { cueFiles, isCue, soundCues } from '../../game-data/audio/sounds';
import type { CueId } from '../../game-data/audio/sounds';
import { ambienceBeds, loopFiles, musicTracks, stingerCues } from '../../game-data/audio/music';
import type { StingerId } from '../../game-data/audio/music';
import { MusicDirector } from './MusicDirector';
import type { Mix, MusicContext } from './MusicDirector';
import { Cooldowns, VariantPicker, pitchSpread } from './SoundBank';
type BusId = 'music' | 'ambience' | 'sfx' | 'ui';
interface Loop {
  sound: StreamingSound | null;
  loading: boolean;
  failed: boolean;
  /** Seconds spent silent; a long silence releases the stream. */
  idle: number;
  playing: boolean;
}
/** A silent loop is released after this long, so only nearby regions stay in memory. */
const RELEASE_AFTER = 20;
/** Sound effects load a few at a time so the first ones are ready quickly. */
const PARALLEL_LOADS = 8;
/**
 * The game's ears and voice. Sound effects are small static buffers loaded once;
 * music and ambience are streamed on demand and released when long silent;
 * stingers are short buffers. Four buses (music, ambience, effects, interface)
 * follow the volume settings. What plays and how loud is decided by the pure
 * MusicDirector and the cue data (game-data/audio).
 */
export class AudioManager {
  private engine: AudioEngineV2 | null = null;
  private buses: Partial<Record<BusId, AudioBus>> = {};
  private cues = new Map<CueId, StaticSound[]>();
  private stingers = new Map<StingerId, StaticSound>();
  private loops = new Map<string, Loop>();
  private loading: Promise<void> | null = null;
  readonly director = new MusicDirector();
  private picker = new VariantPicker();
  private cooldowns = new Cooldowns();
  private clock = 0;
  private warned = new Set<string>();
  private mix: Mix | null = null;
  /** Latest cues and stingers that actually sounded (debug and tests). */
  readonly recent: string[] = [];
  /** Loads everything the game needs to start sounding; safe to call repeatedly. */
  async start(): Promise<void> {
    if (this.loading) return this.loading;
    this.loading = this.initialize();
    return this.loading;
  }
  get ready(): boolean {
    return this.engine !== null;
  }
  private url(path: string): string {
    return `${import.meta.env.BASE_URL}audio/${path}`;
  }
  private async initialize(): Promise<void> {
    const engine = await CreateAudioEngineAsync({ volume: 0.6 });
    await engine.resumeAsync();
    for (const id of ['music', 'ambience', 'sfx', 'ui'] as const)
      this.buses[id] = await CreateAudioBusAsync(id, {}, engine);
    this.engine = engine;
    const jobs: (() => Promise<void>)[] = [];
    for (const [id, cue] of Object.entries(soundCues) as [CueId, (typeof soundCues)[CueId]][])
      for (let variant = 1; variant <= cue.variants; variant++)
        jobs.push(async () => {
          const sound = await CreateSoundAsync(
            `${id}-${variant}`,
            cueFiles(id, variant).map((path) => this.url(path)),
            {
              maxInstances: cue.voices,
              outBus: this.buses[cue.bus],
              spatialEnabled: cue.spatial,
              spatialDistanceModel: 'linear',
              spatialMinDistance: 6,
              spatialMaxDistance: 45,
            },
            engine,
          );
          const variants = this.cues.get(id) ?? [];
          variants[variant - 1] = sound;
          this.cues.set(id, variants);
        });
    for (const id of Object.keys(stingerCues) as StingerId[])
      jobs.push(async () => {
        const sound = await CreateSoundAsync(
          `stinger-${id}`,
          loopFiles('stingers', id).map((path) => this.url(path)),
          { outBus: this.buses.music, maxInstances: 1 },
          engine,
        );
        this.stingers.set(id, sound);
      });
    // A missing or undecodable file costs that sound only; it is reported, not hidden.
    const failures: unknown[] = [];
    for (let i = 0; i < jobs.length; i += PARALLEL_LOADS)
      await Promise.all(
        jobs
          .slice(i, i + PARALLEL_LOADS)
          .map((job) => job().catch((error) => failures.push(error))),
      );
    if (failures.length)
      console.error(`[EIDRA] ${failures.length} sounds failed to load`, failures[0]);
  }
  /** Plays a cue at a position (spatial cues) with a fresh variant and pitch. */
  play(id: string, x = 0, y = 0): void {
    if (!isCue(id)) {
      if (!this.warned.has(id)) console.warn(`[EIDRA] Unknown sound cue "${id}"`);
      this.warned.add(id);
      return;
    }
    const cue = soundCues[id];
    const variants = this.cues.get(id);
    if (!variants?.length || !this.cooldowns.take(id, this.clock, cue.cooldown)) return;
    const sound = variants[this.picker.pick(id, variants.length) - 1] ?? variants[0];
    if (!sound) return;
    sound.pitch = pitchSpread(cue.pitch);
    if (cue.spatial) sound.spatial.position = new Vector3(x, y, 0);
    sound.play({ volume: cue.volume });
    this.remember(id);
    if (cue.duck) this.director.duck(cue.duck);
  }
  /** Cuts a cue short (an interrupted Recueillement). */
  stop(id: string): void {
    if (isCue(id)) for (const sound of this.cues.get(id) ?? []) sound.stop();
  }
  /** A short musical phrase over the score: a victory, a power, a rest, a death. */
  stinger(id: StingerId): void {
    const sound = this.stingers.get(id);
    if (!sound) return;
    sound.stop();
    sound.play({ volume: stingerCues[id].volume });
    this.remember(`stinger:${id}`);
    if (id === 'victory') this.director.victory();
    if (id !== 'rest') this.director.duck(0.8);
  }
  private remember(id: string): void {
    this.recent.push(id);
    if (this.recent.length > 40) this.recent.shift();
  }
  /** What is loaded and audible, for the debug API. */
  state(): { ready: boolean; cues: number; streams: string[]; mix: Mix | null; recent: string[] } {
    return {
      ready: this.ready,
      cues: [...this.cues.values()].reduce((n, variants) => n + variants.filter(Boolean).length, 0),
      streams: [...this.loops].filter(([, loop]) => loop.playing).map(([key]) => key),
      mix: this.mix,
      recent: [...this.recent],
    };
  }
  listen(x: number, y: number): void {
    if (this.engine) this.engine.listener.position = new Vector3(x, y, -4);
  }
  update(dt: number, settings: Settings, context: MusicContext): void {
    this.clock += dt;
    const mix = this.director.update(dt, context);
    this.mix = mix;
    if (!this.engine) return;
    this.engine.volume = settings.master;
    const { music, ambience, sfx, ui } = this.buses;
    if (music) music.volume = settings.music * mix.level * (1 - 0.6 * mix.duck);
    if (ambience) ambience.volume = settings.effects * mix.level * 0.9;
    if (sfx) sfx.volume = settings.effects;
    if (ui) ui.volume = settings.effects;
    for (const [id, track] of Object.entries(musicTracks))
      this.drive(
        `music/${id}`,
        'music',
        (mix.music as Record<string, number>)[id] ?? 0,
        track.volume,
        dt,
      );
    for (const [id, bed] of Object.entries(ambienceBeds))
      this.drive(
        `ambience/${id}`,
        'ambience',
        (mix.ambience as Record<string, number>)[id] ?? 0,
        bed.volume,
        dt,
      );
  }
  /** Streams a loop while it is audible; releases it after a long silence. */
  private drive(
    key: string,
    bus: 'music' | 'ambience',
    gain: number,
    volume: number,
    dt: number,
  ): void {
    let loop = this.loops.get(key);
    if (!loop) {
      if (gain <= 0) return;
      loop = { sound: null, loading: false, failed: false, idle: 0, playing: false };
      this.loops.set(key, loop);
    }
    if (loop.failed) return;
    if (!loop.sound) {
      if (!loop.loading && gain > 0) {
        loop.loading = true;
        const [folder, id] = key.split('/') as ['music' | 'ambience', string];
        CreateStreamingSoundAsync(
          key,
          loopFiles(folder, id).map((path) => this.url(path)),
          { loop: true, volume: 0, outBus: this.buses[bus] },
          this.engine,
        )
          .then((sound) => {
            loop.sound = sound;
            loop.loading = false;
          })
          .catch((error: unknown) => {
            loop.failed = true;
            console.error(`[EIDRA] Could not stream ${key}`, error);
          });
      }
      return;
    }
    loop.sound.volume = gain * volume;
    if (gain > 0) {
      loop.idle = 0;
      if (!loop.playing) {
        loop.sound.play();
        loop.playing = true;
      }
      return;
    }
    loop.idle += dt;
    if (loop.playing && loop.idle > 0.2) {
      loop.sound.stop();
      loop.playing = false;
    }
    if (loop.idle > RELEASE_AFTER) {
      loop.sound.dispose();
      this.loops.delete(key);
    }
  }
  dispose(): void {
    for (const variants of this.cues.values()) for (const sound of variants) sound.dispose();
    for (const sound of this.stingers.values()) sound.dispose();
    for (const loop of this.loops.values()) loop.sound?.dispose();
    this.engine?.dispose();
  }
}
