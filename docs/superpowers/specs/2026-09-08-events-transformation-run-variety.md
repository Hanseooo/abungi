# Abungi — Events, Transformation & Run Variety

Status: proposed design for review. Not implemented, not balance-validated.
Date: 2026-09-08.
Scope: revision of the supplied Spec 02 draft, checked against the repository on the date above. Implementation requires a separate request. This document does not authorize schema or public-interface changes by itself.

Depends on: `docs/superpowers/specs/2026-09-08-run-recovery-economy-reward-depth.md` (referred to below as **Spec 01**). Only §7.2 and delivery slice 3 depend on it — they need the relic `rarity` field Spec 01 slice 3 adds. Slices 1, 2 and 4 are independent of Spec 01 and can be planned and built without it.

## 1. Recommendation

The draft is directed at the right problem. Events are the cheapest source of run-to-run variety Abungi has, and the current pool of eleven two-choice events is thin. But the draft sizes its ambition against the event *pool* rather than against event *exposure*, and it assumes an item/relic rarity ladder that does not match this game's content.

Measured exposure, from 20,000 simulated runs against `generateRegionRoute`:

| Lane policy | Event nodes entered per run | Distinct event IDs seen |
|---|---:|---:|
| Always take the event lane | 3.66 | 3.17 |
| Random lane | 2.99 | — |
| Avoid events where possible | 2.33 | — |

Repeat rate for an event-seeking player, at the current pool of eleven: **39.8% of runs show the same event twice**. Per-region probability of reaching at least one event node on the event-seeking path: **80.1%**; across regions 2 and 3 combined, **95.9%**.

Three consequences drive this revision:

1. **A player sees about three events per run.** In a uniform pool of fifteen, any single event appears in roughly 21% of runs. Authoring effort per event is only repaid for events that are weighted up or anchored.
2. **Deduplication beats pool growth.** `route.ts` draws event IDs with `rng.pick(EVENT_IDS)` and no memory. Drawing without replacement across a run removes the repeat problem more effectively than five new events, at a fraction of the cost.
3. **A Rare-weighted recruitment event is invisible.** At a 5% draw weight over 2.44 region-2/3 event draws it appears in ~12% of runs. Recruitment must be anchored to route generation or cut.

Ship in three slices: variety plumbing first (dedup, derived offers, character variants), then the two transformation events, then recruitment. Recruitment is the only part that touches party state and is the only part that can be deferred without weakening the rest.

### Alternatives considered

| Approach | Benefit | Cost | Decision |
|---|---|---|---|
| Dedup + 4 new events + character variants + anchored recruitment | Real variety per run, one new party-state rule | Recruitment still touches `PartyMemberRunState` | Recommended |
| Draft as written: 14–16 events, tags, rarity transmutation, wheel, persisted event state | Largest content surface | Save schema v3, a cross-battle debuff subsystem, a tag taxonomy with one consumer, a rarity ladder that inverts this game's item power | Reject |
| Dedup and character variants only | Cheapest measurable variety gain | No transformation, no party pivot, weak relics stay dead weight | Insufficient, but a valid slice 1 |

All numeric values below are initial tuning values, not evidence of balance.

## 2. Repository findings that change the draft

Paths are relative to the repository root.

| Current behavior | Evidence | Design consequence |
|---|---|---|
| Event nodes appear only at stages 2, 5 and 6, one lane entered per stage | `src/game/core/progression/route.ts` `STAGE_POOLS` | Maximum three event nodes per region path; measured mean 1.22. Size content to ~3 events per run. |
| `rng.pick(EVENT_IDS)` per node, no memory within or across regions | `route.ts` `makeNode` | 39.8% of event-seeking runs repeat an event. Draw without replacement. |
| Commons are Patch Kit, PP Tonic, Cleanser, Brick in a Sock (avg price 17.75). Uncommons include three battle-only 2-turn buffs and Smoke Bomb (avg 21.83) | `src/game/content/items.ts` | Item rarity does not track usefulness. "2 Common → 1 random Uncommon" is a 39% value loss and a beginner trap. Reject §15 and §16 of the draft. |
| Relics have no rarity field | `src/game/content/relics.ts` `RelicDefinition` | All relic transmutation is blocked on Spec 01 §7. |
| Spec 01's proposed Rare tier is two relics: `blue-tonic-cap`, `jumper-cable` | Spec 01 §7 | "Safe Exchange keeps Rare" is a coin flip over one alternative. Exclude Rare relics from the event entirely. |
| Best existing Rare relic odds are Boss 2 at 10% per slot; Folded Tokens is capped at 0% Rare | Spec 01 §8 | An Uncommon→Rare press would become the cheapest Rare source in the game, for the two relics that most change PP budgeting. Forbid Rare output. |
| `PartyMemberRunState` carries HP and PP only; battle export drops statuses | `src/game/core/types.ts`, Spec 01 §2 | A "next-battle disadvantage" wheel segment requires a new persisted cross-battle debuff system. Cut it. |
| Three Cups pays 10 on a 5-coin wager at 50% | `src/game/content/events.ts` | Expected value is exactly zero. Already flagged in `docs/ECONOMY_AUDIT_V03.md` watchpoint 2. A 0-EV gamble that consumes a route node is strictly declinable. |
| Event hints already state exact odds (`50%: win 10 coins`) | `events.ts` `street-game` | Yeeho cannot be rewarded with information the UI already shows. |
| No captain concept exists (`grep -i captain` over `src/` and `docs/`: zero hits) | — | Delete draft §26. `run.party` is an ordered array of three; a recruit takes the outgoing member's index. |
| No `displayName ===` branching anywhere; content keys on `characterId` and `mechanicId` | `src/game/content/*.ts` | Draft §27 is already satisfied by existing convention. |
| Six of eleven events already have an HP or PP branch | `events.ts` | The pool is already recovery-heavy. Add no further recovery events (rejects draft §33). |
| `generateReward` already builds `relicChoices` and `upgradeChoices` via `distinctPicks`; `claimReward` already applies an upgrade | `src/game/core/progression/rewards.ts` | Choose-one-of-three is an existing, reusable pattern. Skill upgrades are reachable from events with no new machinery. |
| Save schema is version 1; Spec 01 proposes version 2 | `src/game/core/save/saveFormat.ts` | Events must not force a third bump. Derive offers instead of persisting them. |
| `canChooseEvent` already gates coins, pack capacity, relic exhaustion, full-HP paid heals and full-PP paid restores | `src/game/core/progression/events.ts` | Draft §11's no-waste rules mostly exist. Extend the same function; do not design a new legality layer. |
| Event outcomes already commit through the run RNG and `completeRouteNode`, and cannot be rerolled by reload | `appStore.ts` `chooseEvent` | Draft §7 is satisfied for outcomes. Only *offers* are new. |

## 3. Acceptance criteria

1. HP, PP, Coins, Items and Relics remain the only run resources. No new currency, no cross-battle status, no persistent event flags.
2. Event IDs are drawn without replacement for the whole run. A run never presents the same event twice while unseen events remain.
3. Every generated offer (transmutation candidates, recruit candidates, upgrade candidates) is a pure function of `(run.seed, nodeId)`. It advances no run RNG and is persisted nowhere. Reload reproduces it exactly.
4. Every committed outcome advances the run RNG once and completes the node, matching current `applyEventChoice` behavior. Reload cannot re-roll a committed outcome.
5. No event choice consumes a resource when its effect cannot occur. Ineligible choices are disabled with a visible reason, in text, not only a tooltip.
6. Every event retains a free exit.
7. No event grants a relic, item or upgrade of a rarity or quality that its equivalent combat reward could not grant. Events never award Rare items (Spec 01 §6) and never award Rare relics.
8. Character variants replace or extend a base choice; a variant's advantage is worth at most roughly ten coins or one modest tier of an existing effect.
9. Recruitment inherits HP percentage, PP percentage and upgrade *count*. It grants no free power and no free healing beyond the stated KO floor.
10. The route's minimum of two pre-boss combats and the stage-3 Rest/Shop choice are unchanged. Total event value per run does not rise enough to make an event-seeking route better than a combat route.
11. Existing saves load unchanged. This specification introduces no new persisted field and no schema version bump.
12. Event hints show absolute resulting values for the current party alongside percentages.

## 4. Event pool: 15 total, drawn without replacement

Retain all eleven existing event IDs. Add four.

| ID | Category | Weight | Purpose |
|---|---|---:|---|
| `swap-meet` | transmutation | common | Convert dead inventory into a chosen item, or into coins |
| `the-press` | transmutation | uncommon | Give dead Common relics late-run value |
| `sparring-yard` | trade | uncommon | Buy a permanent skill upgrade with coins and HP |
| `fourth-chair` | recruitment | anchored, see §8 | Mid-run party pivot |

Fifteen definitions, not twenty-five. At ~3.2 event nodes entered per run this is roughly five runs of non-repeating content, which is the right ratio for handcrafted presentation.

### Deduplication

`generateRegionRoute` currently picks each event ID independently. Change it to draw from the set of event IDs not yet assigned in this run, falling back to the full pool when the set is exhausted. Region 2 and 3 routes are generated at `advanceRegion` from the live run, so the already-assigned set is derivable from `run.route.nodes` plus the current route; no new persisted field is required if the exclusion set is passed as a parameter and the caller derives it. Confirm by simulation that distinct-events-per-run rises to the visited-node count.

Weights may be stored as numbers on the definition and consumed by a `weightedPick` in `makeNode`. Rarity names are content metadata only.

### Categories

Use the draft's category vocabulary as content metadata for authoring and audit grouping: `recovery`, `trade`, `gamble`, `transmutation`, `recruitment`, `sacrifice`, `combat`, `lore`. Drop `character` — a character variant is a property of a choice, not a category of event. Categories select nothing at runtime beyond weighting and must not acquire an engine.

### Availability conditions

Extend `canChooseEvent`, which already gates coins, capacity, relic exhaustion, full-HP paid heals and full-PP paid restores. Add only what the new events need: minimum owned items of a kind, minimum owned Common relics, at least one un-upgraded party ability, and presence of a required character. Ineligible *events* are excluded at route generation only where the condition is stable for the whole run (recruitment region). Everything else is a disabled choice with a reason, because run state changes between generation and arrival.

## 5. Determinism without new state

Split offers from outcomes.

- **Offers** — which three items `swap-meet` shows, which two characters `fourth-chair` shows, which three upgrades `sparring-yard` shows. Derive with a scratch generator seeded from the run seed and the node ID: `new SeededRng(run.seed, hash(nodeId) ^ run.seed)`. This advances no run RNG, persists nothing, and reproduces identically on reload by construction. Offers may filter against current run state (party membership, ownership) because run state cannot change while an event is open.
- **Outcomes** — wager results, press results. Consume the run RNG at commit time exactly as `wagerCoins` does today, then complete the node. Already reload-safe.

This deletes draft §8 in full. No `RunState.pendingEvent`, no save schema version 3. Note that Spec 01 already proposes a bump to version 2; events must not stack a third.

Add one small string hash helper next to `SeededRng`. Do not add a second RNG implementation.

## 6. Gambling: replace zero expected value with a stake decision

`street-game` currently has an expected value of exactly zero. It is correctly declined by any player who values the route node, and the existing economy audit already lists it as a watchpoint. The draft's "neutral to mildly positive" target reproduces the same failure.

Restate the goal: the interesting question is not *should I gamble* but *how much variance can this run absorb*. Retune `street-game` into a three-stake wager, re-themed as the draft's cardboard wheel. Presentation may be a wheel; the mechanic stays `wagerCoins`.

| Choice | Cost | Win chance | Payout | Net EV |
|---|---:|---:|---:|---:|
| Small stake | 6 | 55% | 14 | +1.7 |
| Medium stake | 15 | 45% | 36 | +1.2 |
| Large stake | 30 | 35% | 90 | +1.5 |
| Walk away | 0 | — | — | 0 |

Expected value is roughly flat and roughly +1.5 coins. That is under one tenth of a normal fight's mean coins (17–30 per `docs/ECONOMY_AUDIT_V03.md`), so the event never competes with combat. Variance ranges from ±6 to ±30, and Walk Away stays correct for a run that is saving an exact amount — losing 15 coins while holding 50 toward a Revive Kit is a real cost.

The existing `canChooseEvent` coin check disables stakes the player cannot afford, with a reason. Show the exact odds and both outcomes on every stake, as the current hints already do.

**Yeeho variant.** The draft's "reveals exact probabilities" is void: `events.ts` already prints them. Give Yeeho a fourth stake instead — 60 coins, 25%, 260 payout, net EV +5. It is the only stake that can meaningfully change a run's purchasing power in one decision, it is available in one party in three, and it is a decision a bad player will lose money on.

No paid segment improvement (draft §12.4). No "next-battle disadvantage" segment: `PartyMemberRunState` has no status storage and Spec 01 confirms battle export drops statuses, so that one wheel slice would cost a persisted cross-battle debuff subsystem.

Reduced motion: `SettingsState.reducedMotion` exists. Under it, present the result as segment highlighting with no spin.

## 7. Transformation

### 7.1 `swap-meet` — items

Reject the draft's rarity-ladder trade. In this game's item pool, Commons are Patch Kit, PP Tonic, Cleanser and Brick in a Sock; Uncommons are three battle-only two-turn buffs, Smoke Bomb, Field Ration and Circuit Brew. Trading two Commons for one random Uncommon converts 35.5 coins of the game's most reliable items into 21.8 coins of situational buffs. It is a downgrade wearing an upgrade's label, and beginners will take it.

The real inventory problem in a six-slot pack is dead weight and duplicates, not rarity. Address that instead.

**Choices:**

1. **Trade two** — the player selects any two owned consumables, then chooses one of three seeded item offers. Frees one slot. Requires at least two owned items and produces a net capacity gain, so it is never capacity-blocked.
2. **Pawn one** — the player selects one owned consumable and receives 50% of its listed price, rounded down (8 to 15 coins today). Frees one slot and gives a full pack an exit that is not "leave the reward behind". Limit one item per visit.
3. **Leave** — free.

Offers are drawn from all non-Rare items, excluding Revive Kit, per Spec 01 §6's rule that Rare items reach the player only through shop wildcard and Leandre draws. The player choosing one of three is what makes this feel like a gain despite the coin-value loss; a blind roll would not.

Selection of which items to sacrifice is explicit and previewed. Nothing is consumed until confirmation.

### 7.2 `the-press` — relics

**Blocked on Spec 01 §7.** Do not implement before relic rarity exists.

Accept **Common relics only**. Spec 01's initial Common tier is `cardboard-plate`, `red-stitch`, `copper-trace`, `violet-thread`, `marked-card`, `sticky-label`, `first-aid-tape`, plus the proposed `reinforced-stance` — eight relics, of which the four affinity-damage relics are worth close to nothing to a party lacking that affinity. Those dead relics are exactly what this event exists to recycle.

| Choice | Requires | Outcome |
|---|---|---|
| Safe exchange | One owned Common relic, one unowned Common relic | Sacrifice the chosen relic, receive a different unowned Common relic |
| Risk the press | One owned Common relic | 45% a random unowned Uncommon · 35% a different unowned Common · 20% destroyed |
| Leave | — | Free |

**The press can never output Rare.** Spec 01's Rare tier is `blue-tonic-cap` and `jumper-cable`, both of which reshape PP budgeting, and its best Rare odds anywhere are Boss 2 at 10% per slot. A 45% Uncommon output is already the most generous relic upgrade in the game; adding Rare would make this event the dominant relic source.

**Uncommon and Rare relics cannot be pressed or exchanged.** With only two Rare definitions a same-rarity Rare swap is a coin flip on the single alternative, and an Uncommon reroll adds nothing the safe exchange does not already do for Commons. One input rarity, one sentence, no protection rules needed. This replaces draft §17.1, §17.2 and §18 entirely.

The 20% destruction chance is deliberately survivable: pressing a dead affinity relic is nearly free upside, pressing `cardboard-plate` is a real gamble. The decision depends on run state, which is the point. Display destruction prominently and confirm before commit.

### 7.3 `sparring-yard` — skill upgrades

Not in the draft. Added because it is the highest-value event available for the least new code.

Skill upgrades currently exist only as elite and boss rewards. They are the most legible permanent reward in the game and the one a beginner understands immediately. `generateReward` already assembles `upgradeChoices` with `distinctPicks` over un-upgraded party abilities, and `claimReward` already applies one including its `maxPPDelta`.

| Choice | Cost | Effect |
|---|---|---|
| Train | 22 coins and 8% party Max HP | Choose one of three un-upgraded party abilities and upgrade it |
| Leave | — | Free |

Compare to the elite fight that would otherwise supply the upgrade: an elite pays roughly 28–40 coins *and* a one-of-three relic *and* an upgrade, for a real HP and PP cost. Paying 22 coins plus 8% HP for the upgrade alone is clearly the worse trade, so this does not make combat avoidable. It does give a coin-rich, HP-healthy run something to buy, which is currently a gap late in region 2.

Disabled with a reason when the party has no un-upgraded abilities, or when coins are short. The HP cost floors at 1 like every other event HP cost.

## 8. Recruitment: `fourth-chair`

The most expensive part of this specification and the only part that touches party state. It is worth building only if it is actually reached.

### 8.1 Placement, not weighting

A Rare-weighted recruitment event appears in roughly 12% of runs at 5% draw weight. Anchor it instead:

- The run's recruitment region is derived from the seed alone: `hash(run.seed) % 2` selects region 2 or region 3. No persisted field.
- Within that region, the first event node in stage order is the recruitment node.
- If the player's path does not pass that node, the run offers no recruitment.

Measured region-level probability of reaching at least one event node on the event-seeking path is 80.1%, and the designated node is one of at most three, so expect recruitment to be offered in roughly half to two thirds of event-seeking runs and considerably less often otherwise. Confirm the exact figure by simulation before tuning. This is exceptional without being a lottery, and a player who wants it has a route strategy for finding it.

### 8.2 Candidates and terms

Two candidates drawn from the eight characters not in the party, derived from `(seed, nodeId)` per §5. Plus **Keep Current Party**, always free.

| Rule | Value |
|---|---|
| Incoming HP, replacing a living member | `round(incoming.maxHp × outgoingHpPercent)`, minimum 1 |
| Incoming HP, replacing a KO member | `round(incoming.maxHp × 0.15)` |
| Incoming PP | Outgoing member's `sum(currentPP) / sum(maxPP)` applied to each incoming ability, clamped to its maximum |
| Upgrades | Incoming member enters with the same **number** of upgrades as the outgoing member, chosen by the player from the incoming character's abilities |
| Party slot | The recruit takes the outgoing member's array index |

The draft's §25 (no upgrades transfer) makes recruitment a trap. By region 2 a member typically carries two to four upgrades; losing them on top of inherited HP means Keep Current Party is almost always correct, and the feature reads as exciting and then never fires. Inheriting the count grants no free power — the same number of upgrades exists before and after — while keeping the pivot attractive. Inheriting *which* upgrades is impossible across different ability sets, so the player picks, reusing the reward screen's existing selection pattern.

The 15% KO floor sits between Spec 01's proposed 10% Rest revival and the 25% boss revival. Replacing a KO member is not a revive: that character is gone from the run.

### 8.3 Confirmation flow

Reveal both candidates with full stats, abilities and passive. Player picks a recruit, picks who leaves, sees the resulting HP and PP for the incoming member, then confirms. Nothing commits before confirmation; there is no first-tap replacement.

**Warn before confirming** when the outgoing member is the sole enabler of an owned relic or party-wide effect. Today that is exactly two cases: Hans with `spare-battery` owned, and Leandre's `good-business` shop offer. Both are one ownership check. Warn, do not block.

### 8.4 What recruitment must not become

Recruitment grants no healing beyond the KO floor, no PP beyond the inherited percentage, no items, no coins, and no relic. It is a lateral pivot with a real cost. Initial party selection stays meaningful because a swap costs the outgoing member's accumulated state and because most runs never see the event.

## 9. Character variants without a tag system

Reject draft §28. Ten content tags with one consumer, disambiguating nothing, is a second taxonomy built ahead of need. Every example in draft §29 is a single-character variant.

Add one optional field to `EventChoice`:

```ts
requiresCharacterId?: string
```

Filter choices by party membership when rendering, and reject in `canChooseEvent` when absent. That is the entire hook system, and it satisfies draft §30's extension contract exactly: a future character ships its variants as choice entries carrying its own stable ID, with no change to generic event logic. Existing content already keys on `characterId` and `mechanicId` — `grep` finds no `displayName ===` branching anywhere — so draft §27's prohibition needs one sentence, not a section.

Introduce tags only when two characters must share a variant. Nothing today does.

Initial variants, one per event, each replacing or sitting beside the base choice it improves:

| Event | Character | Variant |
|---|---|---|
| `street-game` | Yeeho | Fourth stake: 60 coins, 25%, 260 payout |
| `repair-bench` | Hans | Tune restores 40% of missing PP instead of 25% |
| `night-cart` | Jiro | Cooks the meal: 16% party heal for 0 coins instead of 8 |
| `old-locker` | Greg | Field Ration plus 8 coins, at 8% party HP instead of 5% |
| `bulk-deal` | Leandre | The crate costs 14 coins instead of 20 |
| `live-wire` | Earl | 30% missing PP at 4% party HP instead of 9% |

Each variant is worth roughly six to ten coins, in line with Leandre's existing fifth shop offer. That is character identity, not a hidden power tier. Hold every future variant to the same ceiling.

## 10. Optional combat events

`shortcut` already exists and already pays full battle rewards for a real Fast Lane encounter. Draft §31 and §32 are satisfied. Change nothing here.

- **The avoid branch keeps paying nothing.** A consolation reward was considered and rejected. HP and PP are the scarce resources in Abungi; coins are not. The moment Avoid pays anything at all it becomes a guaranteed positive at zero resource cost, and for any injured party the correct play tips to always avoid — the event stops being a decision and becomes a coin dispenser, which is the exact failure draft §40 exists to prevent. A small amount such as 5 coins probably would not flip it, but that is a guess, and proving it would cost more measurement than the feel-bad is worth. If Spec 01's playtest cohort reports the empty branch as unsatisfying, revisit it then with real feedback.
- Add no second combat event in this release. One is enough at three events per run, and each additional one raises average run combat, which interacts with the attrition budget Spec 01 is still validating.

Use the normal combat engine and the existing `battle` effect kind. Build no event-specific combat.

## 11. Presentation and accessibility

Continue the existing theatre treatment in `EventScreen.tsx`. Add themes for the four new events; add no per-event React screen and no presentation metadata beyond a theme ID until a specific event needs it. Draft §36's background/prop/animation/sound metadata block is speculative at ~21% exposure per event.

Dialogue variation reuses the existing `scenes.ts` variant mechanism with `event-arrival`. Add no branching narrative engine.

Required, and mostly already present:

- Every choice states its cost and its effect before commitment. `canChooseEvent`'s reason string already renders in-band in the choice button; keep it there rather than moving to a tooltip.
- **Show absolute values alongside percentages**, computed from the current party: `Restore 25% of missing PP (+14 PP across the party)`. This is the single largest beginner-comprehension win available in the event screen, it matches Spec 01's preview requirement at Rest, and the run state needed is already in scope.
- Multi-step events (`swap-meet` selection, `fourth-chair` confirmation) support Escape and a Back control at every step, restore focus to the originating control on cancel, and commit only on an explicit confirm.
- Disabled choices remain focusable and announce their reason. No reliance on color alone.
- Reduced motion suppresses the wheel spin and the press animation, showing the result directly.

## 12. Exclusions

Not in this release, and not authorized by it:

- Item rarity transmutation in either direction (draft §15, §16).
- Uncommon or Rare relic transmutation, and any Rare relic output (draft §17.1, §17.2, §18).
- Event content tags (draft §28).
- Persisted event instance state and any save schema bump (draft §8).
- Cross-battle statuses or a "next-battle disadvantage" wheel segment (draft §12.2).
- Paid wheel improvement (draft §12.4).
- New recovery events (draft §33). Six of eleven existing events already carry an HP or PP branch.
- Captain or party-ordering semantics (draft §26). No captain concept exists.
- Any new dependency, service, datastore or currency.

## 13. Delivery slices

1. **Variety plumbing.** Run-level event deduplication, weighted event selection, the derived-offer helper, `requiresCharacterId`, the six character variants, absolute-value hints, and the `street-game` stake retune. No new event definitions, no new persisted state, no dependency on Spec 01.
2. **Transformation.** `swap-meet` and `sparring-yard`, plus the multi-step choice contract in §13.1 that both need. No dependency on Spec 01: `swap-meet` excludes Rare *items*, and `ItemDefinition` already carries `rarity`.
3. **The press.** `the-press` alone. **Blocked on Spec 01 slice 3.** `RelicDefinition` is `id, name, description, mechanicId, value` — there is no rarity field, so "an unowned Common relic" is not an answerable query today. This is a compile-time blocker, not a preference, which is why it is a slice of its own rather than half of slice 2.
4. **Recruitment.** `fourth-chair`, seed-derived placement, inheritance rules, confirmation flow, orphaned-relic warning.

Each slice states its acceptance criteria before editing and respects the project limit on modules per approved change. Slice 4 is the only one that touches `PartyMemberRunState` handling and should be reviewed separately.

Sequencing against Spec 01: slice 1 shares no files with Spec 01 slice 1 beyond `appStore.ts` and should follow it rather than run beside it. Slices 2 and 4 are independent of Spec 01 entirely. Slice 3 waits.

### 13.1 The multi-step choice contract

`chooseEvent(choiceId)` commits in one call. `swap-meet` needs the player to select two owned items and then pick one of three offers; `fourth-chair` needs a recruit, an outgoing member, and an upgrade selection. Neither fits the current contract, and this is the one interface question slices 2 and 4 cannot be planned around.

Settle it before writing either plan. The intended shape is a single widened commit — `chooseEvent(choiceId, selection?)` where `selection` carries the item IDs, candidate ID or upgrade IDs the choice requires — with the multi-step interaction living entirely in `EventScreen` local state and nothing committing until confirm. This preserves invariant 12's single-commit rule and `applyEventChoice`'s existing all-or-nothing validation, and adds no run state. Reject any design that commits a partial event across two calls or stores an in-progress selection on `RunState`.

### Existing seams

| Concern | Paths and exports | Intended work |
|---|---|---|
| Definitions | `src/game/content/events.ts`: `EventEffect`, `EventChoice`, `EventDefinition`, `EVENTS` | Weight, category, `requiresCharacterId`, four new definitions, new effect kinds |
| Selection | `src/game/core/progression/route.ts`: `generateRegionRoute`, `makeNode` | Draw without replacement, weighted pick, recruitment anchoring |
| Legality and application | `src/game/core/progression/events.ts`: `canChooseEvent`, `applyEventChoice` | New conditions and effects, offer derivation, multi-step commit |
| Randomness | `src/game/core/rng/seededRng.ts` | One string-hash helper for node-derived streams. No second generator |
| Reward patterns to reuse | `src/game/core/progression/rewards.ts`: `distinctPicks`, `claimReward` upgrade path | Choose-one-of-three offers, upgrade application |
| UI | `src/features/event/EventScreen.tsx` | Multi-step selection, previews, absolute values, focus handling |
| Audit | `scripts/economy-audit.mjs` | Extend the existing event section |

New effect kinds needed on `EventEffect`: sacrificing selected items, granting a chosen item from an offer, granting a chosen upgrade, pressing a relic, and committing a recruitment. Model each as a narrow effect with a named mechanic, consistent with invariant 5. Do not build a generic effect engine.

## 14. Verification

### Correctness

Use existing domain, Vitest and E2E infrastructure. Each non-trivial behavior gets one representative main path and one critical failure path, demonstrated failing before implementation.

Prioritize:

- A run never repeats an event ID while unseen events remain; exhaustion falls back without throwing.
- The same `(seed, nodeId)` reproduces the same offers across a serialize/deserialize cycle, and deriving an offer advances `run.rngState` by zero.
- A committed wager, press or trade cannot be re-rolled by reload; the node completes exactly once.
- `swap-meet` consumes nothing when cancelled at any step; trading two for one never fails on capacity.
- `the-press` never returns Rare and never returns the sacrificed relic; destruction removes exactly one relic.
- `sparring-yard` is disabled with a reason when the party is fully upgraded or coins are short, and applies `maxPPDelta` identically to `claimReward`.
- Recruitment HP and PP inheritance are exact for a living outgoing member and for a KO one; the recruit takes the outgoing index; the upgrade count matches; a cancelled recruitment changes nothing.
- A character variant is unreachable and rejected when its character is absent.
- Existing v1 saves load unchanged and no new field is written.

### Balance measurement

Extend the event section of `scripts/economy-audit.mjs`, and reuse Spec 01's full-run simulation harness once it exists rather than building a second one. Report per run: event nodes entered, distinct events seen, choice selection rates, decline rates, coin delta, HP delta, PP delta, items gained and destroyed, relics gained and destroyed by input rarity, upgrades purchased, recruitment offered versus accepted, and combat-event participation.

Investigation triggers, not pass/fail gates:

- Total event coin and item value per run rising above roughly one normal fight's mean reward suggests events are displacing combat. Compare against the existing 17–30 coin baseline.
- A stake tier chosen in over 80% of wagers suggests the variance ladder is not a real decision.
- `the-press` used on live relics as often as on dead ones suggests destruction risk is priced too low.
- `sparring-yard` accepted in over 90% of encounters suggests its coin and HP cost is too cheap; under 30% suggests upgrades are undervalued or the cost lands at the wrong point in the run.
- Recruitment accepted in under 20% of offers suggests the inheritance terms still make Keep Current Party dominant. Re-examine before adding value.
- Region 3 entrants showing higher median HP or PP than the Spec 01 baseline indicates events have become a recovery route. That baseline must exist first.

### Human playtest

Fold into Spec 01's playtest gate rather than recruiting a second cohort. Observe specifically whether players can state what a press or trade costs before confirming, whether the stake ladder reads as a choice rather than a button, and whether a declined recruitment feels like a decision or a missed reward.

## 15. Next decision

Approve or reject, in order: the deduplication and derived-offer approach in §4 and §5, the rejection of rarity-based item transmutation in §7.1, the Common-only relic press in §7.2, the addition of `sparring-yard` in §7.3, the multi-step commit contract in §13.1, and the recruitment inheritance terms in §8.2.

Slice 1 is fully specified and carries no open questions; it can be planned as soon as those approvals land and Spec 01 slice 1 is out of `appStore.ts`. Slices 2 and 4 additionally require §13.1 to be settled. Slice 3 waits on Spec 01 slice 3.
