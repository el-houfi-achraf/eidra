import { describe, expect, it } from 'vitest';
import {
  arenas,
  checkpoints,
  chunks,
  gates,
  progressGates,
  stageGate,
  stages,
} from '../../game-data/zones/laboratory';
import { EnemyManager } from '../../src/enemies/EnemyManager';
import { HYSTERESIS, StageProgress, stageFlag } from '../../src/quests/StageProgress';
import { makeCombatant } from '../../src/combat/CombatSystem';

describe('laboratory stages', () => {
  it('seal each sector behind its own guardians, in order along the route', () => {
    const manager = new EnemyManager();
    manager.sync(chunks);
    let previous = Number.NEGATIVE_INFINITY;
    for (const stage of stages) {
      const chunk = chunks.find((c) => c.id === stage.id)!;
      expect(chunk, stage.id).toBeDefined();
      const spawns = chunk.enemies.map((e) => e.id);
      for (const id of stage.guardians) {
        expect(spawns, `${stage.id} guardian ${id}`).toContain(id);
        // Guardians live on the stage's side of its exit.
        expect(manager.entities.get(id)!.actor.x).toBeLessThan(stage.gate);
      }
      // Every enemy of a sector guards it: none can be walked past.
      expect([...stage.guardians].sort()).toEqual([...spawns].sort());
      expect(stage.gate).toBeGreaterThan(previous);
      expect(stage.gate).toBeGreaterThanOrEqual(chunk.start);
      // Inside its own sector, so the next sector's title only shows once through.
      expect(stage.gate).toBeLessThan(chunk.end);
      previous = stage.gate;
    }
    // Stages and arenas alternate along the route: no sealed exit lies inside an arena,
    // and every arena is reached through at least one cleared stage.
    for (const arena of arenas) {
      expect(
        stages.some((s) => s.gate > arena.left && s.gate < arena.right),
        arena.id,
      ).toBe(false);
      expect(
        stages.some((s) => s.gate < arena.left),
        arena.id,
      ).toBe(true);
    }
  });
  it('covers every sector that has enemies but no arena of its own', () => {
    const guarded = new Set(arenas.map((a) => a.guardian));
    for (const chunk of chunks) {
      const loose = chunk.enemies.filter((e) => !guarded.has(e.id));
      if (loose.length)
        expect(
          stages.some((s) => s.id === chunk.id),
          chunk.id,
        ).toBe(true);
    }
  });
  it('stands every stage gate on solid floor, clear of anchors', () => {
    const solids = chunks.flatMap((c) => c.platforms.filter((p) => !p.memory));
    for (const stage of stages) {
      expect(
        solids.some((p) => Math.abs(p.x - stage.gate) < p.w / 2 && p.y + p.h / 2 <= 0.05),
      ).toBe(true);
      for (const anchor of checkpoints)
        expect(Math.abs(anchor.x - stage.gate), `${stage.id} / ${anchor.id}`).toBeGreaterThan(
          HYSTERESIS,
        );
    }
    for (const stage of stages) {
      expect(gates.some((g) => g.id === stageGate(stage.id) && g.x === stage.gate)).toBe(true);
      expect(progressGates.has(stageGate(stage.id))).toBe(true);
    }
    for (const arena of arenas) {
      expect(progressGates.has(`${arena.id}-right`)).toBe(true);
      // The gate that seals the way back is not a progress gate: it closes from both sides.
      expect(progressGates.has(`${arena.id}-left`)).toBe(false);
    }
  });
});

describe('stage progress', () => {
  it('opens a stage once all its guardians fall, and remembers it in the saved flags', () => {
    const progress = new StageProgress();
    const flags = new Set<string>();
    const down = new Set<string>();
    const gallery = stages.find((s) => s.id === 'watchers')!;
    expect(progress.sealed(flags)).toHaveLength(stages.length);
    down.add(gallery.guardians[0]!);
    expect(progress.clear(flags, (id) => down.has(id))).toEqual([]);
    expect(progress.remaining(gallery, (id) => down.has(id))).toBe(gallery.guardians.length - 1);
    for (const id of gallery.guardians) down.add(id);
    expect(progress.clear(flags, (id) => down.has(id))).toEqual([gallery]);
    expect(flags.has(stageFlag('watchers'))).toBe(true);
    // Announced once; enemies returning after a death do not close it again.
    expect(progress.clear(flags, (id) => down.has(id))).toEqual([]);
    down.clear();
    expect(progress.sealed(flags).map((s) => s.id)).not.toContain('watchers');
  });
  it('bars the way only from the side a player has not crossed yet', () => {
    const progress = new StageProgress();
    const gate = [{ id: 'stage-test', x: 40 }];
    progress.locate(30, gate);
    expect(progress.beyond('stage-test')).toBe(false);
    // Pressed against the gate: still on the barred side.
    progress.locate(39.5, gate);
    expect(progress.beyond('stage-test')).toBe(false);
    progress.locate(40.8, gate);
    expect(progress.beyond('stage-test')).toBe(false);
    // Starting beyond (an older save or a respawn) keeps the way back open...
    progress.reset();
    progress.locate(50, gate);
    expect(progress.beyond('stage-test')).toBe(true);
    progress.locate(39, gate);
    expect(progress.beyond('stage-test')).toBe(true);
    // ...until the player has clearly walked back into the stage.
    progress.locate(37, gate);
    expect(progress.beyond('stage-test')).toBe(false);
  });
});

describe('guardians behind a sealed exit', () => {
  it('keeps a chasing guardian on its side of the stage gate', () => {
    const manager = new EnemyManager();
    const gallery = chunks.find((c) => c.id === 'watchers')!;
    manager.sync([gallery]);
    const stage = stages.find((s) => s.id === 'watchers')!;
    const sentinel = manager.entities.get('sentinel-1')!;
    const player = makeCombatant('eidra', 100, stage.gate + 2, 1);
    player.invulnerable = 99;
    for (let i = 0; i < 900; i++) manager.update(1 / 60, player, () => undefined, [stage.gate]);
    expect(sentinel.actor.x + sentinel.actor.radius).toBeLessThan(stage.gate);
  });
});
