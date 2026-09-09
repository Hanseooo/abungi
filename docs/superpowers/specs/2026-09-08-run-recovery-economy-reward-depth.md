# Abungi — Run Recovery, Economy & Reward Depth

Status: proposed design for review, not an implemented or balance-validated release.
Date: 2026-09-08.
Scope: strengthen the supplied expansion against the current repository. Implementation requires a separate request. This document does not authorize schema or public-interface changes by itself.

## 1. Recommendation

This is a good fit for Abungi. Limited field use gives existing inventory a useful role in route planning, and weak Rest revival lets a player recover from a KO without removing its cost. Better relic drafts can make optional danger feel worthwhile.

Ship the recovery rules and economy safeguards first, then the small content expansion. Adding all proposed recovery relics together would make their combined effect difficult to assess and could undermine late-run attrition.

The intended experience is: a mistake hurts, the player can understand their remaining options, and recovery requires spending something or foregoing something else. A new player should lose because of a sequence of understandable decisions, not an unexplained item rule or an accidental wasted purchase.

### Alternatives considered

| Approach | Benefit | Cost | Decision |
|---|---|---|---|
| Recovery rules, rarity, three relics, two items, staged validation | More decisions with a manageable balance surface | Smaller initial content burst | Recommended |
| Add every suggested item and relic together | More immediate variety | Duplicate effects, diluted drafts, compounded sustain | Defer |
| Only improve UI and rarity labels | Lowest implementation cost | Does not solve portable recovery or stranded KO allies | Insufficient |

All new numerical values below are initial tuning values. Existing values explicitly marked “retain” are the control baseline. Neither constitutes evidence that the expansion is balanced.

## 2. Repository findings that change the draft

Paths below are relative to the repository root and were inspected on the date above.

| Current behavior | Evidence | Design consequence |
|---|---|---|
| 11 items, including Circuit Brew and Brick in a Sock | `src/game/content/items.ts` | Add two items for 13 total. No need for four additions. |
| Revive Kit already restores 30% HP, costs 46, and is battle-only | `src/game/content/items.ts` | Retain its ID and heal amount. Add field compatibility. Test a moderate price increase. |
| Recover heals living allies 35%. Refresh restores 30% missing PP per move, including KO members | `src/game/core/progression/rest.ts` | Add 10% Rest revival. Preserve Refresh's existing coverage. |
| Boss reward heals survivors 30%, revives KO allies at 25%, restores 25% missing PP | `src/game/core/progression/rewards.ts`, `src/game/balance/constants.ts` | Preserve this earned recovery. The draft omitted an existing revival source. |
| Normal spoils already trade cash/items against 5% living-party HP or 10% missing PP. Automatic non-Rare item drop chance is 12% when space permits | `src/game/core/progression/rewards.ts` | Include these sources in the recovery budget. Do not increase drop frequency. |
| Elite Bandage restores 10% living-party HP after elites | `src/game/content/relics.ts`, `src/game/core/progression/rewards.ts` | Do not add a duplicate Salvager. |
| Blue Tonic Cap already increases PP restoration by 25% | `src/game/content/relics.ts` and restoration paths | Do not add Efficient Mix. |
| Pressed Flower and First-Aid Tape already boost healing. Jumper Cable restores PP at battle start | `src/game/core/combat/battleEngine.ts` | Audit combinations before introducing further healing/PP relics. |
| Party run state has HP and PP but no statuses. Battle export does not preserve statuses | `src/game/core/types.ts`, `exportPartyFromBattle` | Cleanser cannot have useful field behavior. Keep cleansing battle-only. |
| Same statuses already retain the greater duration without stacking intensity | `src/game/core/combat/status.ts` | Preserve `applyStatus`, do not replace the status system. |
| Shop relic chance is 18% / 23% / 28%, with 0.9–1.1 price variance | `src/game/content/shops.ts`, `src/game/core/progression/shop.ts` | Retain cadence and variance. Add rarity within that cadence. |
| Shops regenerate from current run state. No purchased-offer ledger exists | `generateShopOffers`, `purchaseOffer` in `src/app/appStore.ts` | Freeze shelves and track purchases before tuning scarcity. Repeated item buying and relic-driven shelf changes would distort it. |
| Folded Tokens sells a uniformly random unowned relic for 16 coins | `src/game/content/events.ts`, `src/game/core/progression/events.ts` | Give this source its own restrained rarity pool so it cannot bypass the new economy. |
| Region 3 boss rewards precede immediate run victory | `claimRewardChoice`, `advanceRegion` | Final rewards cannot change subsequent combat. Treat them as a victory keepsake, not a build payoff. |

The README still labels the release v0.2 and links some older audit names. Executable content includes v0.3 additions. This proposal uses code as the baseline and treats historical plans/audits as context, not current proof.

## 3. Acceptance criteria

1. HP, PP, Coins, and Items remain the only run resources. Field allowance is an action limit, not a currency or bankable resource.
2. One successful field-item use per completed node, two with Field Pack. No refill from reopening UI, reload, duplicate completion, or reward substeps.
3. Recover restores 35% Max HP to survivors and revives KO allies at 10%, without PP recovery or double-healing revived allies. Refresh remains a separate choice.
4. Revive Kit works in battle and field at 30% Max HP. Full-party defeat stays terminal.
5. Item use with zero benefit spends neither item nor field allowance nor battle turn. Cancellation changes nothing.
6. Inventory capacity is six individual consumables, seven with one Deep Pockets. All award, purchase, and display paths agree.
7. Shop shelves are unique, stable, finite, and reload-safe. Leandre adds one item offer without altering the four base offers or relic roll.
8. Relic rarity changes availability across every acquisition source. No owned duplicates or guaranteed composition-perfect drafts.
9. Boss 1 and 2 drafts have better rarity quality than same-region elite drafts without adding reward layers. Final boss copy acknowledges the run has ended.
10. New players can preview exact recovery, PP destination, item cost, and unavailable reasons without seeing hidden enemy intent.
11. Existing saves load without loss of party, inventory, upgrades, pending rewards, or battle state. Failed persistence is surfaced.
12. Complete-run simulation and human playtests evaluate combined attrition before release. No isolated-battle win rate is presented as a run-completion rate.

## 4. Field actions and transition rules

Field use is allowed only on a resolved Route screen with `status === 'active'`, no active battle, no pending reward, and at least one living party member. It is unavailable inside shops, events, Rest, reward selection, or results. Resolve the current node before using what it awarded or sold.

Store successful uses spent in the current interval. Derive the allowance from owned relics. Do not store remaining uses and maximum as separate facts.

| Transition | Allowance behavior |
|---|---|
| New run before its first node | Zero available. Show “Available after your first node.” |
| A node completes for the first time | Reset spent uses to zero and open a new interval |
| Enter the next node | Close field access. Unspent actions expire |
| Complete battle reward selection | Open one interval after claim, not one at victory plus another at claim |
| Event starts a battle | No interim interval. Resolve that battle and node first |
| Escape a normal encounter | Open one interval when that node is completed. Preserve existing no-victory-reward escape behavior |
| Leave a shop or resolve/leave Rest or event | Open one interval, even when its choice gave no resources |
| Finish boss 1 or 2 and advance region | Carry the single interval created by boss-node completion into the new route |
| Acquire Field Pack in a node | Upcoming interval has two uses. Acquisition itself never refills an interval |
| Reload, reopen inventory, dismiss a scene, repeat a completion request | No reset |
| Full-party defeat or final victory | No field access |

Items found in a node are usable in the interval after that node. One party-wide item still costs one action and one consumable. Battle items use the existing combat turn and do not draw on field allowance.

Node completion must be idempotent before it owns allowance refresh. The current `completeRouteNode` avoids duplicate IDs but still increments score on repeated calls. A repeated completion must become a no-op for score and allowance.

### Route inventory UX

- Show `FIELD USE · 1/1` or `0/1`, adjusted for Field Pack, and `PACK · 4/6`.
- Inventory remains inspectable with no uses left. Explain “No field uses left. Complete another node.”
- Show battle-only items disabled with an inline reason, not only a hover tooltip.
- Select an item, select a valid ally if needed, preview exact effects, then confirm. PP previews identify the move automatically selected.
- Cancel, Escape, and Back close selection without cost. Restore focus to Inventory when closing. Enter confirms only the explicit current selection.
- On success return to route selection with a concise result. With Field Pack, reopening inventory permits the second action.
- Lock commitment and route entry while the action is being committed. Revalidate against current state on submit.
- Empty inventory, invalid target, no effect, and save failure have explicit messages. Use existing overlays/buttons/tokens.
- Allow discarding one owned consumable from field inventory without spending a field action, with explicit confirmation. Discarding grants nothing and cannot refill allowance. This provides an intentional way to make room without adding an overflow inventory.

## 5. Rest and revival

### Recover

For each party member, inspect HP at the start of the choice:

- Living: `min(maxHp, hp + round(maxHp * 0.35))`.
- KO: set to `max(1, round(maxHp * 0.10))`.
- A revived ally does not also receive the living-member heal.
- No PP restoration. No revival scaling from healing relics.

### Refresh

For each ability of every party member, including KO members, retain `round(missingPP * 0.30 * ppModifier)`, clamped to its upgraded maximum. Blue Tonic Cap supplies the existing 1.25 modifier. Refresh neither revives nor heals.

Do not add minimum-one PP recovery to every move. That would disproportionately improve many small deficits. A missing 1 PP restores 0 at baseline. Preview actual rounded values and disable Refresh when its total effect is zero.

Recover and Refresh remain the only two primary choices. Add a secondary “Leave without resting” exit for cases where neither is useful or the player declines. Leaving completes the node and forfeits its choice. It does not let the player pick a sibling shop afterward.

Show each member's resulting HP and PP gain before commitment. Warn when Refresh leaves an ally KO. Show a gentle reminder about an available Revive Kit, without selecting the answer for the player or guaranteeing a kit source.

### Revive Kit

Retain `revive-kit`, Rare, one KO ally, 30% Max HP, unchanged PP. Enable battle and field use. Healing bonuses do not increase revival. It occupies one normal inventory slot.

Start at **56 coins**, comparing 46, 56, and 62 in economy tests. Jumping immediately from 46 to 65 would combine a large price increase with scarcity and could make the safety option theoretical for novices. The field extension is valuable enough to test a moderate premium first.

At 56 base price, the undiscounted seeded range is 50–62 coins. With Shop Chit's existing 12% discount it is 44–54. This competes with several basic consumables, while a Rest revival consumes a route/Rest opportunity instead of coins.

Ordinary battles and common Scavenge never award Rare items. Revive Kit appears only through shop wildcard/Leandre item draws in this release. Rare event acquisition is deferred until measured shop acquisition shows a need. Do not add a guaranteed revive, starting kit, pity revival, or automatic KO-revival relic.

Keep earned boss recovery at 30% HP for survivors, 25% HP for KO members, and 25% missing PP. Rest revival adds an earlier option, not a replacement for the existing region transition.

## 6. Item pool: 13 total

Retain all 11 IDs and existing effects except the explicit changes below.

| Item | Field? | Change |
|---|---|---|
| Patch Kit | Yes | Retain 35% single-target HP, 16 coins |
| PP Tonic | Yes | Retain 4 PP, 18 coins. Correct automatic move selection below |
| Field Ration | Yes | Retain 14% HP to living party, 24 coins |
| Circuit Brew | Yes | Retain 3 PP to one move per living ally, 30 coins |
| Revive Kit | Yes | Retain 30% revival, trial base price 56 |
| Cleanser | No | Retain removal of up to two negative statuses. Explain that statuses end with battle |
| Energy Drink, Power Snack, Guard Patch | No | Retain existing two-turn buffs |
| Smoke Bomb, Brick in a Sock | No | Retain current escape/damage behavior |
| Purge Pack — new `purge-pack` | No | Rare, utility, 32 coins. Remove all current negative statuses from every living ally. No healing |
| Emergency Wrap — new `emergency-wrap` | No | Uncommon, recovery, 22 coins. Heal one living ally 12% Max HP and apply Fortified for one turn |

Emergency Wrap trades healing efficiency for immediate protection. The existing affected-unit duration semantics apply: the buff must survive its application turn and expire after the target's next subsequent completed turn. It does not grant an extra turn. It is valid if either healing or a duration increase is useful. Do not reject a full-HP ally who would gain Fortified.

Purge Pack uses existing cleanse behavior with coverage for all four current negative statuses: `weaken`, `slow`, `blind`, `exposed`. A useful party cleanse can include unaffected allies, but requires at least one affected living ally.

Skip Deep Tonic for now: PP Tonic and Circuit Brew already provide single-target and party coverage, and a stronger clone is not needed to reach the target pool size. Skip Counterfoil until actual affinity-heavy encounter tests establish demand. It would require new hit-consumption rules and competes with existing Guard/Fortified/first-hit protection.

### PP selection and no-waste semantics

Keep automatic selection rather than expanding the battle command contract to select a move:

1. Consider only owned moves below their upgraded maximum PP.
2. Pick the one with the lowest absolute current PP.
3. Break ties by the character definition's ability order.
4. Restore the item amount with existing Blue Tonic Cap scaling, round once, and clamp.

The current resolver sorts all moves, which can select a full low-capacity move despite another move missing PP. Validation and execution must agree on the corrected eligible set. Use the same selection rule in battle, field, and previews. Do not silently redesign Jumper Cable's separate battle-start behavior in this change.

No-effect checks operate on actual resulting benefit after rounding/capping. A party or mixed-effect item is legal when at least one effect benefits at least one eligible target. Overheal or PP overflow is allowed when some benefit remains, but the preview shows only the amount actually restored. No automatic spillover to another move or ally.

Unknown item IDs, missing quantities, invalid targets, wrong context, and stale commands return a reason without mutation. Field HP/PP items cannot target KO members unless explicitly revival. Preserve `max(existingDuration, newDuration)` for identical statuses. Different statuses continue to coexist.

### Healing modifiers

Preserve current combat healing and PP behavior unless explicitly changed above. Field HP items apply Pressed Flower's 1.08 healing multiplier, with one final round and HP cap. First-Aid Tape remains battle-only and is not consumed by a field item. Rest, events, and boss percentage healing retain their existing unmodified HP amounts. Revival is never ordinary healing for modifier purposes. Document Pressed Flower's scope accordingly rather than promising bonuses to every recovery source.

## 7. Relics: rarity and limited expansion

Use `common | uncommon | rare`, with the existing item rarity vocabulary. Rarity controls source availability and shop base price, not an automatic stat multiplier. Keep stable existing IDs.

Initial classifications:

| Rarity | Existing relic IDs |
|---|---|
| Common | `cardboard-plate`, `red-stitch`, `copper-trace`, `violet-thread`, `marked-card`, `sticky-label`, `first-aid-tape` |
| Uncommon | `bike-bearing`, `shop-chit`, `elite-bandage`, `spare-battery`, `lucky-centavo`, `pressed-flower`, `chalk-outline` |
| Rare | `blue-tonic-cap`, `jumper-cable` |

Blue Tonic Cap and Jumper Cable substantially alter PP budgeting without introducing a damage multiplier. Their Rare placement is a proposed classification, not proof that their present effects are balanced.

Add only these three relics, bringing the pool to 19:

| Name / new ID | Rarity | Exact initial effect |
|---|---|---|
| Field Pack / `field-pack` | Uncommon | Maximum two field actions per interval instead of one |
| Deep Pockets / `deep-pockets` | Uncommon | Seven individual consumables instead of six |
| Reinforced Stance / `reinforced-stance` | Common | The first allied Guard command each battle uses a 0.50 incoming-damage multiplier instead of the normal 0.60 until that Guard ends |

Reinforced Stance is once per party per battle, not once per character. Mark it used on the first Guard command, even if no attack lands before it expires. Fortified and other existing modifiers continue to apply in the normal damage calculation. Repeated Guard does not rearm it, and its state survives a battle reload. It gives defensive play a visible payoff without supplying HP or PP.

Field Pack and Deep Pockets are ownership checks, never additive counters. No source grants an owned relic again. Deep Pockets does not increase stack size alone: two Patch Kits consume two capacity units, as they do now.

Do not add Salvager or Efficient Mix because their jobs already exist. Defer Field Medic and Camp Supplies until the combined recovery baseline is tested. Defer Dealer's Token until shelf rarity is measured. Collector's Mark and all transmutation belong to a separate future spec. There is no implemented transmutation system to integrate here.

Exclude Spare Battery from new offers when Hans is absent because it literally has no effect for that run. Do not filter other offers to make them ideal for the current party, injury, or spending power. Already-owned relics remain intact.

## 8. Rarity draws and reward quality

Each relic pick first rolls a tier, then picks uniformly from eligible relics in that tier. Remove selected IDs before the next pick. Percentages below are tier weights, not per-relic weights, so adding more Common definitions does not silently dilute Rare probability.

| Source / region | Common | Uncommon | Rare |
|---|---:|---:|---:|
| Shop 1 | 78 | 20 | 2 |
| Shop 2 | 65 | 31 | 4 |
| Shop 3 | 50 | 43 | 7 |
| Elite 1 | 72 | 25 | 3 |
| Elite 2 | 60 | 35 | 5 |
| Elite 3 | 48 | 44 | 8 |
| Boss 1 | 50 | 44 | 6 |
| Boss 2 | 30 | 60 | 10 |
| Boss 3 keepsake | 0 | 85 | 15 |
| Folded Tokens, all regions | 90 | 10 | 0 |

For boss drafts, draw the first slot from Uncommon/Rare using that row's relative weights. Draw the other two slots normally. This guarantees at least one Uncommon-or-better choice while eligible stock exists, including on Boss 1. It improves the worst boss draft instead of flooding the entire draft with Rare relics.

If a weighted tier is empty, renormalize over nonempty eligible tiers with positive source weight. If all such tiers are empty, allow lower tiers as a fallback for boss guarantees. Sources with zero Rare weight never upgrade into Rare as a fallback. Stop when the eligible pool is exhausted. Show one or two choices when fewer than three remain. If none remain, omit the relic choice and explain exhaustion. Do not add compensating coins or another reward layer.

Elites retain stronger encounter coins, one-of-three relic selection, and one skill upgrade. Bosses retain coins, one-of-three relic selection, one upgrade, recovery, and progression. Existing upgrade exhaustion behavior remains valid.

Do not describe a per-slot Rare weight as the probability of a Rare appearing in a three-choice draft. Report measured draft-level rates, guarantees, and depletion effects separately. Boss slot-one conditioning raises Rare exposure beyond the table's ordinary slot weight.

Boss 3 ends the run. Keep its existing draft and discovery recording, but label it a victory keepsake and explain it has no remaining battles to affect. Do not add a pre-boss reward, extra region, permanent stat bonus, or transmutation to solve that presentation issue. Evaluate “my build changed” for bosses 1 and 2 only. Final-boss combat reward expected value is zero after victory, however prestigious its keepsake looks.

## 9. Shops, inventory, and event economy

Keep four base offers: Recovery, Resource, Tactical, Wildcard. Leandre adds a fifth item offer. Preserve current category membership, including Cleanser as a possible resource shelf choice and utility items in the tactical pool. New Purge Pack can enter the utility pool. Revive Kit remains category `revive`, eligible only for unrestricted item draws.

Preserve current item weights initially: Common 8, Uncommon `4 + regionIndex`, Rare `0.35 + regionIndex * 0.45`. These are per-item weights, unlike the new tier-first relic selection. Report how the two new items change actual shelf frequencies before altering those weights.

Only the wildcard may become a relic. Its chance stays 18%, 23%, 28%. If no eligible relic exists, offer an item instead. Leandre's extra selection happens after all four base offers and prices, using the remaining item pool. Same seed, node, relic ownership, and region with/without Leandre must produce identical first four offers.

Initial relic base prices: Common 50, Uncommon 60, Rare 75. Keep 0.9–1.1 seeded variance and Shop Chit's 12% discount. Buying Shop Chit does not reprice the current shop. It affects future shop snapshots. Rarity is displayed separately from kind: `RELIC · UNCOMMON`, not a fake fourth rarity called `relic`.

### Finite shelves

Generate a shelf once on entry and persist its offers/prices and purchased offer IDs. A purchased offer remains visible as sold out. It never replenishes, rerolls, or changes another offer. No buyback or selling system.

The domain purchase operation must reject unknown, sold-out, unaffordable, already-owned, or capacity-blocked purchases. Deduct coins and grant the item/relic atomically. Resolve authority from the saved shelf rather than accepting a caller-provided price as authoritative. A double click, stale UI, or resumed save cannot buy the same offer twice.

Capacity checks use total quantities and the same derived capacity everywhere: shop legality, reward drops, Scavenge, event multi-item rewards, route inventory, and displays. A paid two-item event requires two free slots before deducting money. Do not silently accept payment for a partial grant.

Retain current reward behavior when full: automatic item drops are not generated and Scavenge is not offered. Do not add a free overflow stash. Discarding before node entry is an intentional capacity decision. Frozen shop inventory does not become accessible for field consumption inside the shop.

### Events

Keep Folded Tokens' 16-coin random relic option and its PP alternative, but restrict its relic source to the table above. It offers a cheap uncertain Common, occasionally Uncommon, rather than a discounted route to the strongest PP relics. Update “undiscovered” copy to “unowned” because current eligibility is run ownership, not profile discovery.

Preserve all other existing event rewards, costs, and HP floors. No new revive event, transmutation pool, or generic event rarity framework is needed in this release.

## 10. Fairness and difficulty boundaries

- Preserve the route's minimum two pre-boss combats and the stage-three Rest/Shop choice. Do not increase enemy stats to offset recovery before measuring its actual effect.
- Keep the starting 30 coins, one Patch Kit, and one PP Tonic. Do not add beginner-only hidden resources or adaptive shop guarantees.
- Teach field allowance once through concise route/guide copy. A player who uses their only action on healing should understand why they cannot also restore PP.
- Show per-move PP in recovery previews. A healthy party can still be resource-starved, which total PP alone conceals.
- Show KO recovery options and exact resulting HP. Never imply 10% revival is safe or that a later shop guarantees a kit.
- Preserve hidden enemy moves, targets, and damage forecasts. Recovery previews reveal only the player's own deterministic resource changes.
- Make no recovery relic required for ordinary run completion. If a party without a healer or PP relic is unviable, inspect resource demand and route choices before adding another safety layer.

The goal is readable consequences and viable recovery routes, not a prescribed win rate or an equal split between every choice.

## 11. Agent implementation guidance

This is a staged design, not authorization for a repository-wide patch. Before implementation, present the exact affected modules and obtain the project's required approval for persisted schema/public-interface changes and work spanning more than three modules. No dependency, service, database, or authentication work is needed.

### Existing code seams

| Concern | Existing paths and exports | Intended work |
|---|---|---|
| Definitions and tuning | `src/game/content/items.ts`: `ItemDefinition`, `ITEMS`; `src/game/content/relics.ts`: `RelicDefinition`, `RELICS`; `src/game/balance/constants.ts`: `BALANCE` | Add explicit field compatibility, rarity, approved content and tuning values |
| Transitions | `src/game/core/progression/run.ts`: `createRun`, `completeRouteNode`, `advanceRegion` | Own interval lifecycle and idempotence |
| Recovery and rewards | `src/game/core/progression/rest.ts`: `applyRestChoice`; `src/game/core/progression/rewards.ts`: `generateReward`, `claimReward` | Exact Rest outcomes, weighted relic picks, capacity consistency |
| Shop and events | `src/game/core/progression/shop.ts`: `generateShopOffers`, `purchaseShopOffer`; `src/game/core/progression/events.ts`: `canChooseEvent`, `applyEventChoice` | Stable finite shelf, source rarity and atomic grants |
| Combat items | `src/game/core/combat/actions.ts`: `validatePlayerCommand`; `src/game/core/combat/battleEngine.ts`: `resolveBattleCommand`; `src/game/core/combat/status.ts`: `applyStatus` | Match legality to outcome, PP eligibility, new item effects and Guard relic |
| State/save | `src/game/core/types.ts`: `RunState`; `src/game/core/save/saveFormat.ts`: `migrateSaveEnvelope`; `src/services/save/schema.ts`: `SaveEnvelopeSchema` | Persist and validate new state without losing v1 runs |
| App/UI | `src/app/appStore.ts`; `src/features/route/RouteScreen.tsx`; `src/features/rest/RestScreen.tsx`; `src/features/shop/ShopScreen.tsx`; `src/features/reward/RewardScreen.tsx`; `src/game/content/guide.ts` | Single-commit actions, previews, accessibility, copy and rarity display |

Proposed new state fields, not present today:

- `RunState.fieldUsesSpent: number | null`. `null` means no interval has been opened yet. Non-null is a nonnegative integer. Current node/battle/reward/status still gates access while inside a node.
- `RunState.shopVisit`: nullable snapshot containing node ID, generated offers, and purchased offer IDs. Retain it through the current shop visit and clear on entering another node. Completed-node state prevents reopening a spent shop.

Prefer a single small proposed domain file, `src/game/core/progression/fieldItems.ts`, for field eligibility, preview, and application. It does not exist yet. Keep it pure. Search for helpers before adding any. Extract a shared PP selector only because battle legality, battle execution, and field use now need the same selection. Extract derived inventory capacity because it has multiple existing consumers. Do not create a generic effect engine, plugin registry, or parallel implementation of combat.

Add an explicit `fieldCompatible` flag to item data. Missing flags mean unavailable in field. Do not infer field safety from absence of `battleOnly`: Cleanser demonstrates why that is unsafe. One source of truth must power both disabled reasons and execution.

Use `BattleState.flags` / unit flags for Reinforced Stance, following current battle mechanics. Add no permanent resistance/status subsystem. Relic draft source weights live in domain-accessible content/balance data, never React.

### Save and deterministic behavior

Choose and review the exact migration contract before coding. Recommended: bump the save envelope to v2 and migrate v1 explicitly through the existing migration seam. Update TypeScript types, the lightweight domain validator, Zod schema, and repository parsing together. Do not merely default a UI counter while Zod strips it from saves.

- Migrated v1 runs already on a resolved route receive an interval with zero spent actions, once as a migration benefit. Pre-first-node runs receive `null`.
- Migrated v1 runs inside unresolved nodes receive no accessible interval. Completing the node opens it normally.
- Preserve pending reward IDs exactly. Never regenerate an already-present draft under new weights.
- For an unresolved v1 shop, historical purchases cannot be reconstructed because no ledger exists. Generate and persist one migrated shelf from its saved run. Explain in migration notes that this can refresh that one legacy shelf. Do not claim exact purchase-history recovery.
- All subsequent shop offers, purchases, field counters, and battle flags survive reload. Migration runs once and is itself saved.
- Invalid counters, invalid shelf references, or inconsistent purchased IDs are rejected with the existing corrupt-save recovery path. No silent run deletion.
- Field use consumes no RNG. Seeded draws advance only at committed generation points. Same post-migration state and commands reproduce the same outcomes.
- Autosave follows the committed state. Save failure displays the existing warning and retains the in-memory result. Do not reapply the item on retry or promise durability when storage failed.

### Delivery slices

1. **Recovery foundation:** approve save/interface contract, implement interval lifecycle, field items, weak Rest revival, PP no-waste correction, and previews. No new consumables or recovery multipliers.
2. **Economy integrity:** stable shelves, sold-out purchases, all capacity paths, migration/resume coverage. Required before drawing scarcity conclusions.
3. **Reward identity:** relic rarity/source weights, three relic additions, two item additions, guide/shop/reward copy. Keep separate checkable commits or review slices without unrelated refactors.
4. **Balance pass:** compare complete runs and human feedback, tune documented constants, then record final values and verification evidence.

Each slice states acceptance criteria before editing. Respect the project limit on modules per approved change. Do not update historical audit results as if they describe the new implementation.

## 12. Verification and balance protocol

The existing `scripts/economy-audit.mjs` samples route/shop/reward generation. `scripts/balance-audit.mjs` simulates isolated battles with no consumable/relic run economy. Neither currently measures this expansion's full-run acceptance criteria. Both write Markdown reports when run. Do not overwrite those reports just to review this proposal.

### Focused correctness checks

Use existing domain/Vitest/E2E infrastructure. For each non-trivial behavior, demonstrate a meaningful failing test before implementation, then its passing result. Keep each behavior's additions to one representative main path and one critical failure path, using actual content definitions and real engine-produced states.

Prioritize:

- Field use changes resources, quantity, and spent action together. No-effect/replayed commitment changes none of them.
- Node completion and region advance open exactly one interval. Reload retains spent actions.
- Recover branches correctly for one living and one KO ally, with unchanged PP. Terminal defeat cannot be revived.
- PP selection skips a full low-capacity move. Preview and actual restoration agree with upgraded caps.
- Emergency Wrap permits a useful partial effect. Purge Pack rejects a party without negative statuses.
- A shop purchase leaves a stable sold-out slot. Reload/double submission cannot charge/grant twice.
- Six/seven-item limits agree across shop, drop, Scavenge, multi-item event, and UI.
- Seeded relic drafts satisfy uniqueness/guarantees and terminate with depleted pools. Folded Tokens cannot award Rare.
- v1 engine-created save payloads migrate without losing run data. Malformed new state fails explicitly.
- A mobile keyboard/touch flow can inspect, cancel, use, close, and resume field inventory, with visible reasons and restored focus.

### Complete-run simulation

Extend the existing audit approach or add one small local script using real domain transitions. Do not build a simulation service. Capture baseline and candidate from identifiable commits with identical seed lists, party lists, and policies.

Initial matrix: all 165 three-character parties, 100 seeded runs each, three policies. This is 49,500 attempts per build. Run a smaller smoke matrix first, then the full matrix after correctness checks pass. Report timeouts as unresolved/failures, never wins.

Policies must use only player-visible information and the same domain item/purchase/route rules:

- **Novice proxy:** legal straightforward attacks, simple low-HP recovery thresholds, no enemy-intent knowledge or multi-step lookahead.
- **Resource-aware:** compares actual recovery, affordable purchases, PP deficits, and visible route opportunities using fixed documented heuristics.
- **Risk-seeking:** chooses more available elites and greed spoils while still using legal recovery.

These are diagnostic bots, not estimates of real novice skill. Freeze policies before comparing builds. If the baseline has no field-use action, record that capability as absent rather than injecting free recovery. Record first divergence when new RNG draws change subsequent paths. Same seed does not guarantee identical later encounters after a rule change.

| Metric | Required interpretation |
|---|---|
| Boss-entry HP | Mean, median, p10/p90 per region, HP/max HP including KO as zero, plus KO count. Show how many attempts reached that boss |
| Remaining PP | Per-move deficits, party PP/max PP, exhausted move count, measured before boss-start relic triggers and separately at first input |
| Item flow | Acquired, bought, used in battle, used in field, discarded, blocked by capacity, and remaining per region |
| Revives | Kits offered/acquired/used separately, Rest revives, boss revives, next-battle survival after each source |
| Field use | Uses per interval, intervals with a useful available item, unspent intervals, benefit of second Field Pack use |
| Rest choices | Recover/Refresh/leave rates, stratified by KO presence and by whether both choices were useful |
| Shops | Visits, available offers, sold offers, spending, unaffordable/no-space attempts, kit purchase rate when offered and affordable |
| Coins | Entry/exit distributions per region, generated coins, purchases, skill costs, event costs. Track KO/crit income separately |
| Relics | Owned count, Rare offered versus chosen, source and acquisition timing, pool exhaustion, unavailable conditional relics |
| Elite value | Coins/relic/upgrade outcomes plus HP/PP/item cost and subsequent boss survival. Compare reachable alternatives, not just surviving elite winners |
| Boss value | Draft quality and changes in subsequent-region outcomes for bosses 1/2. Report final keepsake separately |
| Run result | Attempt completion, death region/node, party composition and policy. Include unsuccessful runs, not only survivors |

Do not collapse relics and upgrades into invented coin values. Report reward value as a vector of guaranteed coins, choice quality, actual resource cost, and later outcomes. Any model-derived scalar estimate must state its assumptions and uncertainty.

### Initial investigation triggers, not universal pass/fail targets

- Region 3 entrants with median HP above 85% **and** median PP above 80% under the resource-aware policy suggest insufficient attrition. Inspect how many runs reach that point before drawing a conclusion.
- Recover or Refresh above 80% of Rest choices when both are useful suggests one option may dominate. A KO-driven preference for Recover is expected.
- Kits acquired more than once per completed run on average warrant a scarcity review. Rare offers alone are not acquisition.
- Most field intervals unused despite useful owned items suggest poor discoverability or overly cautious policy. A second Field Pack action rarely used despite need suggests weak relic value.
- A recovery relic combination improves matched-policy completion by over 10 percentage points: inspect the combination before globally raising enemy damage.
- Optional elite routes consistently reduce subsequent survival without improving meaningful build options: improve draft floor or encounter value, not reward quantity by default.

Do not force a numerical full-run win-rate target without a human baseline. Review lower-tail deaths, no-healer parties, and novice mistakes alongside averages.

### Human playtest gate

Recruit at least five first-time players and three returning players for two runs each where practical. Record the sample size, selected parties, prior experience, and incomplete sessions. This is formative feedback, not a statistically reliable population estimate.

Observe whether players can explain field allowance, choose a meaningful Rest option, identify the PP move being restored, and recover from a KO without assuming a guaranteed revive source. Ask after each boss which reward changed their next decision. For final victory, ask whether the keepsake feels satisfying without implying more combat.

If players understand the rules but still feel repeatedly trapped, examine the failing route/party and recovery affordability. If they fail because the rule was hidden, fix the presentation before changing enemy strength.

### Commands for the implementation handoff

Use repository-defined commands after the relevant slices: `pnpm test:domain`, `pnpm test:vitest`, `pnpm test:release`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`. Run relevant `pnpm test:e2e` flows for the changed UI. Run the updated audit scripts only when their output locations and intended report changes are explicit.

Report exact commands, outcomes, failures, and skipped checks. Re-run only checks affected by subsequent edits. A release requires fresh evidence, not the existence of this checklist.

## 13. Exclusions and next decision

No new currency, automatic revival, broad inventory increase, extra boss reward layer, persistent field statuses, transmutation, new service/dependency, enemy-intent UI, or difficulty-mode system. No broad character rebalance is authorized by this proposal.

Review this design before implementation, particularly the 56-coin Revive Kit trial, 13-item/19-relic scope, finite shop shelves, and final-boss keepsake treatment. The first implementation decision is approval of the recovery/save-state slice and its exact interface changes.
