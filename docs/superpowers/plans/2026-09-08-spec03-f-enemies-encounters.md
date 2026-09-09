# Spec 03 Part F — Enemy Candidates, Encounters and Release Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evaluate three normal-enemy candidates one at a time, shipping each with its encounter only if it earns a measured target-priority decision, then run the complete-run release audit and record the elite decision.

**Architecture:** Each candidate is content plus at most one shared mechanic. Peel Away reuses the `removeEffect` effect kind Part A reserved. Pry Open threads one optional multiplier through the existing damage formula. Taxed reuses the `taxed` effect id Part A reserved, with its cost read from one shared helper so legality and UI can never disagree. Route selection already derives its normal pool from `ENCOUNTERS`, so new encounters become reachable with no route change.

**Tech Stack:** TypeScript 5.8, React 19, Node 22 `node:test`, Vitest, Playwright, plain `.mjs` audit scripts.

**Spec:** `docs/superpowers/specs/2026-09-08-roster-character-encounter-expansion.md` §7 and §9; companion `docs/superpowers/specs/2026-09-08-roster-combat-rules-validation.md` §4, §6, §7 and §9.

**Depends on:** Part E complete and its gate recorded.

## Global Constraints

- Introduce **one candidate per audit step**. Ship each only if it adds a measured target-priority decision without invalidating defensive builds. If a candidate fails its gate, omit that candidate **and its encounter together** and report the reduced count (parent §7).
- Definitions carry **unscaled** content stats, processed through the existing tier and region multipliers. Never copy already-scaled encounter HP into a definition (parent §7).
- New content must not inspect party character names or IDs to choose counters (parent §7).
- At most one new archetype per normal encounter. No duplicate tax enemies, no new three-enemy composition, no new archetype in an existing boss fight (parent §7).
- Peel Away removes exactly one effect, after damage, only if the hit landed and the target survives, in the fixed priority **Fortified, Strength, Haste, Script**. It cannot remove Protect, Ready, or an enemy's Ink Mark. `cooldown: 2` means it cannot appear more often than every third enemy turn (companion §4).
- Pry Open replaces the Guard-action multiplier **for its hit only**. It must not mutate `guardActive`, base Guard, or later hits. Base Guard, Fortified, Protect and Script all remain functional. It never checks for Marcus or Saq (companion §4).
- Taxed: one nonstacking negative effect, ordinary status accuracy affected by Blind, no damage and no automatic PP removal. While active **every skill costs 2 PP from that skill's own reserve**; one remaining PP is insufficient. Guard and items cost no extra and end the turn, expiring it. A committed skill consumes it even on a miss; an invalid command spends nothing and does not expire it. The once-per-battle flag must survive reload. No PP deletion, no one-move disable subsystem, no `+2` surcharge alternative (companion §4).
- Keep the six existing normal encounter IDs and all existing bosses, three regions, route length, and reward layers unchanged (parent §7, §3).
- Pacing bands: normal 3-6 rounds, elite 4-7, boss 6-10, interpreted statistically (parent §7).
- Complete-run audit: all 286 parties through at least **16 complete-run seeds** with legal route, reward, rest, shop, event and field-item decisions and persistent HP, per-move PP, inventory, coins, upgrades and relics. If the harness cannot model a subsystem, extend the script in scope or report that the run gate is **unverified** — never substitute fresh battles and call them complete runs (companion §6).
- Default decision on the elite is **defer** (parent §7, phase I).
- Commands: `pnpm test:domain`, `pnpm test:vitest`, `pnpm test:release`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:e2e`.
- Never claim a step done without pasting the command output.

## File structure

| File | Responsibility |
|---|---|
| `src/game/core/combat/battleEngine.ts` (modify) | `removeEffect` branch, hit tracking, Pry Open plumbing, taxed PP cost, cleanse ordering |
| `src/game/core/combat/damage.ts` (modify) | Optional Guard-action multiplier override |
| `src/game/core/combat/status.ts` (modify) | `incomingDamageMultiplier` override parameter |
| `src/game/core/combat/actions.ts` (modify) | `skillPpCost` — the single authority both legality and UI read |
| `src/game/balance/constants.ts` (modify) | `pryOpenGuardMultiplier` |
| `src/game/content/enemies.ts` (modify) | Up to three enemies and three encounters, added one at a time |
| `src/game/content/guide.ts` (modify) | Taxed effect guide entry |
| `src/features/battle/BattleScreen.tsx` (modify) | Show the taxed skill's real cost before confirming |
| `scripts/generate_local_assets.py` (modify) | Up to three enemy cutouts |
| `scripts/economy-audit.mjs` (modify) | Complete-run coverage or an explicit unverified report |
| `tests/domain/enemies-v03.test.mjs` (create) | Each mechanic's main path and critical failure path |

---

### Task 1: Shared mechanics for the candidates

**Files:**
- Modify: `src/game/core/combat/battleEngine.ts`, `damage.ts`, `status.ts`, `actions.ts`
- Modify: `src/game/balance/constants.ts`
- Create: `tests/domain/enemies-v03.test.mjs`

**Interfaces:**
- Consumes: `removeEffect` from Part A Task 1; the `applyEffect` branch from Part B Task 3; `EFFECT_LIFETIMES` from Part B Task 1.
- Produces: `AbilityContext.hitTargets`, the `removeEffect` resolution branch, `DamageInput.guardActionMultiplier`, `incomingDamageMultiplier(unit, guardActionMultiplier?)`, and `skillPpCost(state, actor)`. Tasks 2-4 add only content on top of these.

- [ ] **Step 1: Write the failing test**

Create `tests/domain/enemies-v03.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRng } from '../../.domain-build/core/rng/seededRng.js';
import { createBattle, resolveBattleCommand } from '../../.domain-build/core/combat/battleEngine.js';
import { skillPpCost, validatePlayerCommand } from '../../.domain-build/core/combat/actions.js';
import { calculateDamage } from '../../.domain-build/core/combat/damage.js';
import { BALANCE } from '../../.domain-build/balance/constants.js';

const party = ['saq','ken','marcus'];
const battleOf = (encounter = 'normal-fastlane', seed = 777) => createBattle(party, encounter, new SeededRng(seed), { coins: 30 });
const unitOf = (battle, sourceId) => battle.allies.concat(battle.enemies).find(id => battle.units[id].sourceId === sourceId);

test('the Guard-action multiplier can be overridden for one hit without touching guardActive', () => {
  const battle = battleOf();
  const target = battle.units[battle.allies[0]];
  target.guardActive = true;
  const attacker = battle.units[battle.enemies[0]];
  const guarded = calculateDamage({ attacker, defender: target, power: 60, moveAffinity: 'might', rng: new SeededRng(1), forceCrit: false, variance: 1 });
  const pried = calculateDamage({ attacker, defender: target, power: 60, moveAffinity: 'might', rng: new SeededRng(1), forceCrit: false, variance: 1, guardActionMultiplier: BALANCE.pryOpenGuardMultiplier });
  assert.ok(pried.amount > guarded.amount, 'the weaker Guard factor lets more damage through');
  assert.equal(target.guardActive, true, 'guardActive is not mutated');

  const after = calculateDamage({ attacker, defender: target, power: 60, moveAffinity: 'might', rng: new SeededRng(1), forceCrit: false, variance: 1 });
  assert.equal(after.amount, guarded.amount, 'the override applies to that hit only');
});

test('a taxed ally pays 2 PP from the chosen skill and cannot act on 1 remaining PP', () => {
  const rng = new SeededRng(777);
  let battle = battleOf();
  const saqId = unitOf(battle, 'saq');
  battle.effects.push({ uid: 'fx-tax', id: 'taxed', sourceUnitId: battle.enemies[0], targetUnitId: saqId, expiry: 'target-turn-end', remaining: 1 });
  while (battle.turnOrder[battle.turnIndex] !== saqId) battle = resolveBattleCommand(battle, { kind: 'guard', actorId: battle.turnOrder[battle.turnIndex] }, rng).nextState;

  assert.equal(skillPpCost(battle, battle.units[saqId]), 2);
  battle.units[saqId].abilityPP['dismissed'] = 1;
  const rejected = validatePlayerCommand(battle, { kind: 'skill', actorId: saqId, abilityId: 'dismissed', targetIds: [battle.enemies[0]] });
  assert.equal(rejected.legal, false);
  assert.match(rejected.reason, /2 PP/);
  assert.equal(battle.units[saqId].abilityPP['dismissed'], 1, 'a rejected command spends nothing');
  assert.equal(battle.effects.length, 1, 'a rejected command does not expire the tax');

  const before = battle.units[saqId].abilityPP['corrective-action'];
  const after = resolveBattleCommand(battle, { kind: 'skill', actorId: saqId, abilityId: 'corrective-action', targetIds: [battle.enemies[0]] }, rng).nextState;
  assert.equal(after.units[saqId].abilityPP['corrective-action'], before - 2);
  assert.equal(after.effects.filter(e => e.id === 'taxed').length, 0, 'a committed skill expires the tax');
});

test('Guard waits out a tax at no extra cost', () => {
  const rng = new SeededRng(777);
  let battle = battleOf();
  const saqId = unitOf(battle, 'saq');
  battle.effects.push({ uid: 'fx-tax', id: 'taxed', sourceUnitId: battle.enemies[0], targetUnitId: saqId, expiry: 'target-turn-end', remaining: 1 });
  while (battle.turnOrder[battle.turnIndex] !== saqId) battle = resolveBattleCommand(battle, { kind: 'guard', actorId: battle.turnOrder[battle.turnIndex] }, rng).nextState;
  const ppBefore = { ...battle.units[saqId].abilityPP };
  battle = resolveBattleCommand(battle, { kind: 'guard', actorId: saqId }, rng).nextState;
  assert.deepEqual(battle.units[saqId].abilityPP, ppBefore);
  assert.equal(battle.effects.filter(e => e.id === 'taxed').length, 0);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/enemies-v03.test.mjs`
Expected: FAIL — `guardActionMultiplier` is ignored and `skillPpCost` does not exist.

- [ ] **Step 3: Add the Guard-action override**

In `src/game/balance/constants.ts`, add after the `ken` block:

```ts
  // Pry Open's weaker Guard factor for one hit. Guard remains beneficial against it.
  pryOpenGuardMultiplier: 0.8,
```

In `src/game/core/combat/status.ts`, change:

```ts
export function incomingDamageMultiplier(unit: BattleUnit, guardActionMultiplier?: number): number {
  let value = 1;
  if (unit.guardActive) value *= guardActionMultiplier ?? BALANCE.guardDamageMultiplier;
  if (hasStatus(unit, 'fortified')) value *= BALANCE.status.fortifiedDamageMultiplier;
  if (hasStatus(unit, 'exposed')) value *= BALANCE.status.exposedDamageMultiplier;
  return value;
}
```

In `src/game/core/combat/damage.ts`, add `guardActionMultiplier?: number;` to `DamageInput` and change the incoming line to:

```ts
  const incoming = incomingDamageMultiplier(input.defender, input.guardActionMultiplier);
```

In `battleEngine.ts`, add `guardActionMultiplier?:number` to `damageOne`'s options and pass it into `calculateDamage`. In `resolveEffects`'s damage branch, set it from the mechanic:

```ts
          const guardActionMultiplier=effect.mechanicId==='pry-open'?BALANCE.pryOpenGuardMultiplier:undefined;
```

and include it in the `damageOne` options object. Nothing mutates `guardActive` or the base Guard stat.

- [ ] **Step 4: Add the shared PP cost**

In `src/game/core/combat/actions.ts`, add:

```ts
/** The authoritative per-skill PP cost. Legality and every UI cost display must read this. */
export function skillPpCost(state:BattleState, actor:BattleUnit):number {
  return state.effects.some(effect=>effect.id==='taxed'&&effect.targetUnitId===actor.id) ? 2 : 1;
}
```

and replace the PP check in `validatePlayerCommand`:

```ts
  const ppCost = skillPpCost(state, actor);
  if ((actor.abilityPP?.[ability.id] ?? 0) < ppCost) return {legal:false,reason:ppCost>1?`Taxed: this skill costs ${ppCost} PP and does not have enough left.`:'No PP remaining.'};
```

In `battleEngine.ts`'s `resolveBattleCommand`, replace `actor.abilityPP![ability.id]-=1;` with:

```ts
    actor.abilityPP![ability.id]-=skillPpCost(state,actor);
```

importing `skillPpCost` from `./actions.js`. Taxed already expires through `tickTargetTurnEnd`, which runs after every completed turn including Guard and item use, and `validatePlayerCommand` throws before any mutation, so a rejected command spends nothing and expires nothing.

- [ ] **Step 5: Add hit tracking and the `removeEffect` branch**

Extend `AbilityContext` with `hitTargets:Record<string,boolean>;`, initialise it to `{}` at both construction sites, and set it in the damage branch immediately after a successful `damageOne`:

```ts
          if(result.hit)context.hitTargets[target.id]=true;
```

Add the resolution branch immediately after the `applyEffect` branch:

```ts
    if(effect.kind==='removeEffect') {
      for(const id of ids) {
        const target=state.units[id];
        // A miss cannot strip, and a KO target has already had its effects cleared.
        if(!target?.alive||!context.hitTargets[target.id]) continue;
        const priority=['fortified','strength','haste'] as const;
        const status=priority.find(statusId=>target.statuses.some(entry=>entry.id===statusId&&entry.remaining>0));
        if(status){
          target.statuses=target.statuses.filter(entry=>entry.id!==status);
          events.push({type:'statusRemoved',targetId:target.id,statusId:status});
          continue;
        }
        const script=state.effects.find(fx=>fx.id==='script'&&fx.targetUnitId===target.id);
        if(script)consumeEffect(state,script.uid,events);
      }
      continue;
    }
```

Fixed priority is Fortified, Strength, Haste, Script. Protect, Ready and Ink Mark are never in the list: Protect and Ready are source-linked stance and payoff state, and Ink Mark is a negative on the enemy side. If nothing is present the move is an ordinary damage hit, not an error.

- [ ] **Step 6: Add effect-level accuracy to the `applyEffect` branch**

Taxing Hex has no damage component, so it has no shared move roll to ride on. In the `applyEffect` branch from Part B Task 3, add immediately after the `passesSharedMoveAccuracy` line:

```ts
        if(shared===undefined&&effect.accuracy!==undefined&&!context.cannotMiss){
          const chance=Math.max(0,Math.min(1,effect.accuracy/100*accuracyMultiplier(actor)));
          if(!rng.chance(chance)){events.push({type:'miss',actorId:actor.id,targetId:target.id});continue;}
        }
```

This is ordinary status accuracy, affected by Blind, exactly as `statusOne` already behaves.

- [ ] **Step 7: Order Taxed last in cleansing**

In `cleanseOne`, after the Ink Mark block Part D added:

```ts
  if(remaining>0){
    const tax=state.effects.find(effect=>effect.id==='taxed'&&effect.targetUnitId===target.id);
    if(tax){consumeEffect(state,tax.uid,events);remaining--;}
  }
```

Ordinary negatives first, then Ink Mark, then Taxed — only if a removal remains.

- [ ] **Step 8: Run to verify it passes**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/enemies-v03.test.mjs && pnpm test:domain`
Expected: PASS.

- [ ] **Step 9: Show the taxed cost before confirming**

In `src/features/battle/BattleScreen.tsx`, wherever the skill list renders `PP {…}`, render `skillPpCost(battle, actor)` as the cost and label a taxed skill explicitly, e.g. `2 PP (taxed)`. Both legality and this display read the same helper, so they cannot disagree. Add the Taxed guide entry in `src/game/content/guide.ts`:

```ts
  {id:'taxed',name:'Taxed',short:'TAX',positive:false,anchor:'Until this ally completes its next turn.',trigger:'Applied by Taxing Hex; ends when the affected ally finishes any turn.',description:'The next skill this ally uses costs 2 PP from that skill\'s own reserve instead of 1, so a move with one PP left cannot be used. Guard and items cost nothing extra and also end the turn, so the tax can simply be waited out. It does not stack, does not delete PP, and applies at most once per battle from a single enemy.'},
```

- [ ] **Step 10: Run every check and commit**

Run: `pnpm typecheck && pnpm test:domain && pnpm test:vitest && pnpm test:release && pnpm lint && pnpm build`
Expected: all pass.

```bash
git add src/game/core/combat src/game/balance/constants.ts src/game/content/guide.ts src/features/battle/BattleScreen.tsx tests/domain/enemies-v03.test.mjs
git commit -m "feat: add disruption, guard penetration and PP tax mechanics"
```

---

### Task 2: Candidate G1 — Paste Scraper

**Files:**
- Modify: `src/game/content/enemies.ts`
- Modify: `scripts/generate_local_assets.py`
- Test: `tests/domain/enemies-v03.test.mjs`

**Interfaces:**
- Consumes: the `removeEffect` branch from Task 1.
- Produces: enemy `paste-scraper`, encounter `normal-peeling`. Ship or omit as one unit.

- [ ] **Step 1: Write the failing test**

Append to `tests/domain/enemies-v03.test.mjs`:

```js
test('Peel Away removes exactly one effect after damage, in fixed priority', () => {
  const battle = battleOf('normal-peeling');
  const ally = battle.units[battle.allies[0]];
  ally.statuses = [{ id: 'strength', remaining: 2 }, { id: 'fortified', remaining: 2 }, { id: 'haste', remaining: 2 }];
  const events = [];
  const scraper = battle.units[unitOf(battle, 'paste-scraper')];
  resolveEnemyMoveForTest(battle, scraper, 'peel-away', [ally.id], new SeededRng(1), events);
  assert.deepEqual(events.filter(e => e.type === 'statusRemoved').map(e => e.statusId), ['fortified']);
  assert.equal(ally.statuses.length, 2, 'exactly one effect is removed');
});

test('Peel Away strips Script only when no eligible status remains', () => {
  const battle = battleOf('normal-peeling');
  const ally = battle.units[battle.allies[0]];
  ally.statuses = [];
  battle.effects.push({ uid: 'fx-s', id: 'script', sourceUnitId: battle.allies[1], targetUnitId: ally.id, expiry: 'source-turn-start', remaining: 2 });
  resolveEnemyMoveForTest(battle, battle.units[unitOf(battle, 'paste-scraper')], 'peel-away', [ally.id], new SeededRng(1), []);
  assert.equal(battle.effects.filter(e => e.id === 'script').length, 0);
});

test('Peel Away cannot remove Protect or Ready', () => {
  const battle = battleOf('normal-peeling');
  const ally = battle.units[battle.allies[0]];
  ally.statuses = [];
  ally.flags.readyTurns = 1;
  battle.effects.push({ uid: 'fx-p', id: 'protect', sourceUnitId: battle.allies[1], targetUnitId: ally.id, expiry: 'source-turn-start', remaining: 1 });
  resolveEnemyMoveForTest(battle, battle.units[unitOf(battle, 'paste-scraper')], 'peel-away', [ally.id], new SeededRng(1), []);
  assert.equal(battle.effects.filter(e => e.id === 'protect').length, 1);
  assert.equal(Number(ally.flags.readyTurns), 1);
});

test('the cooldown prevents Peel Away appearing more often than every third enemy turn', () => {
  const battle = battleOf('normal-peeling');
  const scraper = battle.units[unitOf(battle, 'paste-scraper')];
  battle.recentEnemyMoves[scraper.id] = ['peel-away','scraper-scrape'];
  const legal = legalEnemyMoves(battle, scraper).map(m => m.id);
  assert.ok(!legal.includes('peel-away'));
});
```

`resolveEnemyMoveForTest` is a small local helper that builds the pseudo-ability the engine already builds in `resolveEnemyTurn` and calls the exported `resolveEffects` path; if `resolveEffects` is not exported, drive the move through `resolveBattleCommand` with a seeded RNG that selects it instead of adding a new export.

- [ ] **Step 2: Run to verify failure**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/enemies-v03.test.mjs`
Expected: FAIL — `Unknown encounter id: normal-peeling`.

- [ ] **Step 3: Add the enemy and encounter**

In `src/game/content/enemies.ts`, append to `ENEMIES`:

```ts
  enemy({ id:'paste-scraper', displayName:'Paste Scraper', affinity:'trick', tier:'normal', stats:{maxHp:76,power:80,guard:68,speed:88}, assetId:'enemy-paste-scraper', aiProfile:'controller', rewardCoins:[7,11], moves:[
    move({id:'scraper-scrape',name:'Scrape',affinity:'trick',target:'enemy-one',effects:[{kind:'damage',power:48,target:'enemy-one'}],weight:5,condition:'always',choreography:'melee'}),
    move({id:'peel-away',name:'Peel Away',affinity:'trick',target:'enemy-one',effects:[{kind:'damage',power:36,target:'enemy-one'},{kind:'removeEffect',target:'enemy-one'}],weight:3,cooldown:2,condition:'always',choreography:'utility'})
  ]}),
```

and to `ENCOUNTERS`, after the six existing normals:

```ts
  {id:'normal-peeling',displayName:'Peeling Paint',tier:'normal',enemies:['paste-scraper','scrapper']},
```

These are unscaled content stats; `enemyUnit` applies the tier and region multipliers. `NORMALS` in `src/game/core/progression/route.ts` is derived from `ENCOUNTERS`, so this becomes reachable with no route change, and the six existing IDs are untouched.

- [ ] **Step 4: Add the cutout**

In `scripts/generate_local_assets.py`, add to `props`:

```python
 'scraper':'<rect x="132" y="88" width="46" height="10" rx="2"/><path d="M155 98v46M138 150h34"/><path d="M60 118q22-10 36 4"/>',
```

and to `assets`:

```python
('enemy-paste-scraper',3,'scraper'),
```

Run: `python scripts/generate_local_assets.py`

- [ ] **Step 5: Run to verify it passes**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/enemies-v03.test.mjs && pnpm test:domain && pnpm test:release`
Expected: PASS.

- [ ] **Step 6: Audit the candidate on its own**

```bash
SPEC03_REV=$(git rev-parse HEAD) SPEC03_POLICY=mechanic-aware node scripts/balance-audit.mjs > /tmp/spec03-g1-aware.txt
SPEC03_REV=$(git rev-parse HEAD) SPEC03_POLICY=immediate-value node scripts/balance-audit.mjs > /tmp/spec03-g1-immediate.txt
```

Check the enemy-fairness gate: compare `normal-peeling` with its closest existing role and size counterpart (`normal-smokes`, which also pairs a controller with pressure). Flag an old-roster win-rate loss above **5 percentage points** or a median above **1 extra round**. Verify in traces that Guard and buff use remain viable — buffing must stay worthwhile because ordinary attacks do not strip and the cooldown leaves two intervening enemy turns.

The decision question is whether the encounter creates a real "remove disruption or immediate damage first" choice. If it does not, omit `paste-scraper` and `normal-peeling` together and record the reduced count.

- [ ] **Step 7: Record the decision and commit**

Create `docs/superpowers/evidence/2026-09-08-spec03-enemy-g1.md` with the comparison numbers and a ship/omit verdict.

```bash
git add src/game/content/enemies.ts scripts/generate_local_assets.py public/assets/cutouts/enemy-paste-scraper.svg tests/domain/enemies-v03.test.mjs docs/superpowers/evidence/2026-09-08-spec03-enemy-g1.md
git commit -m "feat: add the Paste Scraper candidate and its encounter"
```

---

### Task 3: Candidate G2 — Prybar Bruiser

**Files:**
- Modify: `src/game/content/enemies.ts`, `scripts/generate_local_assets.py`
- Test: `tests/domain/enemies-v03.test.mjs`

**Interfaces:**
- Consumes: the `pry-open` mechanic plumbing from Task 1.
- Produces: enemy `prybar-bruiser`, encounter `normal-pry-clinic`.

- [ ] **Step 1: Write the failing test**

Append to `tests/domain/enemies-v03.test.mjs`:

```js
test('Pry Open weakens the Guard action for its hit while other defenses still apply', () => {
  const battle = battleOf('normal-pry-clinic');
  const ally = battle.units[battle.allies[0]];
  ally.guardActive = true;
  ally.statuses = [{ id: 'fortified', remaining: 2 }];
  const before = ally.hp;
  resolveEnemyMoveForTest(battle, battle.units[unitOf(battle, 'prybar-bruiser')], 'pry-open', [ally.id], new SeededRng(1), []);
  const pried = before - ally.hp;

  ally.hp = before;
  resolveEnemyMoveForTest(battle, battle.units[unitOf(battle, 'prybar-bruiser')], 'bar-swing', [ally.id], new SeededRng(1), []);
  const swung = before - ally.hp;
  assert.ok(pried > swung, 'the same power lands harder through a Guard action');
  assert.equal(ally.guardActive, true, 'Guard is not cancelled');
  assert.equal(ally.statuses[0].id, 'fortified', 'Fortified is not stripped');
});

test('an unguarded target takes an ordinary 60-power hit from Pry Open', () => {
  const battle = battleOf('normal-pry-clinic');
  const ally = battle.units[battle.allies[0]];
  ally.guardActive = false;
  const before = ally.hp;
  resolveEnemyMoveForTest(battle, battle.units[unitOf(battle, 'prybar-bruiser')], 'pry-open', [ally.id], new SeededRng(1), []);
  const pried = before - ally.hp;
  ally.hp = before;
  resolveEnemyMoveForTest(battle, battle.units[unitOf(battle, 'prybar-bruiser')], 'bar-swing', [ally.id], new SeededRng(1), []);
  assert.equal(pried, before - ally.hp, 'no Guard action means no difference');
});
```

- [ ] **Step 2: Run to verify failure**

Expected: FAIL — `Unknown encounter id: normal-pry-clinic`.

- [ ] **Step 3: Add the enemy and encounter**

```ts
  enemy({ id:'prybar-bruiser', displayName:'Prybar Bruiser', affinity:'might', tier:'normal', stats:{maxHp:96,power:90,guard:82,speed:68}, assetId:'enemy-prybar-bruiser', aiProfile:'aggressive', rewardCoins:[8,12], moves:[
    move({id:'bar-swing',name:'Bar Swing',affinity:'might',target:'enemy-one',effects:[{kind:'damage',power:60,target:'enemy-one'}],weight:5,condition:'always',choreography:'melee'}),
    move({id:'pry-open',name:'Pry Open',affinity:'might',target:'enemy-one',effects:[{kind:'damage',power:60,target:'enemy-one',mechanicId:'pry-open'}],weight:3,cooldown:2,condition:'always',choreography:'heavy'})
  ]}),
```

```ts
  {id:'normal-pry-clinic',displayName:'Forced Entry',tier:'normal',enemies:['prybar-bruiser','backstreet-medic']},
```

Add the cutout prop `'prybar':'<path d="M144 84q26 4 24 26l-8 40-16-2 8-38q2-12-12-14z"/><path d="M52 118q26-14 42 6"/>'` and the asset entry `('enemy-prybar-bruiser',6,'prybar')`, then run `python scripts/generate_local_assets.py`.

- [ ] **Step 4: Run to verify it passes**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/enemies-v03.test.mjs && pnpm test:domain && pnpm test:release`
Expected: PASS.

- [ ] **Step 5: Audit the candidate**

Compare `normal-pry-clinic` with `normal-support` (its closest existing pressure-plus-medic counterpart). Apply the same 5-point / 1-round thresholds.

This enemy tests reliance on **Guard actions**, not all protection. Read the traces: if observed play rarely Guards at all, record that the candidate failed to add a meaningful decision. Do not broaden it into total defense penetration to rescue it.

- [ ] **Step 6: Record and commit**

Create `docs/superpowers/evidence/2026-09-08-spec03-enemy-g2.md` with the numbers and a ship/omit verdict.

```bash
git add src/game/content/enemies.ts scripts/generate_local_assets.py public/assets/cutouts/enemy-prybar-bruiser.svg tests/domain/enemies-v03.test.mjs docs/superpowers/evidence/2026-09-08-spec03-enemy-g2.md
git commit -m "feat: add the Prybar Bruiser candidate and its encounter"
```

---

### Task 4: Candidate G3 — Toll Hexer

**Files:**
- Modify: `src/game/content/enemies.ts`, `scripts/generate_local_assets.py`
- Test: `tests/domain/enemies-v03.test.mjs`

**Interfaces:**
- Consumes: `skillPpCost`, the `applyEffect` accuracy path, and the `taxed` cleanse ordering from Task 1.
- Produces: enemy `toll-hexer`, encounter `normal-toll-road`.

- [ ] **Step 1: Write the failing test**

Append to `tests/domain/enemies-v03.test.mjs`:

```js
test('Taxing Hex applies once per battle and its used flag survives a reload', () => {
  const rng = new SeededRng(777);
  let battle = battleOf('normal-toll-road');
  const hexerId = unitOf(battle, 'toll-hexer');
  // Drive enough turns for the hexer to act at least twice.
  for (let turn = 0; turn < 8 && battle.phase === 'input'; turn += 1) {
    battle = resolveBattleCommand(battle, { kind: 'guard', actorId: battle.turnOrder[battle.turnIndex] }, rng).nextState;
  }
  const used = String(battle.units[hexerId].flags.usedOnceMoves ?? '');
  if (used.includes('taxing-hex')) {
    assert.equal(battle.effects.filter(e => e.id === 'taxed').length <= 1, true, 'the tax never stacks');
    const restored = JSON.parse(JSON.stringify(battle));
    assert.equal(String(restored.units[hexerId].flags.usedOnceMoves), used, 'the once flag round-trips');
  }
});

test('Taxed does not stack or refresh', () => {
  const battle = battleOf('normal-toll-road');
  const allyId = battle.allies[0];
  battle.effects.push({ uid: 'fx-a', id: 'taxed', sourceUnitId: battle.enemies[0], targetUnitId: allyId, expiry: 'target-turn-end', remaining: 1 });
  resolveEnemyMoveForTest(battle, battle.units[unitOf(battle, 'toll-hexer')], 'taxing-hex', [allyId], new SeededRng(1), []);
  assert.equal(battle.effects.filter(e => e.id === 'taxed').length, 1);
});

test('a normal encounter costs at most one extra PP', () => {
  const encounter = ENCOUNTERS.find(e => e.id === 'normal-toll-road');
  const taxers = encounter.enemies.filter(id => getEnemy(id).moves.some(m => m.effects.some(e => e.kind === 'applyEffect' && e.effectId === 'taxed')));
  assert.equal(taxers.length, 1, 'one tax enemy per encounter');
  assert.equal(getEnemy('toll-hexer').moves.find(m => m.id === 'taxing-hex').once, true);
});
```

- [ ] **Step 2: Run to verify failure**

Expected: FAIL — `Unknown encounter id: normal-toll-road`.

- [ ] **Step 3: Add the enemy and encounter**

```ts
  enemy({ id:'toll-hexer', displayName:'Toll Hexer', affinity:'mystic', tier:'normal', stats:{maxHp:72,power:78,guard:62,speed:86}, assetId:'enemy-toll-hexer', aiProfile:'controller', rewardCoins:[7,11], moves:[
    move({id:'toll-stamp',name:'Stamp',affinity:'mystic',target:'enemy-one',effects:[{kind:'damage',power:44,target:'enemy-one'}],weight:5,condition:'always',choreography:'mystic'}),
    move({id:'taxing-hex',name:'Taxing Hex',affinity:'mystic',target:'enemy-one',effects:[{kind:'applyEffect',effectId:'taxed',target:'enemy-one',accuracy:100}],weight:4,once:true,condition:'always',choreography:'mystic'})
  ]}),
```

```ts
  {id:'normal-toll-road',displayName:'Toll Road',tier:'normal',enemies:['toll-hexer','road-dog']},
```

Add the cutout prop `'stamp':'<rect x="138" y="86" width="34" height="22" rx="3"/><path d="M155 108v34M140 146h30"/><path d="M58 112h30M58 126h24"/>'` and the asset entry `('enemy-toll-hexer',4,'stamp')`, then run `python scripts/generate_local_assets.py`.

Taxing Hex uses the existing target-selection rule and may hit an exhausted character, forcing a Guard or item choice. Guard is always available, so the player is never trapped.

- [ ] **Step 4: Run to verify it passes**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/enemies-v03.test.mjs && pnpm test:domain && pnpm test:release && pnpm test:vitest`
Expected: PASS.

- [ ] **Step 5: Extend the policy with a tax decision and audit**

In `scripts/balance-audit.mjs`, inside `chooseMechanicAware`, add before the fallback:

```js
  // A taxed actor either pays the doubled cost or waits it out with Guard.
  if(skillPpCost(battle,actor)>1){
    const affordable=getCharacter(actor.sourceId).abilities.filter(id=>(actor.abilityPP[id]??0)>=2);
    if(!affordable.length||hpRatio(actor)<0.4)return {kind:'guard',actorId:actor.id};
  }
```

importing `skillPpCost` from the compiled `actions.js`. Then run both policies and record **extra tax actually paid versus avoided**, and target-priority choices.

Compare `normal-toll-road` with `normal-fastlane` (its closest existing fast-pressure counterpart). Apply the same 5-point / 1-round thresholds. The one-per-enemy-per-battle limit and one-tax-enemy-per-encounter limit cap a normal encounter at one extra PP; confirm the measured figure matches.

- [ ] **Step 6: Record and commit**

Create `docs/superpowers/evidence/2026-09-08-spec03-enemy-g3.md` with the numbers and a ship/omit verdict.

```bash
git add src/game/content/enemies.ts scripts/balance-audit.mjs scripts/generate_local_assets.py public/assets/cutouts/enemy-toll-hexer.svg tests/domain/enemies-v03.test.mjs docs/superpowers/evidence/2026-09-08-spec03-enemy-g3.md
git commit -m "feat: add the Toll Hexer candidate and its encounter"
```

---

### Task 5: Complete-run release audit

**Files:**
- Modify: `scripts/economy-audit.mjs`
- Create: `docs/superpowers/evidence/2026-09-08-spec03-release.md`

**Interfaces:**
- Consumes: every shipped candidate from Tasks 2-4, the balance audit from Parts C and E.
- Produces: the release evidence. This is the gate that decides whether the whole spec ships.

- [ ] **Step 1: Extend or honestly limit the run harness**

Read `scripts/economy-audit.mjs` and determine which of route, reward, rest, shop, event and field-item decisions it already models with persistent HP, per-move PP, inventory, coins, upgrades and relics.

Extend it to cover all 286 parties across at least **16 complete-run seeds**, using Spec 01/02 behaviour as actually implemented — including recruitment only if it exists. Also stress representative defense and Mystic-burst parties with event-seeking and combat-seeking route choices.

If a subsystem cannot be modelled, write in the report that the run gate is **unverified for that subsystem** and say which. Do not run isolated battles and call them complete runs.

Exercise the relics named in companion §6 in reachable run traces: Cardboard Plate, First-Aid Tape, Pressed Flower, Violet Thread, Sticky Label, Bike Bearing, Blue Tonic Cap, Jumper Cable.

Capture injured, low-PP, upgraded and relic-bearing starting states from actual deterministic run traces, preserving the payload and seed. Do not invent "representative" inventories and call them measured fixtures; a deliberately constructed edge case is allowed only when labelled as such.

- [ ] **Step 2: Run the release suite**

```bash
pnpm typecheck && pnpm test:domain && pnpm test:release && pnpm test:vitest && pnpm lint && pnpm build && pnpm test:e2e
node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json
SPEC03_REV=$(git rev-parse HEAD) SPEC03_POLICY=mechanic-aware node scripts/balance-audit.mjs > /tmp/spec03-release-balance.txt
node scripts/economy-audit.mjs > /tmp/spec03-release-economy.txt
```

Expected: all pass. Paste the tail of each.

- [ ] **Step 3: Check the complete-run economy gate**

Against the matched baseline route-policy scenarios, flag:
- a completion shift above **5 percentage points**
- total extra PP spent above **10%**
- recovery coin spending above **10%**

Explain each shift and require explicit acceptance if it is retained.

Also record encounter exposure after pool growth: the normal pool grew from six encounters to as many as nine, which changes exposure even with constant per-fight rewards. Recheck complete-run HP, PP and rewards on that basis.

- [ ] **Step 4: Run the focused human checks**

Record the number of playtesters, their familiarity, the scenarios, observed confusion, and the changes made. A simulated win-rate improvement cannot substitute for a failed comprehension check. The required checks are:

1. A first-time player can identify whom Saq protects, what expires, and why Saq lost HP, after one in-game explanation.
2. Saq has a worthwhile attack or control option when no ally needs protection, and the player can distinguish his role from Marcus's.
3. A player deliberately sets a mark, consumes it with an ally, and explains why Needlework did not multiply it three times.
4. A player distinguishes Script from Fortified and understands why repeated small hits did not trigger it.
5. A player sees a taxed skill's total cost before confirming, can wait it out, and is not trapped at zero PP.
6. A defense-heavy party wins without tedious repetitive guarding or endless healing; burst parties retain meaningful defensive risk.
7. Mobile, tablet and desktop layouts keep HP, marks, status explanations and deployables readable. Keyboard navigation, visible focus, Enter to confirm, Escape to cancel, focus return, and reduced motion all work at the configured test viewports.
8. Save and reload during presentation resolves to one committed outcome. New local assets load offline. New scenes are skippable and do not eclipse existing relationship content.

- [ ] **Step 5: Write the release report**

Create `docs/superpowers/evidence/2026-09-08-spec03-release.md` containing:

- Every command actually run, with pass/fail counts and any failure output.
- Skipped checks, named.
- Audit provenance: revision, working tree, seeds, policy, fixture state.
- Every changed tuning value against its spec trial value.
- All unresolved balance flags with explanations. The report may not say "balanced" while leaving one unexplained.
- The ship/omit decision for each of the three enemy candidates.
- Runtime content counts printed from `contentRegistry`, not restated from the spec. Full-scope delivery would be 13 characters, 52 abilities, 19 enemies and 15 encounters with no added elite or boss; if a candidate was omitted, derive the reduced totals rather than reusing these numbers.

```bash
node -e "import('./.domain-build/content/contentRegistry.js').then(m=>console.log({characters:m.CONTENT.characters.length,abilities:m.CONTENT.abilities.length,enemies:m.CONTENT.enemies.length,encounters:m.CONTENT.encounters.length,valid:m.validateContent()}))"
```

- [ ] **Step 6: Record the elite decision**

Append a `## Elite decision` section. The default is **defer**, and it stands unless the audit produced evidence of a missing encounter role, a distinct pattern, a region placement and a pacing case. Neither Headmaster nor Inkbound is a commitment, and no fourth region or boss is in scope. If the evidence is absent, write "deferred" and say what would change the answer.

- [ ] **Step 7: Commit**

```bash
git add scripts/economy-audit.mjs docs/superpowers/evidence/2026-09-08-spec03-release.md docs/BALANCE_AUDIT_V03.md docs/ECONOMY_AUDIT_V03.md
git commit -m "docs: record the Spec 03 release audit and enemy decisions"
```

---

## Done

All six parts complete. The release report in `docs/superpowers/evidence/2026-09-08-spec03-release.md` is the handoff artefact: it lists commands run, pass/fail counts, skipped checks, audit provenance, changed tuning values, unresolved flags, and the decision on each enemy candidate.
