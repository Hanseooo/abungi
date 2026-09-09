# Spec 03 Part C — Saq: Events, Lore and Balance Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Saq his two event variants and required writing, upgrade the balance simulator so a bot can actually protect and spend Ready, and produce the measured evidence that decides whether his trial numbers ship.

**Architecture:** Both event variants are new `EventChoice` entries on existing events using the existing `requiresCharacterId` hook — no tag framework, no new event definitions. Lore reuses the existing `relationshipVariants` mechanism, which already selects a variant by party membership with stable authored precedence. The simulator gains a second named policy alongside the current heuristic, plus per-mechanic counters; the engine is never duplicated inside scoring code.

**Tech Stack:** TypeScript 5.8, Node 22 `node:test`, plain `.mjs` audit scripts over the compiled `.domain-build` output.

**Spec:** `docs/superpowers/specs/2026-09-08-roster-character-encounter-expansion.md` §6; companion `docs/superpowers/specs/2026-09-08-roster-combat-rules-validation.md` §6 and §7.

**Depends on:** Part B complete and its gate recorded.

## Global Constraints

- Two event variants only, both on existing events, both using `requiresCharacterId: 'saq'`. No runtime event tags, no new event definitions (parent §6).
- Exact outcomes: `sparring-yard` / `saq-coach` pays **16 coins and 8% Max HP** from living allies then selects one existing seeded upgrade offer. `bulk-deal` / `saq-organize` grants **20 coins and no items** (parent §6). The existing `train` costs 22 coins and the existing `help` grants 14, so each variant is a six-coin step.
- Keep the currently implemented membership rule including KO party membership. Do not add a "must be alive" rule for only these characters (parent §6).
- Every event retains its existing free exit. Choosing one variant resolves the node and forfeits the alternatives (parent §6).
- Each new variant stays within Spec 02's roughly ten-coin or one modest-effect-step ceiling (companion §7).
- Per character: one 50-80 word biography, one departure variant, one region-transition variant, the two event results, one selected boss/elite reaction. At most two short lines per speaker, skippable, deterministic selection through `src/game/content/scenes.ts` (parent §6).
- Do not invent family ties or history with bosses. Preserve existing Jonlow/Jiro and Klyde/Earl priority (parent §6).
- Simulation: 32 seeds for broad screening, 128 for a disputed conclusion. Print actual case counts derived from arrays. Party rows sharing members are not independent observations (companion §6).
- Timeout cap: 30 rounds or 180 player commands, whichever comes first; timeout is failure, never a silent dropped row (companion §7).
- Policies may inspect current HP, buffs, order and learned enemy definitions, but never future RNG, hidden move or target selection, or precomputed future damage (companion §6).
- Commands: `pnpm test:domain`, `pnpm test:vitest`, `pnpm test:release`, `pnpm typecheck`, `pnpm lint`, `pnpm build`. Audits: `node scripts/balance-audit.mjs`, `node scripts/economy-audit.mjs`, both after `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json`.
- Never claim a step done without pasting the command output.

## File structure

| File | Responsibility |
|---|---|
| `scripts/balance-audit.mjs` (modify) | Provenance, two named policies, mechanic counters, seed sets, matched-slot comparison |
| `src/game/content/events.ts` (modify) | The two new choices |
| `src/game/content/scenes.ts` (modify) | Departure, region-transition, Warden reaction, event-arrival line |
| `src/game/content/characters.ts` (modify) | Saq's biography field |
| `src/ui/overlays/DetailPanel.tsx` (modify) | Render the biography |
| `tests/domain/events.test.mjs` (modify) | Both variants' exact outcomes and gating |
| `tests/vitest/content.test.ts` (modify) | Writing inventory completeness |
| `docs/BALANCE_AUDIT_V03.md` (regenerated) | The measured report |

---

### Task 1: Fix audit provenance

**Files:**
- Modify: `scripts/balance-audit.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: a report whose header numbers are derived from the arrays it actually enumerates. Tasks 2-5 build on this file; without the fix every later number inherits a false denominator.

- [ ] **Step 1: Replace the hardcoded counts**

In `scripts/balance-audit.mjs`, in the markdown header assignment, replace:

```js
let md=`# Abungi v0.3 Character Balance Audit\n\nGenerated from the deterministic game engine with ${records.length.toLocaleString()} battles: all 165 three-character parties × 12 encounters × ${seeds.length} deterministic seeds.
```

with:

```js
let md=`# Abungi v0.3 Character Balance Audit\n\nGenerated from the deterministic game engine with ${records.length.toLocaleString()} battles: all ${parties.length} three-character parties from ${CHARACTERS.length} characters × ${ENCOUNTERS.length} encounters × ${seeds.length} deterministic seeds.
```

Leave the rest of that template string unchanged.

- [ ] **Step 2: Add explicit provenance**

Immediately after that assignment, add:

```js
md+=`\nProvenance: revision \`${process.env.SPEC03_REV ?? 'unrecorded'}\`, working tree \`${process.env.SPEC03_TREE ?? 'unrecorded'}\`, seeds \`${seeds.join(',')}\`, policy \`${process.env.SPEC03_POLICY ?? 'heuristic-v1'}\`, timeout cap ${ROUND_CAP} rounds / ${COMMAND_CAP} commands. Party rows share members, so they are not independent observations.\n`;
```

and define the caps near the top of the file, replacing the magic `180`:

```js
const ROUND_CAP=30;
const COMMAND_CAP=180;
```

Then change `simulate`'s loop condition from `actions<180` to `actions<COMMAND_CAP&&battle.round<=ROUND_CAP`, and change its return object to include the outcome kind:

```js
  const allies=battle.allies.map(id=>battle.units[id]);
  const outcome=battle.escaped?'escape':battle.phase==='victory'?'win':battle.phase==='defeat'?'defeat':'timeout';
  return {outcome,won:outcome==='win',rounds:battle.round,actions,survivors:allies.filter(a=>a.alive).length,hpRatio:allies.reduce((s,a)=>s+a.hp/a.maxHp,0)/allies.length};
```

The previous code threw on an unresolved automatic state; keep that throw, and note that reaching the cap now produces a `timeout` row instead of an exception.

- [ ] **Step 3: Report the four outcomes separately**

In `summarize`, add:

```js
    timeouts:rows.filter(r=>r.outcome==='timeout').length,
    defeats:rows.filter(r=>r.outcome==='defeat').length,
    escapes:rows.filter(r=>r.outcome==='escape').length,
    medianRounds:(()=>{const wins=rows.filter(r=>r.outcome==='win').map(r=>r.rounds).sort((a,b)=>a-b);return wins.length?wins[Math.floor(wins.length/2)]:0;})(),
    p90Rounds:(()=>{const wins=rows.filter(r=>r.outcome==='win').map(r=>r.rounds).sort((a,b)=>a-b);return wins.length?wins[Math.min(wins.length-1,Math.floor(wins.length*0.9))]:0;})(),
```

and add median, p90 and timeout columns to the global pacing table. Rounds statistics are victory-only; defeated and timed-out durations must be reported in their own column, never averaged into the win figure.

- [ ] **Step 4: Run it**

```bash
node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json
SPEC03_REV=$(git rev-parse HEAD) node scripts/balance-audit.mjs | head -30
```

Expected: the header now reads "all 220 three-character parties from 12 characters × 12 encounters × 4 deterministic seeds" and carries the provenance line.

- [ ] **Step 5: Commit**

```bash
git add scripts/balance-audit.mjs docs/BALANCE_AUDIT_V03.md
git commit -m "fix: derive balance audit provenance from actual content"
```

---

### Task 2: Mechanic-aware simulation policy

**Files:**
- Modify: `scripts/balance-audit.mjs`

**Interfaces:**
- Consumes: `applyIncomingEffects` behaviour and `BALANCE.saq` from Part B (read, not re-implemented).
- Produces: `POLICIES = {'immediate-value': …, 'mechanic-aware': …}` and a `--policy` switch. Part E extends the same table with mark decisions; Part F adds tax-cost decisions.

- [ ] **Step 1: Extract the existing policy behind a name**

In `scripts/balance-audit.mjs`, rename `chooseCommand` to `chooseImmediateValue` and add the policy table beneath it:

```js
const POLICIES={
  'immediate-value':chooseImmediateValue,
  'mechanic-aware':chooseMechanicAware,
};
const POLICY_NAME=process.env.SPEC03_POLICY??'mechanic-aware';
const chooseCommand=battle=>POLICIES[POLICY_NAME](battle);
```

The immediate-value policy is the pre-existing heuristic and is the control: it never buys a turn that pays off later, so it establishes what Saq is worth to a bot that ignores him.

- [ ] **Step 2: Score the protection decision**

Add above the policy table:

```js
/** Whom the enemy AI is most likely to hit next: it favours the lowest HP fraction 65% of the time. */
function likelyEnemyTarget(battle){
  return living(battle,'ally').sort((a,b)=>hpRatio(a)-hpRatio(b))[0];
}

/** Enemy damage headroom, learned from the enemy definitions the player can already read. */
function worstIncomingPower(battle){
  return Math.max(0,...living(battle,'enemy').flatMap(unit=>getEnemy(unit.sourceId).moves.flatMap(move=>move.effects.filter(e=>e.kind==='damage').map(e=>e.power))));
}

function chooseMechanicAware(battle){
  const actor=battle.units[battle.turnOrder[battle.turnIndex]];
  if(actor.sourceId==='saq'){
    const threatened=likelyEnemyTarget(battle);
    const linked=battle.effects.some(fx=>fx.id==='protect'&&fx.sourceUnitId===actor.id);
    const ppLeft=actor.abilityPP['take-your-seat']??0;
    const worst=worstIncomingPower(battle);
    // Protect when a distinct ally is the likely target, the incoming hit is meaningful,
    // and no equivalent link is already standing. Never protect self; never refresh for free.
    if(!linked&&ppLeft>0&&threatened&&threatened.id!==actor.id&&hpRatio(threatened)<0.62&&worst>=50){
      return {kind:'skill',actorId:actor.id,abilityId:'take-your-seat',targetIds:[threatened.id]};
    }
    // Spend Ready rather than let it expire unused.
    if(Number(actor.flags.readyTurns??0)>0&&(actor.abilityPP['dismissed']??0)>0){
      const foe=living(battle,'enemy').sort((a,b)=>hpRatio(a)-hpRatio(b))[0];
      if(foe)return {kind:'skill',actorId:actor.id,abilityId:'dismissed',targetIds:[foe.id]};
    }
  }
  return chooseImmediateValue(battle);
}
```

Add `import { getEnemy } from '../.domain-build/content/enemies.js';` beside the existing content imports.

Every branch reads only current HP, current effects, current PP and static enemy definitions. None reads future RNG, the enemy's hidden next move, or precomputed damage.

- [ ] **Step 3: Validate the decision trace by hand before trusting any aggregate**

Add a `--trace` flag that prints one battle's chosen commands:

```js
if(process.env.SPEC03_TRACE){
  const rng=new SeededRng(Number(process.env.SPEC03_TRACE));
  let battle=createBattle(['saq','hans','marcus'],'normal-fastlane',rng,{coins:30,regionIndex:0});
  while(battle.phase==='input'&&battle.round<=ROUND_CAP){
    const command=chooseCommand(battle);
    console.log(`R${battle.round} ${battle.units[command.actorId].displayName}: ${command.abilityId??command.kind}`);
    battle=resolveBattleCommand(battle,command,rng).nextState;
  }
  console.log(`outcome=${battle.phase} effects=${JSON.stringify(battle.effects)}`);
  process.exit(0);
}
```

Run: `SPEC03_TRACE=101 node scripts/balance-audit.mjs`
Read the printed trace and confirm by hand that Saq protects a threatened ally rather than himself, and that Dismissed follows a successful interception. A policy whose trace is wrong invalidates every number it later produces — fix the policy before proceeding.

- [ ] **Step 4: Commit**

```bash
git add scripts/balance-audit.mjs
git commit -m "feat: add a mechanic-aware balance policy alongside the heuristic control"
```

---

### Task 3: Protect metrics and the matched-slot comparison

**Files:**
- Modify: `scripts/balance-audit.mjs`

**Interfaces:**
- Consumes: the `effectApplied`, `effectRemoved`, `prevented`, `transfer`, `ready` events from Part A Task 1.
- Produces: a `## Protect diagnostics` and `## Matched-slot replacement` section in `docs/BALANCE_AUDIT_V03.md`. Part E adds mark diagnostics to the same shape.

- [ ] **Step 1: Count the events the engine already emits**

In `simulate`, accumulate per battle rather than re-deriving anything:

```js
  const tally={protectCasts:0,protectTriggers:0,protectExpired:0,recipientAvoided:0,transferPaid:0,monitorPrevented:0,readyGranted:0,readySpent:0};
  // inside the command loop, replacing `battle=resolveBattleCommand(...).nextState;`
  const resolution=resolveBattleCommand(battle,command,rng);
  for(const event of resolution.events){
    if(event.type==='effectApplied'&&event.effectId==='protect')tally.protectCasts++;
    if(event.type==='effectRemoved'&&event.effectId==='protect'&&event.reason==='consumed')tally.protectTriggers++;
    if(event.type==='effectRemoved'&&event.effectId==='protect'&&event.reason==='expired')tally.protectExpired++;
    if(event.type==='transfer')tally.transferPaid+=event.amount;
    if(event.type==='prevented'&&event.kind==='class-monitor')tally.monitorPrevented+=event.amount;
    if(event.type==='ready')event.active?tally.readyGranted++:tally.readySpent++;
  }
  battle=resolution.nextState;
```

Return `tally` from `simulate` and spread it into each record.

Report **recipient damage avoided** and **party damage prevented** as separate columns. They are different numbers: for a 40-damage hit with Class Monitor available the recipient avoids 20 while the party prevents only 15. Never present one as the other.

- [ ] **Step 2: Add the matched-slot comparison**

Append before the report is written:

```js
/** Hold two teammates fixed, swap the third, run the same encounter seeds. */
function matchedSlot(subjectId,alternativeId){
  const others=CHARACTERS.map(c=>c.id).filter(id=>id!==subjectId&&id!==alternativeId);
  const rows=[];
  for(const pair of combinations(others,2))for(const encounter of ENCOUNTERS)for(const seed of seeds){
    const scenarioSeed=(seed^hashText(`${pair.join('|')}|${encounter.id}`))>>>0;
    rows.push({
      pair,encounter:encounter.id,tier:encounter.tier,
      subject:simulate([subjectId,...pair],encounter,scenarioSeed),
      alternative:simulate([alternativeId,...pair],encounter,scenarioSeed),
    });
  }
  return rows;
}
```

Add `import { hashText } from '../.domain-build/core/rng/seededRng.js';`. The scenario seed is derived from the fixed pair and the encounter and never from the swapped slot, so both arms face matched starting conditions. Different action sequences still diverge in RNG consumption; the report must say so rather than claim identical rolls.

Render the result as a table of win-rate delta and median-round delta per encounter tier, and flag any matched-slot win-rate shift greater than **5 percentage points** in either direction.

- [ ] **Step 3: Widen the seed set**

Replace `const seeds=[101,202,303,404];` with:

```js
const SCREENING_SEEDS=[101,202,303,404,505,606,707,808,909,1010,1111,1212,1313,1414,1515,1616,1717,1818,1919,2020,2121,2222,2323,2424,2525,2626,2727,2828,2929,3030,3131,3232];
const EXPANDED_SEEDS=[...SCREENING_SEEDS,...Array.from({length:96},(_,i)=>4000+i*37)];
const seeds=process.env.SPEC03_SEEDS==='expanded'?EXPANDED_SEEDS:SCREENING_SEEDS;
```

32 seeds screen broadly; run `SPEC03_SEEDS=expanded` only on a flagged matchup group before accepting a disputed conclusion. These are practical sample sizes, not a guarantee of statistical precision, and the report must say so.

- [ ] **Step 4: Run both policies and record**

```bash
node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json
SPEC03_REV=$(git rev-parse HEAD) SPEC03_POLICY=immediate-value node scripts/balance-audit.mjs > /tmp/spec03-saq-immediate.txt
SPEC03_REV=$(git rev-parse HEAD) SPEC03_POLICY=mechanic-aware node scripts/balance-audit.mjs > /tmp/spec03-saq-aware.txt
```

Expected: both complete without a thrown error. Compare them. Policy disagreement is uncertainty to investigate, not something to average away.

- [ ] **Step 5: Commit**

```bash
git add scripts/balance-audit.mjs docs/BALANCE_AUDIT_V03.md
git commit -m "feat: measure Protect outcomes and matched-slot replacement"
```

---

### Task 4: The Saq balance gate

**Files:**
- Create: `docs/superpowers/evidence/2026-09-08-spec03-saq-audit.md`

**Interfaces:**
- Consumes: everything from Tasks 1-3.
- Produces: the recorded decision on Saq's trial numbers. Part D does not start until this is written, whether or not the values change.

- [ ] **Step 1: Check each gate and write down the result**

Create `docs/superpowers/evidence/2026-09-08-spec03-saq-audit.md` with one row per gate from companion §7, each carrying its measured number and a pass/flag verdict:

| Gate | What to check | Threshold |
|---|---|---|
| Correctness | No recursive interception, negative PP, repeated reward callback, illegal paid no-op, or save round-trip divergence | Any occurrence blocks release |
| Pacing | Victory median in the tier band: normal 3-6, elite 4-7, boss 6-10 | Flag p90 more than 3 rounds above the band's upper edge |
| Timeouts | Timeout rate per party/encounter group | Flag above 1%; a reproducible indefinite defense loop blocks release |
| Existing roster control | Old-party commands and seeds retain behaviour when no new mechanic is present | Explain any change before tuning content |
| New-character strength | Matched-slot win-rate shift, Saq vs Marcus and vs the rest of the roster | Flag above 5 percentage points either way; confirm with expanded seeds |
| Role relevance | One repeatable focused-pressure niche where Saq helps, one sustained/AoE niche where Marcus helps | Both must be demonstrated in traces |
| Opportunity cost | Protect averts a local KO in a legal scenario without hidden intent | If not, investigate policy, then speed, then duration, then values |

A "save" is a locally lethal hit without that defense, not proof the whole battle would have been lost. Report it as such.

- [ ] **Step 2: Expand any flagged group**

For each flagged row:

```bash
SPEC03_SEEDS=expanded SPEC03_POLICY=mechanic-aware node scripts/balance-audit.mjs > /tmp/spec03-saq-expanded.txt
```

Record whether the flag survives 128 seeds.

- [ ] **Step 3: Record the tuning decision**

If a value changes, change one category at a time in this order and rerun the affected comparisons: legality/policy → duration and usefulness → PP reserve → base power/prevention → base stats → encounter composition. Every changed value lives in `BALANCE.saq` or the ability definitions from Part B; record the old value, the new value, and the measurement that justified it.

If nothing changes, say so explicitly and record that the trial values were retained.

The report may not say "balanced" while leaving a flag unexplained. Do not tune weak existing characters as incidental scope; if an old kit needs changing, propose it separately.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/evidence/2026-09-08-spec03-saq-audit.md docs/BALANCE_AUDIT_V03.md
git commit -m "docs: record the Saq balance audit and tuning decision"
```

---

### Task 5: Saq's two event variants

**Files:**
- Modify: `src/game/content/events.ts`
- Test: `tests/domain/events.test.mjs`

**Interfaces:**
- Consumes: `canChooseEvent`, `applyEventChoice`, `deriveEventOffers` from `src/game/core/progression/events.ts` — all unchanged.
- Produces: choices `saq-coach` on `sparring-yard` and `saq-organize` on `bulk-deal`.

- [ ] **Step 1: Write the failing test**

Append to `tests/domain/events.test.mjs`:

```js
test('saq-coach costs six fewer coins than Train and takes the same injury', () => {
  const run = runWithParty(['saq','hans','marcus'], { coins: 40 });
  const train = getEvent('sparring-yard').choices.find(c => c.id === 'train');
  const coach = getEvent('sparring-yard').choices.find(c => c.id === 'saq-coach');
  assert.equal(coach.requiresCharacterId, 'saq');
  assert.deepEqual(coach.effects, [
    { kind: 'coins', amount: -16 },
    { kind: 'partyHpPercent', amount: -0.08 },
    { kind: 'upgradeAbility' },
  ]);
  assert.equal(train.effects[0].amount, -22, 'the base choice is unchanged');
  assert.equal(coach.effects[1].amount, train.effects[1].amount, 'same injury');
});

test('saq-coach is unavailable without Saq in the party', () => {
  const run = runWithParty(['earl','hans','marcus'], { coins: 40 });
  const verdict = canChooseEvent(run, 'sparring-yard', 'saq-coach');
  assert.equal(verdict.allowed, false);
  assert.match(verdict.reason, /required character/i);
});

test('saq-coach remains available when Saq is KO, matching every other character variant', () => {
  const run = runWithParty(['saq','hans','marcus'], { coins: 40 });
  run.party.find(m => m.characterId === 'saq').hp = 0;
  const node = run.route.nodes.find(n => n.eventId === 'sparring-yard');
  run.currentNodeId = node.id;
  assert.equal(canChooseEvent(run, 'sparring-yard', 'saq-coach', firstUpgradeSelection(run, node)).allowed, true);
});

test('saq-organize grants six more coins than helping pack, and no items', () => {
  const run = runWithParty(['saq','hans','marcus'], { coins: 0 });
  const organize = getEvent('bulk-deal').choices.find(c => c.id === 'saq-organize');
  assert.equal(organize.requiresCharacterId, 'saq');
  assert.deepEqual(organize.effects, [{ kind: 'coins', amount: 20 }]);
  const before = run.coins;
  const result = applyEventChoice(run, 'bulk-deal', 'saq-organize', new SeededRng(5));
  assert.equal(result.run.coins, before + 20);
  assert.deepEqual(result.run.inventory, run.inventory, 'the coin-only helper adds no items');
});

test('bulk-deal still offers its existing free-of-Saq choices', () => {
  const ids = getEvent('bulk-deal').choices.map(c => c.id);
  assert.deepEqual(ids.filter(id => id !== 'saq-organize'), ['leandre-crate','buy','help']);
});
```

`runWithParty` and `firstUpgradeSelection` must reuse whatever helpers `tests/domain/events.test.mjs` already defines; extract them from an existing test if they are currently inline.

- [ ] **Step 2: Run to verify failure**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/events.test.mjs`
Expected: FAIL — `saq-coach` is `undefined`.

- [ ] **Step 3: Add the choices**

In `src/game/content/events.ts`, in `sparring-yard`, insert **before** the existing `train` choice so the character variant is offered first, matching how `night-cart` and `bulk-deal` already order theirs:

```ts
    {id:'saq-coach',label:'Let Saq coach the session',hint:'Spend 16 coins and 8% Max HP from living allies to upgrade one ability.',resultText:'Saq runs the drill properly, and the bruises are on purpose.',requiresCharacterId:'saq',effects:[{kind:'coins',amount:-16},{kind:'partyHpPercent',amount:-0.08},{kind:'upgradeAbility'}]},
```

In `bulk-deal`, insert before the existing `help` choice:

```ts
    {id:'saq-organize',label:'Let Saq organize the pickup',hint:'Gain 20 coins · no items.',resultText:'Saq sorts the shelf into three stacks, and the stallholder pays for the hour.',requiresCharacterId:'saq',effects:[{kind:'coins',amount:20}]},
```

No change is needed in `src/game/core/progression/events.ts`: `canChooseEvent` already gates on `requiresCharacterId` and `deriveEventOffers` already returns `sparring-yard` upgrade offers for the whole party.

- [ ] **Step 4: Run to verify it passes**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/events.test.mjs`
Expected: PASS.

- [ ] **Step 5: Run the full domain suite**

Run: `pnpm test:domain`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/content/events.ts tests/domain/events.test.mjs
git commit -m "feat: add Saq event variants to Sparring Yard and Bulk Deal"
```

---

### Task 6: Recruitment eligibility, only if recruitment exists

**Files:**
- Modify: `src/game/core/progression/events.ts` (only if a recruitment event is implemented)
- Test: `tests/domain/events.test.mjs`

**Interfaces:**
- Consumes: `deriveEventOffers`'s `recruitIds` field, which exists today but is always empty.
- Produces: either Saq in the eligible candidate pool, or a recorded finding that recruitment is absent. Part E repeats this check for Ken.

- [ ] **Step 1: Determine whether recruitment is actually implemented**

```bash
grep -rn "recruit" src/game/content/events.ts src/game/core/progression/events.ts src/features/event
```

The `{kind:'recruit'}` effect type and `recruitIds` field exist, but Spec 02's `fourth-chair` event was absent from the event definitions when the spec was written. If no `EventDefinition` carries a `recruit` effect, recruitment is not implemented.

- [ ] **Step 2a: If recruitment is absent, record it and stop**

Add to `docs/superpowers/evidence/2026-09-08-spec03-saq-audit.md`:

```markdown
## Recruitment integration
Not applicable: no event definition carries a `recruit` effect as of <revision>. Spec 03 §6
does not build recruitment, so Saq's candidate-pool entry is deferred to whichever slice ships it.
```

Do not build recruitment as part of this spec.

- [ ] **Step 2b: If recruitment is present, add Saq to the pool**

Add `saq` to whatever candidate source `deriveEventOffers` uses for `recruitIds`, and write a test asserting all four existing contracts still hold: duplicate exclusion, the outgoing slot, HP/PP percentage and upgrade-count transfer, and the stated KO floor. A recruited Saq must not enter with full reserves when replacing an exhausted member.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/evidence/2026-09-08-spec03-saq-audit.md src/game/core/progression/events.ts tests/domain/events.test.mjs
git commit -m "chore: record Saq recruitment eligibility"
```

---

### Task 7: Saq's required writing

**Files:**
- Modify: `src/game/content/characters.ts`
- Modify: `src/game/content/scenes.ts`
- Modify: `src/ui/overlays/DetailPanel.tsx`
- Test: `tests/vitest/content.test.ts`

**Interfaces:**
- Consumes: `resolveScene`, `relationshipVariants`, `SceneContext` from `scenes.ts` — all unchanged.
- Produces: `CharacterDefinition.bio`, a `party-departure` variant for Saq, a `region-2-intro` variant for Saq, a Warden reaction. Part E adds Ken's set with the same shape and reserves the Jonlow slot for him.

- [ ] **Step 1: Write the failing test**

Append to `tests/vitest/content.test.ts`:

```ts
it('Saq has a 50-80 word biography', () => {
  const words = getCharacter('saq').bio.trim().split(/\s+/).length;
  expect(words).toBeGreaterThanOrEqual(50);
  expect(words).toBeLessThanOrEqual(80);
});

it('Saq has a departure, a region transition and one boss reaction', () => {
  const withSaq = { seed: 1, regionIndex: 0, partyIds: ['saq','hans','marcus'] };
  const withoutSaq = { seed: 1, regionIndex: 0, partyIds: ['earl','hans','marcus'] };
  expect(resolveScene('party-departure', withSaq).id).not.toEqual(resolveScene('party-departure', withoutSaq).id);
  expect(resolveScene('region-2-intro', { ...withSaq, regionIndex: 1 }).id).not.toEqual(resolveScene('region-2-intro', { ...withoutSaq, regionIndex: 1 }).id);
  expect(resolveScene('boss-warden-intro', withSaq).lines.some(l => l.speaker === 'Saq')).toBe(true);
});

it('every scene variant is at most two lines per speaker', () => {
  for (const scene of ALL_SCENE_VARIANTS) {
    const perSpeaker = new Map<string, number>();
    for (const line of scene.lines) perSpeaker.set(line.speaker, (perSpeaker.get(line.speaker) ?? 0) + 1);
    for (const [, count] of perSpeaker) expect(count).toBeLessThanOrEqual(2);
  }
});

it('existing relationship scenes keep their priority over the new character variants', () => {
  const both = { seed: 1, regionIndex: 2, partyIds: ['saq','earl','marcus'] };
  expect(resolveScene('boss-klyde-intro', both).relationshipId).toBe('siblings-klyde-earl');
});
```

`ALL_SCENE_VARIANTS` must be a new named export from `scenes.ts` that flattens `SCENES`, `ELITE_SCENE_OVERRIDES` and `EVENT_ARRIVAL_LINES` variants — add it in Step 3 rather than reaching into module internals from the test.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test:vitest`
Expected: FAIL — `bio` is undefined on the character record.

- [ ] **Step 3: Add the biography field**

In `src/game/core/types.ts`, add to `CharacterDefinition`:

```ts
  bio: string;
```

`pnpm typecheck` will now flag all twelve characters. Add a 50-80 word `bio` to each. For the eleven existing characters, derive the text from their existing `role` and `passive.description` — this is required by the type, so it traces to the request and is not unrelated scope. Saq's:

```ts
    bio:'Saq teaches because he is good at it, not because he needs an audience. He notices which way trouble is about to move a half-second before anyone else and puts himself in its way without a speech about it. Stern, dry, occasionally very tired of people who take avoidable risks. He is warm with anyone who listens, and unimpressed by anyone who does not.',
```

- [ ] **Step 4: Add Saq's scene variants**

In `src/game/content/scenes.ts`, add to `party-departure`:

```ts
  ],relationshipVariants:[{relationshipId:'saq-departure',requiresPartyId:'saq',companionAssetId:'character-saq',variants:[
    {id:'depart-saq',relationshipId:'saq-departure',lines:[{speaker:'Saq',text:'Keep close. You can argue when we are somewhere safer.'}]},
  ]}]},
```

Add the equivalent block to `region-2-intro`:

```ts
  ],relationshipVariants:[{relationshipId:'saq-region',requiresPartyId:'saq',companionAssetId:'character-saq',variants:[
    {id:'r2-saq',relationshipId:'saq-region',lines:[{speaker:'Saq',text:'New district, same bad habits. Stay where I can reach you.'}]},
  ]}]},
```

Add to `boss-warden-intro`:

```ts
  ],relationshipVariants:[{relationshipId:'saq-warden',requiresPartyId:'saq',companionAssetId:'character-saq',variants:[
    {id:'warden-saq',relationshipId:'saq-warden',lines:[{speaker:'Warden',text:'Order is maintained.'},{speaker:'Saq',text:'Order should protect people.'}]},
  ]}]},
```

Add to `EVENT_ARRIVAL_LINES['sparring-yard']`:

```ts
    {id:'training-saq',lines:[{speaker:'Saq',text:'Watch the footwork, not the fist. One repetition, done properly.'}]},
```

`resolveScene` picks a variant with a seeded RNG from a fixed pool, so selection stays deterministic and consumes no run RNG. `relationshipVariants.find` returns the first authored match, so existing Jonlow/Jiro and Klyde/Earl entries keep priority as long as they stay first in their arrays. Reserve `boss-jonlow-intro` for Ken in Part E rather than adding a second Saq boss reaction here.

- [ ] **Step 5: Export the flattened variant list**

Add to `scenes.ts`:

```ts
export const ALL_SCENE_VARIANTS:SceneVariant[]=[
  ...SCENES.flatMap(scene=>[...scene.variants,...(scene.relationshipVariants??[]).flatMap(entry=>entry.variants)]),
  ...Object.values(ELITE_SCENE_OVERRIDES).flatMap(entry=>entry.variants),
  ...Object.values(EVENT_ARRIVAL_LINES).flat(),
];
```

- [ ] **Step 6: Render the biography**

In `src/ui/overlays/DetailPanel.tsx`, in the `overlay.kind==='character'` branch, add `<p className="detail-bio">{c.bio}</p>` immediately after the `detail-lead` paragraph. Add a `.detail-bio` rule in `src/styles.css` reusing the existing body-copy tokens.

- [ ] **Step 7: Run to verify it passes**

Run: `pnpm typecheck && pnpm test:vitest && pnpm test:domain && pnpm test:release && pnpm build`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/game/core/types.ts src/game/content/characters.ts src/game/content/scenes.ts src/ui/overlays/DetailPanel.tsx src/styles.css tests/vitest/content.test.ts
git commit -m "feat: add character biographies and Saq's scene variants"
```

---

### Task 8: Part C gate

**Files:**
- Modify: `docs/superpowers/evidence/2026-09-08-spec03-saq-audit.md`

- [ ] **Step 1: Run every check**

```bash
pnpm typecheck && pnpm test:domain && pnpm test:release && pnpm test:vitest && pnpm lint && pnpm build && pnpm test:e2e
```

Expected: all pass. Paste the tail of each.

- [ ] **Step 2: Check the event-value ceiling**

```bash
node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json
node scripts/economy-audit.mjs > /tmp/spec03-economy-after-c.txt
diff /tmp/spec03-economy-baseline.txt /tmp/spec03-economy-after-c.txt
```

Each variant is a six-coin step, inside Spec 02's roughly ten-coin ceiling. Confirm the combined realized event value does not make a Saq party a dominant route-economy choice: measure event exposure and realized incremental benefit per run, not just availability in the pool. Flag a completion shift above 5 percentage points, extra PP spend above 10%, or recovery coin spending above 10% relative to the matched baseline route policy.

- [ ] **Step 3: Record the gate**

Append a `## Part C gate` section listing the seven command results, the economy comparison, and every unresolved flag with its explanation.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/evidence/2026-09-08-spec03-saq-audit.md
git commit -m "docs: record Spec 03 Part C gate evidence"
```

---

## Next

Part D: `docs/superpowers/plans/2026-09-08-spec03-d-ken-kit.md`.
