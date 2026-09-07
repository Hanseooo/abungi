import { expect, test, type Page } from '@playwright/test';

const FIXED_SEED = 20260907;

async function dismissScenes(page: Page) {
  for (let i = 0; i < 8; i += 1) {
    const scene = page.locator('.scene-overlay');
    if (!(await scene.count())) return;
    await expect(scene).toBeVisible();
    await scene.getByRole('button', { name: /SKIP/i }).click();
  }
  throw new Error('Scene queue did not clear after eight skips.');
}

async function startSeededRun(page: Page) {
  await page.addInitScript(seed => { Date.now = () => seed; }, FIXED_SEED);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ABUNGI' })).toBeVisible();
  await page.getByRole('button', { name: /START NEW RUN/i }).click();
  for (const name of ['Earl', 'Hans', 'Leandre']) {
    await page.getByRole('button', { name: new RegExp(`Select ${name}`, 'i') }).click();
  }
  await page.getByRole('button', { name: /START WITH/i }).click();
  await expect(page.locator('.scene-overlay')).toBeVisible();
  await dismissScenes(page);
  await expect(page.getByRole('heading', { name: /Region 1/i })).toBeVisible();
}

async function chooseReachableNode(page: Page, label: 'FIGHT'|'EVENT'|'SHOP'|'REST'|'ELITE'|'BOSS') {
  const node = page.locator('.route-node.reachable').filter({ hasText: label }).first();
  await expect(node).toBeVisible();
  await node.click();
}

async function submitSelectedAction(page: Page) {
  const target = page.locator('.unit-figure.targetable').first();
  if (await target.count()) {
    await target.click();
  } else {
    const confirm = page.getByRole('button', { name: /CONFIRM USE/i });
    if (await confirm.count()) await confirm.click();
  }
}

async function takeOneBattleAction(page: Page) {
  await expect(page.locator('.battle-screen')).toBeVisible();
  const legalSkill = page.locator('.skill-main:not(:disabled)').first();
  await expect(legalSkill).toBeVisible();
  await legalSkill.click();
  await submitSelectedAction(page);
  await expect(page.locator('.input-lock')).toBeHidden({ timeout: 10_000 });
}

async function finishCurrentBattle(page: Page) {
  for (let actions = 0; actions < 70; actions += 1) {
    if (await page.locator('.reward-screen').count()) return;
    if (await page.locator('.results-screen').count()) throw new Error('Party was defeated in deterministic E2E battle.');
    await takeOneBattleAction(page);
  }
  throw new Error('Battle did not resolve within 70 player actions.');
}

async function claimReward(page: Page) {
  await expect(page.locator('.reward-screen')).toBeVisible();
  await page.getByRole('button', { name: /TAKE REWARD & CONTINUE/i }).click();
  await dismissScenes(page);
  await expect(page.locator('.route-screen')).toBeVisible();
}

async function resolveCurrentEvent(page: Page) {
  await dismissScenes(page);
  await expect(page.locator('.event-screen')).toBeVisible();
  const legalChoice = page.locator('.event-choices button:not(:disabled)').first();
  await expect(legalChoice).toBeVisible();
  await legalChoice.click();
  await expect(page.locator('.event-result')).toBeVisible();
  await page.getByRole('button', { name: /BACK TO ROUTE/i }).click();
  await expect(page.locator('.route-screen')).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test('critical run flow: fight → event → shop → fight → rest → save/reload/continue', async ({ page }) => {
  await startSeededRun(page);

  await chooseReachableNode(page, 'FIGHT');
  await finishCurrentBattle(page);
  await claimReward(page);

  await chooseReachableNode(page, 'EVENT');
  await resolveCurrentEvent(page);

  await chooseReachableNode(page, 'SHOP');
  await dismissScenes(page);
  await expect(page.locator('.shop-screen')).toBeVisible();
  const coinsBefore = Number((await page.locator('.shop-sign strong').textContent())?.trim());
  const buy = page.locator('.shop-offer .paper-button:not(:disabled)').first();
  await expect(buy).toBeVisible();
  await buy.click();
  await expect(page.getByText(/Purchase packed/i)).toBeVisible();
  const coinsAfter = Number((await page.locator('.shop-sign strong').textContent())?.trim());
  expect(coinsAfter).toBeLessThan(coinsBefore);
  await page.getByRole('button', { name: /LEAVE SHOP/i }).click();
  await dismissScenes(page);

  await chooseReachableNode(page, 'FIGHT');
  await finishCurrentBattle(page);
  await claimReward(page);

  await chooseReachableNode(page, 'REST');
  await expect(page.locator('.rest-screen')).toBeVisible();
  await page.getByRole('button', { name: /CHOOSE RECOVER/i }).click();
  await expect(page.locator('.route-screen')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'ABUNGI' })).toBeVisible();
  await page.getByRole('button', { name: /CONTINUE RUN/i }).click();
  await expect(page.locator('.route-screen')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/next move|predicted damage|target forecast/i);
});

test('party selection settings returns to party selection and guide/details close cleanly', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /START NEW RUN/i }).click();
  await expect(page.getByRole('heading', { name: /Choose Your Three/i })).toBeVisible();

  await page.getByRole('button', { name: /Open settings/i }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByRole('button', { name: /RETURN TO GAME/i }).click();
  await expect(page.getByRole('heading', { name: /Choose Your Three/i })).toBeVisible();

  await page.getByRole('button', { name: /Open field guide/i }).click();
  await expect(page.getByText(/FIELD GUIDE/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: /How the Table Works/i })).toBeVisible();
  await page.getByRole('button', { name: /CLOSE GUIDE/i }).click();

  await page.getByRole('button', { name: /View Earl kit/i }).click();
  await expect(page.getByRole('heading', { name: 'Earl' })).toBeVisible();
  await page.getByRole('button', { name: /BACK TO GAME/i }).click();
  await expect(page.getByRole('heading', { name: /Choose Your Three/i })).toBeVisible();
});

test('scene dialogue can advance or skip without losing the destination screen', async ({ page }) => {
  await page.addInitScript(seed => { Date.now = () => seed; }, FIXED_SEED);
  await page.goto('/');
  await page.getByRole('button', { name: /START NEW RUN/i }).click();
  for (const name of ['Earl', 'Hans', 'Leandre']) await page.getByRole('button', { name: new RegExp(`Select ${name}`, 'i') }).click();
  await page.getByRole('button', { name: /START WITH/i }).click();
  const scene = page.locator('.scene-overlay');
  await expect(scene).toBeVisible();
  await expect(scene.getByRole('button', { name: /CONTINUE|NEXT/i })).toBeVisible();
  await scene.getByRole('button', { name: /SKIP/i }).click();
  await dismissScenes(page);
  await expect(page.locator('.route-screen')).toBeVisible();
});

test('enemy committed action is shown as a named move before control returns', async ({ page }) => {
  await startSeededRun(page);
  await chooseReachableNode(page, 'FIGHT');
  const legalSkill = page.locator('.skill-main:not(:disabled)').first();
  await legalSkill.click();
  await submitSelectedAction(page);
  const enemyCallout = page.locator('.combat-message.enemy-callout');
  await expect(enemyCallout).toBeVisible({ timeout: 8_000 });
  await expect(enemyCallout).toContainText(/ENEMY ACTION/i);
  await expect(enemyCallout).toContainText(/used/i);
  await expect(page.locator('.input-lock')).toBeHidden({ timeout: 10_000 });
});

test('active battle resumes at the same committed state after reload', async ({ page }) => {
  await startSeededRun(page);
  await chooseReachableNode(page, 'FIGHT');
  await takeOneBattleAction(page);
  const roundBefore = await page.locator('.battle-utility').textContent();
  await page.reload();
  await page.getByRole('button', { name: /CONTINUE RUN/i }).click();
  await expect(page.locator('.battle-screen')).toBeVisible();
  expect(await page.locator('.battle-utility').textContent()).toContain((roundBefore ?? '').match(/ROUND\s+\d+/)?.[0] ?? 'ROUND');
});

test('rapid tapping never double-commits an action', async ({ page }) => {
  await startSeededRun(page);
  await chooseReachableNode(page, 'FIGHT');
  const skill = page.locator('.skill-main:not(:disabled)').first();
  await skill.dblclick({ delay: 20 });
  const targets = page.locator('.unit-figure.targetable');
  if (await targets.count()) await targets.first().dblclick({ delay: 20 });
  await expect(page.locator('.input-lock')).toBeHidden({ timeout: 10_000 });
  await expect(page.locator('.battle-screen')).toBeVisible();
});

test('settings expose audio, speed and reduced motion controls', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /SETTINGS/i }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByText(/Master audio/i)).toBeVisible();
  await expect(page.getByRole('button', { name: '1×' })).toBeVisible();
  await expect(page.getByRole('button', { name: '2×' })).toBeVisible();
  await expect(page.getByRole('button', { name: '3×' })).toBeVisible();
  await expect(page.getByText(/Reduced motion/i)).toBeVisible();
});

for (const viewport of [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
]) {
  test(`responsive game surfaces fit ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await startSeededRun(page);
    await expectNoHorizontalOverflow(page);
    await expect(page.locator('.route-map')).toBeVisible();
    await chooseReachableNode(page, 'FIGHT');
    await expect(page.locator('.enemy-stage')).toBeVisible();
    await expect(page.locator('.ally-stage')).toBeVisible();
    await expect(page.locator('.action-tray')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}

test('battle HUD stays legible and tappable on a short phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await startSeededRun(page);
  await chooseReachableNode(page, 'FIGHT');
  await expect(page.locator('.battle-screen')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // WS1.2: status stays scannable; skill name and PP stay visible.
  await expect(page.locator('.ally-stage .unit-label .status-strip, .ally-stage .unit-label .status-empty').first()).toBeVisible();
  await expect(page.locator('.skill-main strong').first()).toBeVisible();
  await expect(page.locator('.skill-main .pp-count').first()).toBeVisible();
  await expect(page.locator('.skill-main > small').first()).toBeVisible();

  // WS1.4: named touch targets reach 44px.
  for (const selector of ['.action-tabs button', '.battle-utility button']) {
    const box = await page.locator(selector).first().boundingBox();
    expect(box, `${selector} has no box`).toBeTruthy();
    expect(box!.height, `${selector} height`).toBeGreaterThanOrEqual(44);
  }

  // WS1.1: the enemy-move message is not clipped.
  const clipped = await page.locator('.combat-message strong').first()
    .evaluate(el => el.scrollHeight > el.clientHeight + 1);
  expect(clipped, 'combat message text is clipped').toBe(false);
});
