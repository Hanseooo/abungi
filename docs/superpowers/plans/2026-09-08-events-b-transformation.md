# Events B: Transformation Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans`, single-threaded, with checkbox tracking. Read the spec and Part A's decision gates first. This is a plan, not implementation authorization.

**Goal:** Deliver swap-meet and sparring-yard as confirmed, atomic resource conversions.

**Architecture:** Extend the existing event command with a discriminated optional selection. Keep intermediate choices in EventScreen local state. Domain logic recomputes offers and validates the entire command before cloning, consuming resources or drawing outcomes.

**Tech Stack:** Existing TypeScript, React, Zustand, Node domain tests, Vitest and Playwright. No added packages.

**Spec:** [Events specification](../specs/2026-09-08-events-transformation-run-variety.md), sections 3, 5, 7.1, 7.3, 11, 13.1 and 14.

## Global constraints

- “Nothing is consumed until confirmation.”
- “Every event retains a free exit.”
- “Existing saves load unchanged. This specification introduces no new persisted field and no schema version bump.”
- “Events never award Rare items (Spec 01 §6) and never award Rare relics.”
- Follow [Part A](2026-09-08-events-a-variety.md)'s project and decision gates. No partial event commit, `pendingEvent`, new screen, dependency, tag engine or resource.
- Public-interface approval is required for B1's concrete signature below. The specification explicitly identifies this as a decision before implementing B or D. A response approving it persists for both parts.

## Files and interfaces

| Task | Existing production files | Tests |
|---|---|---|
| B1 | `src/game/content/events.ts`, `src/game/core/progression/events.ts`, `src/app/appStore.ts` | Part A's `tests/domain/events.test.mjs`, new `tests/vitest/eventCommit.test.ts` |
| B2 | `src/game/content/events.ts`, `src/game/core/progression/events.ts` | `tests/domain/events.test.mjs` |
| B3 | `src/game/content/events.ts`, `src/game/core/progression/events.ts` | `tests/domain/events.test.mjs`, existing `tests/vitest/saveSchema.test.ts` |
| B4 | `src/features/event/EventScreen.tsx`, `src/styles.css`, `src/game/content/scenes.ts` | Existing `tests/e2e/abungi.spec.ts` |

New production files: none. The test file isolates real-store commit/replay checks from domain rules. B1 spans content, progression and app. B4 spans event UI, styles and content. If local module interpretation makes either wider than three, obtain approval for the stated set first.

### B1: Establish the single-commit selection contract

**Acceptance:** Legacy one-tap events still work. A stale, incomplete, forged or duplicate selection cannot charge resources or draw RNG. Confirm is the only state-changing call. A second commit or a commit on a completed event is ignored by the store.

**Interfaces:** Introduce `EventSelection` in `src/game/content/events.ts` for B's two mechanics only:

```ts
export type EventSelection =
  | {kind:'tradeItems';itemIds:[string,string];offeredItemId:string}
  | {kind:'pawnItem';itemId:string}
  | {kind:'upgradeAbility';characterId:string;abilityId:string};
```

C and D extend this union in their own tasks. Do not introduce unsupported variants before their effects exist.

```ts
// Existing exports, widened in progression/events.ts:
canChooseEvent(run:RunState,eventId:string,choiceId:string,
  selection?:EventSelection):{allowed:boolean;reason?:string};
applyEventChoice(input:RunState,eventId:string,choiceId:string,
  rng:SeededRng,selection?:EventSelection):EventResolution;
// Existing AppState method:
chooseEvent(choiceId:string,selection?:EventSelection):Promise<void>;
```

`canChooseEvent` without selection checks entry availability. With a selection it additionally checks its discriminant, cardinality, ownership and offer membership. `applyEventChoice` must reject a missing selection for a selection effect even if entry availability is true. Derive `nodeId` from `run.currentNodeId`, never accept a client-supplied offer list or node override. For these new effects require a matching, incomplete current event node. Keep existing one-step domain test calls working.

- [ ] In `tests/vitest/eventCommit.test.ts`, invoke the actual `useAppStore` action. Set up state with real `createRun`, a generated matching event node, the event screen and no active battle/reward. Mock only the save repository boundary. First main test commits an existing event once, asserts node completion once and persisted state equal to the store. Critical test invokes the action again against the completed state and verifies unchanged resources, score, RNG and persistence-call count. Run `pnpm test:vitest` before changing the store. Existing guards may already pass these assertions, which is evidence to preserve them rather than rewrite them.
- [ ] Widen only the method signature, imports and forwarding call:

```ts
const result = applyEventChoice(current,node.eventId,choiceId,rng,selection);
```

Keep `actionReady`, `isResolving`, current-node checks, discovered-relic update, catch/finally, autosave and `startEncounter` handoff. Never call `completeRouteNode` before validating and applying the whole selection. Deterministic conversions consume no run RNG under A's proposed interpretation.
- [ ] Run `pnpm typecheck`, `pnpm test:domain`, `pnpm test:vitest`. B2/B3 extend the red tests to exercise real selection effects as they are introduced. Suggested commit: `refactor: accept atomic event selections`.

### B2: Swap-meet trade and pawn

**Acceptance:** Trade consumes exactly two owned units, including two of the same ID when quantity permits, grants exactly one derived non-Rare offer and frees one slot. Pawn removes one unit and adds `floor(price / 2)` coins. Neither operation changes state on invalid selection, and neither is capacity-blocked when removal creates room.

**Content:** Add `swap-meet`, theme `swap`, category `transmutation`, weight 1. Title “Swap Meet”, text “The trader accepts things you can carry, not promises.” Choices `trade` (“Trade two”), `pawn` (“Pawn one”), `leave` (“Leave”). New narrow effect kinds `tradeItems` and `pawnItem`; one atomic trade effect owns both removal and grant. Avoid separately composable sacrifice/grant steps that permit a partial trade.

- [ ] Extend `deriveEventOffers` for swap-meet with `ITEMS.filter(item => item.rarity !== 'rare' && item.id !== 'revive-kit')`, drawing at most three distinct IDs from its scratch stream. Do not exclude owned outputs or filter by pack capacity. Sacrifice selection must not change offers.
- [ ] Write a main domain test using a real generated swap-meet node. Start from real `createRun` inventory entries and raise Patch Kit quantity to six to exercise stacked units and a full ordinary pack. Select `['patch-kit','patch-kit']` and an actual derived offer. Assert inventory count 5, exact quantity decrement plus the one awarded unit, unchanged coins, input and RNG.
- [ ] Add the critical test with only one Patch Kit but selection `['patch-kit','patch-kit']`. Assert throw with an ownership/quantity reason, and deep equality of input and RNG before/after. The fixture comes from the engine. A single adjusted quantity establishes the boundary under test.
- [ ] Run `pnpm test:domain` red before effect application. Implement counted validation before mutation:

```ts
const requested = new Map<string,number>();
for (const id of selection.itemIds) requested.set(id,(requested.get(id) ?? 0)+1);
for (const [id,count] of requested) {
  const owned = run.inventory.find(entry => entry.itemId === id)?.quantity ?? 0;
  if (owned < count) return {allowed:false,reason:'You no longer own those items.'};
}
```

Check precisely two IDs and offered membership before changing the cloned inventory. Subtract counted units, remove entries reaching zero, then merge/increment the offered item. For pawn, check one owned unit and use `getItem(selection.itemId).price`, not client price or shop discounts. Include Rare owned inputs if selected: the output restriction is non-Rare, the spec permits any owned consumable as input.
- [ ] Extend the main test to pawn one real PP Tonic in a separate fresh run and assert +9 coins and one fewer item. Entry reasons are “Need two items to trade.” and “Need an item to pawn.” Cancellation requires no domain operation at all.
- [ ] Run `pnpm test:domain` green and checkpoint B2. Suggested commit: `feat: trade and pawn selected event inventory`.

Concrete B2 regression pair, appended to A's test file with imports for `deriveEventOffers`, `applyEventChoice` and `inventoryCount` from their compiled progression modules:

```js
test('event trade accepts two units from a full stacked pack', () => {
  const run=runAtEvent('swap-meet');
  run.inventory=run.inventory.filter(entry => entry.itemId==='patch-kit');
  run.inventory[0].quantity=6;
  const before=structuredClone(run);
  const offeredItemId=deriveEventOffers(run,run.currentNodeId).itemIds[0];
  const rng=new SeededRng(run.seed,run.rngState);
  const rngBefore=rng.serialize();
  const result=applyEventChoice(run,'swap-meet','trade',rng,
    {kind:'tradeItems',itemIds:['patch-kit','patch-kit'],offeredItemId});
  assert.equal(inventoryCount(result.run),5);
  assert.equal(result.run.inventory.find(entry => entry.itemId==='patch-kit').quantity,
    offeredItemId==='patch-kit' ? 5 : 4);
  assert.equal(result.run.coins,before.coins);
  assert.deepEqual(run,before);
  assert.deepEqual(rng.serialize(),rngBefore);
});

test('event trade rejects a duplicated input without enough owned units', () => {
  const run=runAtEvent('swap-meet');
  const before=structuredClone(run);
  const offeredItemId=deriveEventOffers(run,run.currentNodeId).itemIds[0];
  const rng=new SeededRng(run.seed,run.rngState);
  const rngBefore=rng.serialize();
  assert.throws(() => applyEventChoice(run,'swap-meet','trade',rng,
    {kind:'tradeItems',itemIds:['patch-kit','patch-kit'],offeredItemId}),/own|quantity/i);
  assert.deepEqual(run,before);
  assert.deepEqual(rng.serialize(),rngBefore);
});
```

### B3: Sparring-yard training and round-trip offers

**Acceptance:** Exactly 22 coins and rounded 8% Max HP from living allies buy one offered un-upgraded party ability. Living HP floors at 1, KO remains 0. Training is unavailable with short coins or no eligible ability. Upgrade PP behavior matches `claimReward`.

**Content:** Add `sparring-yard`, theme `training`, category `trade`, weight .5. Title “Sparring Yard”, text “One lesson. Paid in coins and bruises.” Choice `train` uses `coins:-22`, `partyHpPercent:-.08` and new `upgradeAbility` effect. `leave` is free.

- [ ] Extend offers by enumerating each current member's `getCharacter(characterId).abilities`, excluding `upgradedAbilities`, mapping to `{characterId,abilityId}`, and selecting up to three distinct entries. No reroll on Back, no PP or coin mutation on derivation.
- [ ] Add a main test at a real generated training node. Give the Earl/Hans/Marcus party 22 coins and full HP. Choose an actual derived upgrade. Expect 0 coins and HP `[101,85,112]`: 110−round(8.8), 92−round(7.36), 122−round(9.76). Compare the selected member's resulting upgrade list and abilityPP against the existing real `claimReward` path with a real generated reward containing that upgrade. Do not compare its unrelated coins/heal/score effects.
- [ ] Add one critical test marking every actual party ability upgraded and asserting the visible reason “The party has no un-upgraded abilities.” Both direct commit and legality must reject with no resource/RNG change. Coin shortage is also covered by the existing generic affordability tests.
- [ ] Run `pnpm test:domain` red. Validate offered pair membership before cost effects and reproduce the existing upgrade application:

```ts
member.upgradedAbilities.push(selection.abilityId);
const ability = getAbility(selection.abilityId);
if (ability.upgrade.maxPPDelta) {
  member.abilityPP[ability.id] += ability.upgrade.maxPPDelta;
}
```

No current content ability defines a nonzero `maxPPDelta`. Preserve the branch but do not invent a fake content ability or claim a nonzero fixture was tested. If actual content adds one before execution, use it in the main comparison. Do not call `claimReward` to apply training because that also changes coins, score and pending rewards.
- [ ] Extend `tests/vitest/saveSchema.test.ts` with a real event run through `createSaveEnvelope` → JSON stringify/parse → `migrateSaveEnvelope` → `parseSaveEnvelope`. Compare offers before/after and `rngState`, assert no keys added to `RunState` and schema remains 2. Keep existing v1 migration tests intact. The same test can exercise trade/training using actual generated nodes, not fake IDs.
- [ ] Run `pnpm test:domain`, `pnpm test:vitest`, `pnpm typecheck`. Suggested commit: `feat: offer paid event skill training`.

### B4: Selection, confirmation and presentation

**Acceptance:** Both events are complete in the existing theatre with visible item/skill details, back/cancel at each stage, focus restoration, empty/error/resolving states and one explicit confirmation. Cancel at any step writes nothing.

**Local state:** Keep a discriminated `step` state inside EventScreen with `choices`, `trade-inputs`, `trade-offer`, `pawn-input`, `train-offer`, and `confirm`. Selection draft is local `EventSelection | null`. Store the originating button ref. Reset draft when the current node changes. No `RunState` or save additions.

- [ ] Add one main E2E flow using a captured engine-produced swap event save: select two units, select an offer, review names/quantities, confirm, and reload to prove the completed trade stays completed. Add one critical flow cancelling on each trade step with both Escape and Back, asserting unchanged persisted resources and focus restored to the initiating button. Run `pnpm test:e2e --grep 'event'` red.
- [ ] Use native buttons, checkboxes or radios with labels. Permit selecting a second unit of the same item only when quantity allows it. Show owned quantities and selected count `0/2`, `1/2`, `2/2`. Offers show item descriptions. Pawn preview shows the exact selected item and `+floor(price/2) coins`. Training shows character, ability, existing description and upgrade description plus 22 coins and absolute HP losses.
- [ ] Back goes to the preceding local step, Escape cancels the draft to choices, and every step has a visible Cancel/Back control. On cancel focus the origin. On advancing focus the step heading (`tabIndex={-1}`) or first control. Confirm is disabled via focusable `aria-disabled` while incomplete/resolving. Guard handlers and let native buttons implement Enter. On rejection show the store error and keep a way back. Offers derive synchronously, so there is no invented loading spinner for derivation.
- [ ] At Confirm run current `canChooseEvent` again, then invoke `chooseEvent(choiceId, draft)` exactly once. Never call it for selections, Next, Back or Cancel. Do not display stale confirmations if a node/result changes.
- [ ] Add `.event-theme-swap` and `.event-theme-training` using existing palette/shape primitives. Add two `EVENT_ARRIVAL_LINES` variants per event. Swap lines: “Two things for one. Pick what you can spare.” / “The trader turns your pack upside down with a glance.” Training lines: “The lesson costs twenty-two coins. The bruises are included.” / “A chalk circle waits for someone with a move to improve.” No new scene machinery.
- [ ] Run `pnpm test:e2e --grep 'event'`, `pnpm test:release`, `pnpm typecheck`, and manually inspect every step at 375px with keyboard and reduced motion. Checkpoint B4, then proceed to C or D. Suggested commit: `feat: confirm event trades and training accessibly`.
