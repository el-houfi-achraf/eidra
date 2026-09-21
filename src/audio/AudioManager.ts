import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateAudioEngineAsync } from '@babylonjs/core/AudioV2/webAudio/webAudioEngine';
import { CreateSoundAsync } from '@babylonjs/core/AudioV2/abstractAudio/audioEngineV2';
import type { AudioEngineV2 } from '@babylonjs/core/AudioV2/abstractAudio/audioEngineV2';
import type { StaticSound } from '@babylonjs/core/AudioV2/abstractAudio/staticSound';
import type { Settings } from '../config/settings';
const paths: Record<string, string> = {
  ambient: 'ambient/nhalis',
  music: 'music/awakening',
  boss: 'boss/obedience',
  attack: 'combat/slash',
  heavy: 'combat/heavy',
  hit: 'combat/impact',
  hurt: 'combat/hurt',
  parry: 'combat/parry',
  dash: 'abilities/dash',
  jump: 'footsteps/jump',
  memory: 'abilities/remanence',
  save: 'ui/anchor',
  victory: 'ui/release',
  footstep: 'footsteps/stone',
};
export class AudioManager {
  private engine: AudioEngineV2 | null = null;
  private sounds = new Map<string, StaticSound>();
  private loading: Promise<void> | null = null;
  private mix = 0;
  async start(): Promise<void> {
    if (this.loading) return this.loading;
    this.loading = this.initialize();
    return this.loading;
  }
  private async initialize(): Promise<void> {
    this.engine = await CreateAudioEngineAsync({ volume: 0.6 });
    await this.engine.resumeAsync();
    await Promise.all(
      Object.entries(paths).map(async ([id, path]) => {
        const options = {
          loop: ['ambient', 'music', 'boss'].includes(id),
          volume: 0,
          maxInstances: 4,
          spatialEnabled: !['ambient', 'music', 'boss'].includes(id),
          spatialMinDistance: 2,
        };
        let sound: StaticSound;
        try {
          sound = await CreateSoundAsync(
            id,
            `${import.meta.env.BASE_URL}audio/${path}.ogg`,
            options,
            this.engine,
          );
        } catch (error) {
          console.warn(`[EIDRA] OGG decoder unavailable for ${id}; loading PCM fallback.`, error);
          sound = await CreateSoundAsync(
            id,
            `${import.meta.env.BASE_URL}audio/${path}.wav`,
            options,
            this.engine,
          );
        }
        this.sounds.set(id, sound);
      }),
    );
    for (const id of ['ambient', 'music', 'boss']) this.sounds.get(id)?.play();
  }
  play(id: string, x = 0, y = 0): void {
    const sound = this.sounds.get(id);
    if (sound) {
      sound.spatial.position = new Vector3(x, y, 0);
      sound.play();
    }
  }
  listen(x: number, y: number): void {
    if (this.engine) this.engine.listener.position = new Vector3(x, y, -2);
  }
  update(dt: number, settings: Settings, boss: boolean, paused: boolean): void {
    if (!this.engine) return;
    this.engine.volume = settings.master;
    this.mix += (Number(boss) - this.mix) * Math.min(1, dt * 1.5);
    for (const [id, sound] of this.sounds) {
      const quiet = paused ? 0.35 : 1;
      sound.volume =
        id === 'ambient'
          ? settings.music * 0.25 * quiet
          : id === 'music'
            ? settings.music * (1 - this.mix) * 0.5 * quiet
            : id === 'boss'
              ? settings.music * this.mix * 0.65 * quiet
              : settings.effects * 0.55;
    }
  }
  dispose(): void {
    for (const sound of this.sounds.values()) sound.dispose();
    this.engine?.dispose();
  }
}
