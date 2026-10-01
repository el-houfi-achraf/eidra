import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cueFiles, patternCues, soundCues } from '../../game-data/audio/sounds';
import type { CueId } from '../../game-data/audio/sounds';
import {
  ambienceBeds,
  bossThemes,
  loopFiles,
  musicTracks,
  sectorScores,
  stingerCues,
} from '../../game-data/audio/music';
import { bossRoster } from '../../game-data/bosses/roster';
import { PatternKindSchema } from '../../game-data/bosses/schema';
import { chunks } from '../../game-data/zones/laboratory';
import { Cooldowns, VariantPicker, pitchSpread } from '../../src/audio/SoundBank';
import {
  BOSS_FADE,
  CROSSFADE,
  DEATH_FADE,
  HYSTERESIS,
  MusicDirector,
  VICTORY_SILENCE,
} from '../../src/audio/MusicDirector';
import type { Mix, MusicContext } from '../../src/audio/MusicDirector';
import { CombatCues } from '../../src/audio/CombatCues';
import { EnemyManager } from '../../src/enemies/EnemyManager';
import { makeCombatant } from '../../src/combat/CombatSystem';
import type { Hazard } from '../../game-data/zones/laboratory';

const AUDIO = 'public/audio/';
describe('audio data', () => {
  it('ships every variant of every cue, compressed and as a fallback, and nothing else', () => {
    const expected = new Set<string>();
    for (const [id, cue] of Object.entries(soundCues) as [CueId, (typeof soundCues)[CueId]][])
      for (let v = 1; v <= cue.variants; v++)
        for (const file of cueFiles(id, v)) {
          expect(existsSync(AUDIO + file), file).toBe(true);
          expected.add(file.replace('sfx/', ''));
        }
    expect(new Set(readdirSync(AUDIO + 'sfx'))).toEqual(expected);
  });
  it('ships every theme, ambience and stinger', () => {
    for (const id of Object.keys(musicTracks))
      for (const file of loopFiles('music', id)) expect(existsSync(AUDIO + file), file).toBe(true);
    for (const id of Object.keys(ambienceBeds))
      for (const file of loopFiles('ambience', id))
        expect(existsSync(AUDIO + file), file).toBe(true);
    for (const id of Object.keys(stingerCues))
      for (const file of loopFiles('stingers', id))
        expect(existsSync(AUDIO + file), file).toBe(true);
  });
  it('scores every sector of the route and gives every boss its own theme', () => {
    for (const chunk of chunks) expect(sectorScores[chunk.id], chunk.id).toBeDefined();
    const themes = bossRoster.map((b) => bossThemes[b.id]);
    expect(themes.every(Boolean)).toBe(true);
    expect(new Set(themes).size).toBe(bossRoster.length);
    // Each act has its own ground underfoot.
    expect(sectorScores.awakening!.surface).toBe('stone');
    expect(sectorScores['ember-fields']!.surface).toBe('ash');
    expect(sectorScores['denial-garden']!.surface).toBe('moss');
  });
  it('voices every boss pattern, and never stacks a cue faster than its cooldown allows', () => {
    for (const kind of PatternKindSchema.options) {
      const cue = patternCues[kind];
      expect(cue.windup ?? cue.strike, kind).toBeDefined();
      for (const id of [cue.windup, cue.strike]) if (id) expect(soundCues[id]).toBeDefined();
    }
    // Heavy impacts dip the music; footsteps and menus never do.
    expect(soundCues['boss-slam'].duck).toBeGreaterThan(0);
    expect(soundCues['step-stone'].duck).toBe(0);
    expect(soundCues['ui-move'].bus).toBe('ui');
  });
});

describe('sound variation', () => {
  it('never plays the same variant twice in a row, yet uses them all', () => {
    const picker = new VariantPicker();
    let seed = 7;
    const random = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const seen = new Set<number>();
    let last = 0;
    for (let i = 0; i < 200; i++) {
      const v = picker.pick('hit', 3, random);
      expect(v).not.toBe(last);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(3);
      seen.add(v);
      last = v;
    }
    expect(seen.size).toBe(3);
    expect(picker.pick('parry', 1)).toBe(1);
  });
  it('keeps a cue quiet until its cooldown has passed', () => {
    const c = new Cooldowns();
    expect(c.take('hit', 0, 0.04)).toBe(true);
    expect(c.take('hit', 0.02, 0.04)).toBe(false);
    expect(c.take('kill', 0.02, 0.04)).toBe(true);
    expect(c.take('hit', 0.05, 0.04)).toBe(true);
  });
  it('nudges the pitch within its spread', () => {
    for (const r of [0, 0.25, 0.5, 0.99])
      expect(Math.abs(pitchSpread(80, () => r))).toBeLessThanOrEqual(80);
    expect(pitchSpread(0, () => 0)).toBe(0);
  });
});

describe('music director', () => {
  const play = (
    d: MusicDirector,
    seconds: number,
    context: Partial<MusicContext>,
    step = 0.05,
  ): Mix => {
    let mix = d.update(0, { scene: 'playing', x: 10, boss: null, ...context });
    for (let t = 0; t < seconds; t += step)
      mix = d.update(step, { scene: 'playing', x: 10, boss: null, ...context });
    return mix;
  };
  it('plays the title theme in the menus and the region theme in the vaults', () => {
    const d = new MusicDirector();
    expect(play(d, 4, { scene: 'menu' }).music).toEqual({ title: 1 });
    const mix = play(d, 6, { x: 10 });
    expect(mix.music).toEqual({ lumerite: 1 });
    expect(mix.ambience).toEqual({ laboratory: 1 });
  });
  it('crossfades between regions, without flapping on the border', () => {
    const d = new MusicDirector();
    play(d, 6, { x: 30 });
    // Just past the border: still the vaults' theme.
    expect(play(d, 3, { x: 40 + HYSTERESIS / 2 }).music).toEqual({ lumerite: 1 });
    const mid = play(d, CROSSFADE / 2, { x: 50 });
    expect(mid.music.lumerite).toBeGreaterThan(0.2);
    expect(mid.music.mira).toBeGreaterThan(0.2);
    expect(play(d, CROSSFADE, { x: 50 }).music).toEqual({ mira: 1 });
    // The Act II rifts, then the garden: other themes, other ambiences.
    expect(play(d, 6, { x: 250 }).ambience).toEqual({ ashes: 1 });
    expect(play(d, 6, { x: 380 }).music).toEqual({ garden: 1 });
  });
  it('gives a boss fight its theme, then silence after the victory, then the region', () => {
    const d = new MusicDirector();
    play(d, 6, { x: 180 });
    expect(play(d, BOSS_FADE + 0.1, { x: 180, boss: 'faceless-guardian' }).music).toEqual({
      guardian: 1,
    });
    // The room's ambience recedes under the fight.
    expect(
      play(d, CROSSFADE, { x: 180, boss: 'faceless-guardian' }).ambience.laboratory,
    ).toBeCloseTo(0.35, 1);
    d.victory();
    expect(play(d, 2, { x: 180 }).music).toEqual({});
    const back = play(d, VICTORY_SILENCE + 6, { x: 180 });
    expect(back.music).toEqual({ machinery: 1 });
  });
  it('lets the music die with Eidra, and lowers everything while paused', () => {
    const d = new MusicDirector();
    play(d, 6, { x: 10 });
    expect(play(d, DEATH_FADE + 0.1, { scene: 'dead' }).music).toEqual({});
    expect(play(d, 1, { scene: 'paused' }).level).toBeLessThan(0.5);
  });
  it('dips under heavy impacts and recovers', () => {
    const d = new MusicDirector();
    d.duck(0.6);
    expect(play(d, 0, {}).duck).toBeCloseTo(0.6);
    expect(play(d, 1, {}).duck).toBe(0);
  });
  it('reads the ground under Eidra for her footsteps', () => {
    const d = new MusicDirector();
    expect(d.surfaceAt(10)).toBe('stone');
    expect(d.surfaceAt(260)).toBe('ash');
    expect(d.surfaceAt(390)).toBe('moss');
  });
});

describe('combat cues', () => {
  const ids = (events: { id: string }[]): string[] => events.map((e) => e.id);
  it('hears an enemy notice Eidra, wind up and strike', () => {
    const m = new EnemyManager();
    m.sync(chunks.filter((c) => c.id === 'awakening'));
    const watcher = m.entities.get('watcher-1')!;
    const player = makeCombatant('eidra', 100, watcher.actor.x - 2, watcher.actor.y);
    player.invulnerable = 99;
    const cues = new CombatCues();
    const heard: string[] = [];
    for (let i = 0; i < 300; i++) {
      m.update(1 / 60, player, () => undefined);
      heard.push(...ids(cues.update(m, [], i / 60, player)));
    }
    expect(heard).toContain('enemy-alert');
    expect(heard).toContain('enemy-windup');
    expect(heard).toContain('enemy-swing');
    expect(heard.indexOf('enemy-windup')).toBeLessThan(heard.indexOf('enemy-swing'));
  });
  it('hears a boss roar, telegraph and strike, and its signature', () => {
    const m = new EnemyManager();
    const keeper = m.encounter('keeper')!;
    const player = makeCombatant('eidra', 100, 151, 1);
    player.invulnerable = 99;
    const cues = new CombatCues();
    // Dormant first: the cues see it wake.
    cues.update(m, [], 0, player);
    keeper.director.activate();
    keeper.director.select('standard');
    const heard: { id: string; x: number }[] = [];
    for (let i = 0; i < 60 * 8; i++) {
      m.update(1 / 60, player, () => undefined);
      heard.push(...cues.update(m, [], i / 60, player));
    }
    const names = ids(heard);
    expect(names[0]).toBe('boss-roar');
    expect(names).toContain('boss-windup');
    expect(names).toContain('standard-plant');
    // The banner keeps ringing where it stands.
    const pulses = heard.filter((e) => e.id === 'standard-pulse');
    expect(pulses.length).toBeGreaterThan(1);
    expect(new Set(pulses.map((p) => p.x)).size).toBe(1);
  });
  it('hears the Guardian command and its punishment', () => {
    const m = new EnemyManager();
    const guardian = m.encounter('faceless-guardian')!;
    guardian.director.activate();
    guardian.director.phase = 2;
    guardian.actor.health = 270;
    guardian.director.select('command');
    const player = makeCombatant('eidra', 100, 180, 1);
    player.invulnerable = 99;
    const cues = new CombatCues();
    const heard: string[] = [];
    for (let i = 0; i < 60 * 8 && !heard.includes('gaze-punish'); i++) {
      m.update(1 / 60, player, () => undefined);
      if (guardian.gaze) player.x += 0.05;
      heard.push(...ids(cues.update(m, [], i / 60, player)));
    }
    expect(heard).toContain('command');
    expect(heard).toContain('gaze-punish');
  });
  it('hears the vents that burst near Eidra only', () => {
    const vent: Hazard = {
      id: 'v',
      x: 10,
      width: 1.6,
      period: 3,
      active: 1,
      offset: 0,
      damage: 18,
    };
    const far: Hazard = { ...vent, id: 'far', x: 100 };
    const cues = new CombatCues();
    const m = new EnemyManager();
    const player = { x: 12, y: 1 };
    const heard: { id: string; x: number }[] = [];
    for (let t = 0.5; t < 7; t += 0.05) heard.push(...cues.update(m, [vent, far], t, player));
    expect(heard.map((e) => e.x)).toEqual([10, 10]);
    expect(heard.every((e) => e.id === 'vent')).toBe(true);
  });
});
