# Events A: Variety Plumbing Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement task-by-task, single-threaded. Steps use checkboxes. Read the spec and all four plans before execution. This request authorizes planning only.

**Goal:** Remove avoidable event repetition, add deterministic offers, retune wagers and expose character choices with accurate previews.

**Architecture:** Keep definitions in content, legality and effects in progression, and presentation in the existing EventScreen. Use existing SeededRng and local scratch streams. The route-history correction below requires a decision before implementation.

**Tech Stack:** TypeScript 5.8.3, React 19.2.8, Zustand 5.0.15, Node 22.x, pnpm 12.1.0, existing Node domain tests, Vitest and Playwright.

**Spec:** [Events, Transformation & Run Variety](../specs/2026-09-08-events-transformation-run-variety.md), sections 3–6, 9–14.

## Global constraints

- “HP, PP, Coins, Items and Relics remain the only run resources. No new currency, no cross-battle status, no persistent event flags.”
- “Existing saves load unchanged. This specification introduces no new persisted field and no schema version bump.”
- “Every event retains a free exit.”
- “No event choice consumes a resource when its effect cannot occur.”
- “Events never award Rare items (Spec 01 §6) and never award Rare relics.”
- “The route's minimum of two pre-boss combats and the stage-3 Rest/Shop choice are unchanged.”
- No dependencies, services, datastores, content tags, new recovery events, per-event React screens or generic effect engine.
- Preserve the existing dirty worktree. Do not implement Spec 01 again or reset overlapping changes. Plan files do not authorize API changes or more than three modules per implementation change.
- Before each task state its acceptance criteria, run one main-path and one critical failure-path test red, implement, rerun green. Configuration and copy edits need no new tests. Commit only explicitly scoped files when execution includes commits, with no co-author.

## Reading order and boundaries

| Plan | Deliverable | Dependency |
|---|---|---|
| [A](2026-09-08-events-a-variety.md) | Existing eleven events, route draw, offers, variants and previews | Coordinate overlapping Spec 01 edits first |
| [B](2026-09-08-events-b-transformation.md) | Atomic selection contract, swap-meet, sparring-yard | A and contract decision |
| [C](2026-09-08-events-c-press.md) | Common-only press | B and verified Spec 01 relic behavior |
| [D](2026-09-08-events-d-recruitment-validation.md) | Anchored recruitment and integrated validation | A+B, C optional for recruitment, required for complete release |

These are sequential delivery slices, not four independent workstreams. No implementation is included in this planning change.

## Repository corrections and decision gates

Inspected 2026-09-08 against the working tree, including uncommitted Spec 01 work:

1. `src/game/core/progression/run.ts:advanceRegion` replaces `run.route` and resets `completedNodeIds`. Previous regions are not in `run.route.nodes`. Passing an exclusion set from the current run loses region 1 when generating region 3. Past routes cannot be reconstructed from the original seed under current rules because combats, purchases and outcomes change the RNG before each region.
2. Proposed correction: generate all route topology and event assignments from a scratch RNG initialized from the run seed, replaying regions 0 through the requested region. Keep only the requested route. A run-level local `Set<string>` during replay supplies assignment deduplication without a save field. This changes future route determinism, including how battle choices influence future regions. It needs approval, not an invisible implementation substitution.
3. The spec uses both “unseen” by the player and “not yet assigned” to any lane. Those differ. Eighteen possible event slots across three regions exceed the pool, and unvisited lane assignments can exhaust it. Proposed contract is the explicit section 4 assignment-based rule, with full-pool fallback after assignment exhaustion. Measure visited repeats and do not claim they are impossible. A strict player-visited guarantee requires a different design or retained history. Resolve this before A1.
4. Existing saves remain readable and their current routes must remain untouched. An old region-2/3 save has no historical event IDs. Exact retrospective deduplication is impossible under the no-new-state constraint. Proposed compatibility boundary: guarantee assignment deduplication for newly generated runs, preserve legacy current routes and report legacy-history limits. Do not promise old runs acquire missing history.
5. `applyEventChoice` consumes zero draws for deterministic effects, one for wagers, and multiple for relic draws. `appStore.chooseEvent` persists the resulting RNG state. Proposed interpretation of section 3.4 is **one atomic committed outcome**, retaining effect-specific draw counts. Offers consume zero. The `shortcut` event starts a battle and completes after battle resolution, not before. Preserve this existing path. If exactly one RNG draw is required instead, revise A2/B1 before execution.
6. `RelicDefinition.rarity`, `reinforced-stance`, `inventory.ts`, `relicDrafts.ts` and save version 2 already exist. C's old compile-time blocker is gone in this tree, but its tests and ownership filters still require verification. README still describes schema v1, while code uses v2. Do not follow the stale schema claim.
7. `SeededRng.weightedPick` already exists. FNV-style string hashing exists privately in both `shop.ts` and `scenes.ts`. Move that identical algorithm to `seededRng.ts` and import it at these callers, preserving their seed expressions. Do not add a third copy.
8. Numeric event weights and recruitment PP rounding are absent from the spec. Proposed tuning: all existing events and swap-meet weight 1, sparring-yard and the-press weight 0.5, fourth-chair weight 0 and anchor only. Use `Math.round` then clamp for recruitment PP. These are disclosed initial choices, not measured balance.

**Decision status at authoring:** proposed, awaiting user direction. Planning is complete enough to review these choices. Execution must resolve items 2–5 and B's public selection contract first. If approved later, record the answer here without re-requesting it. Changes that exceed three modules require their concrete file set approved before editing.

## File map

| Task | Existing production files to modify | Tests / other files |
|---|---|---|
| A1 | `src/game/content/events.ts`, `src/game/core/progression/route.ts`, `src/game/core/progression/run.ts` | New `tests/domain/events.test.mjs` |
| A2 | `src/game/core/rng/seededRng.ts`, `src/game/core/progression/shop.ts`, `src/game/content/scenes.ts` | Existing `tests/domain/progression.test.mjs` and `tests/vitest/content.test.ts` |
| A3 | `src/game/core/progression/events.ts` | `tests/domain/events.test.mjs` |
| A4 | `src/game/content/events.ts`, `src/game/core/progression/events.ts`, `src/game/content/scenes.ts` | Existing `tests/domain/progression.test.mjs`, `tests/domain/events.test.mjs` |
| A5 | `src/features/event/EventScreen.tsx`, `src/styles.css` | Existing `tests/e2e/abungi.spec.ts` |
| A6 | `scripts/economy-audit.mjs` | Existing generated `docs/ECONOMY_AUDIT_V03.md` |

Only the test file is new in A. Module boundaries are content, progression/RNG, app and feature UI. File counts do not waive the project module approval gate.

### Concrete domain test setup

Create `tests/domain/events.test.mjs` with these imports and the main/failure pair below before A1 implementation. Later parts append to this same file and add only the imports they need.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRng } from '../../.domain-build/core/rng/seededRng.js';
import { EVENTS } from '../../.domain-build/content/events.js';
import { createRun, advanceRegion } from '../../.domain-build/core/progression/run.js';
import { generateRegionRoute, validateRoute } from '../../.domain-build/core/progression/route.js';

test('event routes reproduce without depending on outcome RNG state', () => {
  const changed = new SeededRng(913);
  for (let i=0;i<200;i++) changed.next();
  const first = generateRegionRoute(2,new SeededRng(913));
  assert.deepEqual(generateRegionRoute(2,changed),first);
  assert.equal(validateRoute(first).valid,true);
});

test('event assignment exhaustion returns valid content without throwing', () => {
  const pool = EVENTS.filter(event => event.weight > 0);
  let foundExhaustion = false;
  for (let seed=1;seed<=20000 && !foundExhaustion;seed++) {
    let run = createRun(['earl','hans','marcus'],seed);
    const ids = [];
    for (let region=0;region<3;region++) {
      ids.push(...run.route.nodes.filter(node => node.type==='event' &&
        node.eventId!=='fourth-chair').map(node => node.eventId));
      if (region<2) run=advanceRegion(run);
    }
    assert.equal(new Set(ids.slice(0,pool.length)).size,Math.min(ids.length,pool.length));
    for (const id of ids) assert.ok(pool.some(event => event.id===id));
    foundExhaustion = ids.length > pool.length;
  }
  assert.equal(foundExhaustion,true,'seed sweep must exercise pool exhaustion');
});
```

The current metadata is absent, so the second test initially fails until A1 adds it. The first must also fail for changed RNG state before the route correction. Once B/C/D increase the pool, retain the sweep to verify it still exercises exhaustion and report if the actual generator no longer reaches that condition.

For later selection tests, add this helper to the same test file. It creates real routes and never manufactures an event ID on a node:

```js
function runAtEvent(eventId,partyIds=['earl','hans','marcus'],accept=()=>true) {
  for (let seed=1;seed<=20000;seed++) {
    let run=createRun(partyIds,seed);
    for (let region=0;region<3;region++) {
      const node=run.route.nodes.find(node => node.eventId===eventId);
      if (node) {
        run.currentNodeId=node.id;
        if (accept(run)) return run;
      }
      if (region<2) run=advanceRegion(run);
    }
  }
  throw new Error(`No generated event fixture found for ${eventId}`);
}
```

This helper establishes domain state at a generated node. Browser tests still use the storage boundary and real store actions, as specified in B.

### A1: Weighted assignment without replacement

**Acceptance:** After approval of the route correction, new runs reproduce all regional routes from their seed, assign no repeated ordinary event until the eligible pool is exhausted, fall back without throwing, and preserve every route safety invariant. No saved route is regenerated on load.

**Interfaces:** Preserve `generateRegionRoute(regionIndex:number, rng:SeededRng):RegionRoute`, `createRun(partyIds:string[], seed:number):RunState` and `advanceRegion(input:RunState):RunState`. New required content fields are `category: EventCategory` and `weight:number`. New private route helper `buildRegion(regionIndex:number,rng:SeededRng,assigned:Set<string>):RegionRoute` contains the current generation loop. Public generation replays that helper using a scratch RNG based on `rng.seed`, without advancing the supplied RNG. This new behavior must be called out in tests.

- [ ] Add a main route test in `tests/domain/events.test.mjs`, importing actual content and compiled domain functions. Generate all three regions with `new SeededRng(913)`, concatenate event nodes in region/stage/lane order, and assert unique IDs before pool exhaustion, `validateRoute(route).valid === true`, `minimumCombatNodesToBoss(route) >= 2`, and stage index 2 types `['rest','shop']`. Compare a second replay with a supplied RNG advanced 200 times: routes must match. Capture a generated run through `advanceRegion`, not fabricated routes.
- [ ] Add the failure-path test with an already exhausted `assigned` set inside a testable route draw scenario using real generated routes. A deterministic seed sweep over 1–20,000 must find at least one full-pool fallback across three regions and complete without an empty-pick exception. Do not export a new production API solely for this test.
- [ ] Run `pnpm test:domain`. Expect the advanced-RNG equality and dedup assertions to fail before changing generation. Keep the first actual failure output.
- [ ] Add the metadata and reuse the existing weighted selector:

```ts
export type EventCategory = 'recovery'|'trade'|'gamble'|'transmutation'|
  'recruitment'|'sacrifice'|'combat'|'lore';

// Inside makeNode, after determining that this is an ordinary event:
const pool = EVENTS.filter(event => event.weight > 0);
const unseen = pool.filter(event => !assigned.has(event.id));
const chosen = rng.weightedPick(unseen.length ? unseen : pool);
node.eventId = chosen.id;
assigned.add(chosen.id);
```

Set categories: rain-stall recovery, loose-crate trade, paper-shrine trade, night-cart recovery, shortcut combat, old-locker sacrifice, street-game gamble, repair-bench recovery, quiet-corner recovery, bulk-deal trade, live-wire sacrifice. Use weight 1 for these eleven definitions. On exhaustion use the full pool as the spec says, not a persisted reset flag.
- [ ] Move the existing region loop into `buildRegion`; replay regions 0..regionIndex with one scratch RNG and one assignment set. Keep topology, elite correction, boss IDs, stage pools and encounter selection unchanged inside the builder. `createRun`/`advanceRegion` continue invoking the public generator. Remove no other RNG use.
- [ ] Run `pnpm test:domain` and `pnpm typecheck`. Review affected fixed-seed tests against real generated routes rather than weakening assertions or retaining old snapshots by changing the algorithm.
- [ ] Review the diff and checkpoint only the A1 file set. Suggested commit: `feat: derive weighted event routes without replacement`.

### A2: One shared string hash

**Acceptance:** Shop shelves and dialogue remain byte-for-byte deterministic for existing seed/context inputs. Event scratch streams have one shared hash implementation.

**Interfaces:** New export `hashText(text:string):number` from `seededRng.ts`. Remove the private `hashText` in shop and `hash` in scenes, importing the shared function. Keep both callers' XOR, region/context formatting and constructors unchanged.

- [ ] Capture actual outputs of `generateShopOffers` and `resolveScene` for the existing fixed-seed tests before the move. Run `pnpm test:domain` and `pnpm test:vitest` as the baseline for this pure relocation.
- [ ] Move the existing algorithm without altering its Unicode iteration:

```ts
export function hashText(text:string):number {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
```

- [ ] Rerun the baseline commands and compare the captured outputs exactly. Search `rg -n '2166136261|16777619' src` to verify no obsolete copy remains. Suggested commit: `refactor: share the existing seeded text hash`.

### A3: Pure derived offers and absolute previews

**Acceptance:** Deriving an offer or preview changes neither the input nor the run RNG. The same eligible run and node round-trip through the actual save parser to identical offers. Preview totals match applied rounding, clipping, KO behavior and Blue Tonic Cap.

**Interfaces:** New exports from progression `events.ts`:

```ts
export interface EventOffers {
  itemIds:string[];
  upgrades:Array<{characterId:string;abilityId:string}>;
  recruitIds:string[];
}
export function deriveEventOffers(run:RunState,nodeId:string):EventOffers;
export function previewEventChoice(run:RunState,eventId:string,choiceId:string):
  {hpDelta:number;ppDelta:number};
```

Return only the relevant pool for the event at `nodeId`, empty arrays for unrelated kinds. Until B/D introduce their definitions, those arrays remain empty. `deriveEventOffers` requires a real route event node, rejecting an unknown ID. Offers filter against the current run because state is stable while the event is open. They are not solely a function of two values when eligible membership differs. Determinism means same seed, node and eligible state.

- [ ] Add one preview main test using `createRun(['earl','hans','marcus'],77)`: set Earl HP to 109, Hans HP to 0, Marcus HP full, then verify rain-stall/wait previews +1 total HP and leaves the source untouched. Add a critical rounding/no-effect case with full PP at live-wire so no HP can be spent for zero PP restoration after A4.
- [ ] Run `pnpm test:domain` red for the new export. Implement previews using exactly the existing effect arithmetic, including `Math.round`, living-only HP changes, upgraded PP maxima and the 1.25 Blue Tonic Cap modifier. Preview each ability separately before summing, never round a party aggregate. Do not call `applyEventChoice` for a preview because random effects would run.
- [ ] Establish the scratch RNG at the offer boundary:

```ts
const rng = new SeededRng(run.seed, (hashText(nodeId) ^ run.seed) >>> 0);
```

Use a local shrinking copy of the relevant pool, splice a random index until three items/upgrades or two recruits are selected, or the pool is empty. This repeats the small existing `distinctPicks` pattern at its second site without exporting a generic helper. B supplies item/upgrade filtering, D supplies recruit filtering.
- [ ] Run `pnpm test:domain` green. Suggested commit: `feat: derive event previews and offers without run state`.

### A4: Stakes and six character variants

**Acceptance:** All exact values below are applied through existing effect kinds. Missing characters are hidden in UI and rejected by domain legality. Resource-cost choices with no deliverable effect spend nothing. Every event still has a zero-cost choice.

**Interfaces:** Add `requiresCharacterId?:string` to `EventChoice`. Preserve the existing signatures of `canChooseEvent` and `applyEventChoice` until B1.

| Event / choice ID | Required character | Effects |
|---|---|---|
| street-game / play | none | wager cost 6, chance .55, payout 14 |
| street-game / medium | none | wager cost 15, chance .45, payout 36 |
| street-game / large | none | wager cost 30, chance .35, payout 90 |
| street-game / yeeho-stake | yeeho | wager cost 60, chance .25, payout 260 |
| repair-bench / hans-tune | hans | restore .40 missing PP |
| night-cart / jiro-cooks | jiro | heal .16 party Max HP, no coin cost |
| old-locker / greg-force | greg | lose .08 party Max HP, Field Ration, +8 coins |
| bulk-deal / leandre-crate | leandre | -14 coins, Field Ration and PP Tonic |
| live-wire / earl-reroute | earl | lose .04 party Max HP, restore .30 missing PP |

Keep existing base choices and street-game `skip` as the free exit. Adding variants beside them avoids a second replacement metadata field.

- [ ] Update the existing wager test, preserving `play` as Small stake: from 12 coins outcomes are 6 or 20, and 5 coins yields `Need 6 coins.` Add the main variant test using a real Hans party and the critical absence test using `['earl','jiro','marcus']`. For absence, assert `applyEventChoice` throws and both input and RNG serialize identically before/after.
- [ ] Run `pnpm test:domain` red. Add the content rows and perform the membership guard before costs:

```ts
if (choice.requiresCharacterId &&
    !run.party.some(member => member.characterId === choice.requiresCharacterId)) {
  return {allowed:false,reason:'The required character is not in your party.'};
}
```

- [ ] Extend existing no-waste checks to HP-cost PP choices and all resource-cost item choices, including Greg's mixed reward. Require capacity for the promised full item bundle before any HP/coins are consumed. Use preview totals to detect restoration that rounds to zero. Free no-effect exits stay legal. Retain Folded Tokens' non-Rare ownership filtering from Spec 01.
- [ ] Rename Three Cups to Cardboard Wheel and update `EVENT_ARRIVAL_LINES['street-game']` to two wheel lines: “Pick a stake. The odds are written on the cardboard.” and “The wheel turns once. Decide what you can afford to lose.” Update hints to display cost, exact win/loss odds, gross payout and net win/loss. Preserve all eleven event IDs.
- [ ] Run `pnpm test:domain`, `pnpm test:vitest`, `pnpm typecheck`. Search `rg -n 'Three Cups|Five coins|five coins|Wager 5|50% wins 10|cups|street-game' src tests scripts` and update active claims affected by the retune. A6 owns audit copy. Historical spec/audit documents are not current product copy.
- [ ] Checkpoint A4. Suggested commit: `feat: add event stakes and character variants`.

### A5: Accessible previews and wheel presentation

**Acceptance:** Percentage hints also show current absolute deltas. Unavailable choices remain focusable with an announced visible reason. Resolving state prevents double activation. The theatre remains usable on all configured viewports and with reduced motion.

- [ ] Extend the existing event E2E flow to focus an unaffordable wager and assert its in-band reason, then press Enter and verify no resource change. Use a real engine-produced save at the existing IndexedDB boundary if the fixed route does not reach this event. Add one main path that chooses Small stake and sees the persisted result after reload. Run `pnpm test:e2e --grep 'event'` red before UI edits.
- [ ] Filter choices by `requiresCharacterId`. Use `aria-disabled` instead of native `disabled` on unavailable event choices. Link the reason with `aria-describedby` and guard click/Enter through the actual handler:

```tsx
<button aria-disabled={!legality.allowed || isResolving}
  aria-describedby={`${event.id}-${choice.id}-reason`}
  onClick={() => {
    if (!legality.allowed || isResolving) return;
    void choose(choice.id);
  }}>
```

Native buttons provide keyboard activation. Keep the reason visible. Render exact preview totals such as `(+1 HP across the party)` with the original percentage wording. Show negative HP costs as losses. Use `isResolving` from the store for a visible “Resolving…” state.
- [ ] Keep the existing result and BACK TO ROUTE flow. The optional wheel spin is skipped: a static cardboard wheel and result highlighting satisfy the spec without adding animation timing to the commit. Use `.event-theme-game` scoped CSS. Reduced motion has no spin to suppress. Any decorative transition must honor both the stored reduced-motion setting and existing CSS conventions.
- [ ] Replace E2E `.event-choices button:not(:disabled)` with a selector that also excludes `[aria-disabled="true"]`. Otherwise existing tests can click disabled choices after this accessibility fix.
- [ ] Run the focused E2E tests and `pnpm typecheck`. Check keyboard focus and 375px width manually. Suggested commit: `feat: show accessible event costs and outcomes`.

### A6: Slice measurement

**Acceptance:** Existing audit reports weighted assignment and entered-event exposure separately, without describing a structural simulation as human behavior.

- [ ] Extend `scripts/economy-audit.mjs` using 20,000 fixed seeds and three legal-path policies: event-first, random reachable lane, event-avoiding. Traverse only `availableRouteNodes`, not every stage lane independently. Replay all three regions through the approved route generator. Record assigned IDs, entered event nodes, distinct visited IDs, repeats before assignment exhaustion, and repeats after exhaustion separately.
- [ ] Replace the old wager audit text. Calculate EV as `chance * payout - cost` and report Small +1.7, Medium +1.2, Large +1.5, Yeeho +5. Do not label these values as balanced from EV alone.
- [ ] Run `pnpm test:domain` to refresh `.domain-build`, then `node scripts/economy-audit.mjs`. The script writes `docs/ECONOMY_AUDIT_V03.md`, so inspect and preserve unrelated report changes. This is an implementation-time command, not a read-only planning check.
- [ ] Record fresh command results, seed range, policy and legacy-route limits. Advance to B after the slice is reviewed. Suggested commit: `docs: measure seeded event variety`.
