# Spec 03 Part B — Saq: Kit, Protect, Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Saq as the twelfth selectable character — four abilities, the Class Monitor passive, the Protect interception pipeline, the Ready payoff, readable UI and a local cutout — with save and selection support.

**Architecture:** Protect is one `BattleEffectInstance` from Part A. All interception maths lives in one new module `src/game/core/combat/interception.ts`, called from a single point inside `damageOne` after existing relic mitigation and before `setHp`. Ready and the Class Monitor round limit are numeric `BattleUnit.flags`, which are already persisted and validated. No new RNG, no new target-selection subsystem, no turn-priority rules.

**Tech Stack:** TypeScript 5.8, React 19, Zustand 5, Node 22 `node:test` for domain tests, Vitest for UI/unit tests, Playwright for E2E.

**Spec:** `docs/superpowers/specs/2026-09-08-roster-character-encounter-expansion.md` §4 and §8; companion `docs/superpowers/specs/2026-09-08-roster-combat-rules-validation.md` §2.

**Depends on:** Part A (`docs/superpowers/plans/2026-09-08-spec03-a-battle-effects-foundation.md`) — complete it first.

## Global Constraints

- Stable character ID `saq`, display name **Saq**, Neutral affinity, asset ID `character-saq`, role string `Teacher / Protector / Interceptor`.
- Base stats exactly **116 HP / 84 Power / 104 Guard / 94 Speed**. These are unvalidated tuning hypotheses; Part C measures them.
- Exactly four abilities and one passive. All skills cost the normal one PP per use.
- Protect never reduces HP costs (Double Down, All In, Abyssal Pact, event injuries), never cleanses, never taunts, and never routes debuffs away from the original recipient (companion §2).
- Transferred damage receives **no second** Guard-stat, affinity, Guard-action, Fortified, Exposed, Script, Cardboard Plate, or Protect pass, and cannot cause a fresh on-hit/drain/critical reward (companion §2).
- The original recipient always retains at least half of positive post-Script damage. No blanket global mitigation ceiling is added.
- No new RNG for expiry, consumption, transfer, or passive triggers (companion §1).
- Do not display source IDs as player copy (parent §8).
- Commands: `pnpm test:domain`, `pnpm test:vitest`, `pnpm test:release`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:e2e`.
- Never claim a step done without pasting the command output.

## File structure

| File | Responsibility |
|---|---|
| `src/game/balance/constants.ts` (modify) | `BALANCE.saq` tuning block — every Saq number lives here, nowhere else |
| `src/game/core/combat/battleEffects.ts` (modify) | `EFFECT_LIFETIMES` table so content declares an effect id, not a duration |
| `src/game/core/combat/interception.ts` (create) | The Protect damage pipeline: split, transfer, Class Monitor, Ready. Part D inserts Script at its documented seam |
| `src/game/core/combat/battleEngine.ts` (modify) | One `applyIncomingEffects` call in `damageOne`; the `applyEffect` branch in `resolveEffects`; Ready grant/expiry; Dismissed and Corrective Action mechanics |
| `src/game/core/combat/actions.ts` (modify) | Illegal self-Protect and no-benefit-refresh validation |
| `src/game/content/characters.ts` (modify) | Saq's four abilities and character record |
| `src/game/content/guide.ts` (modify) | `EFFECT_GUIDE` entries for Protect and Ready |
| `src/game/content/contentRegistry.ts` (modify) | Character count 11 → 12 |
| `src/ui/components/StatusStrip.tsx` (modify) | Render battle effects beside statuses, with icon and text |
| `src/ui/overlays/DetailPanel.tsx` (modify) | `effect` overlay kind: source, duration anchor, trigger, values |
| `src/app/appStore.ts` (modify) | `openEffectInfo` overlay action |
| `src/features/battle/combatDirector.ts` (modify) | `transfer` events move HP bars; new events count as impacts |
| `scripts/generate_local_assets.py` (modify) | `character-saq` cutout |
| `tests/domain/saq.test.mjs` (create) | Protect pipeline, lifecycle, Ready, kit mechanics |
| `tests/release/structure.test.mjs` (modify) | Character cutout count 11 → 12 |
| `tests/vitest/combatDirector.test.ts` (modify) | Transfer events in HP reconstruction |

---

### Task 1: Saq tuning constants and effect lifetimes

**Files:**
- Modify: `src/game/balance/constants.ts`
- Modify: `src/game/core/combat/battleEffects.ts`

**Interfaces:**
- Consumes: `BattleEffectId` from Part A Task 1.
- Produces: `BALANCE.saq` with fields `classMonitorPrevention`, `correctiveActionBonusPower`, `dismissedReadyPower`; and `EFFECT_LIFETIMES: Record<BattleEffectId, {expiry; remaining}>`. Tasks 2-4 and Parts D and F read both.

- [ ] **Step 1: Add the tuning block**

In `src/game/balance/constants.ts`, add inside the `BALANCE` object, after `maxMomentum: 3,`:

```ts
  // Spec 03 Part B trial values. Unvalidated tuning hypotheses; Part C measures them.
  saq: {
    classMonitorPrevention: 5,
    correctiveActionBonusPower: 12,
    dismissedReadyPower: 35,
  },
```

- [ ] **Step 2: Add the lifetime table**

In `src/game/core/combat/battleEffects.ts`, add after the `EffectSpec` interface:

```ts
/**
 * How long each effect lives, so content declares an effect id rather than a duration.
 * Protect: until the start of its source's next turn.
 * Ink Mark / Script: until the start of its source's second subsequent turn.
 * Taxed: until the recipient completes its next turn.
 */
export const EFFECT_LIFETIMES: Record<BattleEffectId, Pick<EffectSpec, 'expiry' | 'remaining'>> = {
  'protect': { expiry: 'source-turn-start', remaining: 1 },
  'ink-mark': { expiry: 'source-turn-start', remaining: 2 },
  'script': { expiry: 'source-turn-start', remaining: 2 },
  'taxed': { expiry: 'target-turn-end', remaining: 1 },
};
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/game/balance/constants.ts src/game/core/combat/battleEffects.ts
git commit -m "feat: add Saq tuning constants and effect lifetimes"
```

---

### Task 2: The Protect damage pipeline

**Files:**
- Create: `src/game/core/combat/interception.ts`
- Create: `tests/domain/saq.test.mjs`

**Interfaces:**
- Consumes: `findEffect`, `consumeEffect`, `clearEffectsForUnit` from Part A Task 2; `BALANCE.saq` from Task 1.
- Produces: `applyIncomingEffects(state, attacker, target, damage, events): number`, returning the recipient's final HP loss and applying Saq's transfer as a side effect. Task 3 calls it from `damageOne`. Part D inserts Script at the marked seam inside it.

- [ ] **Step 1: Write the failing test**

Create `tests/domain/saq.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyIncomingEffects } from '../../.domain-build/core/combat/interception.js';
import { addEffect } from '../../.domain-build/core/combat/battleEffects.js';

function scenario({ saqHp = 116, round = 1, classMonitorRound = 0 } = {}) {
  const saq = { id: 'ally-0-saq', sourceId: 'saq', side: 'ally', hp: saqHp, maxHp: 116, alive: saqHp > 0, flags: classMonitorRound ? { classMonitorRound } : {} };
  const hans = { id: 'ally-1-hans', sourceId: 'hans', side: 'ally', hp: 92, maxHp: 92, alive: true, flags: {} };
  const foe = { id: 'enemy-0-wisp', sourceId: 'wisp', side: 'enemy', hp: 58, maxHp: 58, alive: true, flags: {} };
  const state = { round, effects: [], flags: {}, units: { [saq.id]: saq, [hans.id]: hans, [foe.id]: foe }, allies: [saq.id, hans.id], enemies: [foe.id] };
  addEffect(state, { id: 'protect', sourceUnitId: saq.id, targetUnitId: hans.id, expiry: 'source-turn-start', remaining: 1 });
  return { state, saq, hans, foe };
}

test('a 40-damage hit splits 20 to the recipient and 5 to Saq after Class Monitor', () => {
  const { state, saq, hans, foe } = scenario();
  const events = [];
  const recipientDamage = applyIncomingEffects(state, foe, hans, 40, events);
  assert.equal(recipientDamage, 20, 'recipient keeps B - floor(B/2)');
  assert.equal(saq.hp, 111, 'transfer is ceil(20/2) = 10, minus 5 prevented = 5');
  assert.deepEqual(events.filter(e => e.type === 'prevented'), [{ type: 'prevented', kind: 'class-monitor', targetId: saq.id, amount: 5 }]);
  assert.deepEqual(events.filter(e => e.type === 'transfer'), [{ type: 'transfer', fromId: hans.id, toId: saq.id, amount: 5 }]);
  assert.equal(state.effects.length, 0, 'the link is consumed by the first redirectable hit');
  assert.equal(saq.flags.readyTurns, 1);
  assert.equal(saq.flags.classMonitorRound, state.round);
});

test('the passive fires only once per round', () => {
  const { state, saq, hans, foe } = scenario({ classMonitorRound: 1, round: 1 });
  applyIncomingEffects(state, foe, hans, 40, []);
  assert.equal(saq.hp, 106, 'full ceil(20/2) = 10 transfer with the passive already used this round');
});

test('a hit too small to redirect leaves the link active and costs Saq nothing', () => {
  const { state, saq, hans, foe } = scenario();
  const recipientDamage = applyIncomingEffects(state, foe, hans, 1, []);
  assert.equal(recipientDamage, 1);
  assert.equal(saq.hp, 116);
  assert.equal(state.effects.length, 1, 'floor(1/2) = 0, so no positive share was redirected');
});

test('a lethal transfer KOs Saq, clears his link, and grants no Ready', () => {
  const { state, saq, hans, foe } = scenario({ saqHp: 3, classMonitorRound: 1, round: 1 });
  const events = [];
  applyIncomingEffects(state, foe, hans, 40, events);
  assert.equal(saq.hp, 0);
  assert.equal(saq.alive, false);
  assert.equal(saq.flags.readyTurns ?? 0, 0, 'a dead Saq cannot retain Ready');
  assert.ok(events.some(e => e.type === 'knockout' && e.targetId === saq.id));
});

test('a KO source cannot intercept; the recipient takes the whole hit', () => {
  const { state, saq, hans, foe } = scenario({ saqHp: 0 });
  const recipientDamage = applyIncomingEffects(state, foe, hans, 40, []);
  assert.equal(recipientDamage, 40);
  assert.equal(state.effects.length, 0, 'the dangling link is removed');
});

test('an unlinked ally is untouched by the pipeline', () => {
  const { state, saq, foe } = scenario();
  const recipientDamage = applyIncomingEffects(state, foe, state.units[saq.id], 40, []);
  assert.equal(recipientDamage, 40, 'Saq as an AoE target takes his own ordinary hit');
  assert.equal(state.effects.length, 1);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/saq.test.mjs`
Expected: FAIL — `Cannot find module '.../interception.js'`.

- [ ] **Step 3: Write the module**

Create `src/game/core/combat/interception.ts`:

```ts
import type { BattleState, BattleUnit, CombatEvent } from '../types.js';
import { BALANCE } from '../../balance/constants.js';
import { clearEffectsForUnit, consumeEffect, findEffect } from './battleEffects.js';

function loseHp(unit: BattleUnit, amount: number): number {
  const before = unit.hp;
  unit.hp = Math.max(0, before - amount);
  unit.alive = unit.hp > 0;
  return before - unit.hp;
}

/**
 * Runs the incoming-effect stage of one hostile hit, between existing relic mitigation
 * and the recipient's HP loss. Returns the recipient's final damage.
 *
 * Transferred damage takes NO second defensive pass and cannot recurse: it is applied
 * directly here, never through damageOne.
 *
 * Part D inserts Script evaluation at the marked seam, before the Protect split.
 */
export function applyIncomingEffects(
  state: BattleState, attacker: BattleUnit, target: BattleUnit, damage: number, events: CombatEvent[],
): number {
  let amount = damage;

  // --- Script seam (Part D inserts here; Script is evaluated against `amount` before Protect) ---

  const link = findEffect(state, 'protect', target.id);
  if (!link) return amount;

  const source = state.units[link.sourceUnitId];
  if (!source?.alive) { clearEffectsForUnit(state, link.sourceUnitId, events); return amount; }

  const redirected = Math.floor(amount / 2);
  if (redirected <= 0) return amount;

  let transfer = Math.ceil(redirected / 2);
  const passiveAvailable = source.sourceId === 'saq' && Number(source.flags.classMonitorRound ?? 0) !== state.round;
  if (passiveAvailable && transfer > 0) {
    const prevented = Math.min(BALANCE.saq.classMonitorPrevention, transfer);
    transfer -= prevented;
    source.flags.classMonitorRound = state.round;
    events.push({ type: 'prevented', kind: 'class-monitor', targetId: source.id, amount: prevented });
  }

  consumeEffect(state, link.uid, events);

  if (transfer > 0) {
    const paid = loseHp(source, transfer);
    events.push({ type: 'transfer', fromId: target.id, toId: source.id, amount: paid });
    if (!source.alive) { events.push({ type: 'knockout', targetId: source.id }); clearEffectsForUnit(state, source.id, events); }
  }

  if (source.alive) { source.flags.readyTurns = 1; events.push({ type: 'ready', actorId: source.id, active: true }); }

  return amount - redirected;
}
```

`attacker` is unused today but is part of the signature so Part F's disruptor rules and any future attribution can read it without changing every call site.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/saq.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/game/core/combat/interception.ts tests/domain/saq.test.mjs
git commit -m "feat: add the Protect interception pipeline"
```

---

### Task 3: Engine wiring — applyEffect, interception, Ready

**Files:**
- Modify: `src/game/core/combat/battleEngine.ts`
- Test: `tests/domain/saq.test.mjs`

**Interfaces:**
- Consumes: `applyIncomingEffects` from Task 2; `addEffect`, `EFFECT_LIFETIMES` from Task 1.
- Produces: an engine where an `applyEffect` effect definition creates a link, hostile hits run the pipeline, and `flags.readyTurns` counts down at the end of its holder's turn. Part D reuses the same `applyEffect` branch for Ink Mark, Script and Full Sleeve.

- [ ] **Step 1: Write the failing test**

Append to `tests/domain/saq.test.mjs`:

```js
import { SeededRng } from '../../.domain-build/core/rng/seededRng.js';
import { createBattle, resolveBattleCommand } from '../../.domain-build/core/combat/battleEngine.js';

const saqParty = (encounter = 'normal-fastlane', seed = 777) =>
  createBattle(['saq','hans','marcus'], encounter, new SeededRng(seed), { coins: 30 });

test('Take Your Seat links Saq to a chosen ally and cannot target himself', () => {
  const rng = new SeededRng(777);
  let battle = saqParty();
  const saqId = battle.allies.find(id => battle.units[id].sourceId === 'saq');
  const hansId = battle.allies.find(id => battle.units[id].sourceId === 'hans');
  // Fast-forward to Saq's turn by guarding with whoever acts first.
  while (battle.turnOrder[battle.turnIndex] !== saqId) {
    battle = resolveBattleCommand(battle, { kind: 'guard', actorId: battle.turnOrder[battle.turnIndex] }, rng).nextState;
  }
  const resolution = resolveBattleCommand(battle, { kind: 'skill', actorId: saqId, abilityId: 'take-your-seat', targetIds: [hansId] }, rng);
  const link = resolution.nextState.effects.find(effect => effect.id === 'protect');
  assert.ok(link, 'the skill applies a protect link');
  assert.equal(link.sourceUnitId, saqId);
  assert.equal(link.targetUnitId, hansId);
  assert.ok(resolution.events.some(e => e.type === 'effectApplied' && e.effectId === 'protect'));
});

test('Ready expires at the end of Saq next completed turn if it is not spent', () => {
  const rng = new SeededRng(777);
  let battle = saqParty();
  const saqId = battle.allies.find(id => battle.units[id].sourceId === 'saq');
  battle.units[saqId].flags.readyTurns = 1;
  while (battle.turnOrder[battle.turnIndex] !== saqId) {
    battle = resolveBattleCommand(battle, { kind: 'guard', actorId: battle.turnOrder[battle.turnIndex] }, rng).nextState;
  }
  battle = resolveBattleCommand(battle, { kind: 'guard', actorId: saqId }, rng).nextState;
  assert.equal(Number(battle.units[saqId].flags.readyTurns ?? 0), 0, 'Ready survives the start of that turn, then expires when it completes');
});

test('Dismissed consumes Ready for extra power even when it misses', () => {
  const rng = new SeededRng(777);
  let battle = saqParty();
  const saqId = battle.allies.find(id => battle.units[id].sourceId === 'saq');
  battle.units[saqId].flags.readyTurns = 1;
  while (battle.turnOrder[battle.turnIndex] !== saqId) {
    battle = resolveBattleCommand(battle, { kind: 'guard', actorId: battle.turnOrder[battle.turnIndex] }, rng).nextState;
  }
  const foeId = battle.enemies.find(id => battle.units[id].alive);
  battle = resolveBattleCommand(battle, { kind: 'skill', actorId: saqId, abilityId: 'dismissed', targetIds: [foeId] }, rng).nextState;
  assert.equal(Number(battle.units[saqId].flags.readyTurns ?? 0), 0);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/saq.test.mjs`
Expected: FAIL — `Unknown character id: saq`. Task 4 adds the content; this task adds the engine behaviour those tests exercise. Both must land before the tests pass, so implement Task 3 and Task 4 before re-running.

- [ ] **Step 3: Import the new helpers**

In `src/game/core/combat/battleEngine.ts`, extend the Part A import and add one more:

```ts
import { addEffect, clearAllEffects, clearEffectsForUnit, EFFECT_LIFETIMES, tickSourceTurnStart, tickTargetTurnEnd } from './battleEffects.js';
import { applyIncomingEffects } from './interception.js';
```

- [ ] **Step 4: Call the pipeline from `damageOne`**

In `damageOne`, replace:

```ts
  if(target.side==='ally'&&state.relicIds.includes('cardboard-plate')&&!state.flags.cardboardPlateUsed){state.flags.cardboardPlateUsed=true;result={...result,amount:Math.max(1,Math.round(result.amount*0.65))};}
  setHp(target,target.hp-result.amount);
```

with:

```ts
  if(target.side==='ally'&&state.relicIds.includes('cardboard-plate')&&!state.flags.cardboardPlateUsed){state.flags.cardboardPlateUsed=true;result={...result,amount:Math.max(1,Math.round(result.amount*0.65))};}
  // Hostile direct hits only. HP costs, healing and friendly effects never reach this stage.
  if(target.side!==actor.side&&target.side==='ally')result={...result,amount:applyIncomingEffects(state,actor,target,result.amount,events)};
  setHp(target,target.hp-result.amount);
```

The `damage` event that follows already reports `result.amount`, so it now carries the post-split figure and the HP bars stay consistent with the transfer event.

- [ ] **Step 5: Add the `applyEffect` branch to `resolveEffects`**

In `resolveEffects`, immediately before the `if(effect.kind==='damage')` branch, add:

```ts
    if(effect.kind==='applyEffect') {
      for(const id of ids) {
        const target=state.units[id]; if(!target?.alive) continue;
        const shared=passesSharedMoveAccuracy(actor,target,ability,context,rng,events); if(shared===false) continue;
        const lifetime=EFFECT_LIFETIMES[effect.effectId];
        const instance=addEffect(state,{id:effect.effectId,sourceUnitId:actor.id,targetUnitId:target.id,...lifetime});
        events.push({type:'effectApplied',effectId:effect.effectId,sourceId:actor.id,targetId:target.id,remaining:instance.remaining});
      }
      continue;
    }
```

- [ ] **Step 6: Add the Corrective Action bonus**

In `resolveEffects`, inside the `effect.kind==='damage'` loop, immediately after the `breakaway` line, add:

```ts
          if(effect.mechanicId==='corrective-action'&&(target.statuses.some(status=>['weaken','slow','blind','exposed'].includes(status.id))||state.effects.some(fx=>fx.id==='ink-mark'&&fx.targetUnitId===target.id)))power+=BALANCE.saq.correctiveActionBonusPower;
```

The bonus is flat: multiple qualifying negatives grant no extra.

- [ ] **Step 7: Add Dismissed's Ready consumption**

In `prepareAbilityContext`, immediately before `if(actor.sourceId==='yatords')`, add:

```ts
  if(ability.id==='dismissed'&&Number(actor.flags.readyTurns??0)>0) {
    ctx.damagePowerOverride=upgradedPower(actor,ability,ability.effects.find(effect=>effect.kind==='damage')!.power)+BALANCE.saq.dismissedReadyPower;
    actor.flags.readyTurns=0;
    events.push({type:'ready',actorId:actor.id,active:false},{type:'message',text:'Ready spent on Dismissed.'});
  }
```

Ready is consumed when Dismissed commits, before the accuracy roll, so a miss still spends it.

- [ ] **Step 8: Expire Ready at the end of its holder's turn**

In `resolveBattleCommand`, immediately after the `tickTargetTurnEnd(state,actor.id,events);` line added in Part A, add:

```ts
  const readyLeft=Number(actor.flags.readyTurns??0);
  if(readyLeft>0){actor.flags.readyTurns=readyLeft-1;if(readyLeft-1<=0){delete actor.flags.readyTurns;events.push({type:'ready',actorId:actor.id,active:false});}}
```

Ready survives the start of the turn so Dismissed can use it, and expires once that turn completes — including turns spent on Guard or an item.

- [ ] **Step 9: Verify it compiles**

Run: `pnpm typecheck`
Expected: PASS. Run the tests after Task 4, which supplies the `saq` content the tests need.

- [ ] **Step 10: Commit**

```bash
git add src/game/core/combat/battleEngine.ts
git commit -m "feat: wire Protect, Ready and Corrective Action into the engine"
```

---

### Task 4: Saq content and validation

**Files:**
- Modify: `src/game/content/characters.ts`
- Modify: `src/game/content/contentRegistry.ts`
- Modify: `src/game/core/combat/actions.ts`
- Test: `tests/domain/saq.test.mjs`

**Interfaces:**
- Consumes: the `applyEffect` variant from Part A Task 1, the engine behaviour from Task 3.
- Produces: abilities `corrective-action`, `take-your-seat`, `pop-quiz`, `dismissed`; character `saq` with passive `class-monitor`. Parts C and E reference all five ids.

- [ ] **Step 1: Add the four abilities**

In `src/game/content/characters.ts`, append to the `ABILITIES` array before the closing `];`:

```ts
  ability({ id:'corrective-action', name:'Corrective Action', affinity:'neutral', maxPP:18, target:'enemy-one', description:'60 power. Adds 12 power against a target carrying Weaken, Slow, Blind, Exposed or Ink Mark.', effects:[{kind:'damage', power:60, target:'enemy-one', mechanicId:'corrective-action'}], choreography:'melee', upgrade:{description:'Power rises to 70.', powerDelta:10} }),
  ability({ id:'take-your-seat', name:'Take Your Seat', affinity:'neutral', maxPP:8, target:'ally-one', description:'Protect one other ally until the start of Saq’s next turn. On the first hit that redirects damage, they take half and Saq takes a reduced share, and Saq gains Ready.', effects:[{kind:'applyEffect', effectId:'protect', target:'ally-one'}], choreography:'defense', upgrade:{description:'Max PP rises to 9.', maxPPDelta:1} }),
  ability({ id:'pop-quiz', name:'Pop Quiz', affinity:'neutral', maxPP:7, target:'enemy-one', accuracy:95, description:'40 power and Weaken for 2 turns. Damage and status share one hit check.', effects:[{kind:'damage', power:40, target:'enemy-one', accuracy:95},{kind:'status', target:'enemy-one', statusId:'weaken', duration:2, accuracy:95}], choreography:'utility', upgrade:{description:'Power rises to 50.', powerDelta:10} }),
  ability({ id:'dismissed', name:'Dismissed', affinity:'neutral', maxPP:4, target:'enemy-one', description:'70 power. Spends Ready for 35 extra power. Usable without Ready.', effects:[{kind:'damage', power:70, target:'enemy-one'}], choreography:'heavy', upgrade:{description:'Power rises to 80.', powerDelta:10} }),
```

- [ ] **Step 2: Add the character**

Append to the `CHARACTERS` array before the closing `];`:

```ts
  { id:'saq', displayName:'Saq', affinity:'neutral', role:'Teacher / Protector / Interceptor', stats:{maxHp:116,power:84,guard:104,speed:94}, passive:{id:'class-monitor',name:'Class Monitor',description:'Once per round, when Saq’s Protect redirects damage, his transferred loss is reduced by up to 5 HP.'}, abilities:['corrective-action','take-your-seat','pop-quiz','dismissed'], assetId:'character-saq' },
```

- [ ] **Step 3: Update the content count**

In `src/game/content/contentRegistry.ts`, change:

```ts
  if (CHARACTERS.length !== 11) errors.push(`Expected 11 characters, found ${CHARACTERS.length}`);
```

to:

```ts
  if (CHARACTERS.length !== 12) errors.push(`Expected 12 characters, found ${CHARACTERS.length}`);
```

- [ ] **Step 4: Write the failing validation test**

Append to `tests/domain/saq.test.mjs`:

```js
import { validatePlayerCommand } from '../../.domain-build/core/combat/actions.js';

test('Protect cannot target Saq himself', () => {
  const battle = saqParty();
  const saqId = battle.allies.find(id => battle.units[id].sourceId === 'saq');
  battle.turnIndex = battle.turnOrder.indexOf(saqId);
  const verdict = validatePlayerCommand(battle, { kind: 'skill', actorId: saqId, abilityId: 'take-your-seat', targetIds: [saqId] });
  assert.equal(verdict.legal, false);
  assert.match(verdict.reason, /another ally/i);
});

test('refreshing an identical Protect with no added lifetime is rejected', () => {
  const battle = saqParty();
  const saqId = battle.allies.find(id => battle.units[id].sourceId === 'saq');
  const hansId = battle.allies.find(id => battle.units[id].sourceId === 'hans');
  battle.turnIndex = battle.turnOrder.indexOf(saqId);
  addEffect(battle, { id: 'protect', sourceUnitId: saqId, targetUnitId: hansId, expiry: 'source-turn-start', remaining: 1 });
  const verdict = validatePlayerCommand(battle, { kind: 'skill', actorId: saqId, abilityId: 'take-your-seat', targetIds: [hansId] });
  assert.equal(verdict.legal, false);
  assert.match(verdict.reason, /already protected/i);
});
```

- [ ] **Step 5: Run to verify failure**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/saq.test.mjs`
Expected: FAIL — both commands are reported legal.

- [ ] **Step 6: Add the validation**

In `src/game/core/combat/actions.ts`, add the import:

```ts
import { findEffect } from './battleEffects.js';
```

and insert in `validatePlayerCommand`, immediately before the final `return validateAbilityTargets(state,actor,ability,command.targetIds);`:

```ts
  const protectEffect=ability.effects.find(effect=>effect.kind==='applyEffect'&&effect.effectId==='protect');
  if(protectEffect){
    const targetId=command.targetIds[0];
    if(targetId===actor.id) return {legal:false,reason:'Protect must cover another ally, not its caster.'};
    const existing=targetId?findEffect(state,'protect',targetId):undefined;
    if(existing&&existing.sourceUnitId===actor.id) return {legal:false,reason:'That ally is already protected until your next turn.'};
  }
```

- [ ] **Step 7: Run the full Saq suite to verify it passes**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/saq.test.mjs`
Expected: PASS, 11 tests — including the three from Task 3 that were blocked on this content.

- [ ] **Step 8: Run the full domain suite**

Run: `pnpm test:domain`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/game/content/characters.ts src/game/content/contentRegistry.ts src/game/core/combat/actions.ts tests/domain/saq.test.mjs
git commit -m "feat: add Saq to the roster with Protect validation"
```

---

### Task 5: Asset, guide and effect presentation

**Files:**
- Modify: `scripts/generate_local_assets.py`
- Modify: `src/game/content/guide.ts`
- Modify: `src/ui/components/StatusStrip.tsx`
- Modify: `src/ui/overlays/DetailPanel.tsx`
- Modify: `src/app/appStore.ts`
- Modify: `src/features/battle/BattleScreen.tsx`
- Modify: `src/styles.css`
- Test: `tests/release/structure.test.mjs`

**Interfaces:**
- Consumes: `BattleEffectInstance` from Part A, `saq` content from Task 4.
- Produces: `EFFECT_GUIDE` / `EFFECT_GUIDE_MAP` in `guide.ts`; `StatusStrip` accepting an `effects` prop; the `{kind:'effect'}` overlay and `openEffectInfo(effectId)` store action. Part D adds Ink Mark and Script entries to the same table and reuses the same components unchanged.

- [ ] **Step 1: Write the failing structure test**

In `tests/release/structure.test.mjs`, change `assert.equal(characters.length, 11);` to `assert.equal(characters.length, 12);`.

Run: `pnpm test:release`
Expected: FAIL — 11 character cutouts found, 12 expected.

- [ ] **Step 2: Generate the cutout**

In `scripts/generate_local_assets.py`, add to the `props` dictionary:

```python
 'pointer':'<path d="M143 88l38 12-4 10-36-10z"/><rect x="132" y="96" width="14" height="46" rx="3"/><path d="M126 150h30"/>',
```

and add to the `assets` list, after `('character-leandre',3,'coins')`:

```python
('character-saq',1,'pointer'),
```

Run: `python scripts/generate_local_assets.py`
Then: `ls public/assets/cutouts/character-saq.svg`
Expected: the file exists.

- [ ] **Step 3: Verify the structure test passes**

Run: `pnpm test:release`
Expected: PASS.

- [ ] **Step 4: Add the effect guide entries**

In `src/game/content/guide.ts`, add after `STATUS_GUIDE_MAP`:

```ts
export interface EffectGuideEntry {id:BattleEffectId;name:string;short:string;positive:boolean;anchor:string;trigger:string;description:string}
export const EFFECT_GUIDE:EffectGuideEntry[]=[
  {id:'protect',name:'Protect',short:'PROT',positive:true,anchor:'Until the start of the protector’s next turn.',trigger:'The first hit that redirects a positive share of damage.',description:`The protected ally keeps half of the incoming damage. The protector takes half of that redirected half, reduced by up to ${BALANCE.saq.classMonitorPrevention} HP once per round by Class Monitor. The protector's share takes no second Guard, Fortified or relic reduction, and it can knock the protector out. Protect does not cleanse, does not stop HP costs, and does not redirect the attack's status effects.`},
];
export const EFFECT_GUIDE_MAP=new Map(EFFECT_GUIDE.map(entry=>[entry.id,entry]));
```

Add `import type { Affinity, BattleEffectId, StatusId } from '../core/types.js';` at the top.

Add to `MECHANIC_GUIDE`:

```ts
  {id:'ready',title:'Ready',text:'A successful Protect leaves Saq Ready. Ready lasts through the end of his next completed turn, is spent by Dismissed even on a miss, does not stack, and is lost if he is knocked out.'},
```

- [ ] **Step 5: Add the store action**

In `src/app/appStore.ts`, extend the `OverlayState` union with `|{kind:'effect';effectId:BattleEffectId}` and add the action beside `openStatusInfo`:

```ts
  openEffectInfo:(effectId:BattleEffectId)=>set({overlay:{kind:'effect',effectId}}),
```

matching the exact shape and typing of the existing `openStatusInfo` implementation.

- [ ] **Step 6: Render effects in the strip**

Replace `src/ui/components/StatusStrip.tsx` with:

```tsx
import type { BattleEffectInstance, StatusInstance } from '../../game/core/types';
import { EFFECT_GUIDE_MAP, STATUS_GUIDE_MAP } from '../../game/content/guide';
import { useAppStore } from '../../app/appStore';

export function StatusStrip({statuses,effects=[]}:{statuses:StatusInstance[];effects?:BattleEffectInstance[]}){
  const openStatus=useAppStore(s=>s.openStatusInfo);
  const openEffect=useAppStore(s=>s.openEffectInfo);
  if(!statuses.length&&!effects.length)return <span className="status-empty">No status</span>;
  return <div className="status-strip" aria-label="Active statuses and effects">
    {statuses.map(s=>{const guide=STATUS_GUIDE_MAP.get(s.id);return <button type="button" title={`${guide?.name??s.id}: ${guide?.description??''}`} onClick={event=>{event.stopPropagation();openStatus(s.id)}} className={`status status-${s.id}`} key={s.id}>{guide?.short??s.id.toUpperCase()} <b>{s.remaining}</b><span className="status-info-dot">i</span></button>})}
    {effects.map(effect=>{const guide=EFFECT_GUIDE_MAP.get(effect.id);return <button type="button" title={`${guide?.name??effect.id}: ${guide?.anchor??''}`} onClick={event=>{event.stopPropagation();openEffect(effect.id)}} className={`status effect-${effect.id} ${guide?.positive?'effect-positive':'effect-negative'}`} key={effect.uid}>{guide?.short??effect.id.toUpperCase()} <b>{effect.remaining}</b><span className="status-info-dot">i</span></button>})}
  </div>;
}
```

Every `<StatusStrip statuses={unit.statuses}/>` call site in `src/features/battle/BattleScreen.tsx` gains `effects={battle.effects.filter(effect=>effect.targetUnitId===unit.id)}`. Do not use colour alone: the short label carries the meaning, and the count carries the duration.

- [ ] **Step 7: Add the effect detail overlay**

In `src/ui/overlays/DetailPanel.tsx`, add before the final `else` branch:

```tsx
  } else if(overlay.kind==='effect'){
    const effect=EFFECT_GUIDE_MAP.get(overlay.effectId)!;title=effect.name;kicker='EFFECT';
    body=<><div className={`status-detail-mark effect-${effect.id}`}>{effect.short}</div><p className="detail-lead">{effect.description}</p><ul className="detail-list"><li><strong>Lasts:</strong> {effect.anchor}</li><li><strong>Triggers on:</strong> {effect.trigger}</li></ul><div className="rule-note"><strong>Not a status</strong><p>This effect belongs to whoever applied it. Buff-duration bonuses do not extend it, and it ends if either side of the link is knocked out.</p></div></>;
```

and import `EFFECT_GUIDE_MAP` alongside `STATUS_GUIDE_MAP`. Copy names the character in play, never a source ID.

- [ ] **Step 8: Style the new chips**

In `src/styles.css`, beside the existing `.status-*` rules, add classes for `.effect-protect`, `.effect-positive` and `.effect-negative` using the existing status chip tokens. Reuse the tokens already defined; add no new colour variables. Effect chips must not overlap HP bars, target controls or deployables at the configured mobile viewport.

- [ ] **Step 9: Run the UI checks**

Run: `pnpm typecheck && pnpm test:vitest && pnpm test:release && pnpm build`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add scripts/generate_local_assets.py public/assets/cutouts/character-saq.svg src/game/content/guide.ts src/ui src/app/appStore.ts src/features/battle/BattleScreen.tsx src/styles.css tests/release/structure.test.mjs
git commit -m "feat: present Protect and Ready with icon and text access"
```

---

### Task 6: Combat director attribution

**Files:**
- Modify: `src/features/battle/combatDirector.ts`
- Test: `tests/vitest/combatDirector.test.ts`

**Interfaces:**
- Consumes: the `transfer`, `prevented`, `effectApplied`, `effectRemoved`, `ready` events from Part A Task 1.
- Produces: HP reconstruction that accounts for transferred damage. Without this the protector's bar is wrong during playback and only snaps correct at the end of the action.

- [ ] **Step 1: Write the failing test**

Append to `tests/vitest/combatDirector.test.ts`:

```ts
it('moves the protector HP bar for a transfer event', () => {
  const events: CombatEvent[] = [
    { type: 'actionStart', actorId: 'enemy-0-wisp', label: 'Flicker', side: 'enemy' },
    { type: 'hit', targetId: 'ally-1-hans' },
    { type: 'damage', targetId: 'ally-1-hans', amount: 20, critical: false, affinity: 'normal' },
    { type: 'transfer', fromId: 'ally-1-hans', toId: 'ally-0-saq', amount: 5 },
  ];
  const beats = buildCombatBeats(events);
  const finalHp = { 'ally-0-saq': 111, 'ally-1-hans': 72 };
  const atStart = presentedHpAtBeat(finalHp, beats, 0);
  expect(atStart).toEqual({ 'ally-0-saq': 116, 'ally-1-hans': 92 });
  const atEnd = presentedHpAtBeat(finalHp, beats, beats.length - 1);
  expect(atEnd).toEqual(finalHp);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test:vitest`
Expected: FAIL — `ally-0-saq` reconstructs to 111 at the start because the transfer is invisible to the reconstruction.

- [ ] **Step 3: Handle transfers in both directions**

In `hpAtBeat`, add to the event loop:

```ts
    else if(event.type==='transfer')hp[event.toId]=Math.max(0,(hp[event.toId]??0)-event.amount);
```

In `presentedHpAtBeat`, add to the reverse loop:

```ts
    else if(event.type==='transfer')startHp[event.toId]=(startHp[event.toId]??0)+event.amount;
```

In `combatBeatDuration`, extend the impact list so the new beats get readable time:

```ts
    const impacts=beat.events.filter(event=>['damage','heal','statusApplied','summon','deployableTrigger','revive','bossPhase','transfer','prevented','effectApplied'].includes(event.type)).length;
```

`prevented` never changes HP on its own — the prevented amount is already absent from the `damage` and `transfer` figures — so it must not appear in either reconstruction loop.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:vitest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/battle/combatDirector.ts tests/vitest/combatDirector.test.ts
git commit -m "fix: reconstruct protector HP through transfer events"
```

---

### Task 7: Part B gate

**Files:**
- Modify: `docs/superpowers/evidence/2026-09-08-spec03-baseline.md`

- [ ] **Step 1: Run every check**

```bash
pnpm typecheck && pnpm test:domain && pnpm test:release && pnpm test:vitest && pnpm lint && pnpm build && pnpm test:e2e
```

Expected: all pass. Paste the tail of each.

- [ ] **Step 2: Verify save round-trip with a live Protect link**

Write a one-off script under the scratchpad that builds a battle with `saq`, applies Take Your Seat, serialises through `createSaveEnvelope` + `parseSaveEnvelope` + `migrateSaveEnvelope`, and asserts the restored battle resolves the next command to an identical `nextState` and event list as the unsaved one. Paste its output. Delete the script afterwards; the behaviour it proves is already covered by `tests/domain/saq.test.mjs` and `tests/domain/save.test.mjs`.

- [ ] **Step 3: Confirm the old roster is unchanged**

```bash
node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json
node scripts/balance-audit.mjs > /tmp/spec03-balance-after-b.txt
```

Compare each of the eleven existing characters' inclusion rows with the Part A baseline. Their absolute values will move because the party pool grew from 165 to 220 — that is expected. What must not move is any encounter's behaviour for a party with no Saq in it: confirm by running the same three-character old-roster party and seed through `simulate` before and after and asserting identical rounds and win result.

- [ ] **Step 4: Record the gate**

Append a `## Part B gate` section to `docs/superpowers/evidence/2026-09-08-spec03-baseline.md` with the seven command results, the save round-trip output, and the old-roster comparison.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/evidence/2026-09-08-spec03-baseline.md
git commit -m "docs: record Spec 03 Part B gate evidence"
```

---

## Next

Part C: `docs/superpowers/plans/2026-09-08-spec03-c-saq-events-audit.md`.
