# Run Recovery A: Recovery Foundation Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Work single-threaded unless delegation is authorized under the working agreements.

**Goal:** Make limited field recovery and weak Rest revival deterministic, previewable, and safe to resume.

**Architecture:** Pure progression functions own recovery outcomes and interval eligibility. Zustand commits one validated result before saving. Introduce the complete v2 save contract here, including the shop snapshot needed by Part B, so this expansion has one migration rather than successive incompatible formats.

**Tech Stack:** Existing TypeScript domain, React 19, Zustand, Zod 4, IndexedDB, Node test runner, Vitest, Playwright. Repository baseline: Node 22.x and pnpm 12.1.0.

**Spec:** [2026-09-08-run-recovery-economy-reward-depth.md](../specs/2026-09-08-run-recovery-economy-reward-depth.md), especially sections 3–6 and 11–12.

## Global constraints

- “HP, PP, Coins, and Items remain the only run resources.” Field allowance is an action limit, never bankable.
- “Field use consumes no RNG.” Existing saves, pending rewards, upgrades, inventory, profile, settings, and battles must survive migration.
- “No dependency, service, database, or authentication work is needed.” Change the envelope version, not the IndexedDB database/store layout.
- “Full-party defeat stays terminal.” No field access after victory or defeat.
- Preserve starting 30 coins, one Patch Kit, one PP Tonic, route topology, enemy strength, normal 12% non-Rare item drops, and earned boss recovery.
- No new consumables or recovery multipliers in this part. Recognize the future `field-pack` ownership ID, but Part C adds its definition and acquisition.
- Preserve unrelated working changes in battle presentation, styles, E2E, and release tests. Stage only implementation-owned hunks.

## Sequence, scope, and approval

Execute A → [B: Economy integrity](2026-09-08-run-recovery-b-economy.md) → [C: Reward identity and validation](2026-09-08-run-recovery-c-rewards-validation.md). Each task is a reviewable test cycle. These are implementation plans, not authorization to implement or release. Before coding, present this exact file map and proposed signatures and obtain approval for persisted schema/public-interface changes and work spanning more than three modules. Do not evade the gate by splitting commits. No approval is needed to read or review these plans.

The source spec has already selected the product behavior. Do not reopen its design or add a durable planning document beyond these three files. The README calls the release v0.2 while executable content includes v0.3. Use the code and package scripts for commands.

**Part acceptance:** spec criteria 1–5, recovery/UI portions of 10, save portions of 11, and the interval/migration checks in 12. Part A must pass its tests independently, but release waits for B's finite purchase enforcement and C's complete validation.

### File map

| Task | Existing files to modify | New files, not present at planning time |
|---|---|---|
| A1 | `src/game/core/types.ts`, `src/game/content/relics.ts`, `src/game/core/progression/run.ts`, `src/game/core/progression/shop.ts`, `src/game/core/save/saveFormat.ts`, `src/services/save/schema.ts`, `src/services/save/SaveRepository.ts`, `src/services/save/IndexedDbSaveRepository.ts`, `src/app/appStore.ts`, `tests/domain/save.test.mjs`, `tests/domain/progression.test.mjs` | `tests/vitest/saveSchema.test.ts` |
| A2 | `src/game/core/combat/actions.ts`, `src/game/core/combat/battleEngine.ts`, `tests/domain/mechanics.test.mjs` | `src/game/core/progression/itemRecovery.ts` |
| A3 | `src/game/content/items.ts`, `src/game/content/relics.ts`, `src/game/balance/constants.ts`, `src/game/core/progression/rest.ts`, `tests/domain/progression.test.mjs` | `src/game/core/progression/fieldItems.ts`, `tests/domain/fieldItems.test.mjs` |
| A4 | `src/app/appStore.ts`, `src/features/route/RouteScreen.tsx`, `src/features/rest/RestScreen.tsx`, `src/features/battle/BattleScreen.tsx`, `src/game/content/guide.ts`, `src/ui/overlays/DetailPanel.tsx`, `src/styles.css`, `tests/e2e/abungi.spec.ts` | None |

New domain files have direct consumers in three contexts. No generic effect engine, new UI component, simulation service, or item-action registry is proposed.

## A1: Persist the interval and future finite shelf in one v2 envelope

**Acceptance:** completion is idempotent for score and allowance, boss advancement preserves the one earned interval, v1 migrates once without data loss, invalid v2 state is rejected, and migration storage failure preserves playable in-memory state with a warning.

**Interfaces:** keep `createRun`, `completeRouteNode`, `advanceRegion`, and `generateShopOffers` signatures. Add the following types in `types.ts`. Move the existing `ShopOffer` declaration from `shop.ts` into `types.ts` and re-export it from `shop.ts` to keep one definition. Change its current `rarity: ItemRarity | 'relic'` to `rarity: ItemRarity`, with a type-only import from content/items. Add `RelicDefinition.rarity: ItemRarity` and the 16 existing classifications listed in C1 now, so persisted snapshots use their final shape. Keep uniform acquisition and current relic price 50 until C1 activates source weights/prices. This metadata-only sequencing avoids changing the v2 contract again in C.

```ts
export interface ShopVisit {
  nodeId: string;
  offers: ShopOffer[];
  purchasedOfferIds: string[];
}
// New required RunState members:
fieldUsesSpent: number | null;
shopVisit: ShopVisit | null;
```

Use `SaveEnvelopeV2` for current envelopes, with `schemaVersion: 2`. Keep legacy input as `unknown` until checked, not a v2 `RunState` disguised as v1. `createSaveEnvelope`, `migrateSaveEnvelope`, `parseSaveEnvelope`, and `SaveRepository.save` return `SaveEnvelopeV2`. The `ok` load result gains optional `persistenceWarning?: string` to report failed migration writeback while returning valid migrated data.

- [ ] Before code changes, record `git rev-parse HEAD` and `git status --short` for C4's baseline. Identify the committed pre-expansion baseline and preserve it for a separate compiled checkout. Do not include unrelated uncommitted edits in a supposedly commit-identifiable baseline.
- [ ] Add a failing node-completion test to `tests/domain/progression.test.mjs`:

```js
test('completion opens one interval without replaying score', () => {
  const run = createRun(['earl', 'hans', 'leandre'], 2345);
  assert.equal(run.fieldUsesSpent, null);
  const nodeId = run.route.startNodeIds[0];
  const completed = completeRouteNode(run, nodeId);
  assert.equal(completed.fieldUsesSpent, 0);
  completed.fieldUsesSpent = 1;
  assert.deepEqual(completeRouteNode(completed, nodeId), completed);
  assert.equal(advanceRegion(completed).fieldUsesSpent, 1);
});
```

- [ ] Capture a real pre-change v1 payload in the test using the current `createRun`, `createBattle`, and `generateReward` APIs before editing them. Keep the captured payload in test-local data or a test-local factory using the same engine transitions, not a handwritten imitation of a save. Cover one mixed saved-run preservation path and one malformed-v2 path in existing save tests. Assertions must include exact party, quantities, upgrades, reward choice IDs, battle flags, profile, settings, and RNG equality. Update the existing version-1 expectation to 2 and the unsupported-future test to 3 only after observing their expected failures.
- [ ] Run `pnpm test:domain`. Record the new assertion failures before implementation. Add `tests/vitest/saveSchema.test.ts` using real envelopes through `migrateSaveEnvelope` then `parseSaveEnvelope`, because `.domain-build` excludes the Zod adapter. Its failure path checks a negative/fractional counter and a purchased ID absent from the saved shelf. Run `pnpm test:vitest` and record failures.
- [ ] Initialize both new run fields to `null`. In `completeRouteNode`, validate the node exists, then return an unchanged value for an already-completed node **before** clearing battle, adding score, or changing `currentNodeId`. On first completion set `fieldUsesSpent = 0`. Do not reset it in `advanceRegion`.

```ts
if (input.completedNodeIds.includes(nodeId)) return clone(input);
// After validating nodeId and cloning:
run.completedNodeIds.push(nodeId);
run.fieldUsesSpent = 0;
run.currentNodeId = nodeId;
run.activeBattle = null;
run.score += 10;
```

- [ ] In `selectNode`, clear the prior `shopVisit` when entering a different node. On shop entry set `{nodeId, offers: generateShopOffers(run,nodeId), purchasedOfferIds: []}` before persistence. Make `currentShopOffers` return saved offers. Make the relic offer use `relic.rarity` instead of the fake `'relic'` tier. Preserve `generateShopOffers` as a pure seeded generator for initial entry, migration, tests, and audits. Part B removes caller price authority and tracks sales. Until B, have the current store purchase action pass the saved offers to its old three-argument domain API, so display and charged prices already agree.
- [ ] Implement explicit v1 → v2 migration after validating the legacy shape. Resolved-route v1 runs get `fieldUsesSpent: 0` if a node was completed or `regionIndex > 0` with no current node. Pre-first-node and unresolved-node saves get `null`. Access is separately gated by battle/reward/status/current-node state. Set `shopVisit` to one generated shelf only for an active unresolved shop without battle/reward, otherwise `null`. Preserve all existing payload values and pending draft IDs. Explain the unavoidable one-time refresh of an unresolved legacy shop in migration notes shown by the load warning/notice. Never claim its old purchases were recovered.
- [ ] Update lightweight validation and Zod together. Require nullable nonnegative integer counters, matching current shop node IDs, existing item/relic content IDs, finite positive integer prices, unique offer IDs/content IDs, unique purchased IDs contained in offers, and valid offer discriminants/deal/rarity. A retained completed shop is valid until entering another node. Reject snapshots attached to another region/node or a non-shop. Unknown versions follow existing corrupt-save handling. Permit quantities above six in legacy data rather than deleting inventory.
- [ ] Write migrated envelopes directly in `IndexedDbSaveRepository.load` using an IndexedDB transaction and await its completion. Do not call `save()` from `load()` because `save()` already calls `load()`. Successful migration retains revision semantics and is persisted once. If writeback fails, return the parsed migrated save plus `persistenceWarning`; initialize the store with that run and `saveHealth: 'error'`. Keep the original stored record and offer normal later persistence. Corrupt input still returns `kind: 'corrupt'`.
- [ ] Verify resolved-route, unresolved event/battle/reward/Rest, pre-first-node, next-region route, and unresolved legacy shop cases by extending existing test cases with engine-created transitions. Reloading v2 must not grant an interval or reroll its shelf. Use browser IndexedDB for the writeback and failure test in A4, not a new dependency.
- [ ] Run `pnpm test:domain`, `pnpm test:vitest`, and `pnpm typecheck`. Review only A1 files, then commit the tested slice with `feat: persist recovery intervals and migrate saves to v2`.

## A2: Share eligible PP selection and actual item benefits

**Acceptance:** full low-capacity moves are skipped, ties follow character ability order, upgraded caps are honored, rounding occurs once, and rejected battle items consume neither a turn nor an inventory entry.

**Interfaces:** new `itemRecovery.ts` exports the following pure helper. `sourceId` is supplied as `characterId` for battle units. No RNG or new move-selection command field.

```ts
export interface PpRecoveryTarget {
  characterId: string;
  abilityPP: Record<string, number>;
  upgradedAbilities: readonly string[];
}
export interface PpRestoration { abilityId: string; before: number; after: number }
export function previewItemPp(
  target: PpRecoveryTarget, amount: number, relicIds: readonly string[]
): PpRestoration | null;
```

- [ ] Add this main regression in `tests/domain/mechanics.test.mjs`, importing `previewItemPp` from its new `.domain-build/core/progression/itemRecovery.js` path and `createRun` from the existing run module:

```js
test('tonic skips a full four-PP move and restores the eligible move', () => {
  const member = createRun(['earl', 'hans', 'leandre'], 12).party[0];
  member.abilityPP.yosi = 5; // Adrenaline stays full at 4.
  assert.deepEqual(previewItemPp(member, 4, []),
    { abilityId: 'yosi', before: 5, after: 8 });
  member.abilityPP.yosi = 8;
  assert.equal(previewItemPp(member, 4, []), null);
});
```

- [ ] Extend the existing battle item no-effect test with an engine-created battle whose living targets all have full PP. Assert illegal validation, rejected resolver, unchanged battle, and unchanged RNG. Add the store inventory assertion in A4. Run `pnpm test:domain` to observe failure.
- [ ] Implement the helper by iterating `getCharacter(target.characterId).abilities`. Compute each upgraded maximum from `getAbility`. Ignore moves at cap. Keep the first move unless a later eligible move has strictly lower current PP. Compute `after = min(max, before + round(amount * (blue-tonic-cap ? 1.25 : 1)))`; return `null` if the gain is zero.
- [ ] Replace the resolver's `Object.keys(...).sort(...)` selection and `itemWouldHaveEffect` PP branch with this helper. Keep Jumper Cable's separate battle-start behavior intact. Use returned before/after values in combat messages.
- [ ] Make item lookup in `validatePlayerCommand` reject unknown IDs with a reason instead of leaking `getItem`'s exception. Tighten one-target validation to exactly one existing eligible target. Party targets derive from living allies, never caller-supplied duplicates. Calculate healing usefulness after rounding and caps, and mixed effects with `some`, preserving revival's separate rule. Keep inventory ownership validation in the store because `BattleState` does not own the pack.
- [ ] Run `pnpm test:domain` and `pnpm typecheck`. Commit the slice with `fix: select useful PP item targets consistently`.

## A3: Pure field outcomes and exact Rest recovery

**Acceptance:** one successful use spends exactly one consumable and one action, party items still cost one action, cancellation/no benefit/stale submission change nothing, field revival is 30%, and Rest survivor/KO branches are disjoint.

**Interfaces:** new exports in `fieldItems.ts`. The expected values are ephemeral stale-command checks copied at selection time, not persisted currencies or a new revision system. `inventoryCount` in this command means that item's owned quantity, not total pack size.

```ts
export interface RecoveryChange {
  characterId: string;
  hpBefore: number;
  hpAfter: number;
  pp: Array<{abilityId: string; before: number; after: number}>;
}
export interface FieldItemCommand {
  itemId: string;
  targetId?: string;
  expected: {
    runId: string; regionIndex: number; currentNodeId: string | null;
    fieldUsesSpent: number | null; inventoryCount: number;
  };
}
export interface FieldItemPreview {
  legal: boolean; reason?: string; changes: RecoveryChange[];
}
export function fieldUseLimit(run: RunState): number;
export function fieldAccess(run: RunState): {legal: boolean; reason?: string};
export function previewFieldItem(run: RunState, command: FieldItemCommand): FieldItemPreview;
export function applyFieldItem(run: RunState, command: FieldItemCommand):
  {ok: boolean; reason?: string; run: RunState; changes: RecoveryChange[]};
export function discardFieldItem(run: RunState, itemId: string, expectedQuantity: number):
  {ok: boolean; reason?: string; run: RunState};
```

`rest.ts` retains `RestChoice = 'recover' | 'refresh'` and adds `previewRestChoice(run, choice): {legal:boolean; reason?:string; changes:RecoveryChange[]}`. Store action `leaveRest()` handles exit separately, so `leave` cannot accidentally fall into the existing Refresh `else` branch.

- [ ] Add a main field transaction test using `createRun` and `completeRouteNode`, injure Earl to 10 HP, select the owned Patch Kit, and assert HP 49, inventory quantity reduced by one, spent uses 1, and unchanged RNG. Replay the exact command on the result and assert a failed result with full deep equality. A second failure case uses a full party and verifies no-effect rejection without item/action cost.

```js
const command = {
  itemId: 'patch-kit', targetId: 'earl',
  expected: {runId: run.id, regionIndex: run.regionIndex,
    currentNodeId: run.currentNodeId, fieldUsesSpent: 0, inventoryCount: 1}
};
const result = applyFieldItem(run, command);
assert.equal(result.ok, true);
assert.equal(result.run.party[0].hp, 49);
assert.equal(result.run.fieldUsesSpent, 1);
assert.equal(result.run.rngState, run.rngState);
const replay = applyFieldItem(result.run, command);
assert.equal(replay.ok, false);
assert.deepEqual(replay.run, result.run);
```

- [ ] Replace the old Rest test named “without reviving KO members” with HP expectations `[49, 9, 55]` for Earl/Hans/Leandre starting `[10, 0, 20]`. Assert PP deep equality. Failure path: a defeat run remains terminal and Rest/field application rejects it. Extend the existing Refresh test to include KO-member PP and missing-1-PP rounding to zero. Run `pnpm test:domain` before implementation.
- [ ] Add optional `fieldCompatible?: boolean` to `ItemDefinition`, treating missing as false. Set true only for `patch-kit`, `pp-tonic`, `field-ration`, `circuit-brew`, and `revive-kit`. Remove Revive Kit's `battleOnly: true`, retain `targetKo`, set price 56. Explicitly mark Cleanser battle-only. Update Pressed Flower text to combat healing plus field HP items, excluding revival, Rest, event, and boss recovery.
- [ ] Implement field access: active run, some living ally, no battle/reward, and either a completed current node or no current node on a later-region route. Require a non-null interval and `spent < fieldUseLimit(run)`. Use a private resolved-route check shared with discard, which is allowed with zero uses and before the first node. Store screen/scene checks in A4 additionally prevent use behind unresolved UI.
- [ ] Match all command expectations against current run before computing effects. Reject missing quantity, unknown/incompatible item, wrong target cardinality, KO target for non-revive, living target for revive, and no actual benefit. Use `previewItemPp`. HP items apply only `1.08` for Pressed Flower with one final round and cap. Revive uses `max(1, round(maxHp * .30))`, unchanged PP. Clone and apply the exact preview only after legality succeeds, remove one quantity, then increment `fieldUsesSpent`. No RNG calls or first-aid flags.
- [ ] Implement confirmed discard of one owned unit, quantity revalidation, and removal of zero stacks. It changes neither resources other than inventory nor interval state. Reject non-route context, invalid IDs, and stale quantity. Repeated confirmation is blocked by the UI lock plus expected quantity.
- [ ] Implement Rest preview and application from one private outcome calculation. Use the following disjoint branch and retain Refresh's upgraded PP caps and modifier. Add `BALANCE.restReviveHpPercent: 0.10` next to existing Rest constants.

```ts
const nextHp = member.hp <= 0
  ? Math.max(1, Math.round(character.stats.maxHp * BALANCE.restReviveHpPercent))
  : Math.min(character.stats.maxHp,
      member.hp + Math.round(character.stats.maxHp * BALANCE.restRecoverPercent));
```

- [ ] Gate Rest application to active runs with a living member, reject zero-effect selections, and let the store own unresolved-Rest-node context. Verify non-mutating preview equals application for party heal, party PP, upgraded move, Blue Tonic Cap, and unscaled revival by adding assertions to the corresponding representative tests rather than creating a second fixture framework.
- [ ] Run `pnpm test:domain`, `pnpm test:vitest`, `pnpm typecheck`. Commit with `feat: add field items and weak Rest revival`.

## A4: Commit once and expose recovery decisions accessibly

**Acceptance:** route inventory can inspect, select, preview, cancel, confirm, discard, close, and resume on mobile and keyboard. Rest has exact previews and a secondary exit. Save failures are visible without reapplying effects. Enemy intent remains hidden.

**Interfaces:** add `useFieldItem(command: FieldItemCommand): Promise<void>`, `discardItem(itemId:string, expectedQuantity:number): Promise<void>`, and `leaveRest(): Promise<void>` to `AppState`. Use existing `isResolving`, `error`, `notice`, `saveHealth`, and `PaperButton`. Keep inventory selection local to `RouteScreen`; use a native `<dialog>` styled with existing overlay classes, not a new overlay union/component or dependency.

- [ ] Extend `tests/e2e/abungi.spec.ts` with one “field recovery” flow using existing `startSeededRun`, scene dismissal, and battle helpers. Complete a real first node, inspect its real HP/PP and inventory, cancel a useful selection, confirm it, reload, and verify spent allowance and quantities persist. Add one critical “recovery save failure” flow using browser IndexedDB transaction failure at the storage boundary. Assert the warning, retained in-memory effect, and no duplicate grant. Do not mock the store/domain methods. Run `pnpm test:e2e --grep "field recovery|recovery save failure"` before UI implementation.
- [ ] Use the new actions only on `screen === 'route'`, with no active scene/other overlay and no `isResolving`. Set the lock synchronously before reading/applying the command. Commit `{run,notice}` once, await existing persistence, and unlock in `finally`. A failed save keeps the committed result and warning. Disable route-entry buttons during commitment, and also guard `selectNode` against active battle/reward, terminal status, unresolved current node, or a commitment. Lock node entry itself before its first await.
- [ ] Guard `chooseRest`, `leaveRest`, `leaveShop`, `chooseEvent`, and `claimRewardChoice` against stale screen/current-node/completion and `isResolving`. A duplicate request must be rejected **before** resource application, not merely by idempotent completion afterward. Battle victory waits for reward claim to complete the node. Event-triggered battle opens no interval until its reward/escape. Escape keeps no victory reward. `finishEvent`/scene dismissal never complete a node or reset the interval.
- [ ] In route inventory show `FIELD USE · remaining/limit` and `PACK · used/6` initially. Part B replaces six with the shared capacity. Show “Available after your first node.” and “No field uses left. Complete another node.” where applicable. Inventory remains inspectable without uses. Battle-only items have inline reasons, including Cleanser's statuses ending with battle. Empty pack has an explicit message.
- [ ] Provide native buttons for item and ally selection, an explicit `CONFIRM USE` button disabled without legal selection, Cancel/Back, and a separate confirmed discard step. Store the stale-command expected values when selecting, then render domain preview HP before/after, every changed PP move by name and actual amount, item quantity cost, and one field-action cost. On success close and restore focus to Inventory, announce the result, and let Field Pack users reopen for their second action.

```tsx
<PaperButton disabled={isResolving || !preview?.legal}
  onClick={() => { if (command) void useFieldItem(command); }}>
  CONFIRM USE
</PaperButton>
```

Use native dialog focus containment, a named heading via `aria-labelledby`, Escape's cancel event, initial focus, and focus restoration. Enter activates only the focused explicit control. Prevent cancel/route commitment races while resolving. Show legal failure reasons as text rather than hover-only titles.

- [ ] Render `previewRestChoice` for both choices, with member HP outcomes and PP per move including zeros where needed to understand rounding. Disable zero-effect choices. Warn that Refresh leaves KO allies KO. If a Revive Kit is owned, remind the player it can revive at 30% on the resolved route if allowance permits. Add `LEAVE WITHOUT RESTING`, completing the Rest node and forfeiting the sibling Shop.
- [ ] Update `guide.ts` and item detail copy for allowance, target selection, modifiers, KO options, cost, capacity baseline, and loss on node entry. In `BattleScreen.tsx`, attach the shared PP preview to existing selected-item confirmation so players see the automatically chosen move before spending the turn. Preserve the user's presentation changes and all hidden enemy-intent boundaries.
- [ ] In the E2E main flow also exercise Escape, Back, focus restoration, keyboard confirmation, no-uses inspection, confirmed discard, a disabled battle-only item, and a no-op Rest exit. Cover migration writeback/resume with an engine-created legacy save through IndexedDB in the failure flow. Do not read or screenshot session credentials.
- [ ] Run `pnpm test:domain`, `pnpm test:vitest`, `pnpm test:release`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and the focused E2E command across configured projects. Record exact failures/skips. Commit only verified recovery UI hunks with `feat: preview and commit recovery actions from route and Rest`.

## Handoff to B

Record the implementation commit, approved interface changes, commands/results, and remaining release gates in the conversation. Do not run historical audit writers or claim balance from unit tests. Next action: execute Part B after its scope approval.
