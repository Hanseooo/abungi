import { expect, test, type Page } from '@playwright/test';

async function startRun(page: Page) {
  await page.addInitScript(value => { Date.now = () => value; }, 20260907);
  await page.goto('/');
  await page.getByRole('button', { name: /START NEW RUN/i }).click();
  for (const name of ['Yatords', 'Yeeho', 'Earl']) {
    await page.getByRole('button', { name: new RegExp(`Select ${name}`, 'i') }).click();
  }
  await page.getByRole('button', { name: /START WITH/i }).click();
  for (let i = 0; i < 8; i += 1) {
    const scene = page.locator('.scene-overlay');
    if (!(await scene.count())) break;
    await scene.getByRole('button', { name: /SKIP/i }).click();
  }
  await expect(page.getByRole('heading', { name: /Region 1/i })).toBeVisible();
}

// Abandoning wipes the run with no undo, so one stray tap must not be able to do it.
test('abandoning a run asks before discarding it', async ({ page }) => {
  await startRun(page);

  await page.getByRole('button', { name: /^ABANDON RUN$/i }).click();
  await expect(page.getByRole('heading', { name: /Region 1/i })).toBeVisible();

  await page.getByRole('button', { name: /KEEP PLAYING/i }).click();
  await expect(page.getByRole('button', { name: /DISCARD THIS RUN/i })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Region 1/i })).toBeVisible();

  await page.getByRole('button', { name: /^ABANDON RUN$/i }).click();
  await page.getByRole('button', { name: /DISCARD THIS RUN/i }).click();
  await expect(page.getByRole('heading', { name: 'ABUNGI' })).toBeVisible();
});
