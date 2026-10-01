import { bossThemes, sectorScores } from '../../game-data/audio/music';
import type { AmbienceId, Surface, TrackId } from '../../game-data/audio/music';
import { chunks } from '../../game-data/zones/laboratory';
/** What the game is showing, as far as the score is concerned. */
export type AudioScene = 'menu' | 'playing' | 'paused' | 'dead' | 'ending';
export interface MusicContext {
  scene: AudioScene;
  /** Eidra's position along the route. */
  x: number;
  /** Boss being fought, if any. */
  boss: string | null;
}
export interface Mix {
  /** Gain of each audible music track, 0..1. */
  music: Partial<Record<TrackId, number>>;
  ambience: Partial<Record<AmbienceId, number>>;
  /** 0..1 dip of the music under heavy impacts. */
  duck: number;
  /** 0..1 overall level of music and ambience (lowered while paused). */
  level: number;
}
/** Seconds to cross from one region's theme to the next. */
export const CROSSFADE = 2.5;
/** Seconds for a boss theme to take over when the fight starts. */
export const BOSS_FADE = 1.2;
/** After a victory the arena stays silent, then the region's theme returns. */
export const VICTORY_SILENCE = 6;
export const RETURN_FADE = 4;
/** Seconds for the music to die away when Eidra falls. */
export const DEATH_FADE = 0.8;
/** Metres past a sector's border before its theme gives way (no flapping on the line). */
export const HYSTERESIS = 2;
const sectors = chunks.map((c) => ({ id: c.id, start: c.start, end: c.end }));
/**
 * Decides which music and ambience play and how loud, from where Eidra is and what
 * is happening: a theme per region crossfaded at the borders, the boss's theme
 * during a fight, silence after a victory (the region's theme then returns
 * slowly), a fade on death, quieter loops while paused, and short dips under the
 * heaviest blows. Pure logic: the audio manager applies the mix.
 */
export class MusicDirector {
  private gains = new Map<TrackId, number>();
  private beds = new Map<AmbienceId, number>();
  private sector: (typeof sectors)[number] | null = null;
  private silence = 0;
  private dip = 0;
  /** Sector Eidra is in, held for a few metres past its borders. */
  sectorAt(x: number): string {
    const current = this.sector;
    if (current && x >= current.start - HYSTERESIS && x <= current.end + HYSTERESIS)
      return current.id;
    this.sector = sectors.find((s) => x >= s.start && x < s.end) ?? sectors.at(x < 0 ? 0 : -1)!;
    return this.sector.id;
  }
  /** Ground under Eidra's feet, for her footsteps. */
  surfaceAt(x: number): Surface {
    return sectorScores[this.sectorAt(x)]?.surface ?? 'stone';
  }
  /** A boss fell: silence, then the region's theme. */
  victory(): void {
    this.silence = VICTORY_SILENCE;
  }
  /** A theme chosen on the title screen (soundtrack page, chapter preview). */
  private listening: TrackId | null = null;
  /** Plays a theme of the score instead of the title theme while the menus show. */
  listen(id: TrackId | null): void {
    this.listening = id;
  }
  get chosen(): TrackId | null {
    return this.listening;
  }
  /** Ducks the music by `amount` (0..1), recovering over a moment. */
  duck(amount: number): void {
    this.dip = Math.max(this.dip, Math.min(1, amount));
  }
  update(dt: number, context: MusicContext): Mix {
    const score = sectorScores[this.sectorAt(context.x)];
    const theme = context.boss ? bossThemes[context.boss] : undefined;
    if (!context.boss) this.silence = Math.max(0, this.silence - dt);
    let target: TrackId | null = null;
    let fadeIn = CROSSFADE,
      fadeOut = CROSSFADE;
    // A theme chosen in the menus lasts as long as the menus do.
    if (context.scene !== 'menu') this.listening = null;
    if (context.scene === 'menu') target = this.listening ?? 'title';
    else if (context.scene === 'ending') target = 'title';
    else if (context.scene === 'dead') fadeOut = DEATH_FADE;
    else if (theme) {
      target = theme;
      fadeIn = fadeOut = BOSS_FADE;
    } else if (this.silence > 0) fadeOut = 1;
    else {
      target = score?.music ?? null;
      fadeIn =
        this.gains.size === 0 || [...this.gains.values()].every((g) => g < 0.01)
          ? RETURN_FADE
          : CROSSFADE;
    }
    for (const id of new Set<TrackId>([...this.gains.keys(), ...(target ? [target] : [])])) {
      const gain = this.gains.get(id) ?? 0;
      const goal = id === target ? 1 : 0;
      const step = dt / (goal > gain ? fadeIn : fadeOut);
      const next = goal > gain ? Math.min(goal, gain + step) : Math.max(goal, gain - step);
      if (next <= 0) this.gains.delete(id);
      else this.gains.set(id, next);
    }
    // Ambience: the region's bed, softer under a boss theme, gone in menus.
    const bed =
      context.scene === 'menu' || context.scene === 'ending' ? null : (score?.ambience ?? null);
    const bedLevel = theme ? 0.35 : context.scene === 'dead' ? 0.5 : 1;
    for (const id of new Set<AmbienceId>([...this.beds.keys(), ...(bed ? [bed] : [])])) {
      const gain = this.beds.get(id) ?? 0;
      const goal = id === bed ? bedLevel : 0;
      const step = dt / CROSSFADE;
      const next = goal > gain ? Math.min(goal, gain + step) : Math.max(goal, gain - step);
      if (next <= 0) this.beds.delete(id);
      else this.beds.set(id, next);
    }
    const duck = this.dip;
    this.dip = Math.max(0, this.dip - dt / 0.7);
    return {
      music: Object.fromEntries(this.gains),
      ambience: Object.fromEntries(this.beds),
      duck,
      level: context.scene === 'paused' ? 0.4 : 1,
    };
  }
  reset(): void {
    this.gains.clear();
    this.beds.clear();
    this.silence = 0;
    this.dip = 0;
  }
}
