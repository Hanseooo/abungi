import { expect, test } from '@playwright/test';

// A modal that leaves focus behind it is unusable by keyboard: Tab walks the page underneath.
// The overlay is shared by Settings, the Guide and every detail panel, so one check covers all three.
test.describe('global overlay focus', () => {
  test('takes focus, keeps Tab inside itself, and hands focus back on close', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'ABUNGI' })).toBeVisible();

    const trigger = page.getByRole('button', { name: /SETTINGS/i }).first();
    await trigger.click();
    const overlay = page.locator('.global-overlay');
    await expect(overlay).toBeVisible();

    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('.global-overlay')))
      .toBe(true);

    // Ten tabs is more than the overlay holds. Tabbing past the last control hands focus to the
    // browser's own chrome, which reads back as <body>; the bug is focus landing on a page control
    // BEHIND the overlay, so that is what this rejects.
    for (let i = 0; i < 10; i += 1) {
      await page.keyboard.press('Tab');
      const leaked = await page.evaluate(() => {
        const active = document.activeElement;
        if (!active || active === document.body) return null;
        return active.closest('.global-overlay') ? null : active.tagName + '.' + active.className;
      });
      expect(leaked, `Tab ${i + 1} escaped the overlay`).toBeNull();
    }

    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
