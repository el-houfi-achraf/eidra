import { describe, expect, it } from 'vitest';
import { chunks } from '../../game-data/zones/laboratory';
import { EnemyManager } from '../../src/enemies/EnemyManager';
import { makeCombatant } from '../../src/combat/CombatSystem';

describe('enemy traversal and streaming', () => {
  it('keeps the bridge watcher on its solid bank during chase and knockback', () => {
    const manager = new EnemyManager();
    manager.sync([chunks[2]!]);
    const player = makeCombatant('eidra', 100, 104, 1);
    const watcher = manager.entities.get('watcher-2')!;
    for (let i = 0; i < 600; i++) manager.update(1 / 60, player, () => undefined);
    expect(watcher.actor.x).toBe(108.5);
    watcher.actor.knockback = -40;
    manager.update(1 / 60, player, () => undefined);
    expect(watcher.actor.x).toBe(108.5);
    manager.sync([chunks[0]!]);
    expect(manager.entities.has('watcher-2')).toBe(false);
  });
});
