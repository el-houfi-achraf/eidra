import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { SaveManager, migrateSave } from '../../src/save/SaveManager';
import type { SaveData } from '../../src/save/SaveManager';
import { defaultSettings } from '../../src/config/settings';
const data: SaveData = {
  saveVersion: 2,
  slot: 1,
  savedAt: 1,
  position: { x: 10, y: 1 },
  checkpoint: 'awakening',
  abilities: ['dash'],
  health: 100,
  healthUpgrades: 0,
  collectibles: [],
  shards: 2,
  bosses: [],
  quests: [],
  discoveredAreas: ['awakening'],
  memories: [],
  flags: [],
  settings: defaultSettings(),
  playtime: 5,
};
describe('Save compatibility', () => {
  it('persists across connections with isolated slots', async () => {
    const db = 'save-test-' + crypto.randomUUID();
    const s = new SaveManager(db);
    await s.save(data);
    await s.save({ ...data, slot: 2, position: { x: 50, y: 1 } });
    await s.close();
    const reopened = new SaveManager(db);
    expect((await reopened.load())?.position.x).toBe(10);
    expect((await reopened.load(2))?.position.x).toBe(50);
    expect(await reopened.load(3)).toBeNull();
    await reopened.close();
  });
  it('migrates v1 and rejects future saves without writing them', () => {
    expect(
      migrateSave({ ...data, saveVersion: 1, flags: undefined, shards: undefined }).saveVersion,
    ).toBe(2);
    expect(() => migrateSave({ ...data, saveVersion: 999 })).toThrow();
  });
  it('rejects invalid positions instead of persisting corrupt data', async () => {
    const s = new SaveManager('invalid-' + crypto.randomUUID());
    await expect(s.save({ ...data, position: { x: NaN, y: 1 } })).rejects.toThrow();
    expect(await s.load()).toBeNull();
    await s.close();
  });
});
