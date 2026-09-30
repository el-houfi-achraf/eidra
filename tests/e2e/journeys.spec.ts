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
  // Settings are grouped in tabs; each control is reached through its tab.
  await page.locator('#reducedMotion').check();
  await page.locator('#preset').selectOption('LOW');
  await page.getByRole('tab', { name: 'Accessibilité' }).click();
  await page.locator('#assist').check();
  await page.getByRole('tab', { name: 'Commandes' }).click();
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
test('boss introduction, three phases, defeat and the opening of Act II', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.eidra!.teleport(167));
  await expect(page.locator('body')).toHaveAttribute('data-state', 'CUTSCENE');
  await skipDialogue(page);
  await expect.poll(async () => (await snapshot(page)).boss.state).not.toBe('dormant');
  await page.evaluate(() => window.eidra!.setBossHealth(200));
  await expect.poll(async () => (await snapshot(page)).boss.phase).toBe(2);
  // Each phase change is an armored roar before the wider rotation begins.
  await expect.poll(async () => (await snapshot(page)).boss.state).not.toBe('transition');
  expect((await snapshot(page)).boss.health).toBe(200);
  await page.evaluate(() => window.eidra!.setBossHealth(100));
  await expect.poll(async () => (await snapshot(page)).boss.phase).toBe(3);
  await expect.poll(async () => (await snapshot(page)).boss.state).not.toBe('transition');
  await page.screenshot({ path: 'test-results/boss.png' });
  await page.evaluate(() => window.eidra!.setBossHealth(0));
  await expect.poll(async () => (await snapshot(page)).flags).toContain('boss-defeated');
  // Mira's farewell, then the route opens onto Act II instead of ending the game.
  await page.evaluate(() => window.eidra!.teleport(198));
  await expect(page.locator('body')).toHaveAttribute('data-state', 'CUTSCENE');
  await skipDialogue(page);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'PLAYING');
  await page.evaluate(() => window.eidra!.teleport(203));
  await expect.poll(async () => (await snapshot(page)).flags).toContain('act-2');
  await expect(page.locator('#title-card')).toContainText('ACTE II');
  expect((await snapshot(page)).state).toBe('PLAYING');
});
test('Act II: the Seconde impulsion climbs higher and the ember vents burn', async ({ page }) => {
  await start(page);
  // Peak height of a held jump from the rift's near bank, with or without a second press.
  const peak = async (twice: boolean): Promise<number> => {
    await page.evaluate(() => window.eidra!.teleport(284));
    await expect.poll(async () => (await snapshot(page)).player.grounded).toBe(true);
    const floor = (await snapshot(page)).player.y;
    let top = floor,
      rising = false,
      second = false;
    await page.keyboard.down('Space');
    for (let i = 0; i < 600; i++) {
      const s = await snapshot(page);
      top = Math.max(top, s.player.y);
      if (s.player.vy > 1) rising = true;
      // At the apex, press again (and hold, or the second arc is cut short).
      if (twice && rising && !second && s.player.vy <= 0.5) {
        second = true;
        await page.keyboard.up('Space');
        await page.keyboard.down('Space');
      }
      if (rising && s.player.grounded) break;
    }
    await page.keyboard.up('Space');
    return top - floor;
  };
  const single = await peak(false);
  // The ability lies before the sealed exit of the ember fields.
  await page.evaluate(() => window.eidra!.teleport(277));
  await expect.poll(async () => (await snapshot(page)).abilities).toContain('double-jump');
  const double = await peak(true);
  expect(single).toBeLessThan(2.8);
  // The rift's high ledges rise 2.6 m and more above the previous one.
  expect(double).toBeGreaterThan(3.2);
  expect((await snapshot(page)).flags).toContain('tutorial:double');
  // Standing in a fire column costs health.
  const before = (await snapshot(page)).player.health;
  await page.evaluate(() => window.eidra!.teleport(246));
  await expect
    .poll(async () => (await snapshot(page)).player.health, { timeout: 15_000 })
    .toBeLessThan(before);
});
test('Ilyra: three phases, her fall, the epilogue and the end of the act', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.eidra!.teleport(373));
  await expect(page.locator('body')).toHaveAttribute('data-state', 'CUTSCENE');
  await skipDialogue(page);
  const ilyra = async () => (await snapshot(page)).bosses.find((b) => b.id === 'ilyra')!;
  await expect.poll(async () => (await ilyra()).state).not.toBe('dormant');
  await expect(page.locator('#title-card')).toContainText('ILYRA');
  expect((await snapshot(page)).gates).toContain('denial-right');
  await page.evaluate(() => window.eidra!.setBossHealth(300, 'ilyra'));
  await expect.poll(async () => (await ilyra()).phase).toBe(2);
  await page.evaluate(() => window.eidra!.setBossHealth(120, 'ilyra'));
  await expect.poll(async () => (await ilyra()).phase).toBe(3);
  await page.screenshot({ path: 'test-results/ilyra.png' });
  await page.evaluate(() => window.eidra!.setBossHealth(0, 'ilyra'));
  await expect.poll(async () => (await snapshot(page)).flags).toContain('defeated:ilyra');
  await expect.poll(async () => (await snapshot(page)).gates).not.toContain('denial-right');
  await page.evaluate(() => window.eidra!.teleport(409));
  await expect(page.locator('body')).toHaveAttribute('data-state', 'CUTSCENE');
  await skipDialogue(page);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ENDING');
  await expect(page.getByText('FIN DE L’ACTE II')).toBeVisible();
  // Exploring on returns Eidra to the garden, before the end of the act.
  await page.getByRole('button', { name: 'Revenir explorer →' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'PLAYING');
  expect((await snapshot(page)).player.x).toBeLessThan(408.5);
});
/** Holds a key for `ms` and returns the furthest x reached meanwhile. */
async function furthest(page: Page, key: string, ms: number): Promise<number> {
  let max = Number.NEGATIVE_INFINITY;
  await page.keyboard.down(key);
  const end = Date.now() + ms;
  while (Date.now() < end) max = Math.max(max, (await snapshot(page)).player.x);
  await page.keyboard.up(key);
  return max;
}
test('guardians bar the way until they are defeated', async ({ page }) => {
  await start(page);
  // The Keeper's chamber: crossing its threshold seals the way back.
  await page.evaluate(() => window.eidra!.teleport(146));
  expect((await snapshot(page)).gates).toContain('last-order-right');
  await page.keyboard.down('KeyD');
  await expect.poll(async () => (await snapshot(page)).gates).toContain('last-order-left');
  await page.keyboard.up('KeyD');
  await expect(page.locator('#title-card')).toContainText('LE PORTEUR DU DERNIER ORDRE');
  // Walking at the far gate does not get past it while the Keeper stands.
  await page.evaluate(() => window.eidra!.teleport(157.4));
  const keeperSide = await furthest(page, 'KeyD', 2500);
  // Pressed against the gate (capsule radius 0.33), never through it.
  expect(keeperSide).toBeGreaterThan(157.7);
  expect(keeperSide).toBeLessThan(158.4);
  await page.evaluate(() => window.eidra!.setEnemyHealth('keeper', 0));
  await expect.poll(async () => (await snapshot(page)).gates).not.toContain('last-order-right');
  expect((await snapshot(page)).gates).not.toContain('last-order-left');
  await page.keyboard.down('KeyD');
  await expect.poll(async () => (await snapshot(page)).player.x).toBeGreaterThan(159.5);
  await page.keyboard.up('KeyD');
  // The Guardian's arena: the far gate holds until it falls.
  await page.evaluate(() => window.eidra!.teleport(193.5));
  await expect(page.locator('body')).toHaveAttribute('data-state', 'CUTSCENE');
  await skipDialogue(page);
  await expect.poll(async () => (await snapshot(page)).gates).toContain('obedience-left');
  const guardianSide = await furthest(page, 'KeyD', 2500);
  expect(guardianSide).toBeGreaterThan(195);
  expect(guardianSide).toBeLessThan(195.8);
  expect((await snapshot(page)).state).toBe('PLAYING');
  await page.evaluate(() => window.eidra!.setBossHealth(0));
  await expect.poll(async () => (await snapshot(page)).gates).not.toContain('obedience-right');
});
test('a sector exit stays sealed until its guardian falls, then stays open', async ({ page }) => {
  await start(page);
  // Between the Veilleur of the awakening chamber and the chamber's exit.
  await page.evaluate(() => window.eidra!.teleport(37.5));
  expect((await snapshot(page)).gates).toContain('stage-awakening');
  await expect(page.getByText(/Passage scellé : 1 gardien du secteur/)).toBeVisible();
  // Walking into the exit does not get past it (gate at x = 39, capsule radius 0.33).
  const reached = await furthest(page, 'KeyD', 2500);
  expect(reached).toBeGreaterThan(38.2);
  expect(reached).toBeLessThan(38.8);
  await page.evaluate(() => window.eidra!.setEnemyHealth('watcher-1', 0));
  await expect.poll(async () => (await snapshot(page)).gates).not.toContain('stage-awakening');
  expect((await snapshot(page)).flags).toContain('stage:awakening');
  await expect(page.getByText('Chambre d’éveil : le passage s’ouvre.')).toBeVisible();
  await page.keyboard.down('KeyD');
  await expect.poll(async () => (await snapshot(page)).player.x).toBeGreaterThan(40.5);
  await page.keyboard.up('KeyD');
  // The cleared stage is saved: after a reload the way stays open.
  await page.evaluate(() => window.eidra!.save());
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'PLAYING');
  const after = await snapshot(page);
  expect(after.flags).toContain('stage:awakening');
  expect(after.gates).not.toContain('stage-awakening');
  // The next sector's exit is still sealed by its own guardians.
  expect(after.gates).toContain('stage-watchers');
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
  // The fixture drops Eidra slightly above the bank: wait until she has actually settled,
  // otherwise the buffered jump may expire mid-drop.
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

test('a tap throws a card at a Veilleur; holding the same input mends instead', async ({
  page,
}) => {
  await start(page);
  // Four cards orbit Eidra: enough for two throws.
  await page.evaluate(() => {
    window.eidra!.teleport(26);
    window.eidra!.setResonance(44);
  });
  await expect.poll(async () => (await snapshot(page)).player.grounded).toBe(true);
  const target = (await snapshot(page)).enemies.find((e) => e.id === 'watcher-1')!;
  expect(target.x).toBeGreaterThan(27);
  await page.keyboard.press('KeyF');
  await expect.poll(async () => (await snapshot(page)).resonance).toBe(22);
  await expect
    .poll(async () => (await snapshot(page)).enemies.find((e) => e.id === 'watcher-1')?.health)
    .toBeLessThan(target.health);
  await expect.poll(async () => (await snapshot(page)).cards).toHaveLength(0);
  // Held, the same input channels Recueillement and throws nothing.
  await page.evaluate(() => {
    window.eidra!.teleport(12);
    window.eidra!.setResonance(33);
    window.eidra!.damage(40);
  });
  await expect.poll(async () => (await snapshot(page)).player.grounded).toBe(true);
  const wounded = (await snapshot(page)).player.health;
  await page.keyboard.down('KeyF');
  await expect
    .poll(async () => (await snapshot(page)).player.health, { timeout: 20000 })
    .toBeGreaterThan(wounded);
  await page.keyboard.up('KeyF');
  const after = await snapshot(page);
  expect(after.resonance).toBe(0);
  expect(after.cards).toHaveLength(0);
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
  // Let the respawn grace run out, so the Veilleur's body could hurt Eidra.
  await expect.poll(async () => (await snapshot(page)).player.invulnerable).toBe(0);
  const watcher = (await snapshot(page)).enemies.find((e) => e.id === 'watcher-1')!;
  await page.keyboard.down('KeyS');
  await page.evaluate((x) => window.eidra!.teleport(x, 3.8), watcher.x);
  // Down + attack straight away, as a player above an enemy would: waiting for a state
  // round trip first costs frames of fall, and the drop to the Veilleur's head lasts ~0.3 s.
  await page.keyboard.press('KeyJ');
  // The strike springs Eidra back up: she climbs well above the lowest point of her drop.
  let lowest = Number.POSITIVE_INFINITY;
  await expect
    .poll(
      async () => {
        const y = (await snapshot(page)).player.y;
        lowest = Math.min(lowest, y);
        return y - lowest;
      },
      { intervals: [20], timeout: 8000 },
    )
    .toBeGreaterThan(1);
  await page.keyboard.up('KeyS');
  const after = await snapshot(page);
  expect(after.enemies.find((e) => e.id === 'watcher-1')!.health).toBeLessThan(watcher.health);
  // The plunge had priority over the body it landed on.
  expect(after.player.health).toBe(100);
});
test('contextual hints teach a control and retire once it is performed', async ({ page }) => {
  await start(page);
  const hint = page.locator('#hint');
  await expect(hint).toHaveClass(/visible/);
  await expect(hint).toContainText('Se déplacer');
  await expect(hint.locator('kbd').first()).toHaveText('A');
  await page.keyboard.down('KeyD');
  await expect.poll(async () => (await snapshot(page)).flags).toContain('tutorial:move');
  await page.keyboard.up('KeyD');
  // Jumping is taught next; performing it anywhere retires the prompt for good.
  await page.evaluate(() => window.eidra!.teleport(16));
  await expect(hint).toContainText('Sauter');
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).flags).toContain('tutorial:jump');
  // The prompt fades out (its text stays during the fade).
  await expect(hint).not.toHaveClass(/visible/);
});
interface FakePad {
  id: string;
  index: number;
  mapping: string;
  connected: boolean;
  timestamp: number;
  axes: number[];
  buttons: { pressed: boolean; touched: boolean; value: number }[];
  vibrationActuator: { effects: string[]; playEffect: (type: string) => Promise<string> };
}
type PadWindow = Window & { pad?: FakePad };
/** Plugs in a scripted controller; its buttons and axes are then set by the test. */
async function plugPad(page: Page, id: string, mapping: string, axes: number[]): Promise<void> {
  await page.evaluate(
    ([id, mapping, axes]) => {
      const pad: FakePad = {
        id,
        index: 0,
        mapping,
        connected: true,
        timestamp: 1,
        axes,
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
        vibrationActuator: {
          effects: [],
          playEffect(type: string) {
            this.effects.push(type);
            return Promise.resolve('complete');
          },
        },
      };
      (window as PadWindow).pad = pad;
      Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
      window.dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: pad }));
    },
    [id, mapping, axes] as const,
  );
}
/** Waits for two rendered frames, so the game has polled the pad at least once. */
const frames = (page: Page): Promise<void> =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
async function padButton(page: Page, index: number, pressed: boolean): Promise<void> {
  await page.evaluate(
    ([index, pressed]) => {
      const pad = (window as PadWindow).pad!;
      pad.buttons[index] = { pressed, touched: pressed, value: pressed ? 1 : 0 };
      pad.timestamp++;
    },
    [index, pressed] as const,
  );
}
/** Presses a pad button long enough for the game to see it, then releases it. */
async function padTap(page: Page, index: number): Promise<void> {
  await padButton(page, index, true);
  await frames(page);
  await padButton(page, index, false);
  await frames(page);
}
async function padAxis(page: Page, axis: number, value: number): Promise<void> {
  await page.evaluate(
    ([axis, value]) => {
      (window as PadWindow).pad!.axes[axis] = value;
    },
    [axis, value] as const,
  );
}
const focused = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el ? `${el.id}|${el.dataset.padAction ?? ''}` : '';
  });
test('a PlayStation controller drives the menus, the game and its own glyphs', async ({ page }) => {
  await page.goto('/?debug=1&renderer=webgl2');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await plugPad(
    page,
    'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)',
    'standard',
    [0, 0, 0, 0],
  );
  await expect(page.getByText('Manette connectée : DualSense Wireless Controller')).toBeVisible();
  // ✕ on « Nouvelle partie », then on the first slot: no keyboard, no mouse.
  await padTap(page, 0);
  await expect(page.locator('#slot-0')).toBeVisible();
  await expect.poll(() => focused(page)).toContain('slot-0');
  await padTap(page, 0);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'PLAYING');
  const s = await snapshot(page);
  expect(s.device).toBe('gamepad');
  expect(s.pad).toMatchObject({ family: 'playstation', profile: 'standard' });
  // The press that started the game did not also jump.
  expect(s.player.y).toBeLessThan(1.5);
  // Prompts use the pad's glyphs: the stick first, then the PlayStation buttons.
  await expect(page.locator('#hint kbd').first()).toHaveText('◀');
  const origin = (await snapshot(page)).player.x;
  await padAxis(page, 0, 1);
  await expect.poll(async () => (await snapshot(page)).player.x).toBeGreaterThan(origin + 1);
  await padAxis(page, 0, 0);
  await page.evaluate(() => window.eidra!.teleport(16));
  await expect(page.locator('#hint')).toContainText('Sauter');
  await expect(page.locator('#hint kbd').first()).toHaveText('✕');
  await padButton(page, 0, true);
  await expect.poll(async () => (await snapshot(page)).player.y).toBeGreaterThan(1.5);
  await padButton(page, 0, false);
  // Options pauses, ○ resumes.
  await padTap(page, 9);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'PAUSED');
  await expect(page.locator('.control-list')).toContainText('□');
  await padTap(page, 1);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'PLAYING');
});
test('an unmapped controller plays through its hat and is remapped with the pad alone', async ({
  page,
}) => {
  await page.goto('/?debug=1&renderer=webgl2');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  // A DirectInput pad the browser does not map: POV hat on axis 9, resting at 1.29.
  await plugPad(
    page,
    'Generic USB Joystick (Vendor: 0079 Product: 0006)',
    '',
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1.2857],
  );
  await padTap(page, 0);
  await padTap(page, 0);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'PLAYING');
  expect((await snapshot(page)).pad).toMatchObject({ family: 'generic', profile: 'generic' });
  await expect.poll(async () => (await snapshot(page)).player.grounded).toBe(true);
  const before = (await snapshot(page)).player.x;
  await padAxis(page, 9, -0.4286); // hat right
  await expect.poll(async () => (await snapshot(page)).player.x).toBeGreaterThan(before + 1);
  await padAxis(page, 9, 1.2857);
  // Start → Réglages → the Manette tab, all with the pad.
  await padTap(page, 9);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'PAUSED');
  for (let i = 0; i < 6 && !(await focused(page)).startsWith('settings|'); i++) {
    await padAxis(page, 9, 0.1429); // hat down
    await frames(page);
    await padAxis(page, 9, 1.2857);
    await frames(page);
  }
  await padTap(page, 0);
  await expect(page.locator('.settings-panel')).toBeVisible();
  for (let i = 0; i < 4; i++) await padTap(page, 5);
  await expect(page.locator('#pad-status')).toContainText('Generic USB Joystick');
  await expect(page.locator('#pad-status')).toContainText('Générique');
  // Down to the first row of bindings, then left to « Sauter ».
  const hat = async (value: number): Promise<void> => {
    await padAxis(page, 9, value);
    await frames(page);
    await padAxis(page, 9, 1.2857);
    await frames(page);
  };
  for (let i = 0; i < 8 && (await focused(page)).endsWith('|'); i++) await hat(0.1429);
  if (!(await focused(page)).endsWith('|jump')) await hat(0.7143);
  expect(await focused(page)).toContain('|jump');
  await padTap(page, 0);
  await expect(page.locator('[data-pad-action="jump"] kbd')).toHaveText('Appuyez…');
  // Button 8 of this pad now jumps.
  await padTap(page, 7);
  await expect(page.locator('[data-pad-action="jump"] kbd')).toHaveText('R2');
  expect((await snapshot(page)).settings.padBindings.jump).toBe('b7');
  // East button: back to the pause menu, then back into the game.
  await padTap(page, 1);
  await expect(page.locator('.pause-panel')).toBeVisible();
  await padTap(page, 1);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'PLAYING');
  await padButton(page, 7, true);
  await expect.poll(async () => (await snapshot(page)).player.y).toBeGreaterThan(1.5);
  await padButton(page, 7, false);
});
test('the controller rumbles on a blow, and unplugging it pauses the game', async ({ page }) => {
  await start(page);
  await plugPad(
    page,
    'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)',
    'standard',
    [0, 0, 0, 0],
  );
  await padTap(page, 2);
  expect((await snapshot(page)).device).toBe('gamepad');
  // A fall into the bridge's chasm hurts: the pad rumbles.
  await page.evaluate(() => window.eidra!.teleport(98, 3));
  await expect
    .poll(() => page.evaluate(() => (window as PadWindow).pad!.vibrationActuator.effects))
    .toContain('dual-rumble');
  await page.evaluate(() => {
    const pad = (window as PadWindow).pad!;
    pad.connected = false;
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [] });
    window.dispatchEvent(Object.assign(new Event('gamepaddisconnected'), { gamepad: pad }));
  });
  await expect(page.locator('body')).toHaveAttribute('data-state', 'PAUSED');
  await expect(page.getByText('Manette déconnectée : Xbox Wireless Controller.')).toBeVisible();
});
