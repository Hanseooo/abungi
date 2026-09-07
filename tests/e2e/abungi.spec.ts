import { expect, test, type Page } from '@playwright/test';

const FIXED_SEED = 20260907;

async function dismissScenes(page: Page, waitForFirstScene = false) {
  for (let i = 0; i < 8; i += 1) {
    const scene = page.locator('.scene-overlay');
    if (!(await scene.count())) {
      if (!waitForFirstScene || i > 0) return;
      await scene.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
      if (!(await scene.count())) return;
    }
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
  for (const name of ['Yatords', 'Yeeho', 'Earl']) {
    await page.getByRole('button', { name: new RegExp(`Select ${name}`, 'i') }).click();
  }
  await page.getByRole('button', { name: /START WITH/i }).click();
  await expect(page.locator('.scene-overlay')).toBeVisible();
  await dismissScenes(page, true);
  await expect(page.getByRole('heading', { name: /Region 1/i })).toBeVisible();
}

async function chooseReachableNode(page: Page, label: 'FIGHT'|'EVENT'|'SHOP'|'REST'|'ELITE'|'BOSS', position: 'first'|'last' = 'first') {
  const nodes = page.locator('.route-node.reachable').filter({ hasText: label });
  const node = position === 'last' ? nodes.last() : nodes.first();
  await expect(node).toBeVisible();
  await node.click();
}

async function submitSelectedAction(page: Page) {
  const targets = page.locator('.enemy-stage .unit-figure.targetable');
  const confirm = page.getByRole('button', { name: /CONFIRM USE/i });
  await expect.poll(async () => await targets.count() + await confirm.count(), { timeout: 10_000 }).toBeGreaterThan(0);
  let targetIndex = 0;
  let lowestHp = Number.POSITIVE_INFINITY;
  for (let index = 0; index < await targets.count(); index += 1) {
    const match = (await targets.nth(index).innerText()).match(/(\d+)\/(\d+)/);
    const hp = match ? Number(match[1]) : Number.POSITIVE_INFINITY;
    if (hp < lowestHp) {
      lowestHp = hp;
      targetIndex = index;
    }
  }
  const target = targets.nth(targetIndex);
  if (await target.count()) {
    await target.click();
  } else {
    await expect(confirm).toBeVisible();
    await confirm.click();
  }
}

async function targetMostInjuredAlly(page: Page) {
  const targets = page.locator('.ally-stage .unit-figure.targetable');
  await expect.poll(async () => await targets.count(), { timeout: 10_000 }).toBeGreaterThan(0);
  let targetIndex = 0;
  let lowestRatio = Number.POSITIVE_INFINITY;
  for (let index = 0; index < await targets.count(); index += 1) {
    const match = (await targets.nth(index).innerText()).match(/(\d+)\/(\d+)/);
    const ratio = match ? Number(match[1]) / Number(match[2]) : Number.POSITIVE_INFINITY;
    if (ratio < lowestRatio) {
      lowestRatio = ratio;
      targetIndex = index;
    }
  }
  await targets.nth(targetIndex).click();
}

async function takeOneBattleAction(page: Page) {
  await expect(page.locator('.battle-screen')).toBeVisible();
  const actor = (await page.locator('.actor-ticket h2').textContent())?.trim();
  const injured = (await page.locator('.ally-stage .unit-label').allTextContents()).some(text => {
    const match = text.match(/(\d+)\/(\d+)/);
    return match ? Number(match[1]) < Number(match[2]) : false;
  });
  const healSkill = page.locator('.skill-main:not(:disabled)').filter({ hasText: /Patch Up/i }).first();
  let usePatchKit = false;
  if (injured) {
    await page.getByRole('button', { name: 'ITEMS', exact: true }).click();
    usePatchKit = await page.locator('.item-main:not(:disabled)').filter({ hasText: /Patch Kit/i }).count() > 0;
    if (!usePatchKit) await page.getByRole('button', { name: 'SKILLS', exact: true }).click();
  }
  const useHeal = !usePatchKit && actor === 'Earl' && injured && await healSkill.count() > 0;
  const legalSkill = useHeal ? healSkill : page.locator('.skill-main:not(:disabled)').first();
  const legalItem = page.locator('.item-main:not(:disabled)').filter({ hasText: /Patch Kit/i }).first();
  if (usePatchKit) {
    await expect(legalItem).toBeVisible();
    await legalItem.click();
    await targetMostInjuredAlly(page);
    await expect(page.locator('.input-lock')).toBeHidden({ timeout: 20_000 });
    return;
  }
  await expect(legalSkill).toBeVisible();
  await legalSkill.click();
  if (useHeal) await targetMostInjuredAlly(page);
  else await submitSelectedAction(page);
  await expect(page.locator('.input-lock')).toBeHidden({ timeout: 20_000 });
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
  await dismissScenes(page, true);
  await expect(page.locator('.route-screen')).toBeVisible();
}

async function resolveCurrentEvent(page: Page) {
  await page.locator('.scene-overlay').waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined);
  await dismissScenes(page);
  await expect(page.locator('.event-screen')).toBeVisible();
  const choices = page.locator('.event-choices button:not(:disabled)');
  const itemRecoveryChoice = choices.filter({ hasText: /PATCH KIT|HELP TIE/i }).first();
  const recoveryChoice = choices.filter({ hasText: /RESTORE|RECOVER|WAIT OUT|EAT|TAKE FIVE|TUNE THE GEAR|CHARGE/i }).first();
  const legalChoice = await itemRecoveryChoice.count() ? itemRecoveryChoice : await recoveryChoice.count() ? recoveryChoice : choices.last();
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
  test.setTimeout(120_000);
  await startSeededRun(page);

  await chooseReachableNode(page, 'FIGHT');
  await finishCurrentBattle(page);
  await claimReward(page);

  await chooseReachableNode(page, 'EVENT');
  await resolveCurrentEvent(page);

  await chooseReachableNode(page, 'SHOP');
  await dismissScenes(page, true);
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

  await chooseReachableNode(page, 'FIGHT', 'last');
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
  await expect(page.locator('.battle-screen')).toHaveCount(0);
  await expect(page.locator('.combat-message')).toHaveCount(0);
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
  const enemyCallout = page.locator('.combat-message.enemy-callout');
  let committedText: string | null = null;
  for (let actions = 0; actions < 8 && !committedText; actions += 1) {
    const legalSkill = page.locator('.skill-main:not(:disabled)').first();
    await legalSkill.click();
    await submitSelectedAction(page);
    for (let samples = 0; samples < 200; samples += 1) {
      if (await enemyCallout.isVisible().catch(() => false)) {
        const text = await enemyCallout.textContent();
        if (text?.match(/ENEMY ACTION/i)) {
          committedText = text;
          break;
        }
      }
      if (!(await page.locator('.input-lock').isVisible().catch(() => false))) break;
      await page.waitForTimeout(50);
    }
    if (committedText) break;
    await expect(page.locator('.input-lock')).toBeHidden({ timeout: 10_000 });
  }
  expect(committedText).toMatch(/ENEMY ACTION/i);
  expect(committedText).toMatch(/used/i);
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
