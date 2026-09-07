# Abungi v0.3 — Plan C: Content + Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the content gaps the economy audit exposed — no all-party PP answer, no way for a support character to contribute damage, no PP option in the post-battle spoils — with two items, one spoils choice, two relics and two events; then add five curated animations inside the existing motion budget.

**Architecture:** Content is data first (`src/game/content/*`), with exactly three small domain additions to make the new data work: a `damage` effect kind for items, a `ppPercent` field on the reward spoils choice, and two relic mechanic hooks in `battleEngine`. Animation is presentation-only — new CSS keyframes plus classes derived from `CombatEvent`s the engine already emits; deterministic resolution is untouched.

**Tech Stack:** TypeScript 5.8, React 19, plain CSS, Zod 4 (save validation), `node:test` for domain, Vitest for content structure, Playwright for viewports, `scripts/economy-audit.mjs` for the economy re-check.

**Spec:** `docs/superpowers/specs/2026-09-07-abungi-v03-polish-design.md` (WS4 and WS5)

**Sibling plans:** Plan A (`2026-09-07-abungi-v03-a-mobile-color.md`), Plan B (`2026-09-07-abungi-v03-b-revive-balance.md`). **Plan C must land after Plan B** — Plan B retargets `scripts/economy-audit.mjs` to write `docs/ECONOMY_AUDIT_V03.md`, which Task 7 here regenerates. Plan C is independent of Plan A.

## Global Constraints

Copied from the spec's *Cross-cutting constraints*. Every task's requirements implicitly include this section.

- Domain logic stays pure and deterministic; React/CSS remains presentation (`ARCHITECTURE_INVARIANTS.md` rules 1, 2).
- `Math.random()` is forbidden in `src/game/**`; use `SeededRng` (invariant 4).
- Content is data-driven; generic behaviour composes from reusable effects with narrowly scoped `mechanicId`s (invariant 5). New relics reuse the existing `mechanicId` wiring pattern.
- Stable IDs (invariant 3). New content ids must not collide with anything a save can already reference: existing item ids are `patch-kit, pp-tonic, field-ration, energy-drink, power-snack, guard-patch, smoke-bomb, cleanser, revive-kit`; relic ids are `cardboard-plate, red-stitch, copper-trace, violet-thread, marked-card, sticky-label, first-aid-tape, bike-bearing, shop-chit, elite-bandage, spare-battery, lucky-centavo, blue-tonic-cap, pressed-flower`; event ids are `rain-stall, loose-crate, paper-shrine, night-cart, shortcut, old-locker, street-game, repair-bench, quiet-corner`.
- Save schema stays backward-compatible. The one addition (`ppPercent` on a pending spoils choice) is optional and defaults away, so v0.2 saves keep loading.
- Every animation honours both `@media (prefers-reduced-motion: reduce)` and the in-game Reduced Motion toggle (`.battle-screen.reduced-motion`).
- Motion budget (`DESIGN.md`): ~100–150 ms button response, ~250–450 ms common combat motion, only signature feedback approaches ~900 ms.
- Enemy intent stays hidden (invariant 11) — the boss signature flourish fires on `actionStart`, i.e. *after* commitment, never before.
- No new dependency, no Node version change. `package.json` `version` stays `"0.2.0"` (`tests/release/v02-ui.test.mjs` asserts it).
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` must pass, plus Playwright at every configured viewport.

## Repo facts the executor needs

1. `resolveItem` (`src/game/core/combat/battleEngine.ts`) handles `healPercent`, `healPartyPercent`, `status`, `cleanse`, `restorePP` and `revive`. There is **no damage branch** — Task 2 adds one.
2. `damageOne(state, actor, target, power, affinity, rng, events, opts?)` is module-private in the same file as `resolveItem`, so the thrown-item branch calls it directly. No export needed.
3. `damageOne` is the **only** knockout site — `sacrifice()` always passes `floorAtOne: true`. A KO-triggered relic therefore needs exactly one hook.
4. `targetIdsFor` already resolves `ally-all` to living allies only, so a party-PP item needs no new targeting code.
5. `RewardSpoilsChoice['id']` is a closed union `'cash'|'patch'|'scavenge'` in `src/game/core/types.ts`, and `src/services/save/schema.ts` validates spoils with an explicit field list (`id, label, description, coinBonus, healPercent, itemId`). Zod strips unlisted keys, so `ppPercent` must be added to the schema or it silently vanishes across a save/load.
6. `EventDefinition['theme']` is the closed union `'rain'|'crate'|'shrine'|'food'|'alley'|'locker'|'game'|'repair'|'quiet'`. `src/styles.css` already carries unused `.event-theme-market` and `.event-theme-danger` rules from an earlier build; Task 5 adopts those two names and adds only the matching `.scene-theme-*` rules.
7. `.is-revived` is already applied to `.unit-cutout-wrap` by `UnitFigure` but **has no CSS** — the revive-rise animation is a pure stylesheet addition.
8. `scripts/balance-audit.mjs` injects no items and no relics, so nothing in Plan C moves Plan B's balance numbers. Only the economy audit needs regenerating.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/game/content/items.ts` | Modify | Two new items + `damage` effect kind |
| `src/game/content/relics.ts` | Modify | Two new relics |
| `src/game/content/events.ts` | Modify | Two new events + two theme names |
| `src/game/core/types.ts` | Modify | `ppPercent` + `'ppcache'`; `signature` on `actionStart` |
| `src/game/core/combat/battleEngine.ts` | Modify | Item damage branch, two relic hooks, signature flag |
| `src/game/core/progression/rewards.ts` | Modify | PP Cache spoils generation + claim |
| `src/services/save/schema.ts` | Modify | Accept `ppPercent` on a persisted spoils choice |
| `src/features/battle/BattleScreen.tsx` | Modify | Status-stamp, guard, signature animation hooks |
| `src/features/reward/RewardScreen.tsx` | Modify | Reduced-motion class for the coin pop |
| `src/styles.css` | Modify | Five animations + two scene themes |
| `tests/domain/v03-content.test.mjs` | Create | Item damage, PP Cache, both relics |
| `tests/vitest/content.test.ts` | Modify | Raise the content-count floors |
| `tests/release/v03-ui.test.mjs` | Modify (or create) | Animation + reduced-motion assertions |

`tests/release/v03-ui.test.mjs` is created by Plan A Task 1. If Plan A has not landed, create it here with the same header block:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../../', import.meta.url);
const read = (...parts) => readFileSync(join(root.pathname, ...parts), 'utf8');
```

---

## Task 1: Party-PP item

The economy audit's standing finding is that PP attrition has no all-party answer. `restorePP` + `ally-all` already works end to end, so this is data only.

**Files:**
- Create: `tests/domain/v03-content.test.mjs`
- Modify: `src/game/content/items.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: item id `circuit-brew`. Task 7 re-prices it against the economy audit.

- [ ] **Step 1: Write the failing test**

Create `tests/domain/v03-content.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRng } from '../../.domain-build/core/rng/seededRng.js';
import { createBattle, resolveBattleCommand } from '../../.domain-build/core/combat/battleEngine.js';
import { getItem } from '../../.domain-build/content/items.js';

const party = ['earl','hans','leandre'];
const startBattle = (options = {}) => createBattle(party, 'normal-fastlane', new SeededRng(777), { coins: 30, ...options });

test('Circuit Brew restores PP to the lowest-PP move of every living ally', () => {
  const item = getItem('circuit-brew');
  assert.equal(item.target, 'ally-all');
  assert.equal(item.category, 'resource');

  const battle = startBattle();
  for (const id of battle.allies) {
    const unit = battle.units[id];
    for (const abilityId of Object.keys(unit.abilityPP)) unit.abilityPP[abilityId] -= 5;
  }
  const before = battle.allies.map(id => Object.values(battle.units[id].abilityPP).reduce((a, b) => a + b, 0));

  const actor = battle.units[battle.turnOrder[battle.turnIndex]];
  const next = resolveBattleCommand(battle, { kind:'item', actorId: actor.id, itemId:'circuit-brew', targetIds: [] }, new SeededRng(1)).nextState;

  const after = battle.allies.map(id => Object.values(next.units[id].abilityPP).reduce((a, b) => a + b, 0));
  after.forEach((total, index) => assert.ok(total > before[index], `ally ${index} gained no PP`));
});
```

If the seeded actor turns out not to be an ally, pick the first ally id instead — the assertion under test is the item's effect, not turn order.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/v03-content.test.mjs`
Expected: FAIL — `getItem('circuit-brew')` throws `Unknown item id: circuit-brew`.

- [ ] **Step 3: Add the item**

In `src/game/content/items.ts`, append to `ITEMS` after `cleanser`:

```ts
  {id:'circuit-brew',name:'Circuit Brew',description:'Restore 3 PP to the lowest-PP move of every living ally.',target:'ally-all',price:30,rarity:'uncommon',category:'resource',effects:[{kind:'restorePP',amount:3}]},
```

Priced against the existing curve: PP Tonic restores 4 PP to one ally for 16 coins (common); this restores 3 PP to three allies for 30 (uncommon). It slots into the `resource` category alongside PP Tonic, so `generateShopOffers`' category anchors need no change.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/v03-content.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/content/items.ts tests/domain/v03-content.test.mjs
git commit -m "feat(content): add Circuit Brew, the first all-party PP restore"
```

---

## Task 2: Throwable damage item

Gives buff/support characters a way to contribute damage. This one needs a new item effect kind and one branch in `resolveItem`.

**Files:**
- Modify: `src/game/content/items.ts`
- Modify: `src/game/core/combat/battleEngine.ts`
- Modify: `tests/domain/v03-content.test.mjs`

**Interfaces:**
- Consumes: `tests/domain/v03-content.test.mjs` from Task 1.
- Produces:
  - `ItemDefinition['effects']` gains the member `{kind:'damage'; power:number}`.
  - Item id `brick-in-a-sock`.

- [ ] **Step 1: Write the failing test**

Append to `tests/domain/v03-content.test.mjs`:

```js
test('Brick in a Sock damages one enemy at neutral affinity, so anyone can throw it', () => {
  const item = getItem('brick-in-a-sock');
  assert.deepEqual(item.effects, [{ kind:'damage', power:65 }]);
  assert.equal(item.target, 'enemy-one');
  assert.equal(item.battleOnly, true);

  const battle = startBattle();
  const actorId = battle.allies[0];
  battle.turnOrder = [actorId, ...battle.turnOrder.filter(id => id !== actorId)];
  battle.turnIndex = 0;
  const targetId = battle.enemies[0];
  const before = battle.units[targetId].hp;

  const { nextState, events } = resolveBattleCommand(
    battle, { kind:'item', actorId, itemId:'brick-in-a-sock', targetIds:[targetId] }, new SeededRng(9),
  );

  assert.ok(nextState.units[targetId].hp < before, 'the thrown item dealt no damage');
  const damage = events.find(event => event.type === 'damage' && event.targetId === targetId);
  assert.ok(damage, 'no damage event was emitted');
  assert.equal(damage.affinity, 'normal', 'a thrown object must never take an affinity multiplier');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/v03-content.test.mjs`
Expected: FAIL — `Unknown item id: brick-in-a-sock`.

- [ ] **Step 3: Widen the item effect union**

In `src/game/content/items.ts`, add the new member to `ItemDefinition['effects']`:

```ts
  effects: Array<
    | {kind:'healPercent'; percent:number}
    | {kind:'healPartyPercent'; percent:number}
    | {kind:'restorePP'; amount:number}
    | {kind:'status'; statusId:StatusId; duration:number}
    | {kind:'cleanse'; count:number}
    | {kind:'revive'; percentMaxHp:number}
    | {kind:'damage'; power:number}
  >;
```

- [ ] **Step 4: Add the item**

Append to `ITEMS`, after `circuit-brew`:

```ts
  {id:'brick-in-a-sock',name:'Brick in a Sock',description:'Throw for 65 power at one enemy. No affinity, no PP, anyone can use it.',target:'enemy-one',price:22,rarity:'common',category:'tactical',battleOnly:true,effects:[{kind:'damage',power:65}]},
```

- [ ] **Step 5: Resolve the effect**

In `src/game/core/combat/battleEngine.ts`, inside `resolveItem`'s effect loop, add a branch after the `revive` branch:

```ts
    else if(effect.kind==='damage'){for(const id of ids){const target=state.units[id];if(target?.alive)damageOne(state,actor,target,effect.power,'neutral',rng,events,{cannotMiss:true});}}
```

`'neutral'` is never advantaged or resisted, which is exactly the point — the item's value must not depend on who throws it. `cannotMiss` keeps a thrown object out of the accuracy system; a Blinded support character can still contribute.

Then teach the choreography picker about it, so the thrown item gets the ranged VFX rather than the `utility` default. In `choreographyForItem`, add above the final `return 'utility';`:

```ts
  if(item.effects.some(effect=>effect.kind==='damage'))return 'ranged';
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/v03-content.test.mjs`
Expected: 2/2 PASS.

- [ ] **Step 7: Run the whole suite**

Run: `pnpm typecheck && pnpm test`
Expected: pass. `BattleScreen.tsx`'s `itemTargetCandidates` already routes `enemy-one` items to living enemies, so the battle UI needs no change.

- [ ] **Step 8: Commit**

```bash
git add src/game/content/items.ts src/game/core/combat/battleEngine.ts tests/domain/v03-content.test.mjs
git commit -m "feat(content): add Brick in a Sock, a throwable damage item"
```

---

## Task 3: PP Cache spoils option

PP is the real sustain pressure, and the post-battle spoils offer only Cash / Patch Up / Scavenge.

**Files:**
- Modify: `src/game/core/types.ts`
- Modify: `src/game/core/progression/rewards.ts`
- Modify: `src/services/save/schema.ts`
- Modify: `tests/domain/v03-content.test.mjs`

**Interfaces:**
- Consumes: nothing from Tasks 1–2.
- Produces:
  - `RewardSpoilsChoice['id']` gains `'ppcache'`.
  - `RewardSpoilsChoice` gains `ppPercent?: number`.
  - `claimReward` signature unchanged; `appStore.claimRewardChoice(relicId?, upgrade?, spoilsId?)` unchanged.

- [ ] **Step 1: Write the failing test**

Append to `tests/domain/v03-content.test.mjs`:

```js
import { createRun } from '../../.domain-build/core/progression/run.js';
import { generateReward, claimReward } from '../../.domain-build/core/progression/rewards.js';

test('PP Cache restores a slice of missing party PP when claimed', () => {
  const run = createRun(party, 31337);
  run.party[0].abilityPP['knuckle-up'] = 2; // Earl: max 18, missing 16, +round(16*.10) = +2

  const reward = {
    tier:'normal', coins:0, relicChoices:[], upgradeChoices:[],
    spoilsChoices:[{ id:'ppcache', label:'PP Cache', description:'Restore 10% of missing PP across the party.', ppPercent:0.10 }],
  };
  const next = claimReward(run, reward, { spoilsId:'ppcache' });
  assert.equal(next.party[0].abilityPP['knuckle-up'], 4);
});

test('PP Cache is part of the normal spoils pool', () => {
  const run = createRun(party, 31337);
  const ids = new Set();
  for (let seed = 1; seed <= 200; seed += 1) {
    for (const choice of generateReward(run, 'normal', new SeededRng(seed), 'normal-fastlane').spoilsChoices) ids.add(choice.id);
  }
  assert.ok(ids.has('ppcache'), 'PP Cache never appeared in 200 seeded normal rewards');
  assert.ok(ids.has('cash') && ids.has('patch'), 'PP Cache must sit alongside the existing options, not replace them');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/v03-content.test.mjs`
Expected: FAIL — Earl's PP is unchanged (no `ppPercent` handling) and `ppcache` never appears.

- [ ] **Step 3: Widen the type**

In `src/game/core/types.ts`:

```ts
export interface RewardSpoilsChoice { id:'cash'|'patch'|'scavenge'|'ppcache'; label:string; description:string; coinBonus?:number; healPercent?:number; itemId?:string; ppPercent?:number }
```

- [ ] **Step 4: Offer it and claim it**

In `src/game/core/progression/rewards.ts`, add the third base option in `normalSpoils`:

```ts
  const choices:RewardSpoilsChoice[]=[
    {id:'cash',label:'Take the Cash',description:'Pocket 5 additional coins.',coinBonus:5},
    {id:'patch',label:'Patch Up',description:'Restore 5% Max HP to each living party member.',healPercent:0.05},
    {id:'ppcache',label:'PP Cache',description:'Restore 10% of missing PP across the party.',ppPercent:0.10},
  ];
```

`distinctPicks(choices,2,rng)` still offers exactly two, so the screen keeps its greed-versus-sustain shape — the pool is simply wider.

In `claimReward`'s spoils block, add a fourth branch after the `itemId` one:

```ts
    if(selected?.ppPercent){
      for(const member of run.party){
        const c=getCharacter(member.characterId);
        for(const id of c.abilities){
          const a=getAbility(id);
          const max=a.maxPP+(member.upgradedAbilities.includes(id)?a.upgrade.maxPPDelta??0:0);
          const missing=Math.max(0,max-member.abilityPP[id]);
          member.abilityPP[id]=Math.min(max,member.abilityPP[id]+Math.round(missing*selected.ppPercent*(run.relicIds.includes('blue-tonic-cap')?1.25:1)));
        }
      }
    }
```

The `blue-tonic-cap` multiplier matches every other PP-restoration site in the codebase (`rest.ts`, `events.ts`, `battleEngine.ts`).

- [ ] **Step 5: Let the save keep it**

In `src/services/save/schema.ts`, add `ppPercent` to the spoils object so Zod stops stripping it:

```ts
const reward=z.object({tier,coins:z.number(),itemId:z.string().optional(),relicChoices:z.array(z.string()),upgradeChoices:z.array(z.object({characterId:z.string(),abilityId:z.string()})),bossRecovery:z.boolean().optional(),spoilsChoices:z.array(z.object({id:z.string(),label:z.string(),description:z.string(),coinBonus:z.number().optional(),healPercent:z.number().optional(),itemId:z.string().optional(),ppPercent:z.number().optional()})).default([])});
```

The field is optional, so v0.2 saves with a pending reward still validate.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/v03-content.test.mjs && pnpm test`
Expected: all PASS, including `tests/domain/save.test.mjs`.

- [ ] **Step 7: Commit**

```bash
git add src/game/core/types.ts src/game/core/progression/rewards.ts src/services/save/schema.ts tests/domain/v03-content.test.mjs
git commit -m "feat(reward): add the PP Cache spoils option"
```

---

## Task 4: Two relics

One battle-start party-PP relic and one death-economy relic, both reusing the existing `mechanicId` pattern (a stable id in `relics.ts`, one guarded hook in `battleEngine.ts` keyed on `state.relicIds.includes(...)`).

**Files:**
- Modify: `src/game/content/relics.ts`
- Modify: `src/game/core/combat/battleEngine.ts`
- Modify: `tests/domain/v03-content.test.mjs`

**Interfaces:**
- Consumes: nothing from Tasks 1–3.
- Produces: relic ids `jumper-cable` and `chalk-outline`; battle flag `chalkOutlineUsed`.

- [ ] **Step 1: Write the failing test**

Append to `tests/domain/v03-content.test.mjs`:

```js
import { getRelic } from '../../.domain-build/content/relics.js';

test('Jumper Cable tops up each ally at battle start without exceeding max PP', () => {
  assert.equal(getRelic('jumper-cable').mechanicId, 'battle-start-pp');

  const persisted = createRun(party, 55).party.map(member => ({ ...member, abilityPP: { ...member.abilityPP } }));
  for (const member of persisted) for (const id of Object.keys(member.abilityPP)) member.abilityPP[id] -= 5;

  const plain = createBattle(party, 'normal-fastlane', new SeededRng(55), { coins:0, party: persisted });
  const withRelic = createBattle(party, 'normal-fastlane', new SeededRng(55), { coins:0, party: persisted, relicIds:['jumper-cable'] });

  const total = battle => battle.allies.reduce((sum, id) => sum + Object.values(battle.units[id].abilityPP).reduce((a, b) => a + b, 0), 0);
  assert.equal(total(withRelic) - total(plain), 3 * getRelic('jumper-cable').value);

  // A party already at full PP gains nothing: the relic must clamp at each move's max.
  const atMax = createBattle(party, 'normal-fastlane', new SeededRng(55), { coins:0 });
  const atMaxWithRelic = createBattle(party, 'normal-fastlane', new SeededRng(55), { coins:0, relicIds:['jumper-cable'] });
  assert.equal(total(atMaxWithRelic), total(atMax));
});

test('Chalk Outline pays out once for the first ally knocked out', () => {
  assert.equal(getRelic('chalk-outline').mechanicId, 'ko-coins');

  const battle = createBattle(party, 'normal-fastlane', new SeededRng(88), { coins:0, relicIds:['chalk-outline'] });
  const victim = battle.units[battle.allies[0]];
  victim.hp = 1;
  const enemyId = battle.enemies[0];
  battle.turnOrder = [enemyId, ...battle.turnOrder.filter(id => id !== enemyId)];
  battle.turnIndex = 0;

  // Drive the enemy turn until the ally falls, then assert the payout happened exactly once.
  let state = battle;
  let coins = 0;
  for (let i = 0; i < 12 && state.units[victim.id].alive; i += 1) {
    const actor = state.units[state.turnOrder[state.turnIndex]];
    if (actor.side !== 'ally') break;
    const result = resolveBattleCommand(state, { kind:'guard', actorId: actor.id }, new SeededRng(i + 1));
    state = result.nextState;
    coins += result.events.filter(event => event.type === 'coin').reduce((sum, event) => sum + event.amount, 0);
  }
  assert.ok(!state.units[victim.id].alive, 'the ally never fell; adjust the seed until it does');
  assert.equal(coins, getRelic('chalk-outline').value);
  assert.equal(state.flags.chalkOutlineUsed, true);
});
```

If the second test's ally never falls at seed 88, raise the enemy's damage by lowering `victim.hp` to 1 across a different seed until the KO occurs — the assertion under test is the once-only payout, not the specific seed.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/v03-content.test.mjs`
Expected: FAIL — `getRelic('jumper-cable')` throws `Unknown relic id: jumper-cable`.

- [ ] **Step 3: Add the relics**

In `src/game/content/relics.ts`, append to `RELICS`:

```ts
  {id:'jumper-cable',name:'Jumper Cable',description:'Each ally starts every battle with 2 extra PP on their lowest-PP move.',mechanicId:'battle-start-pp',value:2},
  {id:'chalk-outline',name:'Chalk Outline',description:'The first ally knocked out each battle leaves 15 coins behind.',mechanicId:'ko-coins',value:15},
```

`chalk-outline` fills the death half of the economy gap the way `lucky-centavo` fills the crit half: a once-per-battle, flag-guarded payout.

- [ ] **Step 4: Wire the battle-start PP**

In `src/game/core/combat/battleEngine.ts`, inside `createBattle`, directly after the existing `bike-bearing` line:

```ts
  if(state.relicIds.includes('bike-bearing')) for(const id of allies) units[id].speed=Math.round(units[id].speed*1.10);
  if(state.relicIds.includes('jumper-cable')) for(const id of allies) {
    const unit=units[id]; if(!unit.abilityPP) continue;
    const lowest=Object.keys(unit.abilityPP).sort((a,b)=>unit.abilityPP![a]-unit.abilityPP![b])[0];
    if(!lowest) continue;
    const ability=getAbility(lowest);
    const max=ability.maxPP+(unit.upgradedAbilities?.includes(lowest)?ability.upgrade.maxPPDelta??0:0);
    unit.abilityPP[lowest]=Math.min(max,unit.abilityPP[lowest]+2);
  }
```

Same lowest-PP selection rule as the `restorePP` effect, so the relic and the items behave consistently.

- [ ] **Step 5: Wire the KO payout**

In `damageOne`, replace the knockout line:

```ts
  const killed=wasAlive&&!target.alive;
  if(killed) {
    events.push({type:'knockout',targetId:target.id});
    if(target.side==='ally'&&state.relicIds.includes('chalk-outline')&&!state.flags.chalkOutlineUsed){
      state.flags.chalkOutlineUsed=true;state.availableCoins+=15;state.coinsDelta+=15;events.push({type:'coin',amount:15});
    }
  }
```

`damageOne` is the only KO site, so one hook covers ally KOs from every source — enemy moves, sentries and deployables alike.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/v03-content.test.mjs && pnpm test`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/game/content/relics.ts src/game/core/combat/battleEngine.ts tests/domain/v03-content.test.mjs
git commit -m "feat(content): add Jumper Cable and Chalk Outline relics"
```

---

## Task 5: Two events with new themes

Each is a real choice with cost, risk or opportunity cost — matching the decision-tension table in the economy audit.

**Files:**
- Modify: `src/game/content/events.ts`
- Modify: `src/styles.css`
- Modify: `scripts/economy-audit.mjs`
- Modify: `tests/vitest/content.test.ts`

**Interfaces:**
- Consumes: nothing from Tasks 1–4.
- Produces: event ids `bulk-deal` and `live-wire`; theme names `market` and `danger`.

- [ ] **Step 1: Write the failing test**

In `tests/vitest/content.test.ts`, raise the floors and pin the new content:

```ts
import { describe, expect, test } from 'vitest';
import { validateContent } from '../../src/game/content/contentRegistry';
import { CHARACTERS } from '../../src/game/content/characters';
import { ENEMIES } from '../../src/game/content/enemies';
import { EVENTS } from '../../src/game/content/events';
import { RELICS } from '../../src/game/content/relics';
import { ITEMS } from '../../src/game/content/items';

describe('release content registry', () => {
  test('contains the full v0.3 content set with no broken references', () => {
    expect(validateContent()).toEqual({ valid: true, errors: [] });
    expect(CHARACTERS).toHaveLength(11);
    expect(CHARACTERS.flatMap(character => character.abilities)).toHaveLength(44);
    expect(ENEMIES.length).toBeGreaterThanOrEqual(16);
    expect(EVENTS.length).toBeGreaterThanOrEqual(11);
    expect(RELICS.length).toBeGreaterThanOrEqual(16);
    expect(ITEMS.length).toBeGreaterThanOrEqual(11);
  });

  test('every v0.3 addition uses a fresh id and every event offers a real choice', () => {
    for (const id of ['circuit-brew', 'brick-in-a-sock']) expect(ITEMS.filter(item => item.id === id)).toHaveLength(1);
    for (const id of ['jumper-cable', 'chalk-outline']) expect(RELICS.filter(relic => relic.id === id)).toHaveLength(1);
    for (const id of ['bulk-deal', 'live-wire']) expect(EVENTS.filter(event => event.id === id)).toHaveLength(1);
    for (const event of EVENTS) {
      expect(event.choices.length).toBeGreaterThanOrEqual(2);
      expect(event.choices.some(choice => choice.effects.length > 0)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/vitest/content.test.ts`
Expected: FAIL — `EVENTS.length` is 9, and neither new event exists.

- [ ] **Step 3: Widen the theme union and add the events**

In `src/game/content/events.ts`, extend the theme union:

```ts
export interface EventDefinition { id:string; title:string; text:string; theme:'rain'|'crate'|'shrine'|'food'|'alley'|'locker'|'game'|'repair'|'quiet'|'market'|'danger'; choices:EventChoice[] }
```

Append to `EVENTS`:

```ts
  {id:'bulk-deal',title:'Bulk Deal',theme:'market',text:'A stallholder is packing up early and wants the shelf empty before dark.',choices:[
    {id:'buy',label:'Pay 20 coins for the crate',hint:'Spend 20 coins · gain 1 Field Ration and 1 PP Tonic if your pack has room.',resultText:'Two useful things and one hurried handshake.',effects:[{kind:'coins',amount:-20},{kind:'item',itemId:'field-ration'},{kind:'item',itemId:'pp-tonic'}]},
    {id:'help',label:'Help him pack instead',hint:'Gain 14 coins · no items.',resultText:'He pays you for the hour rather than the crate.',effects:[{kind:'coins',amount:14}]}
  ]},
  {id:'live-wire',title:'Live Wire',theme:'danger',text:'A cable hangs low across the path, still humming.',choices:[
    {id:'reroute',label:'Reroute it by hand',hint:'Lose 9% Max HP from each living ally · restore 30% of missing PP across the party.',resultText:'Everything charges. So do your hands.',effects:[{kind:'partyHpPercent',amount:-0.09},{kind:'restoreMissingPpPercent',amount:0.30}]},
    {id:'around',label:'Go the long way',hint:'Gain 7 coins · no risk.',resultText:'The detour passes a dropped purse.',effects:[{kind:'coins',amount:7}]}
  ]},
```

Both hints match what `applyEventChoice` actually does. `bulk-deal`'s paid branch is correctly gated by `canChooseEvent`: the 20-coin spend is refused below 20 coins, and the full-pack refusal applies because that branch's effects are only `item` plus a negative `coins` amount. `live-wire`'s HP cost floors at 1 (`partyHpPercent` uses `Math.max(1, …)`), so it can never kill an ally.

- [ ] **Step 4: Add the missing scene themes**

`.event-theme-market` and `.event-theme-danger` already exist in `src/styles.css`. Add the two matching scene backdrops next to the other `.scene-theme-*` rules:

```css
.scene-theme-market { background: linear-gradient(180deg,#5d6b58 0 42%,#7d6444 42% 63%,#211b16 63%)!important; }
.scene-theme-market .scene-layer.layer-mid { background: repeating-linear-gradient(90deg,#8d7048 0 54px,#5f4b31 54px 58px); }
.scene-theme-danger { background: radial-gradient(circle at 50% 30%,#7a4a3c 0 9%,#3a2620 50%,#181110 76%)!important; }
.scene-theme-danger .scene-layer.layer-mid { background: repeating-linear-gradient(72deg,transparent 0 22px,rgba(233,196,120,.28) 23px 26px,transparent 27px 44px); }
```

- [ ] **Step 5: Give the economy audit their tension notes**

In `scripts/economy-audit.mjs`, add two entries to `eventNotes` so the generated table has no `Two visible outcomes.` fallback:

```js
  'bulk-deal':'20 coins for two consumables versus 14 coins for none; the paid branch is disabled when coins are short or the pack is full.',
  'live-wire':'9% party HP for 30% missing-PP restoration versus a risk-free 7 coins. The HP cost cannot kill; it floors at 1.',
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm vitest run tests/vitest/content.test.ts && pnpm typecheck && pnpm test`
Expected: all PASS. `validateContent()` re-checks id uniqueness across every content family.

- [ ] **Step 7: Commit**

```bash
git add src/game/content/events.ts src/styles.css scripts/economy-audit.mjs tests/vitest/content.test.ts
git commit -m "feat(content): add the Bulk Deal and Live Wire events"
```

---

## Task 6: Five curated animations

All presentation. Each honours both `@media (prefers-reduced-motion: reduce)` and the in-game toggle, and each fits the motion budget: the four common ones sit in 250–450 ms, only the boss signature reaches ~900 ms.

**Files:**
- Modify: `src/game/core/types.ts`
- Modify: `src/game/core/combat/battleEngine.ts`
- Modify: `src/features/battle/BattleScreen.tsx`
- Modify: `src/features/reward/RewardScreen.tsx`
- Modify: `src/styles.css`
- Modify (or create, see File Structure): `tests/release/v03-ui.test.mjs`

**Interfaces:**
- Consumes: nothing from Tasks 1–5.
- Produces: `CombatEvent` `actionStart` gains `signature?: boolean`. CSS classes `is-status-stamp`, `is-guarding`, `is-revived` (already emitted), `signature`, `.reward-screen.reduced-motion`.

- [ ] **Step 1: Write the failing test**

Append to `tests/release/v03-ui.test.mjs`:

```js
const ANIMATIONS = ['status-stamp', 'guard-brace', 'revive-rise', 'boss-signature', 'coin-pop'];

test('the five v0.3 animations exist with real keyframes', () => {
  const css = read('src/styles.css');
  for (const name of ANIMATIONS) assert.match(css, new RegExp(`@keyframes ${name}\\b`), `missing @keyframes ${name}`);
  assert.match(css, /\.unit-cutout-wrap\.is-status-stamp \{[^}]*animation:\s*status-stamp/s);
  assert.match(css, /\.unit-cutout-wrap\.is-guarding \{[^}]*animation:\s*guard-brace/s);
  assert.match(css, /\.unit-cutout-wrap\.is-revived \{[^}]*animation:\s*revive-rise/s);
  assert.match(css, /\.battle-vfx-layer\.signature \{[^}]*animation:\s*boss-signature/s);
  assert.match(css, /\.reward-ledger strong \{[^}]*animation:\s*coin-pop/s);
});

test('every new animation is suppressed by both reduced-motion paths', () => {
  const css = read('src/styles.css');
  const media = css.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/g)?.join('\n') ?? '';
  const toggle = css.split('\n').filter(line => line.includes('reduced-motion') && !line.includes('@media')).join('\n');
  for (const selector of ['.is-status-stamp', '.is-guarding', '.is-revived', '.battle-vfx-layer.signature', '.reward-screen.reduced-motion']) {
    assert.ok(media.includes(selector) || toggle.includes(selector), `${selector} is not covered by a reduced-motion rule`);
  }
});

test('the boss signature flourish stays inside the ~900ms budget', () => {
  const css = read('src/styles.css');
  const block = css.match(/\.battle-vfx-layer\.signature \{[^}]*\}/s)?.[0] ?? '';
  const ms = Number(block.match(/animation:\s*boss-signature\s+calc\((\d+)ms/)?.[1]);
  assert.ok(ms > 0 && ms <= 900, `boss signature duration ${ms}ms must be within the 900ms budget`);
  assert.match(block, /var\(--anim-scale/, 'the flourish must scale with the 1x/2x/3x speed setting');
});

test('the boss signature flourish is driven by a committed action, never by intent', () => {
  const battle = read('src/features/battle/BattleScreen.tsx');
  assert.match(battle, /action\?\.signature|action\.signature/, 'the flourish reads the actionStart event');
  assert.doesNotMatch(battle, /nextMove|predictedTarget|intent/i, 'enemy intent must stay hidden');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/release/v03-ui.test.mjs`
Expected: all four new tests FAIL — none of the five keyframes exist.

- [ ] **Step 3: Flag boss signatures on the committed action**

In `src/game/core/types.ts`, add one optional field to the `actionStart` event:

```ts
  | { type: 'actionStart'; actorId: string; label: string; actionId?: string; choreography?: ChoreographyId; side?: Side; signature?: boolean }
```

In `src/game/core/combat/battleEngine.ts`, the enemy-turn emit already has the move in hand — add the flag:

```ts
  events.push({type:'actionStart',actorId:actor.id,label:move.name,actionId:move.id,choreography:move.choreography,side:'enemy',signature:move.signature===true&&state.tier==='boss'});
```

Restricting to `state.tier==='boss'` is what makes this the *boss* signature flourish; elite signature moves keep their normal choreography. Combat events are never persisted, so no save-schema change is needed.

- [ ] **Step 4: Add the four battle animation hooks**

In `src/features/battle/BattleScreen.tsx`, inside `UnitFigure`, next to the existing `hit`/`healed`/`revived` derivations:

```tsx
  const stamped=events.some(e=>e.type==='statusApplied'&&e.targetId===unit.id);const guarding=events.some(e=>e.type==='guard'&&e.actorId===unit.id);
```

and extend the wrap's class list — insert `${stamped?'is-status-stamp':''} ${guarding?'is-guarding':''}` immediately after `${healed?'is-healed':''}`:

```tsx
  const content=<><div className={`unit-cutout-wrap ${statusClass(unit)} ${unit.guardActive?'has-guard':''} ${hit?'is-hit':''} ${healed?'is-healed':''} ${stamped?'is-status-stamp':''} ${guarding?'is-guarding':''} ${revived?'is-revived':''} ${ko||!unit.alive?'is-ko':''} ${acting?'is-acting':''}`} data-pulse={pulse}>
```

In `BattleVfx`, add the signature class:

```tsx
  return <div className={`battle-vfx-layer choreo-${action.choreography??'utility'} ${action.signature?'signature':''}`} aria-hidden="true" key={`${action.actorId}:${action.actionId}`}>
```

- [ ] **Step 5: Give the reward screen its reduced-motion class**

In `src/features/reward/RewardScreen.tsx`, read the setting and put it on the root:

```tsx
  const settings=useAppStore(s=>s.settings);
```

```tsx
  return <main className={`screen reward-screen ${settings.reducedMotion?'reduced-motion':''}`}>
```

- [ ] **Step 6: Add the CSS**

In `src/styles.css`, next to the other battle animation rules:

```css
.unit-cutout-wrap.is-status-stamp { animation: status-stamp calc(300ms * var(--anim-scale,1)) ease-out; }
.unit-cutout-wrap.is-guarding { animation: guard-brace calc(380ms * var(--anim-scale,1)) cubic-bezier(.25,.8,.4,1); }
.unit-cutout-wrap.is-revived { animation: revive-rise calc(440ms * var(--anim-scale,1)) cubic-bezier(.2,.8,.3,1) both; }
.battle-vfx-layer.signature { animation: boss-signature calc(880ms * var(--anim-scale,1)) ease-out both; }
.reward-ledger strong { display: inline-block; animation: coin-pop calc(420ms * var(--anim-scale,1)) cubic-bezier(.2,.9,.3,1) both; }

@keyframes status-stamp { 0% { filter: brightness(1); transform: scale(1); } 22% { filter: brightness(1.9) contrast(1.2); transform: scale(1.06) rotate(-1.5deg); } 100% { filter: brightness(1); transform: scale(1); } }
@keyframes guard-brace { 0% { transform: translateY(0) scaleY(1); } 35% { transform: translateY(4px) scaleY(.94) scaleX(1.05); } 70% { transform: translateY(1px) scaleY(1.01); } 100% { transform: translateY(0) scaleY(1); } }
@keyframes revive-rise { 0% { opacity: .55; transform: rotate(11deg) translateY(8px); filter: grayscale(.9) brightness(.65); } 55% { opacity: 1; transform: rotate(-3deg) translateY(-6px) scale(1.04); filter: none; } 100% { opacity: 1; transform: none; filter: none; } }
@keyframes boss-signature { 0% { opacity: 0; transform: scale(.9); } 14% { opacity: 1; transform: scale(1.03); } 44% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1.06); } }
@keyframes coin-pop { 0% { opacity: 0; transform: translateY(9px) scale(.8) rotate(-4deg); } 58% { opacity: 1; transform: translateY(-3px) scale(1.09) rotate(1.5deg); } 100% { opacity: 1; transform: none; } }
```

`--anim-scale` is already `1` / `.5` / `.333` for the 1×/2×/3× setting, so every duration scales with the speed control. The revive-rise keyframe starts from exactly the `.is-ko` resting state (`rotate(11deg) translateY(8px)`, `grayscale(.9) brightness(.65)`, `opacity:.58`) so the stand-up reads as the reverse of the KO.

`.reward-ledger strong` renders the coin total and the found-item name — one pop per ledger entry on arrival, which is the reward/coin pop the spec asks for.

- [ ] **Step 7: Suppress them under both reduced-motion paths**

Extend the existing in-game toggle rule (the `.battle-screen.reduced-motion .unit-cutout-wrap.is-acting, …` list) to cover the new classes, and add the reward screen:

```css
.battle-screen.reduced-motion .unit-cutout-wrap.is-acting,
.battle-screen.reduced-motion .unit-cutout-wrap.is-hit,
.battle-screen.reduced-motion .unit-cutout-wrap.is-healed,
.battle-screen.reduced-motion .unit-cutout-wrap.is-status-stamp,
.battle-screen.reduced-motion .unit-cutout-wrap.is-guarding,
.battle-screen.reduced-motion .battle-vfx-layer.signature { animation: none; }
.battle-screen.reduced-motion .unit-cutout-wrap.is-revived { animation: none; opacity: 1; filter: none; transform: none; }
.reward-screen.reduced-motion .reward-ledger strong { animation: none; opacity: 1; transform: none; }
```

and add the same selectors to the second `@media (prefers-reduced-motion: reduce)` block (the one that already lists `.battle-vfx-layer i`):

```css
  .unit-cutout-wrap.is-status-stamp,
  .unit-cutout-wrap.is-guarding,
  .battle-vfx-layer.signature { animation: none !important; }
  .unit-cutout-wrap.is-revived { animation: none !important; opacity: 1; filter: none; transform: none; }
  .reward-screen.reduced-motion .reward-ledger strong,
  .reward-ledger strong { animation: none !important; opacity: 1; transform: none; }
```

Under reduced motion the revived unit must still *read* as revived — that is why `is-revived` resets opacity, filter and transform rather than only killing the animation. Without it, the unit would stay stuck in the KO look.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `node --test tests/release/v03-ui.test.mjs && pnpm typecheck && pnpm test`
Expected: all PASS.

- [ ] **Step 9: Verify by hand at every speed**

`pnpm dev`, start a run, and check each animation at 1×, 2× and 3× and then with Reduced Motion on:
1. **Status stamp** — apply Slow with Suppressing Fire; the target flashes as the chip appears.
2. **Guard pose** — press GUARD; the actor braces and settles.
3. **Revive rise** — use a Revive Kit on a KO'd ally; the figure stands back up out of the KO tilt.
4. **Boss signature** — reach a boss and wait for Table Flip / Enforcement Burst / Night Swell; the VFX layer flourishes for ~880 ms. Confirm nothing appears *before* the move is committed.
5. **Coin pop** — the reward screen's coin figure pops in on arrival.

With Reduced Motion on: no strong transforms, and every state — status applied, guarding, revived, coins awarded — still readable.

- [ ] **Step 10: Commit**

```bash
git add src/game/core/types.ts src/game/core/combat/battleEngine.ts src/features/battle/BattleScreen.tsx src/features/reward/RewardScreen.tsx src/styles.css tests/release/v03-ui.test.mjs
git commit -m "feat(motion): add status stamp, guard pose, revive rise, boss flourish and coin pop"
```

---

## Task 7: Economy re-audit and full verification

**Files:**
- Generated: `docs/ECONOMY_AUDIT_V03.md`
- Modify (only if the audit demands it): `src/game/content/items.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–6, plus Plan B's retargeted `scripts/economy-audit.mjs`.
- Produces: nothing consumed downstream.

- [ ] **Step 1: Regenerate the economy audit**

```bash
node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node scripts/economy-audit.mjs
```

If `scripts/economy-audit.mjs` still writes `docs/ECONOMY_AUDIT_V02.md`, Plan B has not landed — stop and land Plan B first rather than overwriting the v0.2 baseline.

- [ ] **Step 2: Check the audit against the spec's WS4 validation**

In `docs/ECONOMY_AUDIT_V03.md`:
- **Duplicate shelves must stay 0** for both the with-Leandre and without-Leandre samples. Two new items widen the pool, so this can only improve; a non-zero value means `pickUniqueItem` broke.
- **Average shop price** should not drift more than ~15% from the v0.2 figure. Circuit Brew at 30 is the most expensive uncommon; if the average jumps past that band, drop it to 26.
- **Rarity mix**: the new `common` (Brick in a Sock) and `uncommon` (Circuit Brew) should keep the common share dominant. If the uncommon share climbs more than 5 pp, reprice Circuit Brew rather than re-weighting `rarityWeight` — the weighting is shared with every other item.
- **Event decision table** must list Bulk Deal and Live Wire with the tension notes from Task 5 step 5, and no row may read `Two visible outcomes.`
- **Reward mix** must still read as a greed-versus-sustain choice — Cash, Patch Up, PP Cache and (when rolled) Scavenge, two offered at a time.

- [ ] **Step 3: Confirm inventory capacity still binds**

`BALANCE.inventoryCapacity` is 6 and is unchanged. Re-read the audit's capacity language and confirm nothing in the new content bypasses it: `circuit-brew` and `brick-in-a-sock` are ordinary inventory items, `bulk-deal` grants items through the capacity-checked `item` effect, and PP Cache grants no item at all.

- [ ] **Step 4: Run every gate**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
```

Expected: all green across every configured Playwright viewport.

- [ ] **Step 5: Confirm Plan B's balance numbers still stand**

`scripts/balance-audit.mjs` injects no items and no relics, so Plan C cannot move them. Confirm by diffing: re-run `node scripts/balance-audit.mjs` and check `docs/BALANCE_AUDIT_V03.md` is byte-identical to the version Plan B committed. If it is not, something in Task 2, 4 or 6 changed combat resolution and must be fixed.

- [ ] **Step 6: Point the README at the new content**

Update whichever README section lists item / relic / event counts to the new totals (11 items, 16 relics, 11 events). Do not remove the `v0.2` / `Combat & UX Polish` wording — `tests/release/v02-ui.test.mjs` matches on it.

- [ ] **Step 7: Commit**

```bash
git add docs/ECONOMY_AUDIT_V03.md README.md src/game/content/items.ts
git commit -m "docs: regenerate the v0.3 economy audit for the new content"
```

---

## Self-review notes

- **Spec coverage.** WS4 items (party-PP, throwable damage) → Tasks 1–2. WS4 reward (PP Cache) → Task 3. WS4 relics (battle-start PP, death/crit economy) → Task 4. WS4 events → Task 5. WS4 validation (content tests + economy re-audit, no shelf duplication, capacity holds, greed-vs-sustain intact) → Tasks 5 and 7. WS5 animations 1–5 → Task 6, with the reduced-motion and 1×/2×/3× checks in steps 7–9.
- **Deviation from the spec, flagged.** The spec says "add 1–2 events with new themes". The two new theme names, `market` and `danger`, are new to the `EventDefinition` union but already have `.event-theme-*` CSS on disk from an earlier build — Task 5 adopts them and adds only the two missing `.scene-theme-*` backdrops. That is the smaller change and the visual result is the same as inventing fresh names.
- **Deterministic resolution.** The only combat-resolution changes are the item damage branch (Task 2) and the two relic hooks (Task 4), all inside `SeededRng`-driven code paths with no `Math.random()`. The animation work adds a flag to an event that is never persisted and CSS that never touches state — invariant 7 holds: animations own no authoritative game state.
- **Naming consistency.** `circuit-brew`, `brick-in-a-sock`, `jumper-cable`, `chalk-outline`, `bulk-deal`, `live-wire`, `ppcache`, `ppPercent`, `battle-start-pp`, `ko-coins`, `chalkOutlineUsed`, `is-status-stamp`, `is-guarding`, `is-revived`, `signature`, and the keyframe names `status-stamp` / `guard-brace` / `revive-rise` / `boss-signature` / `coin-pop` are used identically in every task above.
