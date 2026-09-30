import { describe, it, expect } from 'vitest';
import { ENRAGED_HASTE, EnemyFSM, FOLLOW_UP, STRIKE } from '../../src/ai/EnemyFSM';
import type { Blackboard } from '../../src/ai/EnemyFSM';
import { EnemyManager } from '../../src/enemies/EnemyManager';
import { makeCombatant } from '../../src/combat/CombatSystem';
import type { Hitbox } from '../../src/combat/CombatSystem';
import { MovementModel } from '../../src/player/MovementModel';
import { QuestManager } from '../../src/quests/QuestManager';
import {
  VENT_HEIGHT,
  VENT_WARNING,
  scorches,
  ventProgress,
  ventState,
} from '../../src/combat/Hazards';
import { EnemySchema, enemyData } from '../../game-data/enemies/roster';
import { moods } from '../../game-data/zones/moods';
import { chunks, landmarks, pits, route, stages } from '../../game-data/zones/laboratory';
const vents = chunks.flatMap((c) => c.hazards);
/**
 * A heavy elite, as the data may describe one: a combo, a lunge and an enrage
 * threshold (the arena guardians are bosses now, D032).
 */
const elite = EnemySchema.parse({
  id: 'elite',
  name: 'Élite',
  health: 280,
  damage: 26,
  speed: 1.9,
  range: 2.8,
  detection: 12,
  stagger: 0.1,
  windup: 0.9,
  recover: 1.3,
  drops: 14,
  ranged: false,
  scale: 1.85,
  contact: 18,
  combo: 3,
  lunge: 3.2,
  enrage: 0.5,
});
const board = (over: Partial<Blackboard> = {}): Blackboard => ({
  distance: 1,
  homeDistance: 0,
  health: 100,
  stagger: 0,
  ...over,
});
/** Steps an FSM and returns the times at which its blows land. */
function blows(fsm: EnemyFSM, b: Blackboard, seconds: number): number[] {
  const times: number[] = [];
  for (let t = 0; t < seconds; t += 0.01) {
    fsm.update(0.01, b);
    if (fsm.attackTriggered) times.push(t);
  }
  return times;
}
describe('ember vents', () => {
  const vent = vents.find((v) => v.id === 'vent-1')!;
  it('warn before they burst, burn, then rest', () => {
    expect(ventState(vent, 0.2)).toBe('burning');
    expect(ventState(vent, vent.active + 0.1)).toBe('idle');
    expect(ventState(vent, vent.period - VENT_WARNING / 2)).toBe('warning');
    expect(ventProgress(vent, vent.period - VENT_WARNING / 2)).toBeCloseTo(0.5);
    // Periodic, also before the clock's origin.
    expect(ventState(vent, 0.2 + vent.period * 7)).toBe('burning');
    expect(ventState(vent, 0.2 - vent.period)).toBe('burning');
  });
  it('only scorch a body inside a burning column', () => {
    expect(scorches(vent, 0.2, vent.x, 1, 0.4)).toBe(true);
    expect(scorches(vent, 0.2, vent.x + vent.width, 1, 0.4)).toBe(false);
    expect(scorches(vent, 0.2, vent.x, VENT_HEIGHT + 0.5, 0.4)).toBe(false);
    expect(scorches(vent, vent.active + 0.1, vent.x, 1, 0.4)).toBe(false);
  });
  it('always leave a window long enough to cross', () => {
    for (const v of vents) {
      expect(v.period - v.active, v.id).toBeGreaterThan(1.8);
      expect(v.period - v.active).toBeGreaterThan(VENT_WARNING);
    }
    // The three vents of the fields burst in turn, never all at once.
    const fields = chunks.find((c) => c.id === 'ember-fields')!.hazards;
    for (let t = 0; t < 3.2; t += 0.05)
      expect(fields.filter((v) => ventState(v, t) === 'burning').length).toBeLessThan(3);
  });
});
describe('elites and Act II enemies', () => {
  it('chain a combo whose follow-ups wind up faster', () => {
    const keeper = new EnemyFSM(elite);
    const times = blows(keeper, board({ health: 280, maxHealth: 280 }), 2.6);
    expect(times.length).toBe(elite.combo);
    const gap = times[1]! - times[0]!;
    expect(gap).toBeCloseTo(STRIKE + elite.windup * FOLLOW_UP, 1);
    expect(gap).toBeLessThan(elite.windup);
  });
  it('enrage below their threshold: one more blow, quicker windups', () => {
    const calm = new EnemyFSM(elite);
    calm.update(0.01, board({ health: 280, maxHealth: 280 }));
    expect(calm.enraged).toBe(false);
    const angry = new EnemyFSM(elite);
    angry.update(0.01, board({ health: 100, maxHealth: 280 }));
    expect(angry.enraged).toBe(true);
    expect(angry.combo).toBe(elite.combo + 1);
    expect(angry.windup).toBeCloseTo(elite.windup * ENRAGED_HASTE);
    expect(angry.pace).toBeGreaterThan(1);
    // Plain enemies never enrage.
    const crawler = new EnemyFSM(enemyData.crawler);
    crawler.update(0.01, board({ health: 1, maxHealth: 44 }));
    expect(crawler.enraged).toBe(false);
  });
  it('lose their combo when staggered', () => {
    const warden = new EnemyFSM(elite);
    const b = board({ health: 280, maxHealth: 280 });
    expect(blows(warden, b, elite.windup + 0.4)).toHaveLength(1);
    warden.update(0.01, { ...b, stagger: 0.2 });
    expect(warden.state).toBe('STAGGER');
    expect(warden.strikes).toBe(0);
  });
  it('lunge forward and reach as far as the lunge carries them', () => {
    const m = new EnemyManager();
    m.sync(chunks.filter((c) => c.id === 'cinder-gate'));
    const crawler = m.entities.get('crawler-1')!;
    const player = makeCombatant('eidra', 100, crawler.actor.x - 1.4, crawler.actor.y);
    player.invulnerable = 99;
    const start = crawler.actor.x;
    const hits: Hitbox[] = [];
    for (let i = 0; i < 90; i++) m.update(1 / 60, player, (hit) => hits.push(hit));
    expect(crawler.actor.x).toBeLessThan(start - 1);
    const blow = hits.find((h) => h.width > 2)!;
    expect(blow.width).toBeCloseTo(enemyData.crawler.range + enemyData.crawler.lunge);
  });
  it('throw a salvo of fast embers', () => {
    const m = new EnemyManager();
    m.sync(chunks.filter((c) => c.id === 'ember-fields'));
    const ember = m.entities.get('ember-1')!;
    const player = makeCombatant('eidra', 100, ember.actor.x - 6, ember.actor.y);
    let shots = 0;
    for (let i = 0; i < 180; i++) {
      m.update(1 / 60, player, () => undefined);
      if (ember.fsm.attackTriggered) shots++;
    }
    expect(shots).toBe(enemyData.ember.combo);
    expect(Math.max(...m.projectiles.map((p) => Math.abs(p.vx)))).toBeCloseTo(
      enemyData.ember.projectileSpeed,
      0,
    );
  });
});
describe('Act II route', () => {
  it('continues the world without gaps and gives every sector a mood', () => {
    for (let i = 1; i < chunks.length; i++) expect(chunks[i]!.start).toBe(chunks[i - 1]!.end);
    expect(chunks).toHaveLength(10);
    for (const chunk of chunks) expect(moods[chunk.id], chunk.id).toBeDefined();
    expect(moods.brazier!.motif).toBe('cinders');
    expect(moods['denial-garden']!.motif).toBe('garden');
  });
  it('makes the rift a Seconde impulsion crossing', () => {
    // Apex of the feet after a single jump, then with a second jump at its peak.
    const apex = (double: boolean): number => {
      const m = new MovementModel();
      const held = { axis: 0, jump: false, jumpHeld: true, dash: false, walk: false };
      m.step(1 / 60, held, true, true, double);
      let y = 0,
        top = 0,
        second = false;
      m.step(1 / 60, { ...held, jump: true }, true, true, double);
      for (let i = 0; i < 240; i++) {
        const press = double && !second && m.vy <= 0;
        if (press) second = true;
        m.step(1 / 60, { ...held, jump: press }, false, true, double);
        y += m.vy / 60;
        top = Math.max(top, y);
      }
      return top;
    };
    const single = apex(false),
      twice = apex(true);
    expect(twice).toBeGreaterThan(single * 1.8);
    const rift = chunks.find((c) => c.id === 'rift')!;
    const tops = rift.platforms.map((p) => p.y + p.h / 2);
    let climbs = 0;
    for (let i = 1; i < tops.length; i++) {
      const rise = tops[i]! - tops[i - 1]!;
      expect(rise).toBeLessThan(twice - 0.5);
      if (rise > single) climbs++;
    }
    expect(climbs).toBeGreaterThanOrEqual(2);
    // The ability lies before the sealed exit of the fields, the rift after it.
    const ability = landmarks.find((l) => l.id === 'double-jump')!;
    const fields = stages.find((s) => s.id === 'ember-fields')!;
    expect(ability.x).toBeLessThan(fields.gate);
    expect(rift.start).toBeGreaterThan(fields.gate);
    // Falling returns Eidra to the near bank.
    const pit = pits.find((p) => p.from > rift.start)!;
    expect(pit.safe).toBeLessThan(pit.from);
    expect(pit.safe).toBeGreaterThan(rift.start);
  });
  it('leads the main quest from the Guardian to Ilyra', () => {
    const q = new QuestManager();
    const flags = new Set(['boss-defeated', 'defeated:faceless-guardian']);
    q.update(flags);
    flags.add('slice-complete');
    q.update(flags);
    expect(q.objective(flags)).toBe('Traverser les Failles de cendre');
    flags.add('defeated:cinder-warden');
    expect(q.update(flags)).toContain('cinders');
    expect(q.objective(flags)).toBe('Trouver Ilyra au Jardin du déni');
    flags.add('defeated:ilyra');
    expect(q.update(flags)).toContain('ilyra');
    expect(route.finale.boss).toBe('ilyra');
    expect(route.finale.returnX).toBeLessThan(route.finale.x);
  });
});
