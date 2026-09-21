import { chromium } from '@playwright/test';
import { preview } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
const server = await preview({ preview: { host: '127.0.0.1', port: 5174, strictPort: true } });
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-webgpu'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('docs/evidence', { recursive: true });
const ready = async () => {
  await page.goto('http://127.0.0.1:5174/?debug=1&renderer=webgl2');
  await page.waitForFunction(() => document.body.dataset.ready === 'true');
};
try {
  await ready();
  await page.waitForTimeout(1500);
  await page.locator('#debug-overlay').evaluate((el) => (el.style.display = 'none'));
  await page.screenshot({ path: 'docs/evidence/title.png' });
  const report = {
    browser: await browser.version(),
    renderer: 'SwiftShader / WebGL2 (software)',
    resolution: '1280 × 720',
    samples: 120,
    hardwareCertification: false,
    measurements: [],
    streaming: [],
    errors,
  };
  for (const preset of ['MEDIUM', 'LOW']) {
    if (preset === 'LOW') {
      await page.keyboard.press('Escape');
      await page.locator('#settings').click();
      await page.locator('#preset').selectOption('LOW');
      await page.locator('#back').click();
      await page.locator('#resume').click();
    } else {
      await page.locator('#new').click();
      await page.locator('#slot-0').click();
    }
    await page.waitForTimeout(3000);
    const samples = await page.evaluate(async () => {
      const values = [];
      for (let i = 0; i < 120; i++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        values.push(window.eidra.snapshot().metrics);
      }
      return values;
    });
    const stats = (key) => {
      const arr = samples
        .map((s) => s?.[key])
        .filter((n) => typeof n === 'number' && Number.isFinite(n))
        .sort((a, b) => a - b);
      return arr.length
        ? {
            median: arr[Math.floor(arr.length * 0.5)],
            p95: arr[Math.min(arr.length - 1, Math.floor(arr.length * 0.95))],
          }
        : null;
    };
    report.measurements.push({
      preset,
      cpuMs: stats('cpuMs'),
      gpuMs: stats('gpuMs'),
      frameMs: stats('frameMs'),
      drawCalls: stats('drawCalls'),
      triangles: stats('triangles'),
    });
    if (preset === 'MEDIUM') {
      await page.screenshot({ path: 'docs/evidence/awakening.png' });
    }
  }
  for (let i = 0; i < 12; i++) {
    await page.evaluate((x) => window.eidra.teleport(x), i % 2 ? 7 : 123);
    await page.waitForTimeout(300);
    const s = await page.evaluate(() => window.eidra.snapshot());
    report.streaming.push({
      x: Math.round(s.player.x),
      meshes: s.meshes,
      bodies: s.bodies,
      chunks: s.chunks.length,
    });
  }
  await page.evaluate(() => {
    window.eidra.teleport(84);
    window.eidra.unlock('remanence');
  });
  await page.keyboard.press('KeyQ');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/evidence/remanence.png' });
  await writeFile('docs/evidence/performance.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
