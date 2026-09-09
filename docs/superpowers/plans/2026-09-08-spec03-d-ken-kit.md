# Spec 03 Part D — Ken: Ink Mark, Script, Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Ken as the thirteenth selectable character — four abilities, the Collaborative Work passive, Ink Mark consumption, the Script conditional defense, readable UI and a local cutout.

**Architecture:** Ink Mark and Script are `BattleEffectInstance` records from Part A, applied by the generic `applyEffect` branch Part B added. Mark consumption happens at one point inside `damageOne`, after the accuracy check and before `calculateDamage`, so the bonus power flows through the ordinary damage formula exactly once. Script is evaluated at the seam Part B left inside `applyIncomingEffects`, before the Protect split. No new effect kinds, no new save version — Part A's V3 already reserved `ink-mark` and `script`.

**Tech Stack:** TypeScript 5.8, React 19, Zustand 5, Node 22 `node:test`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-08-roster-character-encounter-expansion.md` §5 and §8; companion `docs/superpowers/specs/2026-09-08-roster-combat-rules-validation.md` §3.

**Depends on:** Parts A, B and C complete, with Part C's Saq audit decision recorded.

## Global Constraints

- Stable character ID `ken`, display name **Ken**, Mystic affinity, asset ID `character-ken`, role string `Tattoo Artist / Setup Support`.
- Base stats exactly **98 HP / 90 Power / 84 Guard / 102 Speed**. Trial values; Part E measures them.
- Ink Mark adds **20 move power** to the next successful direct damaging skill hit, then is consumed. The added power takes **that hit's affinity**, not Mystic. It creates no separate damage packet and no extra RNG roll (parent §5).
- Collaborative Work adds **8 power**, once per battle round, only when **another** living ally consumes Ken's mark. Ken's own consumption never triggers it. Deployables and items do not qualify (parent §5, companion §1).
- Needlework's conditional **+12** applies once per action, to the consuming hit only — never to every hit (companion §3).
- Script triggers when post-defense, post-relic damage is at least **20% of the recipient's Max HP**, prevents up to **10 HP**, and is checked **per hit**, before Protect. It cannot trigger on Saq's transfer or on an HP cost (companion §3).
- Both Ink Mark and Script last until the **start of Ken's second subsequent turn**. Jiro, Daboy and Sticky Label duration bonuses do not extend them (companion §3).
- Full Sleeve uses exactly the same Script effect — not a stronger parallel implementation (parent §5).
- Ink Mark is a negative removable effect for cleansing, removed **after** ordinary negatives in their existing order (companion §3).
- No mass offensive-mark application in this release (companion §3).
- Commands: `pnpm test:domain`, `pnpm test:vitest`, `pnpm test:release`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:e2e`.
- Never claim a step done without pasting the command output.

## File structure

| File | Responsibility |
|---|---|
| `src/game/balance/constants.ts` (modify) | `BALANCE.ken` tuning block |
| `src/game/core/combat/interception.ts` (modify) | Script evaluation at the seam Part B marked |
| `src/game/core/combat/battleEngine.ts` (modify) | Mark snapshot, consumption inside `damageOne`, cleanse ordering |
| `src/game/core/combat/actions.ts` (modify) | Script and Full Sleeve no-waste validation |
| `src/game/content/characters.ts` (modify) | Ken's four abilities, character record, biography |
| `src/game/content/guide.ts` (modify) | `EFFECT_GUIDE` entries for Ink Mark and Script |
| `src/game/content/contentRegistry.ts` (modify) | Character count 12 → 13 |
| `scripts/generate_local_assets.py` (modify) | `character-ken` cutout |
| `tests/domain/ken.test.mjs` (create) | Mark, Script, passive, layering |
| `tests/release/structure.test.mjs` (modify) | Character cutout count 12 → 13 |

---

### Task 1: Ken tuning constants

**Files:**
- Modify: `src/game/balance/constants.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `BALANCE.ken` with `inkMarkPower`, `collaborativeWorkPower`, `needleworkMarkPower`, `scriptThresholdPercent`, `scriptPrevention`. Tasks 2-5 and Part E read all five.

- [ ] **Step 1: Add the block**

In `src/game/balance/constants.ts`, add immediately after the `saq` block:

```ts
  // Spec 03 Part D trial values. Unvalidated tuning hypotheses; Part E measures them.
  ken: {
    inkMarkPower: 20,
    collaborativeWorkPower: 8,
    needleworkMarkPower: 12,
    scriptThresholdPercent: 0.20,
    scriptPrevention: 10,
  },
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/game/balance/constants.ts
git commit -m "feat: add Ken tuning constants"
```

---

### Task 2: Script evaluation

**Files:**
- Modify: `src/game/core/combat/interception.ts`
- Create: `tests/domain/ken.test.mjs`

**Interfaces:**
- Consumes: `findEffect`, `consumeEffect` from Part A; `BALANCE.ken` from Task 1; the `// --- Script seam ---` comment Part B left in `applyIncomingEffects`.
- Produces: Script consumption inside the existing pipeline. No new exported function — Script must not become a second implementation beside Protect.

- [ ] **Step 1: Write the failing test**

Create `tests/domain/ken.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyIncomingEffects } from '../../.domain-build/core/combat/interception.js';
import { addEffect } from '../../.domain-build/core/combat/battleEffects.js';

function scenario({ withProtect = false, targetMaxHp = 100 } = {}) {
  const ken = { id: 'ally-0-ken', sourceId: 'ken', side: 'ally', hp: 98, maxHp: 98, alive: true, flags: {} };
  const saq = { id: 'ally-1-saq', sourceId: 'saq', side: 'ally', hp: 116, maxHp: 116, alive: true, flags: {} };
  const hans = { id: 'ally-2-hans', sourceId: 'hans', side: 'ally', hp: targetMaxHp, maxHp: targetMaxHp, alive: true, flags: {} };
  const foe = { id: 'enemy-0-wisp', sourceId: 'wisp', side: 'enemy', hp: 58, maxHp: 58, alive: true, flags: {} };
  const state = { round: 1, effects: [], flags: {}, units: { [ken.id]: ken, [saq.id]: saq, [hans.id]: hans, [foe.id]: foe }, allies: [ken.id, saq.id, hans.id], enemies: [foe.id] };
  addEffect(state, { id: 'script', sourceUnitId: ken.id, targetUnitId: hans.id, expiry: 'source-turn-start', remaining: 2 });
  if (withProtect) addEffect(state, { id: 'protect', sourceUnitId: saq.id, targetUnitId: hans.id, expiry: 'source-turn-start', remaining: 1 });
  return { state, ken, saq, hans, foe };
}

test('a hit at exactly 20% of Max HP consumes Script and prevents 10', () => {
  const { state, hans, foe } = scenario();
  const events = [];
  const damage = applyIncomingEffects(state, foe, hans, 20, events);
  assert.equal(damage, 10);
  assert.equal(state.effects.filter(e => e.id === 'script').length, 0);
  assert.deepEqual(events.filter(e => e.type === 'prevented'), [{ type: 'prevented', kind: 'script', targetId: hans.id, amount: 10 }]);
});

test('a hit one point below the threshold leaves Script intact', () => {
  const { state, hans, foe } = scenario();
  const damage = applyIncomingEffects(state, foe, hans, 19, []);
  assert.equal(damage, 19);
  assert.equal(state.effects.filter(e => e.id === 'script').length, 1);
});

test('three small hits never accumulate to the threshold', () => {
  const { state, hans, foe } = scenario();
  for (let hit = 0; hit < 3; hit += 1) assert.equal(applyIncomingEffects(state, foe, hans, 12, []), 12);
  assert.equal(state.effects.filter(e => e.id === 'script').length, 1, 'the threshold is per hit, never per action');
});

test('Script resolves before Protect and neither pass is applied twice', () => {
  const { state, saq, hans, foe } = scenario({ withProtect: true });
  const events = [];
  const damage = applyIncomingEffects(state, foe, hans, 40, events);
  // Script prevents 10 leaving B=30; recipient keeps 15; R=15; transfer ceil(15/2)=8 minus 5 = 3.
  assert.equal(damage, 15);
  assert.equal(saq.hp, 113);
  assert.equal(events.filter(e => e.type === 'prevented').map(e => e.kind).join(','), 'script,class-monitor');
});

test('Script cannot trigger on the protector transfer', () => {
  const { state, saq, hans, foe } = scenario({ withProtect: true });
  addEffect(state, { id: 'script', sourceUnitId: state.units['ally-0-ken'].id, targetUnitId: saq.id, expiry: 'source-turn-start', remaining: 2 });
  applyIncomingEffects(state, foe, hans, 40, []);
  assert.equal(state.effects.some(e => e.id === 'script' && e.targetUnitId === saq.id), true, 'the transfer takes no second defensive pass');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/ken.test.mjs`
Expected: FAIL — Script is never consumed; `damage` is 20 in the first test.

- [ ] **Step 3: Fill in the seam**

In `src/game/core/combat/interception.ts`, replace the comment line:

```ts
  // --- Script seam (Part D inserts here; Script is evaluated against `amount` before Protect) ---
```

with:

```ts
  const script = findEffect(state, 'script', target.id);
  if (script && amount >= Math.ceil(BALANCE.ken.scriptThresholdPercent * target.maxHp)) {
    const prevented = Math.min(BALANCE.ken.scriptPrevention, amount);
    amount -= prevented;
    consumeEffect(state, script.uid, events);
    events.push({ type: 'prevented', kind: 'script', targetId: target.id, amount: prevented });
  }
```

Protect's transfer is applied directly further down and never re-enters this function, so the last test passes without extra guarding.

- [ ] **Step 4: Run to verify it passes**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/ken.test.mjs`
Expected: PASS, 5 tests.

- [ ] **Step 5: Run the Saq suite for regressions**

Run: `node --test tests/domain/saq.test.mjs`
Expected: PASS — Saq's scenarios carry no Script, so all six results are unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/game/core/combat/interception.ts tests/domain/ken.test.mjs
git commit -m "feat: evaluate Script before the Protect split"
```

---

### Task 3: Ink Mark consumption

**Files:**
- Modify: `src/game/core/combat/battleEngine.ts`
- Test: `tests/domain/ken.test.mjs`

**Interfaces:**
- Consumes: `consumeEffect` from Part A; `BALANCE.ken` from Task 1.
- Produces: `AbilityContext.consumableMarkUids`, a `markConsumer` option on `damageOne`, and the module-local `consumeInkMark`. Part E's simulator reads the resulting `effectRemoved` and `message` events; it re-implements none of this.

- [ ] **Step 1: Write the failing test**

Append to `tests/domain/ken.test.mjs`:

```js
import { SeededRng } from '../../.domain-build/core/rng/seededRng.js';
import { createBattle, resolveBattleCommand } from '../../.domain-build/core/combat/battleEngine.js';

const kenParty = (members = ['ken','michael','marcus'], seed = 777) =>
  createBattle(members, 'normal-fastlane', new SeededRng(seed), { coins: 30 });
const unitOf = (battle, sourceId) => battle.allies.concat(battle.enemies).find(id => battle.units[id].sourceId === sourceId);
const advanceTo = (battle, unitId, rng) => {
  while (battle.turnOrder[battle.turnIndex] !== unitId) battle = resolveBattleCommand(battle, { kind: 'guard', actorId: battle.turnOrder[battle.turnIndex] }, rng).nextState;
  return battle;
};

test('Fresh Ink cannot consume the mark it is about to apply', () => {
  const rng = new SeededRng(777);
  let battle = kenParty();
  const kenId = unitOf(battle, 'ken');
  const foeId = battle.enemies[0];
  battle = advanceTo(battle, kenId, rng);
  const resolution = resolveBattleCommand(battle, { kind: 'skill', actorId: kenId, abilityId: 'fresh-ink', targetIds: [foeId] }, rng);
  assert.equal(resolution.events.filter(e => e.type === 'effectRemoved' && e.effectId === 'ink-mark').length, 0);
  assert.equal(resolution.nextState.effects.filter(e => e.id === 'ink-mark').length, 1);
});

test('another ally consuming the mark adds 20 plus the 8-power passive, once per round', () => {
  const rng = new SeededRng(777);
  let battle = kenParty();
  const kenId = unitOf(battle, 'ken');
  const michaelId = unitOf(battle, 'michael');
  const foeId = battle.enemies[0];
  battle.effects.push({ uid: 'fx-mark', id: 'ink-mark', sourceUnitId: kenId, targetUnitId: foeId, expiry: 'source-turn-start', remaining: 2 });
  battle = advanceTo(battle, michaelId, rng);
  const resolution = resolveBattleCommand(battle, { kind: 'skill', actorId: michaelId, abilityId: 'rifle-burst', targetIds: [foeId] }, rng);
  assert.ok(resolution.events.some(e => e.type === 'message' && e.text.includes('28 power')), 'mark 20 plus Collaborative Work 8');
  assert.equal(resolution.nextState.effects.filter(e => e.id === 'ink-mark').length, 0);
  assert.equal(Number(resolution.nextState.units[kenId].flags.collaborativeWorkRound), battle.round);
});

test('Ken consuming his own mark gets 20 and does not trigger his passive', () => {
  const rng = new SeededRng(777);
  let battle = kenParty();
  const kenId = unitOf(battle, 'ken');
  const foeId = battle.enemies[0];
  battle.effects.push({ uid: 'fx-mark', id: 'ink-mark', sourceUnitId: kenId, targetUnitId: foeId, expiry: 'source-turn-start', remaining: 2 });
  battle = advanceTo(battle, kenId, rng);
  const resolution = resolveBattleCommand(battle, { kind: 'skill', actorId: kenId, abilityId: 'needlework', targetIds: [foeId] }, rng);
  // 20 base + 20 mark + 12 Needlework = 52 on the consuming hit; the other two hits stay at 20.
  assert.ok(resolution.events.some(e => e.type === 'message' && e.text.includes('32 power')), 'mark 20 plus Needlework 12, no passive');
  assert.equal(resolution.events.filter(e => e.type === 'message' && e.text.includes('power')).length, 1, 'the bonus applies once per action, not per hit');
});

test('a mark cannot be consumed twice by one multi-hit action', () => {
  const rng = new SeededRng(777);
  let battle = kenParty(['ken','leandre','marcus']);
  const kenId = unitOf(battle, 'ken');
  const leandreId = unitOf(battle, 'leandre');
  battle.effects.push({ uid: 'fx-mark', id: 'ink-mark', sourceUnitId: kenId, targetUnitId: battle.enemies[0], expiry: 'source-turn-start', remaining: 2 });
  battle = advanceTo(battle, leandreId, rng);
  const resolution = resolveBattleCommand(battle, { kind: 'skill', actorId: leandreId, abilityId: 'scatter', targetIds: [] }, rng);
  assert.equal(resolution.events.filter(e => e.type === 'effectRemoved' && e.effectId === 'ink-mark').length, 1);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/ken.test.mjs`
Expected: FAIL — `Unknown ability id: fresh-ink`. Task 4 supplies the content; implement both before re-running.

- [ ] **Step 3: Snapshot the consumable marks at action start**

In `src/game/core/combat/battleEngine.ts`, extend the `AbilityContext` interface:

```ts
interface AbilityContext { cannotMiss:boolean; outgoing:number; damagePowerOverride?:number; poorDoubleDown?:boolean; totalDamage:number; anyKo:boolean; sharedAccuracy:Record<string,boolean>; sharedMissEmitted:Record<string,boolean>; consumableMarkUids:Set<string>; }
```

Set it in both places a context is constructed. In `prepareAbilityContext`:

```ts
  const ctx:AbilityContext={cannotMiss:false,outgoing:1,totalDamage:0,anyKo:false,sharedAccuracy:{},sharedMissEmitted:{},consumableMarkUids:new Set(state.effects.filter(effect=>effect.id==='ink-mark').map(effect=>effect.uid))};
```

and in `resolveEffects`'s fallback:

```ts
  const context=ctx ?? {cannotMiss:false,outgoing:1,totalDamage:0,anyKo:false,sharedAccuracy:{},sharedMissEmitted:{},consumableMarkUids:new Set(state.effects.filter(effect=>effect.id==='ink-mark').map(effect=>effect.uid))};
```

A skill can therefore consume only marks that existed before its action began. Fresh Ink's newly applied mark has a uid that is not in the snapshot.

- [ ] **Step 4: Add the consumption function**

Add above `damageOne`:

```ts
/**
 * Consumes one eligible Ink Mark on the target and returns the power to add to this single hit.
 * Runs after the accuracy check and before the damage formula, so the bonus takes the consuming
 * skill's affinity and passes through defenses exactly once. No extra RNG, no second damage packet.
 */
function consumeInkMark(state:BattleState,actor:BattleUnit,target:BattleUnit,consumer:{abilityId:string;allowed:Set<string>},events:CombatEvent[]):number {
  const mark=state.effects.find(effect=>effect.id==='ink-mark'&&effect.targetUnitId===target.id&&consumer.allowed.has(effect.uid));
  if(!mark) return 0;
  const source=state.units[mark.sourceUnitId];
  consumeEffect(state,mark.uid,events);
  let bonus=BALANCE.ken.inkMarkPower;
  if(source?.alive&&source.id!==actor.id&&Number(source.flags.collaborativeWorkRound??0)!==state.round){
    source.flags.collaborativeWorkRound=state.round;
    bonus+=BALANCE.ken.collaborativeWorkPower;
  }
  if(consumer.abilityId==='needlework') bonus+=BALANCE.ken.needleworkMarkPower;
  events.push({type:'message',text:`Ink Mark adds ${bonus} power to ${actor.displayName}'s hit.`});
  return bonus;
}
```

Add `consumeEffect` to the `battleEffects.js` import list.

- [ ] **Step 5: Call it from `damageOne`**

Extend the options type:

```ts
  opts?:{cannotMiss?:boolean;accuracy?:number;outgoing?:number;onHitHealPercent?:number;markConsumer?:{abilityId:string;allowed:Set<string>}}
```

and add immediately after the miss check, before `const wasAlive=target.alive;`:

```ts
  const markBonus=opts?.markConsumer?consumeInkMark(state,actor,target,opts.markConsumer,events):0;
  power+=markBonus;
```

Change `power` in the signature from a `const` parameter to a mutable local by renaming the parameter and reassigning, or declare the parameter without `readonly` and reassign directly — TypeScript permits reassigning a parameter, so `power+=markBonus;` is enough.

- [ ] **Step 6: Pass the consumer from the skill path only**

In `resolveEffects`, in the `damage` branch, change the `damageOne` call's options to include:

```ts
markConsumer:actor.side==='ally'&&ability&&target.side==='enemy'?{abilityId:ability.id,allowed:context.consumableMarkUids}:undefined,
```

Items resolve through `resolveItem` and deployables through `triggerDeployables`; neither passes `markConsumer`, so neither consumes a mark or triggers the passive.

- [ ] **Step 7: Order Ink Mark last in cleansing**

Change `cleanseOne`'s signature to `cleanseOne(state:BattleState,target:BattleUnit,count:number,events:CombatEvent[])` and add, after the existing status loop:

```ts
  if(remaining>0){
    const mark=state.effects.find(effect=>effect.id==='ink-mark'&&effect.targetUnitId===target.id);
    if(mark){consumeEffect(state,mark.uid,events);remaining--;}
  }
```

Move `let remaining=count;` and `const next` so `remaining` is still in scope, and update both call sites in `resolveEffects` and `resolveItem`. Ordinary negatives are removed first in their current order; Ink Mark is only reached if a removal remains.

- [ ] **Step 8: Verify it compiles**

Run: `pnpm typecheck`
Expected: PASS. Run the tests after Task 4.

- [ ] **Step 9: Commit**

```bash
git add src/game/core/combat/battleEngine.ts
git commit -m "feat: consume Ink Mark once per hit with bounded bonus power"
```

---

### Task 4: Ken content and no-waste validation

**Files:**
- Modify: `src/game/content/characters.ts`
- Modify: `src/game/content/contentRegistry.ts`
- Modify: `src/game/core/combat/actions.ts`
- Test: `tests/domain/ken.test.mjs`

**Interfaces:**
- Consumes: the `applyEffect` branch from Part B Task 3, `consumeInkMark` from Task 3.
- Produces: abilities `fresh-ink`, `protective-script`, `needlework`, `full-sleeve`; character `ken` with passive `collaborative-work`. Part E references all five ids.

- [ ] **Step 1: Add the four abilities**

Append to `ABILITIES` in `src/game/content/characters.ts`:

```ts
  ability({ id:'fresh-ink', name:'Fresh Ink', affinity:'mystic', maxPP:16, target:'enemy-one', accuracy:100, description:'45 power. A successful hit leaves Ink Mark on a surviving target. It may consume an older mark first, then apply one new mark.', effects:[{kind:'damage', power:45, target:'enemy-one', accuracy:100},{kind:'applyEffect', effectId:'ink-mark', target:'enemy-one', accuracy:100}], choreography:'mystic', upgrade:{description:'Power rises to 53.', powerDelta:8} }),
  ability({ id:'protective-script', name:'Protective Script', affinity:'neutral', maxPP:6, target:'ally-one', description:'Apply Script to one living ally, including Ken. A single large hit consumes it to prevent up to 10 HP.', effects:[{kind:'applyEffect', effectId:'script', target:'ally-one'}], choreography:'defense', upgrade:{description:'Max PP rises to 7.', maxPPDelta:1} }),
  ability({ id:'needlework', name:'Needlework', affinity:'mystic', maxPP:6, target:'enemy-one', description:'Three 20-power hits. If this action consumes Ink Mark, that one hit gains a further 12 power.', effects:[{kind:'damage', power:20, hits:3, target:'enemy-one'}], choreography:'multi-hit', upgrade:{description:'Each hit rises to 23 power.', powerDelta:3} }),
  ability({ id:'full-sleeve', name:'Full Sleeve', affinity:'neutral', maxPP:3, target:'ally-all', description:'Apply Script to every living ally, using exactly the same rule as Protective Script. No healing and no ordinary buffs.', effects:[{kind:'applyEffect', effectId:'script', target:'ally-all'}], choreography:'defense', upgrade:{description:'Max PP rises to 4.', maxPPDelta:1} }),
```

Fresh Ink declares `accuracy:100` on the ability and on both effects so they share one hit check: a miss applies no mark, and Blind still reduces the chance normally. The `applyEffect` branch skips a dead target, so a killing blow leaves no mark on the corpse — and no "applied" count is recorded for it.

- [ ] **Step 2: Add the character**

Append to `CHARACTERS`:

```ts
  { id:'ken', displayName:'Ken', affinity:'mystic', role:'Tattoo Artist / Setup Support', stats:{maxHp:98,power:90,guard:84,speed:102}, passive:{id:'collaborative-work',name:'Collaborative Work',description:'Once per round, when another living ally consumes Ken’s Ink Mark, that hit gains 8 additional power.'}, abilities:['fresh-ink','protective-script','needlework','full-sleeve'], assetId:'character-ken', bio:'Ken reads a room the way he reads a bad tattoo: he sees the second stroke, the covered mistake, the line someone rushed. Confident about his craft and quietly critical of sloppy work, he cares more about what a mark means than how it looks. He is calm, observant, and completely unbothered by people who assume he is dangerous.' },
```

- [ ] **Step 3: Update the content count**

In `src/game/content/contentRegistry.ts`, change the expected character count from 12 to 13.

- [ ] **Step 4: Write the failing validation test**

Append to `tests/domain/ken.test.mjs`:

```js
import { validatePlayerCommand } from '../../.domain-build/core/combat/actions.js';

test('Protective Script is rejected when it would add no new or later Script', () => {
  const battle = kenParty();
  const kenId = unitOf(battle, 'ken');
  const marcusId = unitOf(battle, 'marcus');
  battle.turnIndex = battle.turnOrder.indexOf(kenId);
  battle.effects.push({ uid: 'fx-s', id: 'script', sourceUnitId: kenId, targetUnitId: marcusId, expiry: 'source-turn-start', remaining: 2 });
  const verdict = validatePlayerCommand(battle, { kind: 'skill', actorId: kenId, abilityId: 'protective-script', targetIds: [marcusId] });
  assert.equal(verdict.legal, false);
  assert.match(verdict.reason, /already/i);
});

test('Full Sleeve is rejected only when no living ally would gain anything', () => {
  const battle = kenParty();
  const kenId = unitOf(battle, 'ken');
  battle.turnIndex = battle.turnOrder.indexOf(kenId);
  for (const allyId of battle.allies) battle.effects.push({ uid: `fx-${allyId}`, id: 'script', sourceUnitId: kenId, targetUnitId: allyId, expiry: 'source-turn-start', remaining: 2 });
  assert.equal(validatePlayerCommand(battle, { kind: 'skill', actorId: kenId, abilityId: 'full-sleeve', targetIds: [] }).legal, false);

  battle.effects = battle.effects.slice(1);
  assert.equal(validatePlayerCommand(battle, { kind: 'skill', actorId: kenId, abilityId: 'full-sleeve', targetIds: [] }).legal, true);
});

test('Needlework stays legal with no mark available', () => {
  const battle = kenParty();
  const kenId = unitOf(battle, 'ken');
  battle.turnIndex = battle.turnOrder.indexOf(kenId);
  assert.equal(validatePlayerCommand(battle, { kind: 'skill', actorId: kenId, abilityId: 'needlework', targetIds: [battle.enemies[0]] }).legal, true);
});
```

- [ ] **Step 5: Run to verify failure**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/ken.test.mjs`
Expected: FAIL — both Script commands are reported legal.

- [ ] **Step 6: Add the validation**

In `src/game/core/combat/actions.ts`, immediately after the Protect block Part B added, insert:

```ts
  const scriptEffect=ability.effects.find(effect=>effect.kind==='applyEffect'&&effect.effectId==='script');
  if(scriptEffect){
    const candidates=scriptEffect.target==='ally-all'
      ? livingTargets(state,actor.side)
      : command.targetIds.map(id=>state.units[id]).filter((unit):unit is BattleUnit=>Boolean(unit));
    const gains=candidates.some(candidate=>{
      const existing=findEffect(state,'script',candidate.id);
      return !existing||existing.remaining<EFFECT_LIFETIMES.script.remaining;
    });
    if(!gains) return {legal:false,reason:scriptEffect.target==='ally-all'?'Every living ally already carries an equal Script.':'That ally already carries an equal Script.'};
  }
```

and extend the import to `import { EFFECT_LIFETIMES, findEffect } from './battleEffects.js';`.

A skill with a damage component stays usable when its conditional setup payoff is unavailable — this check only runs for abilities whose whole effect is applying Script, so Needlework and Fresh Ink are unaffected.

- [ ] **Step 7: Run the full Ken suite**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/ken.test.mjs`
Expected: PASS, 12 tests — including the four from Task 3.

- [ ] **Step 8: Run the whole domain suite**

Run: `pnpm test:domain`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/game/content/characters.ts src/game/content/contentRegistry.ts src/game/core/combat/actions.ts tests/domain/ken.test.mjs
git commit -m "feat: add Ken to the roster with Script no-waste validation"
```

---

### Task 5: Asset, guide and presentation

**Files:**
- Modify: `scripts/generate_local_assets.py`
- Modify: `src/game/content/guide.ts`
- Test: `tests/release/structure.test.mjs`

**Interfaces:**
- Consumes: the `EFFECT_GUIDE` table, `StatusStrip` `effects` prop and `effect` overlay from Part B Task 5 — all reused unchanged.
- Produces: `character-ken.svg`, and Ink Mark and Script guide entries.

- [ ] **Step 1: Write the failing structure test**

In `tests/release/structure.test.mjs`, change the character cutout assertion from 12 to 13.

Run: `pnpm test:release`
Expected: FAIL — 12 found, 13 expected.

- [ ] **Step 2: Generate the cutout**

In `scripts/generate_local_assets.py`, add to `props`:

```python
 'needle':'<path d="M148 84l30 10-6 12-28-8z"/><path d="M144 100l-9 44M152 102l-6 44"/><circle cx="139" cy="152" r="6"/>',
```

and to `assets`, after the Saq entry:

```python
('character-ken',5,'needle'),
```

Run: `python scripts/generate_local_assets.py && ls public/assets/cutouts/character-ken.svg`

Offensive marks and defensive scripts use distinct shapes and labels; the cutout uses drawn strokes and stencil forms, not a glowing circle.

- [ ] **Step 3: Verify the structure test passes**

Run: `pnpm test:release`
Expected: PASS.

- [ ] **Step 4: Add the guide entries**

Append to `EFFECT_GUIDE` in `src/game/content/guide.ts`:

```ts
  {id:'ink-mark',name:'Ink Mark',short:'INK',positive:false,anchor:'Until the start of Ken’s second turn from now.',trigger:'The next successful direct damaging skill hit against this enemy.',description:`Adds ${BALANCE.ken.inkMarkPower} power to that one hit, taking the consuming skill's affinity, then disappears. Another ally consuming it adds a further ${BALANCE.ken.collaborativeWorkPower} once per round; Needlework adds ${BALANCE.ken.needleworkMarkPower} to its own consuming hit. It never multiplies across the hits of a multi-hit move, creates no second attack, and is removed by cleansing after ordinary negatives.`},
  {id:'script',name:'Script',short:'SCRIPT',positive:true,anchor:'Until the start of Ken’s second turn from now.',trigger:`One hit landing for at least ${Math.round(BALANCE.ken.scriptThresholdPercent*100)}% of this ally's Max HP.`,description:`Prevents up to ${BALANCE.ken.scriptPrevention} HP from that single large hit, then disappears. Repeated small hits never trigger it, and it cannot react to an HP cost or to a protector's transferred share. Unlike Fortified, which reduces every hit for its duration, Script is one conditional use.`},
```

Add to `MECHANIC_GUIDE`:

```ts
  {id:'marks',title:'Marks and scripts',text:'Ink Mark and Script belong to Ken, not to the unit carrying them. They last until the start of his second turn from now, and buff-duration bonuses from Jiro, Daboy or Sticky Label do not extend them. A mark applied this turn cannot be consumed by the action that applied it.'},
```

- [ ] **Step 5: Run every check**

Run: `pnpm typecheck && pnpm test:domain && pnpm test:vitest && pnpm test:release && pnpm lint && pnpm build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate_local_assets.py public/assets/cutouts/character-ken.svg src/game/content/guide.ts tests/release/structure.test.mjs
git commit -m "feat: present Ink Mark and Script with icon and text access"
```

---

### Task 6: Part D gate

**Files:**
- Modify: `docs/superpowers/evidence/2026-09-08-spec03-baseline.md`

- [ ] **Step 1: Run every check**

```bash
pnpm typecheck && pnpm test:domain && pnpm test:release && pnpm test:vitest && pnpm lint && pnpm build && pnpm test:e2e
```

Expected: all pass. Paste the tail of each.

- [ ] **Step 2: Confirm the roster is complete**

```bash
node -e "import('./.domain-build/content/contentRegistry.js').then(m=>{const r=m.validateContent();console.log(r,m.CONTENT.characters.length,m.CONTENT.abilities.length)})"
```

Expected: `{valid:true,errors:[]}`, 13 characters, 52 abilities. Print these from runtime content; do not restate the spec's numbers.

- [ ] **Step 3: Verify save resume with live marks**

Build a battle with `ken`, apply Fresh Ink and Full Sleeve, serialise through `createSaveEnvelope` → `parseSaveEnvelope` → `migrateSaveEnvelope`, and assert the restored battle resolves the next command to an identical `nextState` and event list, with exact source IDs, remaining counts and the `collaborativeWorkRound` flag intact. Paste the output.

- [ ] **Step 4: Record the gate**

Append a `## Part D gate` section with the seven command results, the runtime content counts, and the save-resume output.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/evidence/2026-09-08-spec03-baseline.md
git commit -m "docs: record Spec 03 Part D gate evidence"
```

---

## Next

Part E: `docs/superpowers/plans/2026-09-08-spec03-e-ken-events-audit.md`.
