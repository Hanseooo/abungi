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

async function startSeededRun(page: Page, seed = FIXED_SEED, partyNames = ['Yatords', 'Yeeho', 'Earl']) {
  await page.addInitScript(value => { Date.now = () => value; }, seed);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ABUNGI' })).toBeVisible();
  await page.getByRole('button', { name: /START NEW RUN/i }).click();
  for (const name of partyNames) {
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
  await page.getByRole('button', { name: new RegExp(`ENTER ${label}`, 'i') }).click();
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

async function finishBattleWithSkillsOnly(page: Page) {
  for (let actions = 0; actions < 70; actions += 1) {
    if (await page.locator('.reward-screen').count()) return;
    if (await page.locator('.results-screen').count()) throw new Error('Party was defeated in deterministic E2E battle.');
    await expect(page.locator('.battle-screen')).toBeVisible();
    const skillsTab = page.getByRole('button', { name: 'SKILLS', exact: true });
    await expect(skillsTab).toBeEnabled({ timeout: 20_000 });
    await skillsTab.click();
    const skill = page.locator('.skill-main:not(:disabled)').first();
    await expect(skill).toBeVisible();
    await skill.click();
    await submitSelectedAction(page);
    await expect(page.locator('.input-lock')).toBeHidden({ timeout: 20_000 });
  }
  throw new Error('Battle did not resolve within 70 player actions.');
}

async function openFieldInventory(page: Page) {
  const inventory = page.getByRole('button', { name: /INVENTORY/i });
  await expect(inventory).toBeVisible();
  await inventory.click();
  const dialog = page.locator('dialog.field-inventory-dialog');
  await expect(dialog).toBeVisible();
  return { dialog, inventory };
}

async function readPrimarySave(page: Page) {
  return page.evaluate(() => new Promise<unknown>((resolve, reject) => {
    const request = indexedDB.open('abungi-save', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('snapshots', 'readonly');
      const read = transaction.objectStore('snapshots').get('primary');
      read.onsuccess = () => { db.close(); resolve(read.result); };
      read.onerror = () => { db.close(); reject(read.error); };
    };
  }));
}

async function rewritePrimarySaveAsLegacyV1(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('abungi-save', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const readTransaction = db.transaction('snapshots', 'readonly');
      const read = readTransaction.objectStore('snapshots').get('primary');
      read.onerror = () => { db.close(); reject(read.error); };
      read.onsuccess = () => {
        const legacy = structuredClone(read.result) as { schemaVersion: number; payload: { activeRun?: Record<string, unknown> | null } };
        legacy.schemaVersion = 1;
        if (legacy.payload.activeRun) {
          delete legacy.payload.activeRun.fieldUsesSpent;
          delete legacy.payload.activeRun.shopVisit;
        }
        const writeTransaction = db.transaction('snapshots', 'readwrite');
        writeTransaction.objectStore('snapshots').put(legacy, 'primary');
        writeTransaction.oncomplete = () => { db.close(); resolve(); };
        writeTransaction.onerror = () => { db.close(); reject(writeTransaction.error); };
        writeTransaction.onabort = () => { db.close(); reject(writeTransaction.error); };
      };
    };
  }));
}

async function failSecondIndexedDbPut(page: Page) {
  await page.addInitScript(() => {
    const originalPut = IDBObjectStore.prototype.put;
    let migratedRevision: number | null = null;
    IDBObjectStore.prototype.put = function (...args) {
      const envelope = args[0] as { revision?: number };
      if (typeof envelope?.revision === 'number' && migratedRevision === null) migratedRevision = envelope.revision;
      else if (typeof envelope?.revision === 'number' && envelope.revision > migratedRevision!) {
        this.transaction.abort();
      }
      return originalPut.apply(this, args as Parameters<typeof originalPut>);
    };
  });
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
  const choices = page.locator('.event-choices button:not(:disabled):not([aria-disabled="true"])');
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

test('finite shop shelf survives reload and rejects a repeated purchase', async ({ page }) => {
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

  const shelfBefore = await page.locator('.shop-offer').allTextContents();
  expect(shelfBefore.length).toBeGreaterThanOrEqual(4);
  const coinsBefore = Number((await page.locator('.shop-sign strong').textContent())?.trim());
  const buy = page.getByRole('button', { name: 'BUY', exact: true }).first();
  await expect(buy).toBeVisible();
  await buy.dblclick({ delay: 20 });
  await expect(page.getByRole('button', { name: 'SOLD OUT', exact: true })).toHaveCount(1);
  const coinsAfter = Number((await page.locator('.shop-sign strong').textContent())?.trim());
  expect(coinsAfter).toBeLessThan(coinsBefore);
  const shelfAfter = await page.locator('.shop-offer').allTextContents();
  expect(shelfAfter).toHaveLength(shelfBefore.length);

  await page.reload();
  await page.getByRole('button', { name: /CONTINUE RUN/i }).click();
  await expect(page.locator('.shop-screen')).toBeVisible();
  await expect(page.getByRole('button', { name: 'SOLD OUT', exact: true })).toHaveCount(1);
  expect(await page.locator('.shop-offer').allTextContents()).toEqual(shelfAfter);
  await expect(page.getByRole('button', { name: /LEAVE SHOP/i })).toBeEnabled();
});

test('shop storage failure keeps one in-memory purchase without a second charge', async ({ page }) => {
  test.setTimeout(120_000);
  await startSeededRun(page);
  await chooseReachableNode(page, 'FIGHT');
  await finishCurrentBattle(page);
  await claimReward(page);
  await chooseReachableNode(page, 'EVENT');
  await resolveCurrentEvent(page);
  await chooseReachableNode(page, 'SHOP');
  await dismissScenes(page, true);
  await rewritePrimarySaveAsLegacyV1(page);
  await failSecondIndexedDbPut(page);

  await page.reload();
  await page.getByRole('button', { name: /CONTINUE RUN/i }).click();
  await expect(page.locator('.shop-screen')).toBeVisible();
  const coinsBefore = Number((await page.locator('.shop-sign strong').textContent())?.trim());
  const buy = page.getByRole('button', { name: 'BUY', exact: true }).first();
  await buy.click();
  await expect(page.getByRole('button', { name: 'SOLD OUT', exact: true })).toHaveCount(1);
  await expect(page.getByText(/could not be saved locally/i)).toBeVisible();
  const coinsAfter = Number((await page.locator('.shop-sign strong').textContent())?.trim());
  expect(coinsAfter).toBeLessThan(coinsBefore);
  await expect(page.getByRole('button', { name: 'SOLD OUT', exact: true })).toBeDisabled();
  expect(Number((await page.locator('.shop-sign strong').textContent())?.trim())).toBe(coinsAfter);
});

test('field recovery can be previewed, canceled, confirmed, discarded and resumed', async ({ page }) => {
  test.setTimeout(180_000);
  await startSeededRun(page);
  await chooseReachableNode(page, 'FIGHT');
  await finishBattleWithSkillsOnly(page);
  await claimReward(page);

  await expect(page.getByRole('region', { name: 'Run resources' })).toContainText(/FIELD USE\s*2\/2/i);
  await expect(page.getByRole('region', { name: 'Run resources' })).toContainText(/PACK\s*3\/6/i);
  const first = await openFieldInventory(page);
  await expect(first.dialog.getByRole('heading', { name: /Field inventory/i })).toBeVisible();
  await expect(first.dialog).toContainText(/Patch Kit/);
  await expect(first.dialog).toContainText(/PP Tonic/);
  await expect(first.dialog).toContainText(/HP/);
  await expect(first.dialog).toContainText(/PP/);

  await page.keyboard.press('Escape');
  await expect(first.dialog).toBeHidden();
  await expect(first.inventory).toBeFocused();

  const second = await openFieldInventory(page);
  const patch = second.dialog.locator('.field-item-card').filter({ hasText: /Patch Kit/ });
  await patch.locator('.field-item-select').click();
  const target = second.dialog.locator('.field-ally-target:not(:disabled)').first();
  await expect(target).toBeVisible();
  await target.click();
  await expect(second.dialog.getByText(/FIELD ACTION COST/i)).toBeVisible();
  await second.dialog.getByRole('button', { name: /CLEAR SELECTION/i }).click();
  await expect(second.dialog.getByRole('button', { name: /CONFIRM USE/i })).toBeDisabled();

  await patch.locator('.field-item-select').click();
  await second.dialog.locator('.field-ally-target:not(:disabled)').first().click();
  const confirm = second.dialog.getByRole('button', { name: /CONFIRM USE/i });
  await expect(confirm).toBeEnabled();
  await confirm.focus();
  await page.keyboard.press('Enter');
  await expect(second.dialog).toBeHidden();
  await expect(page.getByRole('region', { name: 'Run resources' })).toContainText(/FIELD USE\s*1\/2/i);
  await expect(page.getByText(/Field recovery committed/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /INVENTORY/i })).toBeFocused();

  const secondUse = await openFieldInventory(page);
  const tonic = secondUse.dialog.locator('.field-item-card').filter({ hasText: /PP Tonic/ });
  await tonic.locator('.field-item-select').click();
  await secondUse.dialog.locator('.field-ally-target:not(:disabled)').first().click();
  await secondUse.dialog.getByRole('button', { name: /CONFIRM USE/i }).click();
  await expect(secondUse.dialog).toBeHidden();
  await expect(page.getByRole('region', { name: 'Run resources' })).toContainText(/FIELD USE\s*0\/2/i);

  const noUses = await openFieldInventory(page);
  await expect(noUses.dialog).toContainText(/No field uses left\. Complete another node\./i);
  await noUses.dialog.getByRole('button', { name: /CLOSE INVENTORY/i }).click();
  await expect(noUses.dialog).toBeHidden();
  await expect(noUses.inventory).toBeFocused();

  await chooseReachableNode(page, 'EVENT');
  await resolveCurrentEvent(page);
  await chooseReachableNode(page, 'SHOP');
  await dismissScenes(page, true);
  const energy = page.locator('.shop-offer').filter({ hasText: /Energy Drink/ });
  await expect(energy).toBeVisible();
  await energy.getByRole('button', { name: /^BUY$/i }).click();
  await expect(page.getByText(/Purchase packed/i)).toBeVisible();
  await page.getByRole('button', { name: /LEAVE SHOP/i }).click();
  await dismissScenes(page);

  await chooseReachableNode(page, 'FIGHT');
  await finishCurrentBattle(page);
  await claimReward(page);
  await chooseReachableNode(page, 'REST');
  await expect(page.locator('.rest-screen')).toBeVisible();
  await page.getByRole('button', { name: /LEAVE WITHOUT RESTING/i }).click();
  await expect(page.getByText(/sibling Shop will be lost/i)).toBeVisible();
  await page.getByRole('button', { name: /CONFIRM LEAVE/i }).click();
  await expect(page.locator('.route-screen')).toBeVisible();
  await expect(page.getByText(/left without resting|without resting/i)).toBeVisible();

  const battleOnly = await openFieldInventory(page);
  const energyItem = battleOnly.dialog.locator('.field-item-card').filter({ hasText: /Energy Drink/ });
  await expect(energyItem).toContainText(/BATTLE ONLY/i);
  await expect(energyItem.locator('.field-item-select')).toBeDisabled();
  await energyItem.getByRole('button', { name: /DISCARD/i }).click();
  await expect(battleOnly.dialog.getByText(/Discard one Energy Drink/i)).toBeVisible();
  await battleOnly.dialog.getByRole('button', { name: /CONFIRM DISCARD/i }).click();
  await expect(battleOnly.dialog.locator('.field-item-card').filter({ hasText: /Energy Drink/ })).toHaveCount(0);
  await battleOnly.dialog.getByRole('button', { name: /CLOSE INVENTORY/i }).click();
});

test('recovery save failure keeps one in-memory effect after legacy migration', async ({ page }) => {
  test.setTimeout(150_000);
  await startSeededRun(page);
  await chooseReachableNode(page, 'FIGHT');
  await finishBattleWithSkillsOnly(page);
  await claimReward(page);
  await rewritePrimarySaveAsLegacyV1(page);
  await failSecondIndexedDbPut(page);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'ABUNGI' })).toBeVisible();
  await page.getByRole('button', { name: /CONTINUE RUN/i }).click();
  await expect(page.locator('.route-screen')).toBeVisible();
  const migrated = await readPrimarySave(page) as { schemaVersion: number; payload: { activeRun: { fieldUsesSpent: number | null; inventory: Array<{ itemId: string; quantity: number }> } } };
  expect(migrated.schemaVersion).toBe(3);
  expect(migrated.payload.activeRun.fieldUsesSpent).toBe(0);

  const inventory = await openFieldInventory(page);
  const patch = inventory.dialog.locator('.field-item-card').filter({ hasText: /Patch Kit/ });
  await patch.locator('.field-item-select').click();
  await inventory.dialog.locator('.field-ally-target:not(:disabled)').first().click();
  await inventory.dialog.getByRole('button', { name: /CONFIRM USE/i }).click();
  await expect(inventory.dialog).toBeHidden();
  await expect(page.getByText(/could not be saved locally/i)).toBeVisible();
  await expect(page.locator('[role="status"]', { hasText: 'SAVE ISSUE' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Run resources' })).toContainText(/FIELD USE\s*1\/2/i);

  const retained = await openFieldInventory(page);
  await expect(retained.dialog.locator('.field-item-card').filter({ hasText: /Patch Kit/ })).toHaveCount(0);
  await retained.dialog.getByRole('button', { name: /CLOSE INVENTORY/i }).click();

  const persisted = await readPrimarySave(page) as { payload: { activeRun: { fieldUsesSpent: number | null; inventory: Array<{ itemId: string; quantity: number }> } } };
  expect(persisted.payload.activeRun.fieldUsesSpent).toBe(0);
  expect(persisted.payload.activeRun.inventory.find(item => item.itemId === 'patch-kit')?.quantity).toBe(1);
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
  await page.addInitScript(value => { Date.now = () => value; }, FIXED_SEED);
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
  await expect(page.locator('.combat-message')).toHaveCount(0);
  const enemyCallout = page.locator('.enemy-action-ticket');
  let committedText: string | null = null;
  for (let actions = 0; actions < 8 && !committedText; actions += 1) {
    const legalSkill = page.locator('.skill-main:not(:disabled)').first();
    await legalSkill.click();
    await submitSelectedAction(page);
    for (let samples = 0; samples < 200; samples += 1) {
      if (await enemyCallout.isVisible().catch(() => false)) {
        const text = await enemyCallout.textContent();
        if (text?.match(/target/i)) {
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
  expect(committedText).toMatch(/enemy/i);
  expect(committedText).toMatch(/target/i);
  expect(committedText).not.toMatch(/future intent|commitment/i);
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
  const overflowingSkills = await page.locator('.skill-main').evaluateAll(skills => skills.filter(skill => skill.scrollWidth > skill.clientWidth + 1).length);
  expect(overflowingSkills, 'skill content crosses into the info control').toBe(0);
  await expect(page.locator('.skill-main .affinity span').first()).toBeHidden();

  // WS1.4: named touch targets reach 44px.
  for (const selector of ['.action-tabs button', '.battle-utility button']) {
    const box = await page.locator(selector).first().boundingBox();
    expect(box, `${selector} has no box`).toBeTruthy();
    expect(box!.height, `${selector} height`).toBeGreaterThanOrEqual(44);
  }

  await expect(page.locator('.combat-message')).toHaveCount(0);
});


test('press shows destructive odds, supports cancel focus, and survives reload', async ({ page }) => {
  test.setTimeout(120_000);
  await startSeededRun(page, 370, ['Earl', 'Michael', 'Greg']);

  await chooseReachableNode(page, 'FIGHT');
  await finishCurrentBattle(page);
  await claimReward(page);

  await chooseReachableNode(page, 'FIGHT');
  await finishCurrentBattle(page);
  await claimReward(page);

  await chooseReachableNode(page, 'SHOP');
  await dismissScenes(page, true);
  // Read the stocked relic rather than naming one, so a content change retunes this test for free.
  const relicOffer = page.locator('.shop-offer').filter({ has: page.locator('.offer-kind', { hasText: /^RELIC$/ }) }).first();
  await expect(relicOffer).toBeVisible();
  // The shelf renders the name uppercased in CSS; the press list renders it as authored.
  const relicName = new RegExp(`^${(await relicOffer.locator('h2').innerText()).trim()}$`, 'i');
  await relicOffer.getByRole('button', { name: 'BUY', exact: true }).click();
  await expect(page.getByText(/Purchase packed/i)).toBeVisible();
  await page.getByRole('button', { name: /LEAVE SHOP/i }).click();
  await dismissScenes(page);

  await chooseReachableNode(page, 'FIGHT');
  await finishCurrentBattle(page);
  await claimReward(page);

  await chooseReachableNode(page, 'EVENT', 'last');
  await dismissScenes(page, true);
  await expect(page.locator('.event-screen h1', { hasText: 'The Press' })).toBeVisible();
  await page.getByRole('button', { name: /Risk the press/i }).click();
  await expect(page.getByRole('heading', { name: /Choose a relic to press/i })).toBeVisible();
  await expect(page.getByText(relicName)).toBeVisible();
  await page.getByRole('button', { name: /CANCEL/i }).click();
  await expect(page.getByRole('button', { name: /Risk the press/i })).toBeFocused();

  await page.getByRole('button', { name: /Risk the press/i }).click();
  await page.getByText(relicName).click();
  await expect(page.getByText(/45%: unowned Uncommon/i)).toBeVisible();
  await expect(page.getByText(/35%: different unowned Common/i)).toBeVisible();
  await expect(page.getByText(/20%: your selected relic is destroyed/i)).toBeVisible();
  await page.getByRole('button', { name: /REVIEW PRESS/i }).click();
  await expect(page.getByRole('button', { name: /Confirm risky press/i })).toBeVisible();
  await expect(page.getByText(/20%: your selected relic is destroyed/i)).toBeVisible();
  await page.getByRole('button', { name: /Confirm risky press/i }).click();
  await expect(page.locator('.event-result')).toBeVisible();
  const savedBeforeReload = await readPrimarySave(page) as { payload: { activeRun: { relicIds: string[] } } };
  const relicsBeforeReload = savedBeforeReload.payload.activeRun.relicIds;
  expect(relicsBeforeReload.filter(id => relicName.test(id.replace(/-/g, ' ')))).toEqual([]);
  await page.getByRole('button', { name: /BACK TO ROUTE/i }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: /CONTINUE RUN/i })).toBeVisible();
  await page.getByRole('button', { name: /CONTINUE RUN/i }).click();
  await expect(page.locator('.route-screen')).toBeVisible();
  const savedAfterReload = await readPrimarySave(page) as { payload: { activeRun: { relicIds: string[] } } };
  expect(savedAfterReload.payload.activeRun.relicIds).toEqual(relicsBeforeReload);
});
