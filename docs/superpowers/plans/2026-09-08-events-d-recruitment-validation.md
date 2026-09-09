# Events D: Recruitment and Validation Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans`, single-threaded, with checkbox tracking. Read the spec and Parts A–C. Recruitment can execute after A+B without C, but full release validation includes C.

**Goal:** Offer a seed-anchored party pivot that transfers resource percentages and upgrade count, then measure the complete event release.

**Architecture:** Anchor one route node in one seed-selected region, derive two eligible candidates locally, validate a complete replacement command and replace exactly one array slot. The existing party state shape is sufficient. Keep all selection and warnings in the existing event flow.

**Tech Stack:** Existing TypeScript, React, Zustand, Node tests, Vitest, Playwright and Node-standard-library audit scripts.

**Spec:** [Events specification](../specs/2026-09-08-events-transformation-run-variety.md), sections 8, 11, 13 slice 4 and 14.

## Global constraints

- “The recruit takes the outgoing member's array index.”
- “Incoming member enters with the same number of upgrades as the outgoing member, chosen by the player from the incoming character's abilities.”
- “Nothing commits before confirmation; there is no first-tap replacement.”
- “Recruitment grants no healing beyond the KO floor, no PP beyond the inherited percentage, no items, no coins, and no relic.”
- “Existing saves load unchanged. This specification introduces no new persisted field and no schema version bump.”
- Keep “Keep Current Party” always free. No captain, reorder semantics, new party resource, persistent flags, per-event screen or recruitment bonus.
- Follow A's decision gates and B's single-command contract. This part changes party-state handling, not its schema, and needs a separate implementation review.

## Files

| Task | Existing production files | Tests / reports |
|---|---|---|
| D1 | `src/game/content/events.ts`, `src/game/core/progression/route.ts`, `src/game/core/progression/events.ts` | `tests/domain/events.test.mjs` |
| D2 | `src/game/content/events.ts`, `src/game/core/progression/events.ts` | `tests/domain/events.test.mjs`, `tests/vitest/saveSchema.test.ts` |
| D3 | `src/features/event/EventScreen.tsx`, `src/styles.css`, `src/game/content/scenes.ts` | `tests/e2e/abungi.spec.ts`, `tests/vitest/eventCommit.test.ts` |
| D4 | `scripts/economy-audit.mjs` | `docs/ECONOMY_AUDIT_V03.md`; Spec 01's future `scripts/run-recovery-audit.mjs` only once it exists |

No new production files. `scripts/run-recovery-audit.mjs` does not exist at authoring time. It is owned by Spec 01 Part C task C4, not authorized to be created by this plan.

### D1: Recruitment placement and candidates

**Acceptance:** Fourth-chair appears at most once in all generated regions, only in seed-selected region 2 or 3, at its first event node by stage/lane order. No event in that region means no recruitment. Skipping its lane does not move the anchor later. Two candidates exclude the current three party members and are reproducible with zero run RNG draws.

**Interfaces:** Add `fourth-chair`, title “The Fourth Chair”, theme `recruitment`, category `recruitment`, weight 0. Choices `recruit` (“Consider a recruit”) and `keep` (“Keep Current Party”). New `recruit` effect. A's public route signature stays unchanged. D2 defines the selection and application before this content is released.

- [ ] Add a main route test across seeds 1–20,000. Compute `1 + (hashText(String(seed)) % 2)` as the zero-based chosen region. For each run assert zero/one fourth-chair node overall, its region, and its identity as the first actual event node in that region sorted by stage then generation lane order. Preserve minimum combat and stage-3 checks. Add the critical absent-event-region case using a seed found by the real generator, asserting no insertion or forced topology change.
- [ ] Run `pnpm test:domain` red. Anchor during A's replay before drawing an ordinary event ID for that node. A private `anchorAssigned` local boolean belongs to the selected region's build, never `RunState`. Ordinary pool excludes fourth-chair because its weight is zero. Anchor does not consume an ordinary event ID or overwrite a previously assigned one, preventing phantom dedup exclusions.
- [ ] Extend `deriveEventOffers` for fourth-chair with `CHARACTERS.filter(character => !run.party.some(member => member.characterId === character.id))`, selecting two distinct IDs with the existing scratch draw. The current roster has eleven definitions, so a legal three-member party leaves eight candidates. Do not hard-code eight or persist offers.
- [ ] Extend B's offer round-trip test to a real recruitment node and verify candidate exclusion, distinctness and unmodified RNG. Do not expose the anchor region in product UI as implementation metadata.
- [ ] Run `pnpm test:domain`, `pnpm typecheck`. Keep D1 and D2 in the same release checkpoint so an enabled recruit effect never ships without its validator/application. Suggested combined commit after D2: `feat: anchor resource-preserving recruitment`.

### D2: Validate and preview replacement

**Acceptance:** Living and KO HP rules, aggregate PP inheritance and selected upgrade count are exact. Input and the two remaining party slots are unchanged. Wrong candidate, slot or upgrade selection is rejected before RNG or resource changes. No extra PP restore bonus applies.

**Interfaces:** Extend B's `EventSelection`:

```ts
| {kind:'recruit';candidateId:string;outgoingCharacterId:string;upgradeIds:string[]}
```

New export in progression/events.ts:

```ts
export function previewRecruitment(run:RunState,
  selection:Extract<EventSelection,{kind:'recruit'}>):
  {member:PartyMemberRunState;warnings:string[]};
```

It validates and returns the exact incoming member used by commit. This shared calculation prevents preview/application disagreement. It does not mutate the run or replace a member. `canChooseEvent` handles absent/incomplete selections with reasons. Preview throws the same validation reason for an invalid complete draft.

- [ ] Add a main test using real Hans as outgoing and Earl as the offered incoming candidate, discovering a seed whose actual candidate list includes Earl. Set Hans HP to 46/92 and all PP to zero. Expected Earl HP is 55/110, all PP zero, same party index and same selected upgrade count. Repeat within the main case with every outgoing move full: incoming moves must be full, without overflow. Upgrades use real incoming ability IDs.
- [ ] Add one critical selection test sending a duplicated upgrade ID for an outgoing member with two upgrades. Assert rejection and exact input/RNG equality. Verify candidate membership and outgoing identity through the same complete validator, not a UI-only guard.
- [ ] Run `pnpm test:domain` red. Validate candidate is one of current derived candidates and absent from party, outgoing member exists exactly once, upgrade IDs are distinct incoming abilities and count equals outgoing `upgradedAbilities.length`. If content ever leaves fewer incoming abilities than the count, disable that replacement with “This recruit cannot inherit that many upgrades.” Do not silently drop upgrades.
- [ ] Build PP maxima using actual upgrade deltas. Apply upgrades to incoming maxima **before** distributing inherited PP, with no flat upgrade refill afterward:

```ts
const outgoing = run.party.find(member => member.characterId === selection.outgoingCharacterId)!;
const from = getCharacter(outgoing.characterId);
const incoming = getCharacter(selection.candidateId);
const currentPp = from.abilities.reduce((sum,id) => sum + outgoing.abilityPP[id],0);
const maximumPp = from.abilities.reduce((sum,id) => {
  const ability = getAbility(id);
  return sum + ability.maxPP + (outgoing.upgradedAbilities.includes(id)
    ? ability.upgrade.maxPPDelta ?? 0 : 0);
},0);
const fraction = maximumPp > 0 ? Math.max(0,Math.min(1,currentPp / maximumPp)) : 0;
const member:PartyMemberRunState = {
  characterId: incoming.id,
  hp: outgoing.hp <= 0
    ? Math.max(1,Math.round(incoming.stats.maxHp * .15))
    : Math.max(1,Math.min(incoming.stats.maxHp,
        Math.round(incoming.stats.maxHp * outgoing.hp / from.stats.maxHp))),
  abilityPP: {},
  upgradedAbilities: [...selection.upgradeIds],
};
for (const id of incoming.abilities) {
  const ability = getAbility(id);
  const maximum = ability.maxPP + (selection.upgradeIds.includes(id)
    ? ability.upgrade.maxPPDelta ?? 0 : 0);
  member.abilityPP[id] = Math.max(0,Math.min(maximum,Math.round(maximum * fraction)));
}
```

Math.round for PP is the disclosed initial convention from A. Add a hand-computed interior assertion: Hans maxima are 18+7+6+4=35. At 7 total current PP the ratio is 1/5. Earl maxima are 18,8,6,4, yielding `[4,2,1,1]`. KO Hans gives incoming Earl 17 HP (`round(110*.15)`), while retaining the same PP ratio. Use those real content values and flag content drift rather than self-computing expected values.
- [ ] Warnings are exactly “Replacing Hans leaves Spare Battery without an enabler.” when Hans leaves and spare-battery is owned, and “Replacing Leandre removes Good Business's extra shop offer.” when Leandre leaves. Warn even if KO. Check stable character IDs, not names. No generalized dependency registry.
- [ ] At commit, replace `run.party[index]` with the validated preview member. Change no inventory, relics, coins, other party members or profile usage statistics. Let the store perform ordinary node completion, score and autosave. No battle engine change is required.
- [ ] Extend save tests to parse a real recruited member and retain HP/PP/upgrades exactly. Run `pnpm test:domain`, `pnpm test:vitest`, `pnpm typecheck`. Checkpoint D1+D2.

Concrete D2 main/failure pair, appended to A's domain test file with `previewRecruitment` added to the existing event import:

```js
function recruitmentForEarl() {
  return runAtEvent('fourth-chair',['hans','jiro','marcus'],run =>
    deriveEventOffers(run,run.currentNodeId).recruitIds.includes('earl'));
}
test('event recruitment inherits the outgoing slot and aggregate PP ratio', () => {
  const run=recruitmentForEarl();
  const hans=run.party[0];
  hans.hp=46;
  hans.abilityPP={sidearm:7,'sentry-unit':0,'repair-drone':0,overclock:0};
  const selection={kind:'recruit',candidateId:'earl',outgoingCharacterId:'hans',upgradeIds:[]};
  const preview=previewRecruitment(run,selection);
  assert.equal(preview.member.hp,55);
  assert.deepEqual(preview.member.abilityPP,
    {'knuckle-up':4,yosi:2,'patch-up':1,adrenaline:1});
  const result=applyEventChoice(run,'fourth-chair','recruit',new SeededRng(5),selection);
  assert.deepEqual(result.run.party[0],preview.member);
  assert.deepEqual(result.run.party.slice(1),run.party.slice(1));
  hans.hp=0;
  assert.equal(previewRecruitment(run,selection).member.hp,17);
});
test('event recruitment rejects duplicate inherited upgrades', () => {
  const run=recruitmentForEarl();
  run.party[0].upgradedAbilities=['sidearm','sentry-unit'];
  const before=structuredClone(run);
  const rng=new SeededRng(5);
  const rngBefore=rng.serialize();
  assert.throws(() => applyEventChoice(run,'fourth-chair','recruit',rng,
    {kind:'recruit',candidateId:'earl',outgoingCharacterId:'hans',
      upgradeIds:['knuckle-up','knuckle-up']}),/unique|duplicate|distinct/i);
  assert.deepEqual(run,before);
  assert.deepEqual(rng.serialize(),rngBefore);
});
```

### D3: Complete recruitment interaction

**Acceptance:** Both candidates show full stats, four abilities and passive before commitment. Player selects candidate, outgoing member and exactly the inherited number of upgrades, then sees final HP and per-ability PP plus warnings. Back, Cancel and Escape never commit.

- [ ] Add one main E2E test from a real engine-produced recruitment save. Select recruit/outgoing/upgrades, verify preview, confirm and assert exact slot/resources after reload. Add one critical path cancelling from every recruitment step, with focus restored to “Consider a recruit”. Run `pnpm test:e2e --grep 'event'` red.
- [ ] Extend EventScreen's local state with `recruit-candidate`, `recruit-outgoing`, `recruit-upgrades` and the shared `confirm`. Render details from `getCharacter`/`getAbility`, using existing typography and native controls. The two candidates must be inspectable without committing. Clear outgoing/upgrades when the candidate changes and clear upgrade selections when the outgoing member changes. For zero inherited upgrades, proceed directly to confirmation.
- [ ] Show HP as `current / max` and each move's resulting PP alongside the inherited percentage. Show upgrade count selected/required and the complete upgrade effects. Use `previewRecruitment` only after a complete valid selection. Keep warning text in-band immediately above Confirm. “Keep Current Party” remains accessible from the top-level choices and Cancel returns there from all steps.
- [ ] Confirm calls `chooseEvent('recruit', draft)` once. Guard while resolving, preserve the error display and focus behavior from B, and reset local draft on node/result change. Do not apply party state optimistically before the domain validator succeeds.
- [ ] Add `.event-theme-recruitment` with a fourth empty-chair prop using the existing theatre structure. Arrival lines: “A fourth chair waits beside the road. Only three can travel on.” and “Two strangers offer to take someone's place, not erase the journey.” No external assets or new animations are required.
- [ ] Extend `tests/vitest/eventCommit.test.ts` with one real recruitment commit and replay, checking party index, no bonus resources, one completion and persistence. Run `pnpm test:e2e --grep 'event'`, `pnpm test:vitest`, `pnpm test:release`, `pnpm typecheck`. Inspect 375px layout, all stats/abilities, focus order and reduced motion. Suggested commit: `feat: preview and confirm party recruitment`.

### D4: Integrated evidence and balance handoff

**Acceptance:** Correctness, structural simulation, full-run balance and human playtest each have their own evidence/status. No missing baseline is reported as a pass.

- [ ] Before final checks, self-review against this coverage map:

| Spec requirement | Tasks |
|---|---|
| 3.1 resources, 3.11 save compatibility | B1, B3, D2 and existing v1 tests |
| 3.2 dedup, section 4 weights/categories | A1, A6, approved assignment/legacy boundary |
| 3.3 deterministic offers | A2–A3, B2–B3, D1 |
| 3.4 outcome commit and reload | B1, C2, D3, approved RNG/shortcut interpretation |
| 3.5 no waste, 3.6 free exit | A4–A5, B2–B4, C1–C2, D2–D3 |
| 3.7 rarity limits | B2, C1, unchanged Folded Tokens filter |
| 3.8 variants and section 6 wagers | A4–A6 |
| 3.9 recruitment inheritance | D2–D3 |
| 3.10 route safety and value | A1, A6, D4 |
| 3.12 absolute hints, section 11 accessibility | A3, A5, B4, C2, D3 |
| Sections 7.1/7.3/7.2 transformations | B2/B3/C1–C2 |
| Section 8 placement, warnings, confirmation | D1–D3 |
| Section 10 existing combat event unchanged | B1 store handoff regression |
| Section 12 exclusions | Diff review in every slice |
| Section 14 balance and playtest | A6, D4 |

- [ ] Update the event section of `scripts/economy-audit.mjs` with all fifteen definitions, actual weights and four arrival themes. Extend A6's route analysis with recruitment designated/generated/reached counts under each legal-path policy. Report offered as a reached anchor, not merely generated. Confirm the exact exposure rate before tuning its placement.
- [ ] For press mechanics, count draws by input/output rarity, destruction, safe versus risk and no eligible stock. Distinguish structural fixed-seed branch sampling from acceptance by players. Keep current normal reward baseline from `encounterCoinRange`, not an unverified copied 17–30 claim.
- [ ] Run fresh verification in this order:

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
node scripts/economy-audit.mjs
git diff --check
```

`pnpm test` refreshes domain compilation. Playwright currently configures **five** viewports, despite README saying four. Run the configuration as written. Inspect audit output changes, do not overwrite or dismiss unrelated working-tree edits.
- [ ] Search current source/tests/scripts for old wager values, eleven-event assertions, missing theme entries and first-legal-choice assumptions. Update only active claims affected by this release. Check that event count after all slices is exactly fifteen and every definition has a free choice with no character requirement.
- [ ] Once Spec 01's `scripts/run-recovery-audit.mjs` exists and its baseline is recorded, extend its existing `runAttempt({domainDir,partyIds,seed,policy,maxActions})` and `summarizeAttempts(records)` integration rather than building a second simulator. Consume real engine `deriveEventOffers`, `canChooseEvent`, `applyEventChoice`, battle and node transitions. Existing “first legal event option” policy must construct valid selections for the new effects before commit or explicitly decline with a logged reason. Never retry randomized outcomes to choose the best.
- [ ] Add event fields to its existing transition records, not production RunState: event/node/choice IDs, offered alternatives, selected inputs/output, declined/accepted, coins/HP/PP before and after, items gained/destroyed, relic inputs/outputs by rarity, upgrade purchases, recruit offered/accepted, and shortcut combat participation. Record both gain and destruction even when net count is zero. Preserve result values `victory | defeat | unresolved` and denominators for reached events/regions.
- [ ] Compare paired baseline/candidate fixed seeds with frozen policies and identifiable source revisions, including dirty patch identity when relevant. Report per-run event count, distinct visited events, choice/decline rates, all resource deltas, upgrades, recruitment and combat-event participation. Scripted choice rates are policy outcomes, never evidence of human preference.
- [ ] Investigate, without automatically failing or retuning: event coin+item value over one normal fight mean, one wager tier above 80%, live-relic press usage matching dead-affinity usage, training acceptance above 90% or below 30%, recruitment acceptance below 20%, and region-3 entry median HP/PP above the Spec 01 baseline. Keep the denominator beside each percentage. A dead affinity relic is one whose affinity has no party member, using current definitions, not an invented universal relic valuation model.
- [ ] If the full-run harness or baseline is absent, mark full-run balance **not run: Spec 01 harness/baseline unavailable**, and report structural/correctness evidence separately. Do not create another datastore/script framework or declare the balance criterion fulfilled.
- [ ] Fold event observations into Spec 01's playtest cohort: can players describe press/trade costs before Confirm, do stake tiers feel like distinct decisions, and does declining recruitment feel deliberate? Do not contact or recruit people without authorization. Human playtest remains **not run** until actual observations exist.
- [ ] Finish with commands and actual results, failure output, skipped checks and remaining decisions. Suggested checkpoint: `test: validate event variety and recruitment`. Stop after the requested implementation scope and verification, without publishing or unrelated cleanup.
