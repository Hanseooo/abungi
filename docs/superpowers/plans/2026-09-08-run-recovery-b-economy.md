# Run Recovery B: Economy Integrity Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Work single-threaded unless delegation is authorized under the working agreements.

**Goal:** Make every shop finite and every consumable grant obey the same individual-item capacity.

**Architecture:** Use Part A's persisted `shopVisit` as purchase authority. A small derived-capacity module replaces repeated inventory sums and fixed-limit checks. Existing reward/event functions remain the owners of their grants, without a generic transaction framework.

**Tech Stack:** Existing TypeScript, React, Zustand, Zod/IndexedDB, Node domain tests, Vitest, and Playwright. Node 22.x, pnpm 12.1.0. No added dependencies.

**Spec:** [2026-09-08-run-recovery-economy-reward-depth.md](../specs/2026-09-08-run-recovery-economy-reward-depth.md), sections 3, 9, and 11–12.

## Global constraints

- “Inventory capacity is six individual consumables, seven with one Deep Pockets.” Count quantities, not stack entries.
- “Generate a shelf once on entry and persist its offers/prices and purchased offer IDs.” Sold offers stay visible.
- “Only the wildcard may become a relic.” Retain four base offers, Leandre's fifth item, 18% / 23% / 28% relic cadence, and 0.9–1.1 price variance.
- “Buying Shop Chit does not reprice the current shop.” Its 12% discount affects future snapshots.
- “A paid two-item event requires two free slots before deducting money.” No partial paid grants, overflow stash, buyback, selling, or consumption inside shops.
- “Preserve all other existing event rewards, costs, and HP floors.” Folded Tokens rarity changes belong to C1.
- Keep Common item weight 8, Uncommon `4 + regionIndex`, Rare `0.35 + regionIndex * 0.45`, using zero-based `regionIndex`.
- Do not tune scarcity until shelves, awards, purchases, and reload behavior are correct.

## Dependency and approval

Requires [Part A](2026-09-08-run-recovery-a-foundation.md), including `RunState.shopVisit`, v2 parsing/migration, shop snapshot creation, and action locks. Next is [Part C](2026-09-08-run-recovery-c-rewards-validation.md).

Before coding, present the file map and the purchase signature change below for the project's required approval. The plan does not itself authorize schema/public-interface changes or work spanning more than three modules. Part A already introduces the complete v2 persisted shape, so B must not create another save version. If the repository contradicts that dependency, stop and reconcile the contract before writing code.

**Part acceptance:** spec criteria 6–7, economy portions of 11, and finite-shelf/capacity verification from 12. No full-run balance claim yet.

### File map

| Task | Existing files to modify | New files, not present at planning time |
|---|---|---|
| B1 | `src/game/core/progression/shop.ts`, `src/game/core/progression/rewards.ts`, `src/game/core/progression/events.ts`, `src/features/route/RouteScreen.tsx`, `src/features/shop/ShopScreen.tsx`, `tests/domain/progression.test.mjs`, `tests/domain/v03.test.mjs` | `src/game/core/progression/inventory.ts` |
| B2 | `src/game/core/progression/shop.ts`, `src/app/appStore.ts`, `src/features/shop/ShopScreen.tsx`, `tests/domain/progression.test.mjs`, `tests/domain/save.test.mjs` | None |
| B3 | `tests/e2e/abungi.spec.ts`, `src/game/content/guide.ts`, `src/ui/overlays/DetailPanel.tsx` | None |

Preserve existing unrelated modifications in E2E and styles. No stylesheet change is expected unless existing disabled/sold-out presentation is unreadable. If needed, identify that exact in-scope hunk in review rather than replacing current styles.

## B1: Derive capacity once and apply it at every award boundary

**Acceptance:** six/seven limits agree across shop, auto drop generation and claim, Scavenge generation and claim, every event item grant, route inventory, and shop display. Paid Bulk Deal has space for both items before spending 20 coins.

**Interfaces:** new `inventory.ts` exports:

```ts
export function inventoryCount(run: Pick<RunState, 'inventory'>): number {
  return run.inventory.reduce((sum, entry) => sum + entry.quantity, 0);
}
export function inventoryCapacity(run: Pick<RunState, 'relicIds'>): number {
  return BALANCE.inventoryCapacity + (run.relicIds.includes('deep-pockets') ? 1 : 0);
}
```

Import `RunState` and `BALANCE` from existing modules. No mutable capacity field, stack-size rule, grant service, or generic predicate wrapper. Part C adds the `deep-pockets` relic definition, so it is not newly obtainable in this part.

- [ ] Add one representative main test and critical paid-overflow case to existing progression tests. Use real `bulk-deal` content and `createRun`. This main case deliberately has two stack entries but five individual items:

```js
test('Deep Pockets allows the complete paid two-item grant', () => {
  const run = createRun(['earl', 'hans', 'leandre'], 901);
  run.coins = 20;
  run.inventory = [{itemId: 'patch-kit', quantity: 4}, {itemId: 'pp-tonic', quantity: 1}];
  run.relicIds = ['deep-pockets'];
  const result = applyEventChoice(run, 'bulk-deal', 'buy', new SeededRng(4));
  assert.equal(result.run.coins, 0);
  assert.equal(inventoryCount(result.run), 7);
  assert.equal(result.run.inventory.find(x => x.itemId === 'field-ration').quantity, 1);
  assert.equal(result.run.inventory.find(x => x.itemId === 'pp-tonic').quantity, 2);
  assert.equal(inventoryCount(run), 5);
});

test('paid Bulk Deal rejects one free slot without charging or granting', () => {
  const run = createRun(['earl', 'hans', 'leandre'], 901);
  run.coins = 20;
  run.inventory = [{itemId: 'patch-kit', quantity: 5}];
  const before = structuredClone(run);
  const rng = new SeededRng(4);
  const rngBefore = rng.serialize();
  assert.equal(canChooseEvent(run, 'bulk-deal', 'buy').allowed, false);
  assert.throws(() => applyEventChoice(run, 'bulk-deal', 'buy', rng), /room|full/i);
  assert.deepEqual(run, before);
  assert.deepEqual(rng.serialize(), rngBefore);
});
```

- [ ] Import the new functions in tests and run `pnpm test:domain` to capture the expected failures. Extend existing full-pack reward tests with six items plus Deep Pockets, then seven items. Do not create separate duplicate tests for each call site.
- [ ] Replace the private shop count function and every capacity-related sum/comparison in `rewards.ts` and `events.ts` with the two derived functions. Generate no auto drop or Scavenge option when full. On claim, capacity-check again because a saved pending reward can be resumed in a different valid state. Preserve existing award ordering: auto item before Scavenge, without overflow compensation.
- [ ] In `canChooseEvent`, calculate all item effects before any costs and require room for every item in a paid item choice. Retain the existing check for item-only rewards with HP/coin costs and the existing behavior for free mixed rewards. Apply the same capacity in `applyEventChoice`; do not silently charge for a partial paid grant. No event effects or HP floors change.

```ts
const itemRewardCount = choice.effects.filter(effect => effect.kind === 'item').length;
if (itemRewardCount > 0 && (spend > 0 || onlyItemValue)
    && inventoryCount(run) + itemRewardCount > inventoryCapacity(run)) {
  return {allowed: false, reason: 'Your pack is too full; there is not enough room for those items.'};
}
```

- [ ] Render `PACK · count/capacity` in route inventory and shop. Replace hardcoded “6 slots” reasons with the derived limit. Count two Patch Kits as two units. Over-capacity migrated inventory stays intact, blocks further grants/purchases, and can be reduced by confirmed route discard.
- [ ] Search the entire repository with `rg -n 'inventoryCapacity|6 slots|/6|inventory\.reduce' src tests scripts`. Inspect every match. Keep `BALANCE.inventoryCapacity: 6` as the sole baseline constant. Do not change unrelated reductions or historical audit text.
- [ ] Run `pnpm test:domain`, `pnpm test:vitest`, `pnpm typecheck`, and `pnpm test:release`. Commit the tested capacity slice with `fix: enforce individual item capacity across economy paths`.

## B2: Purchase exclusively from the persisted finite shelf

**Acceptance:** unknown/sold-out/unaffordable/owned/full-pack purchases return reasons without mutation. The same offer cannot charge or grant twice after a double click or reload. Buying any offer, including Shop Chit or Deep Pockets, never changes another offer's price/content/order.

**Interfaces:** replace existing `purchaseShopOffer(input, offerId, offers)` with `purchaseShopOffer(input: RunState, offerId: string): PurchaseResult`. Keep `PurchaseResult` unchanged. Add `shopOfferAvailability(run: RunState, offerId: string): {legal:boolean; reason?:string}` in `shop.ts`, used by both purchase and UI. `generateShopOffers(run,nodeId): ShopOffer[]` remains pure. `currentShopOffers(run:RunState|null): ShopOffer[]` returns the saved snapshot only.

- [ ] Rewrite the existing purchase test to obtain a real shop node from a seeded route, generating successive fixed seeds if necessary, set that unresolved current node, and set `shopVisit` from `generateShopOffers`. Use a real item offer, not a fake caller price. One main/replay test:

```js
const offer = run.shopVisit.offers.find(o => o.kind === 'item');
assert.ok(offer);
const shelf = structuredClone(run.shopVisit.offers);
const beforeCoins = run.coins;
const beforeCount = inventoryCount(run);
const bought = purchaseShopOffer(run, offer.id);
assert.equal(bought.ok, true);
assert.equal(bought.run.coins, beforeCoins - offer.price);
assert.equal(inventoryCount(bought.run), beforeCount + 1);
assert.deepEqual(bought.run.shopVisit.offers, shelf);
assert.deepEqual(bought.run.shopVisit.purchasedOfferIds, [offer.id]);
const replay = purchaseShopOffer(bought.run, offer.id);
assert.equal(replay.ok, false);
assert.match(replay.reason, /sold out/i);
assert.deepEqual(replay.run, bought.run);
```

Use the same main test's saved result through `createSaveEnvelope` / `migrateSaveEnvelope` to prove replay is still rejected after serialization. The critical failure test supplies an unknown ID and a completed-shop run and asserts no mutation. Add affordability/owned/capacity assertions to existing relevant tests, not a new suite of one-branch mirrors.

- [ ] Run `pnpm test:domain` before implementation. Type errors at the removed caller argument are expected only after the interface change, not the initial proof of the behavior bug. First demonstrate that replay currently succeeds.
- [ ] Implement `shopOfferAvailability` in this order: active run and living party, no battle/reward, existing current unresolved shop, matching `shopVisit.nodeId`, known offer, not purchased, affordable, relic not owned or item capacity available. Return concise reasons. The display calls this exact function.
- [ ] In `purchaseShopOffer`, validate first, clone only a legal input, find the authoritative saved offer, deduct its price, grant one item/relic, and append its ID to `purchasedOfferIds` in the same returned run. Never accept a caller-provided price or regenerate the shelf here.

```ts
const availability = shopOfferAvailability(input, offerId);
if (!availability.legal) return {ok: false, reason: availability.reason, run: input};
const run = clone(input);
const offer = run.shopVisit!.offers.find(candidate => candidate.id === offerId)!;
run.coins -= offer.price;
if (offer.kind === 'relic') run.relicIds.push(offer.contentId);
else {
  const entry = run.inventory.find(item => item.itemId === offer.contentId);
  if (entry) entry.quantity += 1;
  else run.inventory.push({itemId: offer.contentId, quantity: 1});
}
run.shopVisit!.purchasedOfferIds.push(offer.id);
return {ok: true, run};
```

- [ ] Update `purchaseOffer` to use only that domain result, guard `screen === 'shop'` and the commitment lock, and derive discovery recording from the pre-purchase saved offer. Commit run/profile together before awaiting persistence. Disable Buy and Leave while committing. Rejected requests do not persist or change profile.
- [ ] Render every offer, including purchased slots. Sold-out takes precedence over affordability/capacity and reads `SOLD OUT`; it remains inspectable. All other unavailable reasons stay inline. Use `shopOfferAvailability` instead of a second UI legality implementation.
- [ ] Verify generator ordering explicitly. Draw/prices for Recovery, Resource (including Cleanser), Tactical (including utility), and Wildcard occur before checking Leandre for his extra draw. Sample the extra item from the remaining item pool. Guard the existing `while` fill loop against an empty pool so it cannot spin forever. With identical seed/node/region/relic ownership and Hans present in both parties, assert `withLeandre.slice(0,4)` deep-equals the four base offers and slot five is an item. Part C must preserve this after rarity selection changes.
- [ ] Search all `purchaseShopOffer`, `generateShopOffers`, and `currentShopOffers` usages. Update actual call sites/tests only. Generation remains allowed in A's entry/migration path and audits, never in display/purchase. Verify a future shop gets Shop Chit's discount but the current saved shelf does not reprice.
- [ ] Run `pnpm test:domain`, `pnpm test:vitest`, `pnpm typecheck`, and `pnpm test:release`. Commit with `fix: make saved shop shelves finite and authoritative`.

## B3: Verify the complete shop/resume and capacity UX

**Acceptance:** shelf stock and prices survive navigation/reload, a sold item cannot be bought twice, discard before entry enables intentional capacity management, and storage failure does not imply durability.

**Interfaces:** consumes A's recovery/store actions and B1/B2's exact capacity/purchase helpers. No additional API or persisted fields.

- [ ] Extend E2E with one “finite shop” path: use existing seeded-run/navigation helpers, reach a shop, record four/five actual offers/prices, buy an affordable item, verify sold-out text and count/coin changes, reload/continue, and compare the full visible shelf. An immediate repeated click must not double-charge. Choose a seed with a naturally reachable affordable offer, rather than editing store state or inventing items in the browser.
- [ ] Add one “shop storage failure” path using the existing browser storage boundary approach from A4. Assert one in-memory purchase, a sold-out slot and warning, and that retrying persistence does not buy again. Do not assert reload durability after intentionally failed storage.

```ts
const shelfBefore = await page.locator('.shop-offer').allTextContents();
const buy = page.getByRole('button', {name: 'BUY', exact: true}).first();
await buy.click();
await expect(page.getByRole('button', {name: 'SOLD OUT', exact: true})).toHaveCount(1);
const shelfAfter = await page.locator('.shop-offer').allTextContents();
expect(shelfAfter).toHaveLength(shelfBefore.length);
await page.reload();
await page.getByRole('button', {name: /CONTINUE RUN/i}).click();
await expect(page.getByRole('button', {name: 'SOLD OUT', exact: true})).toHaveCount(1);
expect(await page.locator('.shop-offer').allTextContents()).toEqual(shelfAfter);
```

The existing title button is `CONTINUE RUN` with a Region suffix, matched by the expression above. Do not add production test hooks to make this snippet pass.

- [ ] Run `pnpm test:e2e --grep "finite shop|shop storage failure"` and inspect the failure before completing missing UI behavior. Verify keyboard focus/activation, touch, visible PACK FULL/price reasons, retained Info access, and Leave Shop across the configured five projects. A's discard flow covers making room before entry; B must prove there is no consumption control inside the shop.
- [ ] Update `guide.ts` and item detail copy only where needed for six/seven individual items, finite shelves, and pre-entry discard. Do not imply guaranteed Revive Kits, refunds, or reusable stock.
- [ ] Run `pnpm test:domain`, `pnpm test:vitest`, `pnpm test:release`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and the focused E2E flows. Capture failures and skipped checks explicitly. Commit with `test: verify finite shop resume and capacity decisions`.

## Handoff to C

Record the tested commit and approval history in the conversation. The economy is ready to measure only after C's rarity/content changes and complete-run audit. Next action: execute Part C's reward tasks, then its automated and human release gates.
