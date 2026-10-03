import { describe, expect, it } from 'vitest';
import { enemyData, enemyKinds } from '../../game-data/enemies/roster';
import { appearances } from '../../game-data/characters/appearance';
import { chunks } from '../../game-data/zones/laboratory';
import { EnemyManager, guarded, TURN_TIME } from '../../src/enemies/EnemyManager';
import type { ShotSpace } from '../../src/enemies/EnemyManager';
import { EnemyFSM, RISE } from '../../src/ai/EnemyFSM';
import { makeCombatant } from '../../src/combat/CombatSystem';
import type { ChunkData } from '../../game-data/zones/laboratory';
import { inside, roomById, worldSolids } from '../../src/world/Rooms';

/** A room holding one enemy, on the archives' floor or in the air of the well. */
const room = (kind: (typeof enemyKinds)[number], x: number, y: number): ChunkData => ({
  ...roomById('archives')!,
  enemies: [{ id: `${kind}-test`, kind, x, y }],
});
const run = (
  m: EnemyManager,
  player: ReturnType<typeof makeCombatant>,
  seconds: number,
  onHit: () => void = () => undefined,
): void => {
  for (let t = 0; t < seconds; t += 1 / 60) m.update(1 / 60, player, onHit);
};

describe('the bestiary of the depths', () => {
  it('counts ten kinds, each with a look, a lore line and a place in Act I', () => {
    expect(enemyKinds).toHaveLength(10);
    const spawned = new Set(chunks.flatMap((c) => c.enemies.map((e) => e.kind)));
    for (const kind of enemyKinds) {
      expect(appearances[kind], kind).toBeDefined();
      expect(enemyData[kind].lore.length, kind).toBeGreaterThan(20);
      expect(spawned.has(kind), kind).toBe(true);
    }
  });
  it('dives the wax moth at Eidra, once per blow, then climbs back to its height', () => {
    const m = new EnemyManager();
    m.sync([room('moth', 62, -24.4)]);
    const moth = m.entities.get('moth-test')!;
    const player = makeCombatant('eidra', 100, 64, -28.4, 0.35, 1.7);
    let hits = 0,
      lowest = moth.actor.y;
    for (let t = 0; t < 3; t += 1 / 60) {
      m.update(1 / 60, player, () => hits++);
      lowest = Math.min(lowest, moth.actor.y);
    }
    // It came down towards her, no further than its swoop allows.
    expect(lowest).toBeLessThan(-26.5);
    expect(-24.4 - lowest).toBeLessThanOrEqual(enemyData.moth.swoop + 0.01);
    expect(hits).toBeGreaterThanOrEqual(1);
    // Out of reach, it climbs back up.
    player.x = 20;
    run(m, player, 4);
    expect(moth.actor.y).toBeCloseTo(-24.4, 1);
  });
  it('turns the walled husk round slowly, and never in the middle of a blow', () => {
    const m = new EnemyManager();
    m.sync([room('husk', 62.5, -28.4)]);
    const husk = m.entities.get('husk-test')!;
    const player = makeCombatant('eidra', 100, 60, -28.4, 0.35, 1.7);
    run(m, player, 0.1);
    expect(husk.facing).toBe(-1);
    // Eidra dashes past: it keeps facing the wrong way for a moment.
    player.x = 66;
    run(m, player, TURN_TIME * 0.6);
    expect(husk.facing).toBe(-1);
    run(m, player, TURN_TIME * 0.6);
    expect(husk.facing).toBe(1);
  });
  it('lets the husk’s shell turn blows from its face, never from behind or above', () => {
    const m = new EnemyManager();
    m.sync([room('husk', 62.5, -28.4)]);
    const husk = m.entities.get('husk-test')!;
    husk.facing = -1;
    // Struck by Eidra from its left (her blow travels right): its face.
    expect(guarded(husk, 1, false)).toBe(true);
    expect(guarded(husk, -1, false)).toBe(false);
    expect(guarded(husk, 1, true)).toBe(false);
    // Reeling after its lunge, it is open.
    husk.fsm.state = 'RECOVER';
    expect(guarded(husk, 1, false)).toBe(false);
    m.sync([room('watcher', 62.5, -28.4)]);
    expect(guarded(m.entities.get('watcher-test')!, 1, false)).toBe(false);
  });
  it('keeps the gisant a still, harmless carving until Eidra comes close, then raises it', () => {
    const fsm = new EnemyFSM(enemyData.gisant);
    const board = (distance: number) => ({
      distance,
      homeDistance: 0,
      health: 55,
      stagger: 0,
    });
    for (let t = 0; t < 5; t += 1 / 60) fsm.update(1 / 60, board(8));
    expect(fsm.state).toBe('IDLE');
    expect(fsm.dormant).toBe(true);
    fsm.update(1 / 60, board(3));
    expect(fsm.state).toBe('DETECT');
    for (let t = 0; t < RISE - 0.1; t += 1 / 60) fsm.update(1 / 60, board(3));
    expect(fsm.state).toBe('DETECT');
    for (let t = 0; t < 0.2; t += 1 / 60) fsm.update(1 / 60, board(3));
    expect(fsm.state).not.toBe('DETECT');
    // Asleep, its body does not hurt: Eidra may brush past it.
    const m = new EnemyManager();
    m.sync([room('gisant', 62.5, -28.4)]);
    const player = makeCombatant('eidra', 100, 62.5, -28.4, 0.35, 1.7);
    m.entities.get('gisant-test')!.fsm.state = 'IDLE';
    let touched = 0;
    m.entities.get('gisant-test')!.actor.x = 70;
    run(m, player, 0.01, () => touched++);
    expect(touched).toBe(0);
  });
  it('holds the watching lantern in place, firing pairs of slow sparks', () => {
    const m = new EnemyManager();
    m.sync([room('lantern', 60, -22)]);
    const lantern = m.entities.get('lantern-test')!;
    const player = makeCombatant('eidra', 100, 66, -28.4, 0.35, 1.7);
    let shots = 0,
      speed = 0;
    for (let t = 0; t < 4; t += 1 / 60) {
      m.update(1 / 60, player, () => undefined);
      if (lantern.fsm.attackTriggered) shots++;
      for (const p of m.projectiles) speed = Math.max(speed, Math.hypot(p.vx, p.vy));
    }
    expect(lantern.actor.x).toBe(60);
    expect(shots).toBeGreaterThanOrEqual(enemyData.lantern.combo);
    expect(speed).toBeCloseTo(enemyData.lantern.projectileSpeed, 3);
  });
  it('sends the dust mites quick and frail: the fastest and lightest foes of the act', () => {
    const mite = enemyData.mite;
    for (const kind of enemyKinds) {
      expect(mite.speed).toBeGreaterThanOrEqual(enemyData[kind].speed);
      expect(mite.health).toBeLessThanOrEqual(enemyData[kind].health);
    }
  });
});

describe('shots stay in the room they were fired in', () => {
  const inWall = (x: number, y: number): boolean =>
    worldSolids.some((w) => Math.abs(x - w.x) < w.w / 2 && Math.abs(y - w.y) < w.h / 2);
  /** The real walls, and the rooms on screen. */
  const space = (...shown: string[]): ShotSpace => ({
    blocked: inWall,
    open: (x, y) => shown.some((id) => inside(roomById(id)!, x, y, 0.5)),
  });
  const shot = (x: number, y: number, vx: number, vy: number) => ({
    sourceId: 'lantern-1',
    x,
    y,
    vx,
    vy,
    life: 3,
    damage: 10,
  });
  const far = makeCombatant('eidra', 100, 40, 0, 0.35, 1.7);
  it('breaks a spark on the wall it flies into, never through it', () => {
    // From the trial's air towards its right wall, above the doorway.
    const m = new EnemyManager();
    m.projectiles.push(shot(22, -25.5, 6, 0));
    let furthest = 0;
    for (let t = 0; t < 2 && m.projectiles.length; t += 1 / 60) {
      m.update(1 / 60, far, () => undefined, [], false, space('dash-trial', 'elans'));
      for (const p of m.projectiles) furthest = Math.max(furthest, p.x);
    }
    expect(m.projectiles).toEqual([]);
    expect(furthest).toBeLessThan(26 - 0.6 + 0.2);
  });
  it('lets it fly out through a doorway, and fade there once its room is left behind', () => {
    const m = new EnemyManager();
    m.projectiles.push(shot(23, -28.2, 6, 0));
    for (let t = 0; t < 0.6; t += 1 / 60)
      m.update(1 / 60, far, () => undefined, [], false, space('dash-trial', 'elans'));
    expect(m.projectiles).toHaveLength(1);
    expect(m.projectiles[0]!.x).toBeGreaterThan(26);
    // Eidra has gone on into the chamber of the Élan: the trial is no longer drawn.
    m.projectiles.push(shot(20, -26, -6, 0));
    m.update(1 / 60, far, () => undefined, [], false, space('elans'));
    expect(m.projectiles.map((p) => Math.round(p.x))).toEqual([27]);
  });
  it('lets a shard fall out of a ledge it starts in, then break on the next one', () => {
    // Through the archives' stair: it starts inside a step and falls onto the floor.
    const m = new EnemyManager();
    const step = roomById('archives')!.platforms.find((p) => !p.memory && p.y < -27)!;
    m.projectiles.push(shot(step.x, step.y, 0, -9));
    const ys: number[] = [];
    for (let t = 0; t < 1 && m.projectiles.length; t += 1 / 60) {
      m.update(1 / 60, far, () => undefined, [], false, space('archives'));
      for (const p of m.projectiles) ys.push(p.y);
    }
    expect(Math.min(...ys)).toBeLessThan(step.y - step.h);
    expect(m.projectiles).toEqual([]);
    expect(Math.min(...ys)).toBeGreaterThan(-30 + 0.6 - 0.25);
  });
});
