# Spec 03 Part E — Ken: Events, Lore and Balance Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Ken his two event variants and required writing, teach the simulator to set and spend marks, and produce the measured evidence for the full thirteen-character roster including the Saq+Ken layered-defense case.

**Architecture:** Same shape as Part C. Event variants are `EventChoice` entries on existing events using `requiresCharacterId`. Lore reuses `relationshipVariants`. The simulator's `mechanic-aware` policy gains mark decisions in the same function Part C created; the engine is never duplicated inside scoring code.

**Tech Stack:** TypeScript 5.8, Node 22 `node:test`, Vitest, plain `.mjs` audit scripts over the compiled `.domain-build` output.

**Spec:** `docs/superpowers/specs/2026-09-08-roster-character-encounter-expansion.md` §6; companion `docs/superpowers/specs/2026-09-08-roster-combat-rules-validation.md` §6 and §7.

**Depends on:** Part D complete and its gate recorded.

## Global Constraints

- Two event variants only, both on existing events, both using `requiresCharacterId: 'ken'`. No new event definitions and no runtime tags (parent §6).
- Exact outcomes: `paper-shrine` / `ken-read-work` pays **10 coins** for the same eligible random unowned relic, preserving existing rarity restrictions and exhausted-pool gating. `old-locker` / `ken-trace-latch` loses **3% Max HP** from each living ally and grants **one Field Ration**, still requiring pack room (parent §6). The existing `take` costs 16 and the existing `force` costs 5% Max HP, so each variant is one modest step.
- When Saq and Leandre, or Ken and Greg, are both present, show each eligible choice as an alternative. Do not combine discounts or rewards; choosing one resolves the node (parent §6).
- Ken's locker improvement is the one modest effect tier Spec 02 allows. Evaluate total realized event benefit per run, not each variant separately (parent §6).
- Per character: one 50-80 word biography (already added in Part D), one departure variant, one region-transition variant, the two event results, one selected boss/elite reaction. At most two short lines per speaker, skippable, deterministic (parent §6).
- Preserve existing Jonlow/Jiro and Klyde/Earl relationship priority. Ken takes the Jonlow slot behind Jiro; Saq already holds the Warden slot (parent §6, Part C Task 7).
- 32 seeds screen; 128 seeds confirm a disputed conclusion. Print actual case counts from arrays (companion §6).
- Compute mark contribution by comparing the hit with and without the added power using the same already-drawn variance and critical values. Never rerun RNG or emit another hit (companion §6).
- Party rows sharing members are not independent observations. Do not average away policy disagreement (companion §6).
- Commands: `pnpm test:domain`, `pnpm test:vitest`, `pnpm test:release`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:e2e`. Audits after `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json`.
- Never claim a step done without pasting the command output.

## File structure

| File | Responsibility |
|---|---|
| `src/game/content/events.ts` (modify) | The two new choices |
| `src/game/content/scenes.ts` (modify) | Departure, region transition, Jonlow reaction, event-arrival lines |
| `scripts/balance-audit.mjs` (modify) | Mark decisions in the aware policy, mark/script metrics, Ken comparisons |
| `tests/domain/events.test.mjs` (modify) | Both variants' exact outcomes and coexistence with Greg's |
| `tests/vitest/content.test.ts` (modify) | Ken's writing inventory |
| `docs/superpowers/evidence/2026-09-08-spec03-ken-audit.md` (create) | The measured decision |

---

### Task 1: Ken's two event variants

**Files:**
- Modify: `src/game/content/events.ts`
- Test: `tests/domain/events.test.mjs`

**Interfaces:**
- Consumes: `canChooseEvent`, `applyEventChoice`, `drawRelicIds`, `eligibleRelics`, `inventoryCapacity` from `src/game/core/progression/events.ts` — all unchanged.
- Produces: choices `ken-read-work` on `paper-shrine` and `ken-trace-latch` on `old-locker`.

- [ ] **Step 1: Write the failing test**

Append to `tests/domain/events.test.mjs`:

```js
test('ken-read-work costs six fewer coins than the base token offer and draws the same relic pool', () => {
  const shrine = getEvent('paper-shrine');
  const base = shrine.choices.find(c => c.id === 'take');
  const ken = shrine.choices.find(c => c.id === 'ken-read-work');
  assert.equal(ken.requiresCharacterId, 'ken');
  assert.deepEqual(ken.effects, [{ kind: 'coins', amount: -10 }, { kind: 'randomRelic' }]);
  assert.equal(base.effects[0].amount, -16, 'the base choice is unchanged');

  const run = runWithParty(['ken','hans','marcus'], { coins: 40 });
  const kenResult = applyEventChoice(run, 'paper-shrine', 'ken-read-work', new SeededRng(9));
  const baseResult = applyEventChoice(run, 'paper-shrine', 'take', new SeededRng(9));
  assert.deepEqual(kenResult.run.relicIds, baseResult.run.relicIds, 'same seeded draw from the same eligible pool');
  assert.equal(kenResult.run.coins, baseResult.run.coins + 6);
});

test('ken-read-work is blocked when every eligible relic is already owned', () => {
  const run = runWithParty(['ken','hans','marcus'], { coins: 40 });
  run.relicIds = allEligibleRelicIds(run);
  const verdict = canChooseEvent(run, 'paper-shrine', 'ken-read-work');
  assert.equal(verdict.allowed, false);
  assert.match(verdict.reason, /already own every relic/i);
});

test('ken-trace-latch costs two percentage points less injury than Force and still needs pack room', () => {
  const locker = getEvent('old-locker');
  const force = locker.choices.find(c => c.id === 'force');
  const ken = locker.choices.find(c => c.id === 'ken-trace-latch');
  assert.equal(ken.requiresCharacterId, 'ken');
  assert.deepEqual(ken.effects, [{ kind: 'partyHpPercent', amount: -0.03 }, { kind: 'item', itemId: 'field-ration' }]);
  assert.equal(force.effects[0].amount, -0.05, 'the base choice is unchanged');

  const full = runWithParty(['ken','hans','marcus'], { coins: 0 });
  full.inventory = [{ itemId: 'patch-kit', quantity: 6 }];
  const verdict = canChooseEvent(full, 'old-locker', 'ken-trace-latch');
  assert.equal(verdict.allowed, false);
  assert.match(verdict.reason, /pack is too full/i);
});

test('Ken and Greg both offer their locker choices as separate alternatives', () => {
  const run = runWithParty(['ken','greg','marcus'], { coins: 0 });
  const eligible = getEvent('old-locker').choices.filter(c => canChooseEvent(run, 'old-locker', c.id).allowed).map(c => c.id);
  assert.deepEqual(eligible, ['greg-force','ken-trace-latch','force','leave']);
});

test('choosing one locker variant resolves the node and grants only that outcome', () => {
  const run = runWithParty(['ken','greg','marcus'], { coins: 0 });
  const result = applyEventChoice(run, 'old-locker', 'ken-trace-latch', new SeededRng(3));
  assert.equal(result.run.coins, run.coins, 'Greg\'s eight coins are not combined in');
  assert.equal(result.run.inventory.find(e => e.itemId === 'field-ration').quantity, 1);
});
```

`allEligibleRelicIds` should call the existing `eligibleRelics(run,'folded-tokens')` helper and map to ids.

- [ ] **Step 2: Run to verify failure**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/events.test.mjs`
Expected: FAIL — `ken-read-work` is `undefined`.

- [ ] **Step 3: Add the choices**

In `src/game/content/events.ts`, in `paper-shrine`, insert before the existing `take` choice:

```ts
    {id:'ken-read-work',label:'Let Ken read the work',hint:'Spend 10 coins · gain a random unowned relic.',resultText:'Ken turns the token over twice, points at the second stroke, and pays the honest price.',requiresCharacterId:'ken',effects:[{kind:'coins',amount:-10},{kind:'randomRelic'}]},
```

In `old-locker`, insert after the existing `greg-force` choice so Greg's authored order is preserved:

```ts
    {id:'ken-trace-latch',label:'Let Ken trace the latch',hint:'Lose 3% Max HP from each living ally · gain 1 Field Ration if your pack has room.',resultText:'Ken traces the latch line, finds where it gives, and opens it with less blood than usual.',requiresCharacterId:'ken',effects:[{kind:'partyHpPercent',amount:-0.03},{kind:'item',itemId:'field-ration'}]},
```

No change to `src/game/core/progression/events.ts`: `canChooseEvent` already checks the relic pool via `eligibleRelics(run,'folded-tokens')` and the pack-room rule via `inventoryCount + itemRewardCount > inventoryCapacity`, and `applyEventChoice` already handles `randomRelic` through `drawRelicIds(run,'folded-tokens',1,rng)` with the same rarity weights.

- [ ] **Step 4: Run to verify it passes**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/events.test.mjs`
Expected: PASS.

- [ ] **Step 5: Run the full domain suite**

Run: `pnpm test:domain`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/content/events.ts tests/domain/events.test.mjs
git commit -m "feat: add Ken event variants to Folded Tokens and Old Locker"
```

---

### Task 2: Ken's required writing

**Files:**
- Modify: `src/game/content/scenes.ts`
- Test: `tests/vitest/content.test.ts`

**Interfaces:**
- Consumes: `resolveScene`, `relationshipVariants`, `ALL_SCENE_VARIANTS` from Part C Task 7.
- Produces: Ken's departure, region-transition, Jonlow reaction and two event-arrival lines.

- [ ] **Step 1: Write the failing test**

Append to `tests/vitest/content.test.ts`:

```ts
it('Ken has a departure, a region transition and one boss reaction', () => {
  const withKen = { seed: 1, regionIndex: 0, partyIds: ['ken','hans','marcus'] };
  const withoutKen = { seed: 1, regionIndex: 0, partyIds: ['earl','hans','marcus'] };
  expect(resolveScene('party-departure', withKen).id).not.toEqual(resolveScene('party-departure', withoutKen).id);
  expect(resolveScene('region-3-intro', { ...withKen, regionIndex: 2 }).id).not.toEqual(resolveScene('region-3-intro', { ...withoutKen, regionIndex: 2 }).id);
  expect(resolveScene('boss-jonlow-intro', withKen).lines.some(l => l.speaker === 'Ken')).toBe(true);
});

it('Jiro keeps priority over Ken at Jonlow', () => {
  const both = { seed: 1, regionIndex: 0, partyIds: ['ken','jiro','marcus'] };
  expect(resolveScene('boss-jonlow-intro', both).relationshipId).toBe('siblings-jonlow-jiro');
});

it('Saq keeps the Warden slot and Ken does not contest it', () => {
  const both = { seed: 1, regionIndex: 2, partyIds: ['saq','ken','marcus'] };
  expect(resolveScene('boss-warden-intro', both).relationshipId).toBe('saq-warden');
});

it('every scene variant remains at most two lines per speaker', () => {
  for (const scene of ALL_SCENE_VARIANTS) {
    const perSpeaker = new Map<string, number>();
    for (const line of scene.lines) perSpeaker.set(line.speaker, (perSpeaker.get(line.speaker) ?? 0) + 1);
    for (const [, count] of perSpeaker) expect(count).toBeLessThanOrEqual(2);
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test:vitest`
Expected: FAIL — the departure scene resolves identically with and without Ken.

- [ ] **Step 3: Add Ken's variants**

In `src/game/content/scenes.ts`, append to `party-departure`'s `relationshipVariants` array, **after** Saq's entry so authored precedence is explicit:

```ts
    {relationshipId:'ken-departure',requiresPartyId:'ken',companionAssetId:'character-ken',variants:[
      {id:'depart-ken',relationshipId:'ken-departure',lines:[{speaker:'Ken',text:'Give me a moment. I want to get the lines right.'}]},
    ]},
```

Add to `region-3-intro`:

```ts
  ],relationshipVariants:[{relationshipId:'ken-region',requiresPartyId:'ken',companionAssetId:'character-ken',variants:[
    {id:'r3-ken',relationshipId:'ken-region',lines:[{speaker:'Ken',text:'Different paper. Same bad workmanship.'}]},
  ]}]},
```

Append to `boss-jonlow-intro`'s `relationshipVariants` array, after the existing Jiro entry:

```ts
    {relationshipId:'ken-jonlow',requiresPartyId:'ken',companionAssetId:'character-ken',variants:[
      {id:'jonlow-ken',relationshipId:'ken-jonlow',lines:[{speaker:'Jonlow',text:'You will do.'},{speaker:'Ken',text:'Somebody drew you badly and never fixed it.'}]},
    ]},
```

`relationshipVariants.find` returns the first authored match, so Jiro keeps Jonlow and Saq keeps Warden. Ken makes no claim about family or shared history.

Add to `EVENT_ARRIVAL_LINES['paper-shrine']`:

```ts
    {id:'shrine-ken',lines:[{speaker:'Ken',text:'See the second stroke? Someone changed the original.'}]},
```

and to `EVENT_ARRIVAL_LINES['old-locker']`:

```ts
    {id:'locker-ken',lines:[{speaker:'Ken',text:'The latch has a seam. Forcing it is just the loud option.'}]},
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm typecheck && pnpm test:vitest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/content/scenes.ts tests/vitest/content.test.ts
git commit -m "feat: add Ken's scene variants behind existing relationship priority"
```

---

### Task 3: Recruitment eligibility, only if recruitment exists

**Files:**
- Modify: `src/game/core/progression/events.ts` (only if a recruitment event is implemented)

**Interfaces:**
- Consumes: the finding recorded by Part C Task 6.
- Produces: either Ken in the eligible candidate pool, or a recorded repeat of the "recruitment absent" finding.

- [ ] **Step 1: Re-check whether recruitment landed since Part C**

```bash
grep -rn "kind:'recruit'" src/game/content/events.ts
```

If no event definition carries a `recruit` effect, recruitment is still absent. Record that in `docs/superpowers/evidence/2026-09-08-spec03-ken-audit.md` and move on — Spec 03 §6 does not build recruitment.

- [ ] **Step 2: If present, add Ken to the pool**

Add `ken` to the candidate source alongside Saq, and assert the same four contracts: duplicate exclusion, outgoing slot, HP/PP percentage and upgrade-count transfer, and the KO floor. Neither new character may enter with full reserves when replacing an exhausted member, and arrival dialogue must not imply a KO character has been revived.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/evidence/2026-09-08-spec03-ken-audit.md src/game/core/progression/events.ts
git commit -m "chore: record Ken recruitment eligibility"
```

---

### Task 4: Mark-aware simulation policy and metrics

**Files:**
- Modify: `scripts/balance-audit.mjs`

**Interfaces:**
- Consumes: `chooseMechanicAware` and the tally shape from Part C Tasks 2-3.
- Produces: mark decisions inside the same policy function, plus `## Ink diagnostics` and `## Script diagnostics` report sections. Part F extends the same policy with tax-cost decisions.

- [ ] **Step 1: Add the mark decisions**

In `scripts/balance-audit.mjs`, inside `chooseMechanicAware`, add before the final `return chooseImmediateValue(battle);`:

```js
  const kenUnit=living(battle,'ally').find(unit=>unit.sourceId==='ken');
  const marked=battle.effects.filter(fx=>fx.id==='ink-mark');

  if(actor.sourceId==='ken'){
    // Set up only when a later ally can plausibly cash it: someone else still acts before Ken does again.
    const laterAlly=battle.turnOrder.slice(battle.turnIndex+1).some(id=>battle.units[id]?.alive&&battle.units[id].side==='ally'&&id!==actor.id);
    if(!marked.length&&laterAlly&&(actor.abilityPP['fresh-ink']??0)>0){
      const foe=living(battle,'enemy').sort((a,b)=>hpRatio(b)-hpRatio(a))[0];
      if(foe)return {kind:'skill',actorId:actor.id,abilityId:'fresh-ink',targetIds:[foe.id]};
    }
    // Conditional Script: only where a single incoming hit could realistically clear the threshold.
    const threshold=unit=>Math.ceil(0.20*unit.maxHp);
    const worst=worstIncomingPower(battle);
    const needy=living(battle,'ally').find(unit=>!battle.effects.some(fx=>fx.id==='script'&&fx.targetUnitId===unit.id)&&worst>=threshold(unit)*2);
    if(needy&&(actor.abilityPP['protective-script']??0)>0&&battle.tier!=='normal'){
      return {kind:'skill',actorId:actor.id,abilityId:'protective-script',targetIds:[needy.id]};
    }
    // Cash his own mark rather than let it expire.
    if(marked.length&&(actor.abilityPP['needlework']??0)>0){
      return {kind:'skill',actorId:actor.id,abilityId:'needlework',targetIds:[marked[0].targetUnitId]};
    }
  }

  // Any other ally: aim an ordinary damaging skill at a marked enemy when one is available.
  if(kenUnit&&marked.length&&actor.id!==kenUnit.id){
    const markedFoe=battle.units[marked[0].targetUnitId];
    if(markedFoe?.alive){
      const best=getCharacter(actor.sourceId).abilities
        .map(id=>({id,ability:getAbility(id)}))
        .filter(entry=>entry.ability.effects.some(e=>e.kind==='damage')&&entry.ability.target==='enemy-one')
        .filter(entry=>validatePlayerCommand(battle,{kind:'skill',actorId:actor.id,abilityId:entry.id,targetIds:[markedFoe.id]}).legal)
        .sort((a,b)=>scoreAbility(battle,actor,b.ability,markedFoe.id)-scoreAbility(battle,actor,a.ability,markedFoe.id))[0];
      if(best)return {kind:'skill',actorId:actor.id,abilityId:best.id,targetIds:[markedFoe.id]};
    }
  }
```

Every branch reads current state and static definitions only. The `immediate-value` control policy has none of this, so the two policies bracket what the mechanic is worth.

- [ ] **Step 2: Add mark and script metrics**

Extend the `tally` in `simulate` and its event loop:

```js
    if(event.type==='effectApplied'&&event.effectId==='ink-mark')tally.inkApplied++;
    if(event.type==='effectRemoved'&&event.effectId==='ink-mark')tally[`ink${event.reason[0].toUpperCase()}${event.reason.slice(1)}`]++;
    if(event.type==='effectApplied'&&event.effectId==='script')tally.scriptApplied++;
    if(event.type==='effectRemoved'&&event.effectId==='script'&&event.reason==='consumed')tally.scriptTriggered++;
    if(event.type==='effectRemoved'&&event.effectId==='script'&&event.reason==='expired')tally.scriptExpired++;
    if(event.type==='prevented'&&event.kind==='script')tally.scriptPrevented+=event.amount;
    const markMessage=event.type==='message'&&event.text.startsWith('Ink Mark adds');
    if(markMessage){tally.markConsumed++;tally.markPower+=Number(event.text.match(/adds (\d+) power/)[1]);}
```

Initialise all of these to `0` in the tally literal, including `inkConsumed`, `inkExpired` and `inkCleared`.

Also record setup-to-payoff delay: store the round of each `effectApplied` for `ink-mark` in a map keyed by target, and on the matching consumption push `state.round - appliedRound` into a list.

Mark **contribution** is computed as diagnostic arithmetic on the already-drawn hit: the report states the added power and the resulting damage difference from the same variance and critical values. Do not rerun RNG and do not emit another hit.

- [ ] **Step 3: Add the Ken comparisons**

Reuse `matchedSlot` from Part C:

```js
const kenVsNathaniel=matchedSlot('ken','nathaniel');
const saqVsMarcus=matchedSlot('saq','marcus');
```

and add an explicit layered-defense group, since Saq+Ken is the case neither single comparison covers:

```js
const LAYERED_PARTIES=[['saq','ken','jiro'],['saq','ken','nathaniel'],['saq','marcus','jiro'],['saq','marcus','hans'],['saq','earl','jiro'],['saq','nathaniel','earl']];
const BURST_PARTIES=[['ken','nathaniel','leandre'],['ken','greg','yatords'],['ken','michael','daboy']];
```

Run both lists across every encounter and seed and report them as their own tables. Every one of these is named in companion §6 as required coverage.

- [ ] **Step 4: Run both policies at the 13-character checkpoint**

```bash
node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json
SPEC03_REV=$(git rev-parse HEAD) SPEC03_POLICY=immediate-value node scripts/balance-audit.mjs > /tmp/spec03-ken-immediate.txt
SPEC03_REV=$(git rev-parse HEAD) SPEC03_POLICY=mechanic-aware node scripts/balance-audit.mjs > /tmp/spec03-ken-aware.txt
grep -m1 'three-character parties' /tmp/spec03-ken-aware.txt
```

Expected: the header reports **286** parties from **13** characters. If it reports anything else, the roster or the enumeration is wrong — stop and fix it before reading any other number.

- [ ] **Step 5: Hand-check one mark trace**

Run: `SPEC03_TRACE=202 node scripts/balance-audit.mjs`
Confirm by reading the trace that Ken sets a mark only when a later ally can use it, that the mark is consumed once, and that the printed added power matches 20, 28 or 32 as appropriate. A wrong trace invalidates every aggregate below it.

- [ ] **Step 6: Commit**

```bash
git add scripts/balance-audit.mjs docs/BALANCE_AUDIT_V03.md
git commit -m "feat: measure Ink Mark and Script outcomes under a mark-aware policy"
```

---

### Task 5: The Ken balance gate

**Files:**
- Create: `docs/superpowers/evidence/2026-09-08-spec03-ken-audit.md`

**Interfaces:**
- Consumes: everything from Task 4 and Part C's Saq audit.
- Produces: the recorded decision on Ken's trial numbers and on the layered-defense case. Part F does not start until this is written.

- [ ] **Step 1: Check each gate and write down the result**

Create `docs/superpowers/evidence/2026-09-08-spec03-ken-audit.md` with a row per gate, each carrying its measured number and a pass/flag verdict:

| Gate | What to check | Threshold |
|---|---|---|
| Correctness | No duplicate mark consumption, no mark consumed by an action that applied it, no double-mitigated layering, no save round-trip divergence | Any occurrence blocks release |
| Pacing | Victory median in band: normal 3-6, elite 4-7, boss 6-10, across all 286 parties | Flag p90 more than 3 rounds above the band's upper edge |
| Timeouts | Per party/encounter group, especially the layered-defense list | Flag above 1%; a reproducible indefinite defense loop blocks release |
| Existing roster control | Unchanged encounters with no new mechanic present retain behaviour | Explain any change before tuning content |
| New-character strength | Matched-slot shift for Ken vs Nathaniel and vs the rest of the roster | Flag above 5 percentage points either way; confirm with `SPEC03_SEEDS=expanded` |
| Role relevance | Team-follow-up value for Ken and immediate burst value for Nathaniel in controlled traces | Both must be demonstrated |
| Opportunity cost | Mark-aware play beats blindly repeating Fresh Ink in at least one normal and one boss/elite matchup | If not, investigate policy, then speed, then duration, then values |
| Layered defense | Saq+Ken parties across the six required sustain compositions | No dominance and no stall; if Full Sleeve wins every defensive decision, lower its reserve or prevention before adding tattoo types |

Include the three required burst checks — Ken/Nathaniel/Leandre, Ken/Greg/Yatords, Ken/Michael/Daboy — and confirm burst parties retain meaningful defensive risk.

- [ ] **Step 2: Expand any flagged group**

```bash
SPEC03_SEEDS=expanded SPEC03_POLICY=mechanic-aware node scripts/balance-audit.mjs > /tmp/spec03-ken-expanded.txt
```

Record whether each flag survives 128 seeds.

- [ ] **Step 3: Record the tuning decision**

Change one category at a time, in order: legality/policy → duration and usefulness → PP reserve → base power/prevention → base stats → encounter composition. Rerun the affected comparisons after each change. Record every changed value with its old value and the measurement that justified it, or state explicitly that the trial values were retained.

Do not insist every party has an equal win rate, and do not auto-nerf a beneficial specialist matchup. If an existing kit needs changing, propose it separately rather than folding it in here.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/evidence/2026-09-08-spec03-ken-audit.md docs/BALANCE_AUDIT_V03.md
git commit -m "docs: record the Ken balance audit and tuning decision"
```

---

### Task 6: Part E gate

**Files:**
- Modify: `docs/superpowers/evidence/2026-09-08-spec03-ken-audit.md`

- [ ] **Step 1: Run every check**

```bash
pnpm typecheck && pnpm test:domain && pnpm test:release && pnpm test:vitest && pnpm lint && pnpm build && pnpm test:e2e
```

Expected: all pass. Paste the tail of each.

- [ ] **Step 2: Check combined event value**

```bash
node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json
node scripts/economy-audit.mjs > /tmp/spec03-economy-after-e.txt
diff /tmp/spec03-economy-baseline.txt /tmp/spec03-economy-after-e.txt
```

Four new variants now exist across four events. Measure **realized incremental benefit per run**, not availability in the pool, and confirm a Saq+Ken party is not a dominant route-economy choice. Flag a completion shift above 5 percentage points, extra PP spend above 10%, or recovery coin spend above 10% against the matched baseline route policy.

- [ ] **Step 3: Record the gate**

Append a `## Part E gate` section with the seven command results, the economy comparison, and every unresolved flag with its explanation.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/evidence/2026-09-08-spec03-ken-audit.md
git commit -m "docs: record Spec 03 Part E gate evidence"
```

---

## Next

Part F: `docs/superpowers/plans/2026-09-08-spec03-f-enemies-encounters.md`.
