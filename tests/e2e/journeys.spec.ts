import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { DebugSnapshot } from '../../src/debug/types';
const snapshot = (page: Page): Promise<DebugSnapshot> =>
  page.evaluate(() => window.eidra!.snapshot());
async function start(page: Page): Promise<void> {
  await page.goto('/?debug=1&renderer=webgl2');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Nouvelle partie' }).click();
  await page.locator('#slot-0').click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'PLAYING');
  await expect.poll(async () => (await snapshot(page)).player.grounded).toBe(true);
}
async function hold(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}
async function skipDialogue(page: Page): Promise<void> {
  // Lines are typed out: the first press completes a line, the next one advances.
  for (let i = 0; i < 12; i++) {
    if ((await snapshot(page)).state !== 'CUTSCENE') break;
    await page.locator('#advance').click();
    await page.waitForTimeout(80);
  }
}
test('new game: capsule movement, buffered jump, ability pickup and attack damage', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page);
  const before = (await snapshot(page)).player.x;
  // Hold until the simulation has advanced, independent of the renderer's frame rate.
  await page.keyboard.down('KeyD');
  await expect.poll(async () => (await snapshot(page)).player.x).toBeGreaterThan(before + 1);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('Space');
  await expect.poll(async () => (await snapshot(page)).player.y).toBeGreaterThan(1.5);
  await page.keyboard.up('Space');
  await page.evaluate(() => window.eidra!.teleport(17));
  await hold(page, 'KeyD', 300);
  await expect.poll(async () => (await snapshot(page)).abilities).toContain('dash');
  await hold(page, 'ShiftLeft', 70);
  await expect.poll(async () => (await snapshot(page)).player.x).toBeGreaterThan(18);
  await page.evaluate(() => window.eidra!.teleport(31));
  await page.keyboard.down('KeyD');
  await expect
    .poll(
      async () => {
        const s = await snapshot(page);
        return Math.abs(s.player.x - (s.enemies.find((e) => e.id === 'watcher-1')?.x ?? 100));
      },
      { intervals: [30] },
    )
    .toBeLessThan(1.8);
  await page.keyboard.up('KeyD');
  const enemy = (await snapshot(page)).enemies.find((e) => e.id === 'watcher-1')!;
  await page.keyboard.press('KeyJ', { delay: 80 });
  await expect
    .poll(async () => (await snapshot(page)).enemies.find((e) => e.id === 'watcher-1')?.health ?? 0)
    .toBeLessThan(enemy.health);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/combat.png' });
});
test('checkpoint persists with IndexedDB through refresh and continue', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.eidra!.teleport(73));
  await page.waitForTimeout(250);
  await page.keyboard.press('KeyE');
  await expect.poll(async () => (await snapshot(page)).checkpoint).toBe('mira');
  await page.evaluate(() => window.eidra!.save());
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).checkpoint).toBe('mira');
  expect((await snapshot(page)).player.x).toBeCloseTo(73, 0);
});
test('settings, remapping and keyboard without a gamepad survive reload', async ({ page }) => {
  await page.goto('/?debug=1');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await page.locator('#reducedMotion').check();
  await page.locator('#assist').check();
  await page.locator('#preset').selectOption('LOW');
  await page.locator('[data-action="attack"]').click();
  await page.keyboard.press('KeyF');
  await page.locator('#back').click();
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const s = await snapshot(page);
  expect(s.settings.reducedMotion).toBe(true);
  expect(s.settings.assist).toBe(true);
  expect(s.settings.preset).toBe('LOW');
  expect(s.settings.bindings.attack).toBe('KeyF');
  expect(s.gamepad).toBe(false);
  expect(s.renderer).toBe('WebGL2');
});
test('memory bridge creates collision and echo holds the counterweight gate', async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    window.eidra!.teleport(84);
    window.eidra!.unlock('remanence');
    window.eidra!.unlock('memory-step');
  });
  await page.waitForTimeout(200);
  const before = (await snapshot(page)).bodies;
  await page.keyboard.press('KeyQ');
  await expect.poll(async () => (await snapshot(page)).remanence).toBe(true);
  expect((await snapshot(page)).bodies).toBeGreaterThan(before);
  await page.evaluate(() => window.eidra!.teleport(130));
  await page.waitForTimeout(5200);
  await page.keyboard.press('KeyR');
  await expect.poll(async () => (await snapshot(page)).echo).not.toBeNull();
  // Walk through the gate while the Echo holds the seal; polling keeps this frame-rate independent.
  await page.keyboard.down('KeyD');
  await expect.poll(async () => (await snapshot(page)).flags).toContain('echo-gate-open');
  await page.keyboard.up('KeyD');
  await page.evaluate(() => window.eidra!.teleport(123));
  await page.waitForTimeout(250);
  await page.keyboard.press('KeyE');
  await expect.poll(async () => (await snapshot(page)).player.x).toBeLessThan(30);
  await expect.poll(async () => (await snapshot(page)).chunks).toContain('awakening');
});
test('streaming unloads old sectors and death returns to the checkpoint', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.eidra!.teleport(73));
  await page.waitForTimeout(250);
  await page.keyboard.press('KeyE');
  await expect.poll(async () => (await snapshot(page)).checkpoint).toBe('mira');
  await page.evaluate(() => window.eidra!.teleport(125));
  await expect.poll(async () => (await snapshot(page)).chunks.includes('awakening')).toBe(false);
  expect((await snapshot(page)).chunks.length).toBeLessThanOrEqual(3);
  await page.evaluate(() => window.eidra!.damage(999));
  await expect(page.locator('body')).toHaveAttribute('data-state', 'GAME_OVER');
  await page.getByRole('button', { name: 'Se reconstituer' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'PLAYING');
  const s = await snapshot(page);
  expect(s.player.health).toBe(100);
  expect(s.player.x).toBeCloseTo(73, 0);
});
test('boss introduction, phase two, defeat and prelude conclusion', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.eidra!.teleport(167));
  await expect(page.locator('body')).toHaveAttribute('data-state', 'CUTSCENE');
  await skipDialogue(page);
  await expect.poll(async () => (await snapshot(page)).boss.state).not.toBe('dormant');
  await page.evaluate(() => window.eidra!.setBossHealth(150));
  await expect.poll(async () => (await snapshot(page)).boss.phase).toBe(2);
  // The phase change is an armored roar before the second rotation begins.
  await expect.poll(async () => (await snapshot(page)).boss.state).not.toBe('transition');
  expect((await snapshot(page)).boss.health).toBe(150);
  await page.screenshot({ path: 'test-results/boss.png' });
  await page.evaluate(() => window.eidra!.setBossHealth(0));
  await expect.poll(async () => (await snapshot(page)).flags).toContain('boss-defeated');
  await page.evaluate(() => window.eidra!.teleport(196));
  await expect(page.locator('body')).toHaveAttribute('data-state', 'CUTSCENE');
  await skipDialogue(page);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ENDING');
  await expect(page.getByText('FIN DU PRÉLUDE')).toBeVisible();
});
test('standard gamepad API controls the player while keyboard stays available', async ({
  page,
}) => {
  await start(page);
  const before = (await snapshot(page)).player.x;
  await page.evaluate(() => {
    const pad = {
      connected: true,
      axes: [1, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      mapping: 'standard',
      id: 'E2E standard pad',
      index: 0,
      timestamp: 1,
    };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  });
  await expect.poll(async () => (await snapshot(page)).gamepad).toBe(true);
  await expect.poll(async () => (await snapshot(page)).player.x).toBeGreaterThan(before + 1);
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [] }),
  );
  await page.keyboard.down('Space');
  await expect.poll(async () => (await snapshot(page)).player.y).toBeGreaterThan(1.5);
  await page.keyboard.up('Space');
});

test('crosses the memory bridge using jumps and dash without losing health', async ({ page }) => {
  await start(page);
  // Position the fixture at the start of the challenge; all traversal uses real input.
  await page.evaluate(() => {
    window.eidra!.teleport(86);
    window.eidra!.unlock('remanence');
    window.eidra!.unlock('dash');
  });
  // The grounded flag can still describe the pre-teleport frame; wait until Eidra has
  // actually settled on the bank, otherwise the buffered jump may expire mid-drop.
  await expect
    .poll(async () => {
      const s = await snapshot(page);
      return s.player.grounded && s.player.y < 1.05;
    })
    .toBe(true);
  await page.keyboard.press('KeyQ');
  for (const target of [91, 98, 105, 110]) {
    const origin = (await snapshot(page)).player.x;
    await page.keyboard.down('Space');
    await page.keyboard.down('KeyD');
    if (target - origin > 5.5) {
      await expect
        .poll(async () => (await snapshot(page)).player.x, { intervals: [30] })
        .toBeGreaterThan(origin + 1.8);
      await page.keyboard.press('ShiftLeft');
    }
    await expect
      .poll(async () => (await snapshot(page)).player.x, { intervals: [30] })
      .toBeGreaterThan(target - 0.5);
    await page.keyboard.up('KeyD');
    await expect
      .poll(async () => (await snapshot(page)).player.grounded, { intervals: [30] })
      .toBe(true);
    await page.keyboard.up('Space');
    expect((await snapshot(page)).player.x).toBeGreaterThan(target - 1);
  }
  expect((await snapshot(page)).player.health).toBe(100);
  expect((await snapshot(page)).remanence).toBe(true);
});

test('Recueillement: resonance earned by real strikes mends Eidra', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.eidra!.teleport(32.3));
  // Three blows are needed to fell the first Veilleur, each one feeding resonance.
  await expect
    .poll(
      async () => {
        await page.keyboard.press('KeyJ', { delay: 40 });
        return (await snapshot(page)).resonance;
      },
      { timeout: 30000, intervals: [120] },
    )
    .toBeGreaterThanOrEqual(33);
  await page.evaluate(() => {
    window.eidra!.teleport(12);
    window.eidra!.damage(45);
  });
  await expect.poll(async () => (await snapshot(page)).player.grounded).toBe(true);
  const wounded = (await snapshot(page)).player.health;
  expect(wounded).toBeLessThan(100);
  await page.keyboard.down('KeyF');
  await expect
    .poll(async () => (await snapshot(page)).player.health, { timeout: 20000 })
    .toBeGreaterThan(wounded);
  await page.keyboard.up('KeyF');
  expect((await snapshot(page)).resonance).toBeLessThan(33);
});

test('anchor altar trades shards for vitality that survives a reload', async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    window.eidra!.addShards(12);
    window.eidra!.teleport(7);
  });
  await page.waitForTimeout(250);
  await page.keyboard.press('KeyE');
  await expect(page.getByText('AUTEL DE L’ANCRAGE')).toBeVisible();
  await page.getByRole('button', { name: /Offrir 10 éclats/ }).click();
  await expect.poll(async () => (await snapshot(page)).player.maxHealth).toBe(120);
  expect((await snapshot(page)).shards).toBe(2);
  await expect(page.getByRole('button', { name: /Offrir 20 éclats/ })).toBeDisabled();
  await page.getByRole('button', { name: /Reprendre le voyage/ }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'PLAYING');
  await page.evaluate(() => window.eidra!.save());
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'PLAYING');
  const s = await snapshot(page);
  expect(s.healthUpgrades).toBe(1);
  expect(s.player.maxHealth).toBe(120);
});

test('a downward strike bounces off a Veilleur', async ({ page }) => {
  await start(page);
  // Stay beyond detection range so the Veilleur is idle when Eidra drops onto it.
  await page.evaluate(() => window.eidra!.teleport(20));
  await expect
    .poll(async () => (await snapshot(page)).enemies.find((e) => e.id === 'watcher-1')?.state)
    .toMatch(/IDLE|PATROL/);
  const watcher = (await snapshot(page)).enemies.find((e) => e.id === 'watcher-1')!;
  await page.keyboard.down('KeyS');
  await page.evaluate((x) => window.eidra!.teleport(x, 3.8), watcher.x);
  // Strike once the controller reports the fall, as a player would after a jump.
  await expect
    .poll(async () => (await snapshot(page)).player.grounded, { intervals: [10] })
    .toBe(false);
  await page.keyboard.press('KeyJ');
  await expect
    .poll(async () => (await snapshot(page)).player.y, { intervals: [20], timeout: 8000 })
    .toBeGreaterThan(4.2);
  await page.keyboard.up('KeyS');
  const after = (await snapshot(page)).enemies.find((e) => e.id === 'watcher-1')!;
  expect(after.health).toBeLessThan(watcher.health);
});
