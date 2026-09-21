import { it, expect } from 'vitest';
import { SceneManager } from '../../src/world/SceneManager';
it('unloads obsolete chunks and keeps bounded resources across repeated travel', () => {
  let live = 0;
  const manager = new SceneManager(() => {
    live++;
    return {
      dispose: () => {
        live--;
      },
      setMemory: () => undefined,
    };
  });
  for (let i = 0; i < 100; i++) {
    manager.update(i % 2 ? 180 : 5, false);
    expect(live).toBeLessThanOrEqual(3);
  }
  manager.dispose();
  expect(live).toBe(0);
});
