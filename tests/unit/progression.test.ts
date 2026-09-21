import { describe, it, expect } from 'vitest';
import { AbilitySystem } from '../../src/abilities/AbilitySystem';
import { NarrativeManager } from '../../src/narrative/NarrativeManager';
import { QuestManager } from '../../src/quests/QuestManager';
import { Inventory } from '../../src/inventory/Inventory';
const frame = { x: 2, y: 1, facing: 1, attacking: false };
describe('Memory and progression', () => {
  it('gates abilities, drains and restores energy', () => {
    const a = new AbilitySystem();
    expect(a.toggleRemanence()).toBe(false);
    a.unlock('remanence');
    a.toggleRemanence();
    a.update(11, frame);
    expect(a.energy).toBe(0);
    expect(a.remanence).toBe(false);
    a.update(1, frame);
    expect(a.energy).toBe(11);
  });
  it('replays a bounded history independently from player movement', () => {
    const a = new AbilitySystem();
    a.unlock('memory-step');
    for (let i = 0; i < 140; i++) a.update(0.05, { ...frame, x: i });
    expect(a.createEcho()).toBe(true);
    expect(a.echo?.x).toBe(40);
    a.update(0.1, { ...frame, x: 1000 });
    expect(a.echo?.x).toBe(42);
    expect(a.createEcho()).toBe(false);
    a.update(8, frame);
    expect(a.echo).toBeNull();
  });
  it('requires every unique fundamental memory for the true ending', () => {
    const n = new NarrativeManager();
    expect(n.canEnd('SILENCE')).toBe(true);
    expect(n.canEnd('REMEMBER, THEN LET GO')).toBe(false);
    for (const id of ['kael', 'seris', 'ilyan', 'vaela', 'deren', 'noa', 'aren']) n.remember(id);
    expect(n.canEnd('REMEMBER, THEN LET GO')).toBe(true);
  });
  it('dialogue completion updates quest flags exactly once', () => {
    const n = new NarrativeManager(),
      q = new QuestManager();
    n.start('mira');
    while (n.advance()) {
      expect(n.line).not.toBe('');
    }
    expect(n.flags.has('met-mira')).toBe(true);
    expect(q.update(n.flags)).toContain('mira');
    expect(q.update(n.flags)).toEqual([]);
  });
  it('inventory rejects duplicate rewards and invalid spending', () => {
    const i = new Inventory();
    expect(i.collect('a', 2)).toBe(true);
    expect(i.collect('a', 2)).toBe(false);
    expect(i.spend(-1)).toBe(false);
    expect(i.spend(3)).toBe(false);
    expect(i.spend(2)).toBe(true);
    expect(i.shards).toBe(0);
  });
});
