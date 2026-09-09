# Run Recovery C: Reward Identity and Validation Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Work single-threaded unless delegation is authorized under the working agreements.

**Goal:** Ship source-aware relic rarity, three relics, two consumables, clear reward copy, and measured complete-run recovery/economy evidence.

**Architecture:** A small pure relic-selection module serves rewards, shops, and Folded Tokens using tier-first weights. Existing item effects and battle/unit flags implement the content additions. One local audit script drives real domain transitions and records run-level evidence, with human playtests remaining a separate release gate.

**Tech Stack:** Existing TypeScript/React, SeededRng, Node domain tests, Vitest, Playwright, and Node standard-library audit scripts. Node 22.x and pnpm 12.1.0. No new dependency, service, datastore, or test framework.

**Spec:** [2026-09-08-run-recovery-economy-reward-depth.md](../specs/2026-09-08-run-recovery-economy-reward-depth.md), sections 6–13. Read its full metric table and human gate before C4/C5.

## Global constraints

- “Use `common | uncommon | rare`, with the existing item rarity vocabulary.” Stable existing IDs remain intact.
- Final pool is exactly 13 items and 19 relics. Add only `purge-pack`, `emergency-wrap`, `field-pack`, `deep-pockets`, and `reinforced-stance`.
- “No source grants an owned relic again.” Exclude new Spare Battery offers without Hans, but preserve already-owned copies. No other composition, injury, or affordability filtering.
- Bosses retain their existing reward layers. Boss 3's draft is a victory keepsake with zero subsequent combat value.
- “Sources with zero Rare weight never upgrade into Rare as a fallback.” Stop cleanly with depleted eligible pools.
- Preserve 12% non-Rare ordinary drops, common-only Scavenge, starting resources, route minimum two combats and stage-three Rest/Shop choice, enemy stats, existing event HP floors, and boss recovery 30%/25%/25%.
- “No isolated-battle win rate is presented as a run-completion rate.” Diagnostic bots do not estimate novice skill.
- No Deep Tonic, Counterfoil, Salvager, Efficient Mix, Field Medic, Camp Supplies, Dealer's Token, Collector's Mark, transmutation, automatic revival, extra boss layer, or broad character rebalance.

## Dependency, approval, and acceptance

Requires [A: Recovery foundation](2026-09-08-run-recovery-a-foundation.md) and [B: Economy integrity](2026-09-08-run-recovery-b-economy.md). Present the exact file map and new exports for required scope approval before implementation. This plan does not authorize a release or unbounded tuning. New interfaces and any changes spanning more than three modules require the project's approval. No additional persisted fields are planned.

**Part acceptance:** spec criteria 8–9 and 12, new content from 6–7, and completion of 10–11. Correctness can be complete before balance/human evidence exists. Report those statuses separately.

### File map

| Task | Existing files to modify | New files, not present at planning time |
|---|---|---|
| C1 | `src/game/content/relics.ts`, `src/game/balance/constants.ts`, `src/game/core/progression/rewards.ts`, `src/game/core/progression/shop.ts`, `src/game/core/progression/events.ts`, `src/game/content/events.ts`, `tests/domain/progression.test.mjs` | `src/game/core/progression/relicDrafts.ts`, `tests/domain/relicDrafts.test.mjs` |
| C2 | `src/game/content/items.ts`, `src/game/content/relics.ts`, `src/game/core/combat/actions.ts`, `src/game/core/combat/battleEngine.ts`, `src/game/core/combat/status.ts`, `tests/domain/mechanics.test.mjs`, `tests/domain/v03-content.test.mjs`, `tests/vitest/content.test.ts` | None |
| C3 | `src/features/shop/ShopScreen.tsx`, `src/features/reward/RewardScreen.tsx`, `src/game/content/guide.ts`, `src/ui/overlays/DetailPanel.tsx`, `README.md`, `tests/e2e/abungi.spec.ts`, `tests/release/v03-ui.test.mjs` | None |
| C4 | `scripts/economy-audit.mjs` | `scripts/run-recovery-audit.mjs`, `tests/domain/runRecoveryAudit.test.mjs`, `docs/RUN_RECOVERY_ECONOMY_AUDIT.md`, `docs/RUN_RECOVERY_BALANCE_AUDIT.md` |
| C5 | Only measured in-scope tuning values in `src/game/balance/constants.ts`, `src/game/content/items.ts`, `src/game/content/relics.ts`, and their live guide/README copy | `docs/RUN_RECOVERY_PLAYTEST.md` |

Audit report files are generated only when the implementation audit runs, not by this planning task. Raw per-attempt JSONL output stays in the explicit local temporary output directory unless intentionally selected for retention. Do not overwrite `docs/ECONOMY_AUDIT_V03.md` or `docs/BALANCE_AUDIT_V03.md`.

## C1: Tier-first selection across every relic source

**Acceptance:** unique deterministic picks, boss first-slot floor, correct source exclusions and depletion behavior, rare prices, finite shelves unchanged after purchase, and no current pending reward regeneration.

**Interfaces:** Part A establishes `RelicDefinition.rarity: ItemRarity` and `ShopOffer.rarity: ItemRarity` for the final save shape. This task adds domain-accessible tables and new exports:

```ts
export type RelicSource = 'shop' | 'elite' | 'boss' | 'folded-tokens';
export function eligibleRelics(run: RunState, source: RelicSource): RelicDefinition[];
export function drawRelicIds(
  run: RunState, source: RelicSource, count: number, rng: SeededRng
): string[];
```

`relicDrafts.ts` imports definitions from content and weights/prices from `BALANCE`. `eligibleRelics` removes owned IDs and Spare Battery without Hans and excludes zero-weight tiers except permitted lower-tier boss fallback. Do not export a generic selection strategy or new event effect type.

### Exact classifications and tables

Verify A's classifications against this list. C2 extends them with the three new IDs.

| Rarity | Existing IDs |
|---|---|
| Common | `cardboard-plate`, `red-stitch`, `copper-trace`, `violet-thread`, `marked-card`, `sticky-label`, `first-aid-tape` |
| Uncommon | `bike-bearing`, `shop-chit`, `elite-bandage`, `spare-battery`, `lucky-centavo`, `pressed-flower`, `chalk-outline` |
| Rare | `blue-tonic-cap`, `jumper-cable` |

Add `BALANCE.relicTierWeights` with the following tuple values `[common, uncommon, rare]`. Region arrays use indices 0, 1, 2. Add `BALANCE.relicBasePrices = {common:50, uncommon:60, rare:75}`.

```ts
relicTierWeights: {
  shop: [[78,20,2], [65,31,4], [50,43,7]],
  elite: [[72,25,3], [60,35,5], [48,44,8]],
  boss: [[50,44,6], [30,60,10], [0,85,15]],
  'folded-tokens': [[90,10,0], [90,10,0], [90,10,0]],
},
relicBasePrices: {common:50, uncommon:60, rare:75},
```

- [ ] Add one main seeded draft test and one depletion failure test to the new domain file. Import actual `RELICS`, `getRelic`, `createRun`, `SeededRng`, and new `drawRelicIds` from `.domain-build`:

```js
test('boss drafts are deterministic, unique, and start above Common', () => {
  const run = createRun(['earl', 'hans', 'leandre'], 42);
  const ids = drawRelicIds(run, 'boss', 3, new SeededRng(42));
  assert.deepEqual(ids, drawRelicIds(run, 'boss', 3, new SeededRng(42)));
  assert.equal(ids.length, 3);
  assert.equal(new Set(ids).size, 3);
  assert.notEqual(getRelic(ids[0]).rarity, 'common');
});

test('Folded Tokens cannot fall back into Rare when lower tiers are exhausted', () => {
  const run = createRun(['earl', 'hans', 'leandre'], 42);
  run.relicIds = RELICS.filter(r => r.rarity !== 'rare').map(r => r.id);
  assert.deepEqual(drawRelicIds(run, 'folded-tokens', 3, new SeededRng(42)), []);
});
```

Extend those tests with boss Common-only depletion, one/two eligible leftovers, all-owned exhaustion, and no-Hans filtering. A finite fixed seed set can exercise each region; do not assert random percentage tolerances as correctness tests. Use the audit for frequencies. Run `pnpm test:domain` and record expected failures.
- [ ] Implement draws without replacement. For each slot, construct nonempty tier buckets from remaining eligible definitions. Use `rng.weightedPick` for tiers, then `rng.pick` within the tier. Remove the chosen ID. For boss slot zero, set Common weight to zero and use the relative Uncommon/Rare row weights. If none remain, allow Common as lower-tier fallback. Boss 3 may likewise fall back to Common after its positive-weight stock is gone. Other zero-weight tiers remain forbidden. Break when no eligible tier remains, including `count <= 0`. Do not loop trying random rejected relics.
- [ ] Replace `distinctPicks(eligibleRelics,3,rng)` for elite/boss rewards with `drawRelicIds`. Keep upgrade sampling, coins, spoils, auto items, and boss recovery unchanged. Do not call the draw again in reward claim or resume. Existing pending IDs remain valid even if their new acquisition eligibility differs.
- [ ] Replace uniform shop relic choice with one `drawRelicIds(run,'shop',1,rng)` after the wildcard chance roll, using the same private shelf RNG and the rarity base price times existing variance and discount. If no eligible relic exists, fill wildcard with an item. Keep Leandre's draw after all four base offers/prices, and keep item weights unchanged. No acquisition/price recalculation of already saved shelves.
- [ ] Use `eligibleRelics(run,'folded-tokens')` in `canChooseEvent` and `drawRelicIds` in the `paper-shrine` random relic resolution. If eligible stock is empty, disable its paid option before charging. Retain cost 16 and PP alternative 22% missing PP. Change current “undiscovered” wording to “unowned”. Do not add a generic event rarity field or change other events.
- [ ] Run `pnpm test:domain`, `pnpm test:vitest`, `pnpm typecheck`, and B's Leandre/shelf tests. Commit with `feat: weight relic availability by source and rarity`.

## C2: Add exactly two items and three relics using existing mechanics

**Acceptance:** 13 items/19 relics, correct mixed-effect legality, all four negative statuses cleansed on living allies, and Reinforced Stance armed once per party even if never hit, surviving reload.

**Interfaces:** use A's `fieldUseLimit` and B's `inventoryCapacity` ownership checks. Use existing `BattleState.flags.reinforcedStanceUsed` and `BattleUnit.flags.reinforcedGuard` keys (new keys in existing boolean/number/string maps), no new status or persisted schema. Existing `incomingDamageMultiplier(unit)` reads the unit flag only while `guardActive`.

- [ ] Extend content tests to require 13 item IDs and 19 relic IDs, retaining every old ID exactly once. Add this actual item data in the content implementation step after the failure:

```ts
{id:'purge-pack', name:'Purge Pack',
 description:'Remove all negative statuses from every living ally. Battle only.',
 target:'ally-all', price:32, rarity:'rare', category:'utility',
 battleOnly:true, fieldCompatible:false, effects:[{kind:'cleanse',count:4}]},
{id:'emergency-wrap', name:'Emergency Wrap',
 description:'Restore 12% Max HP to one living ally and grant Fortified for one turn.',
 target:'ally-one', price:22, rarity:'uncommon', category:'recovery',
 battleOnly:true, fieldCompatible:false,
 effects:[{kind:'healPercent',percent:0.12},{kind:'status',statusId:'fortified',duration:1}]},
```

Four is the complete current negative-status count (`weaken`, `slow`, `blind`, `exposed`), not an infinite numeric value that would be unsafe to serialize. No healing effect on Purge Pack.

- [ ] In existing mechanics tests, use `createBattle` and actual `applyStatus` calls to build a living target at full HP without Fortified. Main test: Emergency Wrap is legal, HP remains full, Fortified appears and survives application, then expires after the target's next completed turn. Continue real `resolveBattleCommand` calls to that turn. Critical failure: full HP plus Fortified duration at least one is rejected with unchanged state/RNG. Do not stub status ticks.
- [ ] Add the Purge Pack main path to the existing cleanse test: apply all four actual negative statuses across living allies plus one positive status, resolve the item, verify all negatives removed and positive retained. Failure path: only healthy/status-free living allies (a KO ally may still have a negative status) produces illegal command and no turn consumption. Run `pnpm test:domain` before adding definitions/effects.
- [ ] Add these relic definitions. Values express the final limit/multiplier, not counters to accumulate:

```ts
{id:'field-pack',name:'Field Pack',rarity:'uncommon',
 description:'Use up to two field items after each completed node.',
 mechanicId:'field-use-limit',value:2},
{id:'deep-pockets',name:'Deep Pockets',rarity:'uncommon',
 description:'Carry seven individual consumables instead of six.',
 mechanicId:'inventory-capacity',value:7},
{id:'reinforced-stance',name:'Reinforced Stance',rarity:'common',
 description:'The first allied Guard each battle reduces incoming damage by 50% instead of 40%.',
 mechanicId:'first-guard-reduction',value:0.50},
```

- [ ] Keep `applyStatus`'s maximum-duration behavior. Check existing `tickOnlyExisting` against Emergency Wrap on self and another ally before altering it; it already preserves newly applied statuses on the application turn. Use existing healing, cleanse, and party targeting. A mixed item is valid if any actual effect benefits any eligible target. Preserve existing combat healing modifiers and First-Aid Tape behavior as the spec requires; its consumption rule is not a separate rebalance task.
- [ ] Add a main Reinforced Stance test using an engine-created battle, the real first Guard, `incomingDamageMultiplier`, and envelope/JSON roundtrip. With no other mitigation, expect 0.50. Failure path: after Guard expires, a subsequent allied Guard remains 0.60 even when the first Guard absorbed no hit. Check a second ally as well as the original actor; party-wide use is the rule.
- [ ] Implement the first-Guard branch and modifier:

```ts
// In the existing allied Guard command branch:
actor.guardActive = true;
if (state.relicIds.includes('reinforced-stance') && !state.flags.reinforcedStanceUsed) {
  state.flags.reinforcedStanceUsed = true;
  actor.flags.reinforcedGuard = true;
}
// In incomingDamageMultiplier:
if (unit.guardActive) value *= unit.flags.reinforcedGuard === true
  ? 0.50 : BALANCE.guardDamageMultiplier;
```

Clear `reinforcedGuard` whenever that unit's Guard ends, including all existing `guardActive=false` sites, but never clear `reinforcedStanceUsed` during a battle. New battles start with fresh flags. Preserve Fortified/Exposed and all other damage modifiers. Check the saved flags pass through Zod unchanged.
- [ ] Exercise acquiring Field Pack through actual reward claim followed by node completion: the upcoming interval allows two uses, acquisition alone never resets spent uses. Exercise Deep Pockets acquisition followed by the existing seventh-unit capacity path. Do not multiply limits if an invalid duplicate ID occurs in an old save.
- [ ] Run `pnpm test:domain`, `pnpm test:vitest`, `pnpm typecheck`, and `pnpm test:release`. Commit with `feat: add tactical recovery items and three focused relics`.

## C3: Show reward identity and final keepsake honestly

**Acceptance:** shop/reward rarity is visible, reduced/exhausted drafts remain usable, Boss 3 clearly ends the run, and live descriptions/counts agree without rewriting historical audits.

**Interfaces:** existing `reward.tier`, `run.regionIndex`, `reward.relicChoices`, `getRelic(id).rarity`; no new reward layers or result state.

- [ ] Extend the existing reward E2E flow with the main Boss 1/2 rarity presentation path and one exhausted/final keepsake path using real engine-produced saved rewards at the IndexedDB boundary if a full browser run is impractical. Never hand-author a fake `RewardState`. Run the focused test before copy/UI changes. Preserve the current user's E2E edits.
- [ ] In `RewardScreen`, compute final keepsake from the existing zero-based region and tier:

```ts
const isKeepsake = reward.tier === 'boss' && run.regionIndex === 2;
const relicHeading = isKeepsake ? 'Choose a victory keepsake' : 'Choose one relic';
```

Show “The run is complete. This keepsake records your victory; no battles remain for it to affect.” Keep the draft, claim, upgrade exhaustion, discovery recording, and immediate victory transition. Label final confirmation `TAKE KEEPSAKE & FINISH` when a relic exists, otherwise `FINISH RUN`. Do not promise the final skill upgrade changes another battle.
- [ ] Add each relic's real rarity label to reward choices and keep it separate from `kind` in shops: `RELIC · UNCOMMON`. Use existing rarity classes/tokens. Show one/two available choices normally, and an explicit exhausted-pool explanation with no compensating coins if empty. Keep the claim action available with no relic choice.
- [ ] Update guide/detail descriptions: Pressed Flower scope, field allowance/capacity relics, first Guard once per party, Emergency Wrap duration, Purge Pack battle-only behavior, Revive Kit 56 trial, PP move selection, and no guaranteed kit source. Preserve battle-only reasons and player-only recovery previews. Update README live inventory/relic counts to 13/19 and add expansion behavior without pretending old audits cover it. Do not rename the package release version without a separate request.
- [ ] Search `rg -n 'undiscovered|11 items|16 relics|46 coins|battle.only|35%|relic' src/game/content src/features src/ui README.md tests` and inspect matches. Correct current claims affected by this expansion, retain unrelated values and clearly historical documents.
- [ ] Run `pnpm test:domain`, `pnpm test:vitest`, `pnpm test:release`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `pnpm test:e2e --grep "reward|keepsake"`. Commit with `feat: present relic rarity and final victory keepsakes`.

## C4: Measure source rates and complete-run attrition

**Acceptance:** real complete attempts across fixed parties/seeds/policies, explicit denominators and unresolved attempts, all spec section 12 metrics, source/draft-level rarity frequencies, and reproducible baseline/candidate identities. A simulation implementation and a completed full matrix are separate checkboxes.

**Interfaces:** new Node-standard-library script `scripts/run-recovery-audit.mjs`, importable without executing its CLI. Export `runAttempt({domainDir,partyIds,seed,policy,maxActions}): Promise<AttemptRecord>` and `summarizeAttempts(records): object`. `domainDir` points to a compiled game tree, not a remote module. CLI uses built-in `parseArgs` and validates paths/numeric bounds before writing. New options:

```text
--domain-dir PATH       compiled game root, default .domain-build
--build-ref STRING      required identifiable source commit
--policy-ref STRING     required commit containing frozen policy code
--mode smoke|full       default smoke
--out PATH             required new JSONL output path, refuse overwrite
--report PATH          required Markdown summary path
```

`AttemptRecord` contains `{partyIds,seed,policy,result,deathNode,deathRegion,actions,firstDivergenceKey,regions,transitions}`. Result is exactly `victory | defeat | unresolved`. Each transition records node/region/action name, RNG before/after, resource deltas, offers/choice IDs, and recovery source, sufficient to aggregate the following table. Store both snapshots and domain events when attribution cannot be recovered from net deltas alone.

- [ ] Before implementation changes begin, identify and record the baseline commit with `git rev-parse HEAD` and working-tree differences. Never call a dirty state an exact commit baseline. Capture baseline v1 fixtures and build from an isolated checkout of the chosen committed baseline using the existing worktree procedure if needed. Keep the frozen audit script outside that checkout and pass its compiled directory with `--domain-dir`. Baseline selection occurs before tuning, and the original tree is never reset.
- [ ] Add one smoke main-path and one timeout failure test in `tests/domain/runRecoveryAudit.test.mjs` using imported `runAttempt`. Use actual `createRun`/engine data. The main path asserts a terminal or explicitly unresolved recorded attempt, nonempty transitions, and a complete accounting identity for coins/items. The critical failure uses `maxActions: 0` and expects `result: 'unresolved'`, never victory. Run `pnpm test:domain` before writing the loop.

```js
const record = await runAttempt({
  domainDir: '.domain-build', partyIds: ['earl','hans','leandre'],
  seed: 1, policy: 'novice', maxActions: 0
});
assert.equal(record.result, 'unresolved');
assert.equal(record.actions, 0);
```

- [ ] Implement one bounded transition loop using the existing domain operations. Resolve available route nodes with `availableRouteNodes`; set current-node entry and shop snapshots as A's store does; create battles with persisted party/coins/relics/region and current RNG; validate and resolve every command; export party and availableCoins; generate/claim rewards; complete a node once; advance after bosses; use `applyRestChoice`, `applyEventChoice`, `purchaseShopOffer`, and `applyFieldItem` only where legal. Escape completes without a victory reward. Count item consumption once at the same outer boundary as the store. Do not duplicate damage, recovery, draw, or purchase algorithms.
- [ ] Support the committed baseline through a small local capability branch in this script: if its field module is absent, record field use as unavailable; if its saved-shelf contract is absent, call its original `purchaseShopOffer(run,id,offers)` and record its actual regenerating behavior. Do not inject free field recovery or retrofit finite shops. Use conditional module imports only for the known A/B contract differences. No production compatibility abstraction.
- [ ] Freeze policy functions before comparison. All tie-breaks use definition/route order, not extra RNG. They may read visible enemy HP/affinity and their own abilities/items, but never enemy move selection, target intent, RNG future, or post-action damage forecasts. Use fixed heuristics:

| Policy | Route/Rest/economy | Battle |
|---|---|---|
| `novice` | Prefer Rest when any ally below 35% HP or KO, otherwise Shop if at least 16 coins, otherwise first legal route option. Recover for KO/low HP, otherwise useful Refresh. Buy first affordable useful recovery/resource item if space, at most once per offer ID per visit. Use useful field healing below 35%, then PP if any move is empty. Choose first legal reward/event option. | Revive a KO ally if kit available, heal below 25% HP, restore PP if no damaging move has PP, otherwise first legal damage ability on the lowest visible HP foe. First legal ability then Guard are fallbacks. |
| `resource-aware` | Prefer useful Rest for KO or party HP below 60% or aggregate PP below 40%, then a visible Shop when coins are at least 16 and the party has a recovery deficit and pack space, otherwise first combat/route option. Inspect actual stock only after entering. At Rest choose Recover for KO, else compare mean fractional HP restored with mean fractional PP restored, HP on ties. Spend on KO revival, then HP below 60%, then PP deficits of at least item gain. Reserve 16 coins unless buying a needed revive. Choose useful recovery spoils, otherwise cash; pick first highest-rarity offered relic and first upgrade. | Same legal recovery priorities at HP below 40%; score damaging abilities by printed power × hits × visible affinity multiplier across legal targets, with missing-HP healing as a candidate when useful. No hidden defense or next-enemy-action prediction. Definition order breaks ties. |
| `risk-seeking` | Same resource rules as resource-aware but prefer a reachable elite, then ordinary combat, before recovery nodes unless KO. Prefer cash/Scavenge greed spoils over sustain. | Use the same resource-aware battle policy so route risk is the principal difference. |

For all policies, discard only on a resolved route when full and holding a currently unusable battle-only item while a useful already-owned field item can be used or the next visible choice is a shop. Discard the first such item, never using hidden future stock. Loop field use only while useful and legal. Record intervals with useful inventory even when thresholds choose not to spend. On baseline, all capabilities absent from its rules remain absent.

- [ ] Record resource snapshots immediately before `createBattle` for boss-entry HP/PP, and again after it returns at first player input. The latter includes any automatic opening enemy turns, not just relic triggers, and must be labeled accordingly. If those effects need isolation, attribute actual engine events/known PP deltas rather than inventing a second battle-start engine.
- [ ] Implement these output groups, keeping unsuccessful attempts and reached-boss denominators:

| Group | Required fields/aggregation |
|---|---|
| HP / PP | Region boss entrants count, HP/max including KO zero, KO counts, mean/median/p10/p90, per-move PP deficits, exhausted move counts, pre-start and first-input PP |
| Items / revival | Acquired, bought, battle-used, field-used, discarded, capacity-blocked, remaining by region; kits offered/acquired/used separately; Rest/boss revives; survival through the next battle by revive source |
| Field / Rest | Uses per interval, useful-owned-item intervals, unspent intervals, second Field Pack action benefit; Recover/Refresh/leave and whether KO/both choices useful |
| Shops / coins | Visits, offers/sales, spend, affordable kit opportunities/purchases, unaffordable/full attempts; region entry/exit coin distributions; generated income, purchase/skill/event costs; KO/crit income separately |
| Relics / routes | Owned count, Rare offered/chosen by source/time, depleted pools, excluded conditional relics; elite coins/draft/upgrades against HP/PP/items spent and subsequent boss survival, including failed routes |
| Boss / result | Boss 1/2 draft quality and following-region outcomes, final keepsake separately, completion/death/unresolved by party/policy/region/node; first changed transition/RNG key across matched builds |

Preserve accounting categories rather than assigning relics/upgrades invented coin prices. For elite alternatives, run a diagnostic branch from the same reachable decision state through each available alternative under the same policy, labeling these counterfactual attempts separately from the primary 49,500. Compare all branch outcomes, not just elite survivors. Do not require later RNG streams to stay identical.
- [ ] Extend `economy-audit.mjs` with explicit `--out` support and refuse accidental overwrite of historical reports. Separate `offer.kind` from `offer.rarity` in counters (the current script counts the fake `relic` rarity). Report per-source/region slot-tier rates, three-choice draft Rare-exposure rates, boss first-slot guarantees, depletion cases, and observed item shelf frequencies before/after the two additions. Keep actual offer/acquisition distinction. Do not change source/item weights to make a frequency test pass.
- [ ] Compare Revive Kit base prices 46, 56, and 62 in the local economy measurement using the same seeded draws and existing price formula. Keep 56 as the candidate gameplay value until C5 review. Report 56-price bounds of 50–62 undiscounted and 44–54 with Shop Chit, and actual affordability/opportunity-conditioned purchase rates. A local price scenario must not mutate frozen production item data during ordinary tests.
- [ ] Implement smoke as first five lexicographically ordered parties × seeds 1–3 × all three policies (45 attempts). Full mode is all 165 unique three-character parties × seeds 1–100 × all three policies (49,500 attempts per build). Cap at 3,000 player commands per attempt and 200 per battle; cap breaches/errors are unresolved with reason. Log periodic counts so long runs remain observable.
- [ ] Run fresh `pnpm test:domain`, then smoke with explicit output paths, replacing the reference values below via PowerShell variables obtained from the actual commits. These variables are inputs captured during execution, not literal report labels:

```powershell
$candidateCommit = git rev-parse HEAD
$policyCommit = $candidateCommit
node scripts/run-recovery-audit.mjs --domain-dir .domain-build --build-ref $candidateCommit --policy-ref $policyCommit --mode smoke --out "$env:TEMP/abungi-recovery-candidate-smoke.jsonl" --report docs/RUN_RECOVERY_BALANCE_AUDIT.md
node scripts/economy-audit.mjs --out docs/RUN_RECOVERY_ECONOMY_AUDIT.md
```

Commit the audited implementation and frozen policies before setting these references. For repeated runs choose a fresh raw output filename; do not bypass refusal by deleting unrelated temporary files. Baseline invocation uses the same script/policy ref and the separately compiled baseline directory/ref.
- [ ] Inspect smoke results for accounting consistency, legal actions, terminal outcome handling, no-access intervals, and timeouts. Then run `--mode full` once per baseline and candidate, using separate raw output files. Read JSONL in the script to compare matching party/seed/policy keys and render paired summaries. Report first divergence, not an assertion that same seed means identical later encounters.
- [ ] Record full commands, source/policy references, seed list, counts, elapsed time, failures, and unresolved attempts in `docs/RUN_RECOVERY_BALANCE_AUDIT.md`. Record source-rate/price/content findings in `docs/RUN_RECOVERY_ECONOMY_AUDIT.md`. Commit the script/tests and deliberately generated reports with `test: audit complete-run recovery and reward economy`.

## C5: Review attrition, collect human evidence, and close release gates

**Acceptance:** all spec correctness checks have fresh evidence, balance findings are interpreted with denominators, and first-time/returning human feedback is recorded. An unavailable human cohort is a named release blocker, never fabricated or replaced with bot results.

**Interfaces:** consumes C4 reports only. No new code interfaces. Any tuning outside the named numeric/content scope requires approval.

- [ ] Review the following as investigation triggers, not automatic targets: resource-aware Region 3 entrants median HP >85% **and** PP >80%; one Rest choice >80% when both useful; kits acquired >1 per completed run; useful intervals mostly unspent; weak second Field Pack utilization; matched-policy recovery combinations >10 percentage-point completion improvement; elite alternatives consistently costing survival without meaningful build quality. Stratify by reached region, lower-tail failures, party, no-healer composition, and policy.
- [ ] For recovery combinations, report ownership timing and survivorship bias in observational comparisons. If testing controlled combinations, run a separately labeled diagnostic with the same party/seed/policy and disclosed relic injection/acquisition timing. Do not mix those attempts into natural-run completion statistics or claim causation from surviving owners alone.
- [ ] Request human playtest participation when the playable implementation and feedback sheet are ready. Target at least five first-time and three returning players, two runs each where practical. Record actual participant counts, prior experience, selected parties, incomplete sessions, and one row per run in new `docs/RUN_RECOVERY_PLAYTEST.md`:

```markdown
| Participant code | Prior experience | Run | Party | Result / stopped at | Field rule understood | Rest reasoning | Named PP destination | KO recovery assumption | Boss 1/2 next decision | Final keepsake response |
|---|---|---|---|---|---|---|---|---|---|---|
```

Use anonymous participant codes and their observed responses. Ask them to explain allowance, Rest, the selected PP move, and KO options, then ask which reward changed their next decision after each boss. Ask about keepsake satisfaction separately. Do not imply a statistically reliable population estimate.
- [ ] If rules are misunderstood, fix the affected existing UI/copy before changing enemy strength. If understood but trapping players, inspect the actual failed route/party, recovery affordability, and lower-tail demand. Keep rarity/draft quantity and enemy stats unchanged unless evidence and a new approved scope support an adjustment.
- [ ] For accepted tuning, change only documented constants/content values and all current descriptions of those values. Run affected tests and the paired smoke first, then rerun full comparisons if the economy/attrition result changed. Preserve prior baseline evidence and identify each candidate by commit. Do not rewrite historical audits as current proof.
- [ ] Final fresh correctness commands: `pnpm test:domain`, `pnpm test:vitest`, `pnpm test:release`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `pnpm test:e2e`. These cover five configured viewports, despite README's old “four” wording. Correct that live README command description as part of C3. Run audit scripts only with explicit report destinations.
- [ ] In the final implementation handoff, report each spec acceptance criterion against its evidence, exact commands/outcomes/failure output, skipped checks, automated full-matrix status, and actual human sample. Mark release ready only if required checks and human/balance review are complete. Otherwise end with the specific remaining blocker and next action.

## Coverage index across the three plans

| Spec acceptance | Implementing tasks |
|---|---|
| 1. Existing resources only | A1/A3 field counter contract; C4 accounting |
| 2. Exactly one/two uses and interval lifecycle | A1/A3/A4; C2 ownership acquisition |
| 3. Rest split recovery and PP | A3/A4 |
| 4. Kit battle/field, terminal defeat | A2/A3/A4 |
| 5. No-waste and cancellation | A2/A3/A4; C2 mixed/cleanse effects |
| 6. Six/seven individual items | B1/B3; C2 Deep Pockets |
| 7. Stable finite Leandre shelves | A1 snapshot; B2/B3; C1 seeded ordering |
| 8. Rarity across all sources | C1/C2/C4 |
| 9. Boss draft floor and final keepsake | C1/C3/C4 |
| 10. Exact player-visible previews/reasons | A4/B3/C3, with C5 human checks |
| 11. Migration, resume, failure visibility | A1/A4/B2/B3; C2 flag roundtrip |
| 12. Complete runs and human validation | C4/C5 |

Next action after plan review: obtain implementation scope/contract approval and start A1. Do not begin with balance tuning or add the deferred content.
