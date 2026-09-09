# Spec 03 Part A — Battle Effect Foundation & Save V3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one bounded, source-linked battle-effect collection to `BattleState`, persist it through save envelope V3, and record a reproducible pre-change baseline — with no player-visible gameplay yet.

**Architecture:** A single typed array `BattleState.effects` holds every new source-linked effect (`protect`, `ink-mark`, `script`, `taxed`). Lifecycle lives in one new module `src/game/core/combat/battleEffects.ts`. Existing duration-only `StatusInstance` statuses are untouched. Bounded per-battle counters (Ready, Class Monitor round, Collaborative Work round) reuse the existing `BattleUnit.flags` record, which is already typed, persisted, and validated — no schema work for them.

**Tech Stack:** TypeScript 5.8, Node 22 `node:test` for domain tests, Vitest for schema tests, Zod 4 for save validation.

**Spec:** `docs/superpowers/specs/2026-09-08-roster-character-encounter-expansion.md` and its companion `docs/superpowers/specs/2026-09-08-roster-combat-rules-validation.md` (companion §5 owns this part).

## Global Constraints

- Existing `StatusInstance` statuses stay on their existing path. Do not migrate statuses, deployables, or passives into a new engine (companion §5).
- No new RNG for expiry, consumption, transfer, passive triggers, or bonus power (companion §1).
- Store only authoritative facts: effect ID, source/target battle-unit IDs, expiry boundary, remaining count, consumed passive round/once flags. No computed damage previews, no shadow representation in both flags and statuses (companion §5).
- Source IDs are battle-instance IDs (`ally-0-saq`), never roster IDs (companion §3).
- Save envelope becomes **V3** with V1 → V2 → V3 migration. Older battles get an empty collection and default unused flags (companion §5).
- Unknown future versions are rejected clearly without overwriting the stored save (companion §5).
- Commands: `pnpm test:domain`, `pnpm test:vitest`, `pnpm test:release`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- Never claim a step done without pasting the command output.

## File structure

| File | Responsibility |
|---|---|
| `src/game/core/types.ts` (modify) | `BattleEffectId`, `BattleEffectInstance`, `BattleState.effects`, two `EffectDefinition` variants, five `CombatEvent` variants |
| `src/game/core/combat/battleEffects.ts` (create) | The entire lifecycle: add, find, consume, tick, clear. No damage maths, no content knowledge |
| `src/game/core/combat/battleEngine.ts` (modify) | Initialise, tick at the two turn boundaries, clear on KO and on export |
| `src/game/core/save/saveFormat.ts` (modify) | V3 constant, `SaveEnvelopeV3`, V2 → V3 run migration |
| `src/services/save/schema.ts` (modify) | Zod shape for `effects`, envelope literal 3 |
| `tests/domain/battleEffects.test.mjs` (create) | Lifecycle behaviour and engine wiring |
| `tests/domain/save.test.mjs` (modify) | Migration and round-trip |
| `tests/vitest/saveSchema.test.ts` (modify) | Zod preservation and rejection |

---

### Task 0: Freeze the baseline (spec phase 0)

**Files:**
- Create: `docs/superpowers/evidence/2026-09-08-spec03-baseline.md`

**Interfaces:**
- Consumes: nothing.
- Produces: a dated baseline file every later audit task in Parts C, E and F compares against.

- [ ] **Step 1: Record repository provenance**

```bash
git rev-parse HEAD > /tmp/spec03-rev.txt
git status --porcelain > /tmp/spec03-dirty.txt
git diff --stat >> /tmp/spec03-dirty.txt
```

- [ ] **Step 2: Run the existing full check suite and capture output**

```bash
pnpm typecheck 2>&1 | tail -20
pnpm test:domain 2>&1 | tail -30
pnpm test:release 2>&1 | tail -20
pnpm test:vitest 2>&1 | tail -20
pnpm lint 2>&1 | tail -20
```

Expected: all pass. If any fails, stop and report — the baseline must be green before adding mechanics.

- [ ] **Step 3: Run both audits on the current code**

```bash
node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json
node scripts/balance-audit.mjs > /tmp/spec03-balance-baseline.txt
node scripts/economy-audit.mjs > /tmp/spec03-economy-baseline.txt
```

- [ ] **Step 4: Write the baseline evidence file**

Create `docs/superpowers/evidence/2026-09-08-spec03-baseline.md` containing, verbatim from the captured output:

```markdown
# Spec 03 Baseline

Date: 2026-09-08
Revision: <contents of /tmp/spec03-rev.txt>
Working tree: <clean | dirty — paste /tmp/spec03-dirty.txt>

## Suite results
<paste the tail of each pnpm command above, with its exit status>

## Balance audit (seeds 101,202,303,404; 11 characters; 165 parties; 12 encounters)
<paste the global pacing and character-inclusion tables from docs/BALANCE_AUDIT_V03.md>

## Economy audit
<paste the summary section written by scripts/economy-audit.mjs>

## Known provenance defect
scripts/balance-audit.mjs prints a hardcoded "165 three-character parties x 12 encounters"
string in its markdown header while enumerating parties dynamically. Part C Task 1 fixes it.
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/evidence/2026-09-08-spec03-baseline.md
git commit -m "docs: record Spec 03 pre-implementation baseline"
```

---

### Task 1: Battle effect types

**Files:**
- Modify: `src/game/core/types.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `BattleEffectId`, `BattleEffectInstance`, `BattleState.effects`, the `applyEffect` and `removeEffect` effect-definition variants, and the `effectApplied` / `effectRemoved` / `prevented` / `transfer` / `ready` combat events. Every later part of Spec 03 depends on these exact names.

- [ ] **Step 1: Add the effect types**

In `src/game/core/types.ts`, immediately after the `StatusInstance` interface (lines 17-20), add:

```ts
export type BattleEffectId = 'protect' | 'ink-mark' | 'script' | 'taxed';

/**
 * A source-linked battle effect. Unlike StatusInstance it records who applied it,
 * who carries it, and which unit's turns count down its lifetime.
 * `source-turn-start` expires before the source's input becomes available.
 * `target-turn-end`   expires after the target completes a turn.
 */
export interface BattleEffectInstance {
  uid: string;
  id: BattleEffectId;
  sourceUnitId: string;
  targetUnitId: string;
  expiry: 'source-turn-start' | 'target-turn-end';
  remaining: number;
}
```

- [ ] **Step 2: Add the two effect-definition variants**

In the `EffectDefinition` union (lines 38-47), add two members at the end of the union:

```ts
  | { kind: 'applyEffect'; effectId: BattleEffectId; target: TargetMode; accuracy?: number; mechanicId?: string }
  | { kind: 'removeEffect'; target: TargetMode; mechanicId?: string }
```

- [ ] **Step 3: Add `effects` to `BattleState`**

In `BattleState` (lines 126-144), add immediately after `deployables: DeployableState[];`:

```ts
  effects: BattleEffectInstance[];
```

- [ ] **Step 4: Add the presentation events**

In the `CombatEvent` union, add immediately before `| { type: 'victory' }`:

```ts
  | { type: 'effectApplied'; effectId: BattleEffectId; sourceId: string; targetId: string; remaining: number }
  | { type: 'effectRemoved'; effectId: BattleEffectId; targetId: string; reason: 'expired' | 'consumed' | 'cleared' }
  | { type: 'prevented'; kind: 'script' | 'class-monitor'; targetId: string; amount: number }
  | { type: 'transfer'; fromId: string; toId: string; amount: number }
  | { type: 'ready'; actorId: string; active: boolean }
```

- [ ] **Step 5: Verify it does not compile yet, for the right reason**

Run: `pnpm typecheck`
Expected: FAIL — the `BattleState` literal in `battleEngine.ts` `createBattle` is now missing the required `effects` property. Any other error means a mistake in this task.

- [ ] **Step 6: Commit**

```bash
git add src/game/core/types.ts
git commit -m "feat: add source-linked battle effect types"
```

---

### Task 2: Effect lifecycle module

**Files:**
- Create: `src/game/core/combat/battleEffects.ts`
- Create: `tests/domain/battleEffects.test.mjs`

**Interfaces:**
- Consumes: `BattleEffectId`, `BattleEffectInstance`, `BattleState`, `CombatEvent` from Task 1.
- Produces: `addEffect(state, spec)`, `findEffect(state, id, targetUnitId)`, `findEffectFromSource(state, id, sourceUnitId)`, `consumeEffect(state, uid, events)`, `tickSourceTurnStart(state, unitId, events)`, `tickTargetTurnEnd(state, unitId, events)`, `clearEffectsForUnit(state, unitId, events)`, `clearAllEffects(state)`, and the `EffectSpec` input type. Parts B, D and F call all of these.

- [ ] **Step 1: Write the failing test**

Create `tests/domain/battleEffects.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addEffect, findEffect, findEffectFromSource, consumeEffect,
  tickSourceTurnStart, tickTargetTurnEnd, clearEffectsForUnit, clearAllEffects,
} from '../../.domain-build/core/combat/battleEffects.js';

const emptyState = () => ({ effects: [], flags: {} });

test('an added effect is findable by target and by source', () => {
  const state = emptyState();
  const effect = addEffect(state, { id: 'protect', sourceUnitId: 'ally-0-saq', targetUnitId: 'ally-1-hans', expiry: 'source-turn-start', remaining: 1 });
  assert.equal(state.effects.length, 1);
  assert.equal(findEffect(state, 'protect', 'ally-1-hans').uid, effect.uid);
  assert.equal(findEffectFromSource(state, 'protect', 'ally-0-saq').uid, effect.uid);
  assert.equal(findEffect(state, 'protect', 'ally-2-earl'), undefined);
});

test('uids stay unique across adds and removes', () => {
  const state = emptyState();
  const first = addEffect(state, { id: 'ink-mark', sourceUnitId: 'ally-0-ken', targetUnitId: 'enemy-0-wisp', expiry: 'source-turn-start', remaining: 2 });
  consumeEffect(state, first.uid, []);
  const second = addEffect(state, { id: 'ink-mark', sourceUnitId: 'ally-0-ken', targetUnitId: 'enemy-0-wisp', expiry: 'source-turn-start', remaining: 2 });
  assert.notEqual(first.uid, second.uid);
});

test('reapplication replaces rather than stacks, for the same source and for the same target', () => {
  const state = emptyState();
  addEffect(state, { id: 'protect', sourceUnitId: 'ally-0-saq', targetUnitId: 'ally-1-hans', expiry: 'source-turn-start', remaining: 1 });
  addEffect(state, { id: 'protect', sourceUnitId: 'ally-0-saq', targetUnitId: 'ally-2-earl', expiry: 'source-turn-start', remaining: 1 });
  assert.equal(state.effects.length, 1);
  assert.equal(state.effects[0].targetUnitId, 'ally-2-earl');

  addEffect(state, { id: 'script', sourceUnitId: 'ally-0-ken', targetUnitId: 'ally-1-hans', expiry: 'source-turn-start', remaining: 2 });
  addEffect(state, { id: 'script', sourceUnitId: 'ally-0-ken', targetUnitId: 'ally-1-hans', expiry: 'source-turn-start', remaining: 2 });
  assert.equal(state.effects.filter(e => e.id === 'script').length, 1);
});

test('a source-turn-start effect with remaining 2 survives one source turn and expires on the second', () => {
  const state = emptyState();
  addEffect(state, { id: 'ink-mark', sourceUnitId: 'ally-0-ken', targetUnitId: 'enemy-0-wisp', expiry: 'source-turn-start', remaining: 2 });
  const events = [];
  tickSourceTurnStart(state, 'ally-0-ken', events);
  assert.equal(state.effects.length, 1);
  assert.equal(state.effects[0].remaining, 1);
  tickSourceTurnStart(state, 'ally-0-ken', events);
  assert.equal(state.effects.length, 0);
  assert.deepEqual(events, [{ type: 'effectRemoved', effectId: 'ink-mark', targetId: 'enemy-0-wisp', reason: 'expired' }]);
});

test('another unit taking turns never expires a source-turn-start effect', () => {
  const state = emptyState();
  addEffect(state, { id: 'protect', sourceUnitId: 'ally-0-saq', targetUnitId: 'ally-1-hans', expiry: 'source-turn-start', remaining: 1 });
  tickSourceTurnStart(state, 'ally-1-hans', []);
  tickSourceTurnStart(state, 'enemy-0-wisp', []);
  assert.equal(state.effects.length, 1);
});

test('a target-turn-end effect expires on the recipient completing a turn, not on its source acting', () => {
  const state = emptyState();
  addEffect(state, { id: 'taxed', sourceUnitId: 'enemy-0-toll-hexer', targetUnitId: 'ally-1-hans', expiry: 'target-turn-end', remaining: 1 });
  tickSourceTurnStart(state, 'enemy-0-toll-hexer', []);
  assert.equal(state.effects.length, 1);
  tickTargetTurnEnd(state, 'ally-1-hans', []);
  assert.equal(state.effects.length, 0);
});

test('clearing a unit removes effects it sources and effects it carries', () => {
  const state = emptyState();
  addEffect(state, { id: 'protect', sourceUnitId: 'ally-0-saq', targetUnitId: 'ally-1-hans', expiry: 'source-turn-start', remaining: 1 });
  addEffect(state, { id: 'script', sourceUnitId: 'ally-2-ken', targetUnitId: 'ally-0-saq', expiry: 'source-turn-start', remaining: 2 });
  const events = [];
  clearEffectsForUnit(state, 'ally-0-saq', events);
  assert.equal(state.effects.length, 0);
  assert.equal(events.filter(e => e.reason === 'cleared').length, 2);
});

test('clearAllEffects empties the collection without emitting events', () => {
  const state = emptyState();
  addEffect(state, { id: 'protect', sourceUnitId: 'ally-0-saq', targetUnitId: 'ally-1-hans', expiry: 'source-turn-start', remaining: 1 });
  clearAllEffects(state);
  assert.deepEqual(state.effects, []);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/battleEffects.test.mjs`
Expected: FAIL — `Cannot find module '.../battleEffects.js'`.

- [ ] **Step 3: Write the module**

Create `src/game/core/combat/battleEffects.ts`:

```ts
import type { BattleEffectId, BattleEffectInstance, BattleState, CombatEvent } from '../types.js';

export interface EffectSpec {
  id: BattleEffectId;
  sourceUnitId: string;
  targetUnitId: string;
  expiry: BattleEffectInstance['expiry'];
  remaining: number;
}

function nextUid(state: BattleState): string {
  const serial = Number(state.flags.effectSerial ?? 0) + 1;
  state.flags.effectSerial = serial;
  return `fx-${serial}`;
}

/**
 * Applies one effect. A source holds at most one effect of a given id, and a target
 * carries at most one effect of a given id, so reapplication replaces rather than stacks.
 */
export function addEffect(state: BattleState, spec: EffectSpec): BattleEffectInstance {
  state.effects = state.effects.filter(effect =>
    effect.id !== spec.id || (effect.sourceUnitId !== spec.sourceUnitId && effect.targetUnitId !== spec.targetUnitId));
  const effect: BattleEffectInstance = { uid: nextUid(state), ...spec };
  state.effects.push(effect);
  return effect;
}

export function findEffect(state: BattleState, id: BattleEffectId, targetUnitId: string): BattleEffectInstance | undefined {
  return state.effects.find(effect => effect.id === id && effect.targetUnitId === targetUnitId);
}

export function findEffectFromSource(state: BattleState, id: BattleEffectId, sourceUnitId: string): BattleEffectInstance | undefined {
  return state.effects.find(effect => effect.id === id && effect.sourceUnitId === sourceUnitId);
}

export function consumeEffect(state: BattleState, uid: string, events: CombatEvent[]): void {
  const effect = state.effects.find(candidate => candidate.uid === uid);
  if (!effect) return;
  state.effects = state.effects.filter(candidate => candidate.uid !== uid);
  events.push({ type: 'effectRemoved', effectId: effect.id, targetId: effect.targetUnitId, reason: 'consumed' });
}

/** Called before the unit's input becomes available, and before an enemy turn resolves. */
export function tickSourceTurnStart(state: BattleState, unitId: string, events: CombatEvent[]): void {
  const kept: BattleEffectInstance[] = [];
  for (const effect of state.effects) {
    if (effect.expiry !== 'source-turn-start' || effect.sourceUnitId !== unitId) { kept.push(effect); continue; }
    const remaining = effect.remaining - 1;
    if (remaining > 0) kept.push({ ...effect, remaining });
    else events.push({ type: 'effectRemoved', effectId: effect.id, targetId: effect.targetUnitId, reason: 'expired' });
  }
  state.effects = kept;
}

/** Called after the unit completes a turn. */
export function tickTargetTurnEnd(state: BattleState, unitId: string, events: CombatEvent[]): void {
  const kept: BattleEffectInstance[] = [];
  for (const effect of state.effects) {
    if (effect.expiry !== 'target-turn-end' || effect.targetUnitId !== unitId) { kept.push(effect); continue; }
    const remaining = effect.remaining - 1;
    if (remaining > 0) kept.push({ ...effect, remaining });
    else events.push({ type: 'effectRemoved', effectId: effect.id, targetId: effect.targetUnitId, reason: 'expired' });
  }
  state.effects = kept;
}

/** A KO source cannot leave a link waiting forever; a KO recipient loses what it carried. */
export function clearEffectsForUnit(state: BattleState, unitId: string, events: CombatEvent[]): void {
  const kept: BattleEffectInstance[] = [];
  for (const effect of state.effects) {
    if (effect.sourceUnitId === unitId || effect.targetUnitId === unitId) {
      events.push({ type: 'effectRemoved', effectId: effect.id, targetId: effect.targetUnitId, reason: 'cleared' });
    } else kept.push(effect);
  }
  state.effects = kept;
}

export function clearAllEffects(state: BattleState): void {
  state.effects = [];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/battleEffects.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/game/core/combat/battleEffects.ts tests/domain/battleEffects.test.mjs
git commit -m "feat: add battle effect lifecycle module"
```

---

### Task 3: Wire the collection into the engine

**Files:**
- Modify: `src/game/core/combat/battleEngine.ts` — `createBattle` (~line 95), `damageOne` (~line 167), `resolveEnemyTurn` (~line 384), `advanceAutomaticTurns` (~line 396), `resolveBattleCommand` (~line 440), `exportPartyFromBattle` (~line 446)
- Test: `tests/domain/battleEffects.test.mjs`

**Interfaces:**
- Consumes: `clearAllEffects`, `clearEffectsForUnit`, `tickSourceTurnStart`, `tickTargetTurnEnd` from Task 2.
- Produces: an engine where `state.effects` exists, ticks on the right turn boundaries, and clears on KO and on battle export. Parts B, D and F add the effects themselves; this task adds no gameplay.

- [ ] **Step 1: Write the failing test**

Append to `tests/domain/battleEffects.test.mjs`:

```js
import { SeededRng } from '../../.domain-build/core/rng/seededRng.js';
import { createBattle, resolveBattleCommand } from '../../.domain-build/core/combat/battleEngine.js';

test('a new battle starts with an empty effect collection', () => {
  const battle = createBattle(['earl','hans','marcus'], 'normal-fastlane', new SeededRng(777), { coins: 30 });
  assert.deepEqual(battle.effects, []);
});

test('a link survives the turn on which it was applied and is not expired by other units acting', () => {
  const rng = new SeededRng(777);
  let battle = createBattle(['earl','hans','marcus'], 'normal-fastlane', rng, { coins: 30 });
  const actorId = battle.turnOrder[battle.turnIndex];
  const otherAllyId = battle.allies.find(id => id !== actorId);
  battle.effects.push({ uid: 'fx-test', id: 'protect', sourceUnitId: actorId, targetUnitId: otherAllyId, expiry: 'source-turn-start', remaining: 1 });

  battle = resolveBattleCommand(battle, { kind: 'guard', actorId }, rng).nextState;
  assert.equal(battle.effects.length, 1, 'the effect must not expire during or immediately after the turn that applied it');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/battleEffects.test.mjs`
Expected: FAIL — `battle.effects` is `undefined` because `createBattle` does not build it.

- [ ] **Step 3: Initialise the collection**

In `src/game/core/combat/battleEngine.ts`, add beside the existing combat imports:

```ts
import { clearAllEffects, clearEffectsForUnit, tickSourceTurnStart, tickTargetTurnEnd } from './battleEffects.js';
```

In `createBattle`, in the `const state:BattleState={...}` literal, add `effects:[],` immediately after `deployables:[],`.

- [ ] **Step 4: Clear effects on KO**

In `damageOne`, inside `if(killed) {`, immediately after `events.push({type:'knockout',targetId:target.id});`, add:

```ts
    clearEffectsForUnit(state,target.id,events);
```

- [ ] **Step 5: Tick at the two turn boundaries**

In `resolveEnemyTurn`, add as the first statement of the body, before `actor.guardActive=false;`:

```ts
  tickSourceTurnStart(state,actor.id,events);
```

In `advanceAutomaticTurns`, replace the ally branch:

```ts
    if(actor.side==='ally'){actor.guardActive=false;state.phase='input';break;}
```

with:

```ts
    if(actor.side==='ally'){
      const key=`turnStarted-${actor.id}-${state.round}`;
      if(!state.flags[key]){state.flags[key]=true;tickSourceTurnStart(state,actor.id,events);}
      actor.guardActive=false;state.phase='input';break;
    }
```

`advanceAutomaticTurns` can be re-entered for the same actor and round after a rejected command, so the round-scoped flag keeps the tick idempotent. Enemy turns resolve exactly once per visit and need no guard.

In `resolveBattleCommand`, immediately after the existing `tickOnlyExisting(actor,before,events);` line, add:

```ts
  tickTargetTurnEnd(state,actor.id,events);
```

In `resolveEnemyTurn`, immediately after its `tickOnlyExisting(actor,before,events);` call, add the same line.

- [ ] **Step 6: Clear effects when the battle ends**

In `exportPartyFromBattle`, add as the first statement of the body:

```ts
  clearAllEffects(state);
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/battleEffects.test.mjs`
Expected: PASS, 10 tests.

- [ ] **Step 8: Run the full domain suite for regressions**

Run: `pnpm test:domain`
Expected: PASS. Any failure here means the tick placement changed existing behaviour — investigate before continuing.

- [ ] **Step 9: Commit**

```bash
git add src/game/core/combat/battleEngine.ts tests/domain/battleEffects.test.mjs
git commit -m "feat: tick and clear battle effects at turn boundaries"
```

---

### Task 4: Save envelope V3

**Files:**
- Modify: `src/game/core/save/saveFormat.ts`
- Modify: `src/services/save/schema.ts`
- Test: `tests/domain/save.test.mjs`
- Test: `tests/vitest/saveSchema.test.ts`

**Interfaces:**
- Consumes: `BattleEffectInstance` from Task 1, `BattleState.effects` from Task 3.
- Produces: `SAVE_SCHEMA_VERSION === 3`, `SaveEnvelopeV3`, `migrateSaveEnvelope` handling V1 → V2 → V3, `parseSaveEnvelope` returning `SaveEnvelopeV3`.

- [ ] **Step 1: Write the failing domain test**

Append to `tests/domain/save.test.mjs`. If the file builds run literals inline, first extract that literal into a local `baseRun()` function and leave the existing tests calling it, so the new tests below can reuse it:

```js
test('V2 saves migrate to V3 with an empty effect collection on an active battle', () => {
  const battle = createBattle(['earl','hans','marcus'], 'normal-fastlane', new SeededRng(777), { coins: 30 });
  delete battle.effects;
  const v2 = {
    schemaVersion: 2, timestamp: '2026-09-08T00:00:00.000Z', revision: 4,
    payload: { activeRun: { ...baseRun(), activeBattle: battle }, profile: DEFAULT_PROFILE, settings: DEFAULT_SETTINGS },
  };
  const migrated = migrateSaveEnvelope(v2);
  assert.equal(migrated.schemaVersion, 3);
  assert.deepEqual(migrated.payload.activeRun.activeBattle.effects, []);
  assert.equal(migrated.payload.activeRun.coins, baseRun().coins);
});

test('a V3 save round-trips its effect collection unchanged', () => {
  const battle = createBattle(['earl','hans','marcus'], 'normal-fastlane', new SeededRng(777), { coins: 30 });
  battle.effects = [{ uid: 'fx-1', id: 'protect', sourceUnitId: battle.allies[0], targetUnitId: battle.allies[1], expiry: 'source-turn-start', remaining: 1 }];
  const envelope = createSaveEnvelope({ activeRun: { ...baseRun(), activeBattle: battle }, profile: DEFAULT_PROFILE, settings: DEFAULT_SETTINGS }, 5);
  const restored = migrateSaveEnvelope(JSON.parse(JSON.stringify(envelope)));
  assert.deepEqual(restored.payload.activeRun.activeBattle.effects, battle.effects);
});

test('a future schema version is rejected without a partial result', () => {
  assert.throws(() => migrateSaveEnvelope({ schemaVersion: 4, timestamp: 'x', revision: 1, payload: {} }), /newer, unsupported/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/save.test.mjs`
Expected: FAIL — `migrated.schemaVersion` is `2`, not `3`.

- [ ] **Step 3: Implement V3 in `saveFormat.ts`**

Change the version constant:

```ts
export const SAVE_SCHEMA_VERSION = 3 as const;
```

Add the V3 envelope type beside the existing ones:

```ts
export interface SaveEnvelopeV3 {schemaVersion:3;timestamp:string;revision:number;payload:SavePayload;persistenceWarning?:string}
```

Change `createSaveEnvelope`'s return type to `SaveEnvelopeV3`.

In `validateSaveShape`, change `if(raw.schemaVersion!==2)` to `if(raw.schemaVersion!==3)`.

Add the V2 → V3 run migration beside `migrateRunV1toV2`:

```ts
function migrateRunV2toV3(run:unknown):RunState {
  const r=run as RunState;
  if(!r.activeBattle) return r;
  return {...r, activeBattle:{...r.activeBattle, effects:Array.isArray(r.activeBattle.effects)?r.activeBattle.effects:[]}};
}
```

Replace `migrateSaveEnvelope` with a chained migration:

```ts
export function migrateSaveEnvelope(raw:unknown):SaveEnvelopeV3{
  if(!isRecord(raw))throw new Error('Save is corrupt or unreadable.');
  const version=raw.schemaVersion;
  if(typeof version!=='number')throw new Error('Save has no schema version.');
  if(version>3)throw new Error('Save was created by a newer, unsupported version of Abungi.');
  if(version<1)throw new Error('Save schema version is unsupported.');

  let envelope=raw as unknown as SaveEnvelopeV1|SaveEnvelopeV2|SaveEnvelopeV3;

  if(envelope.schemaVersion===1){
    const v1=envelope;
    if(typeof v1.timestamp!=='string'||typeof v1.revision!=='number'||!isRecord(v1.payload))
      throw new Error('Save validation failed: V1 envelope is malformed.');
    const run=v1.payload.activeRun;
    envelope={schemaVersion:2,timestamp:v1.timestamp,revision:v1.revision,payload:{...v1.payload,activeRun:run?migrateRunV1toV2(run):null}};
  }

  if(envelope.schemaVersion===2){
    const v2=envelope;
    if(typeof v2.timestamp!=='string'||typeof v2.revision!=='number'||!isRecord(v2.payload))
      throw new Error('Save validation failed: V2 envelope is malformed.');
    const run=v2.payload.activeRun;
    return {schemaVersion:3,timestamp:v2.timestamp,revision:v2.revision,payload:{...v2.payload,activeRun:run?migrateRunV2toV3(run):null}};
  }

  const verdict=validateSaveShape(envelope);
  if(!verdict.valid)throw new Error(`Save validation failed: ${verdict.errors.join(' ')}`);
  return envelope;
}
```

- [ ] **Step 4: Run the domain test to verify it passes**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/save.test.mjs`
Expected: PASS.

- [ ] **Step 5: Write the failing Zod test**

Append to `tests/vitest/saveSchema.test.ts`, reusing the file's existing run/envelope helpers (extract a `baseRun()` local first if it builds runs inline):

```ts
it('preserves a battle effect collection through parsing', () => {
  const battle = createBattle(['earl','hans','marcus'], 'normal-fastlane', new SeededRng(777), { coins: 30 });
  battle.effects = [{ uid: 'fx-1', id: 'protect', sourceUnitId: battle.allies[0], targetUnitId: battle.allies[1], expiry: 'source-turn-start', remaining: 1 }];
  const envelope = createSaveEnvelope({ activeRun: { ...baseRun(), activeBattle: battle }, profile: DEFAULT_PROFILE, settings: DEFAULT_SETTINGS }, 1);
  const parsed = parseSaveEnvelope(JSON.parse(JSON.stringify(envelope)));
  expect(parsed.payload.activeRun!.activeBattle!.effects).toEqual(battle.effects);
});

it('rejects an unknown effect id rather than silently stripping it', () => {
  const battle = createBattle(['earl','hans','marcus'], 'normal-fastlane', new SeededRng(777), { coins: 30 });
  (battle.effects as unknown[]).push({ uid: 'fx-9', id: 'not-a-real-effect', sourceUnitId: 'a', targetUnitId: 'b', expiry: 'source-turn-start', remaining: 1 });
  const envelope = createSaveEnvelope({ activeRun: { ...baseRun(), activeBattle: battle }, profile: DEFAULT_PROFILE, settings: DEFAULT_SETTINGS }, 1);
  expect(() => parseSaveEnvelope(JSON.parse(JSON.stringify(envelope)))).toThrow();
});
```

- [ ] **Step 6: Run to verify failure**

Run: `pnpm test:vitest`
Expected: FAIL — the parsed envelope drops `effects`, and the `z.literal(2)` `schemaVersion` rejects the V3 envelope.

- [ ] **Step 7: Update the Zod schema**

In `src/services/save/schema.ts`, add beside the `deployable` schema:

```ts
const battleEffect=z.object({
  uid:z.string(),
  id:z.enum(['protect','ink-mark','script','taxed']),
  sourceUnitId:z.string(),
  targetUnitId:z.string(),
  expiry:z.enum(['source-turn-start','target-turn-end']),
  remaining:z.number().int().nonnegative(),
});
```

In the `battle` object, add immediately after `deployables:z.array(deployable),`:

```ts
  effects:z.array(battleEffect).default([]),
```

Change the envelope literal and the imported type:

```ts
import type { SaveEnvelopeV3 } from '../../game/core/save/saveFormat';
export const SaveEnvelopeSchema=z.object({schemaVersion:z.literal(3),timestamp:z.string(),revision:z.number().int().nonnegative(),payload:z.object({activeRun:run.nullable(),profile,settings})});
export function parseSaveEnvelope(value:unknown):SaveEnvelopeV3{return SaveEnvelopeSchema.parse(value) as SaveEnvelopeV3;}
```

Then run `pnpm typecheck` and repoint every remaining `SaveEnvelopeV2` reference it reports in `src/services/save/*.ts` and `src/app/appStore.ts` at `SaveEnvelopeV3`.

- [ ] **Step 8: Run every suite to verify they pass**

Run: `pnpm typecheck && pnpm test:domain && pnpm test:vitest`
Expected: PASS on all three.

- [ ] **Step 9: Commit**

```bash
git add src/game/core/save/saveFormat.ts src/services/save src/app/appStore.ts tests/domain/save.test.mjs tests/vitest/saveSchema.test.ts
git commit -m "feat: migrate saves to envelope V3 with battle effects"
```

---

### Task 5: Part A gate

**Files:** none changed except the evidence file.

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: recorded proof that Part A changed no gameplay, which Part B's comparisons depend on.

- [ ] **Step 1: Run every check**

```bash
pnpm typecheck && pnpm test:domain && pnpm test:release && pnpm test:vitest && pnpm lint && pnpm build
```

Expected: all pass. Paste the tail of each.

- [ ] **Step 2: Confirm no behaviour drift**

```bash
node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json
node scripts/balance-audit.mjs > /tmp/spec03-balance-after-a.txt
diff <(grep -A20 'Global pacing' /tmp/spec03-balance-baseline.txt) <(grep -A20 'Global pacing' /tmp/spec03-balance-after-a.txt)
```

Expected: empty diff. Part A adds no gameplay, so identical seeds must produce identical results. A non-empty diff blocks Part B — find the cause before continuing.

- [ ] **Step 3: Append the result to the baseline evidence file**

Add a `## Part A gate` section to `docs/superpowers/evidence/2026-09-08-spec03-baseline.md` recording the six command results and the empty audit diff.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/evidence/2026-09-08-spec03-baseline.md
git commit -m "docs: record Spec 03 Part A gate evidence"
```

---

## Next

Part B: `docs/superpowers/plans/2026-09-08-spec03-b-saq-kit.md`.
