import { test, expect } from '@playwright/test';
test('boots Babylon with WebGL2 fallback without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?renderer=webgl2&debug=1');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#debug-overlay')).toContainText('WebGL2');
  expect(errors).toEqual([]);
});
