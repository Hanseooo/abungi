# Abungi v0.3 — Plan B: Region Revive + Balance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** End the boss death-spiral by reviving KO'd allies at region completion, ease bosses just enough to move the boss-tier win rate out of its 62.5% hole, and nudge the balance outliers (Michael, Yeeho, Daboy, Leandre) toward the ~82% mean band — every change validated by re-running the 7,920-battle deterministic audit.

**Architecture:** Pure-domain only. Two files carry the mechanic (`src/game/balance/constants.ts`, `src/game/core/progression/rewards.ts`); the tuning changes are numbers in `constants.ts`, `characters.ts` and `enemies.ts`. No React, no CSS, no save-schema change. The audit scripts get a one-line output-path change so v0.2 numbers survive as the baseline next to the new v0.3 report.

**Tech Stack:** TypeScript 5.8 compiled to `.domain-build` via `tsconfig.domain.json`, `node:test` for domain tests, `scripts/balance-audit.mjs` and `scripts/economy-audit.mjs` for the deterministic sims.

**Spec:** `docs/superpowers/specs/2026-09-07-abungi-v03-polish-design.md` (WS3)

**Sibling plans:** Plan A (`2026-09-07-abungi-v03-a-mobile-color.md`), Plan C (`2026-09-07-abungi-v03-c-content-animation.md`). Plan B is independent of Plan A. Plan C's economy work must land **after** Plan B, because Plan B renames the audit outputs to the V03 files that Plan C regenerates.

## Global Constraints

Copied from the spec's *Cross-cutting constraints*. Every task's requirements implicitly include this section.

- Domain logic stays pure and deterministic (`ARCHITECTURE_INVARIANTS.md` rule 1). No React, DOM, IndexedDB or audio imports under `src/game/`.
- `Math.random()` is forbidden in `src/game/**` — `scripts/release-audit.mjs` fails the build on it. Use `SeededRng` (invariant 4).
- Frequently tuned multipliers live in `src/game/balance/constants.ts`, not scattered through components (invariant 6).
- Save schema unchanged. `regionReviveHpPercent` is a balance constant, not persisted state — add no save field.
- No new dependency, no schema-breaking change, no Node version change (`engines.node` stays `22.x`).
- `package.json` `version` stays `"0.2.0"`. `tests/release/v02-ui.test.mjs` asserts it; the spec does not ask for a bump.
- `docs/BALANCE_AUDIT_V02.md` and `docs/ECONOMY_AUDIT_V02.md` must remain on disk — `tests/release/v02-ui.test.mjs` requires both.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` must pass, plus Playwright at the four (five, after Plan A) required viewports.

## Baseline (docs/BALANCE_AUDIT_V02.md, 7,920 battles)

Every gate in this plan is measured against these exact numbers.

| Tier | Win rate | Avg rounds | Avg survivors | Ending HP |
|---|---:|---:|---:|---:|
| normal | 92.7% | 3.94 | 2.46 | 62.6% |
| elite | 80.8% | 6.05 | 1.83 | 42.4% |
| boss | 62.5% | 9.26 | 1.34 | 29.1% |

Overall 82.2% wins, 5.80 average rounds. Mean character-inclusion win rate 82.2%.

| Character | Overall | Boss |
|---|---:|---:|
| Nathaniel | 90.0% | 80.0% |
| Yatords | 88.4% | 70.7% |
| Greg | 88.3% | 72.8% |
| Earl | 82.6% | 58.9% |
| Hans | 81.1% | 73.9% |
| Jiro | 80.5% | 59.4% |
| Leandre | 80.1% | 53.7% |
| Marcus | 79.8% | 60.6% |
| Daboy | 78.6% | 51.9% |
| Yeeho | 77.8% | 47.2% |
| Michael | 76.8% | 58.1% |

**Prior leader max: Nathaniel 90.0%.** No change may push any character above it.

## Acceptance gates

Derived from the spec's guardrail ("brings outliers toward the ~82% mean band without pushing leaders past it"; "no change ships if it pushes a leader above the prior max or leaves an outlier unchanged").

| Gate | Target |
|---|---|
| G1 Boss tier win rate | 68.0%–75.0% (was 62.5%) |
| G2 Boss tier avg rounds | ≤ 9.26 (no slower) |
| G3 Boss tier ending HP | ≥ 33.0% (was 29.1%) |
| G4 Michael overall | ≥ 79.0% (was 76.8%) |
| G5 Yeeho boss | ≥ 55.0% (was 47.2%) |
| G6 Daboy boss | ≥ 57.0% (was 51.9%) |
| G7 Leandre boss | ≥ 58.0% (was 53.7%) |
| G8 Leader ceiling | no character overall > 90.0% |
| G9 Normal + elite tiers | within ±3.0 pp of baseline (92.7% / 80.8%) |

## Repo facts the executor needs

1. `claimReward` in `src/game/core/progression/rewards.ts` is a pure `RunState → RunState` function. It has **no event channel**. The spec asks for `revive` + `heal` events at region clear; there is nowhere to emit them and no consumer. Task 1 does not add one — see the flagged deviation in Self-review notes.
2. The `bossRecovery` block currently heals only `if(member.hp>0)`, so KO'd allies stay dead for the rest of the run (Revive Kit is `battleOnly`).
3. `scripts/balance-audit.mjs` injects **no items and no relics**, so Plan C's new content is invisible to it. Plan B's numbers stand after Plan C lands.
4. Both audit scripts import from `.domain-build/`, which only exists after `tsc -p tsconfig.domain.json`. The full audit command is in Task 2.
5. `scripts/release-audit.mjs` counts abilities with `/ability\(\{ id:/g` and expects exactly 44, and characters with `/\{ id:'[^']+', displayName:/g` expecting exactly 11. Editing stats and powers inside those objects keeps both counts intact.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/game/balance/constants.ts` | Modify | `regionReviveHpPercent`; boss HP multiplier |
| `src/game/core/progression/rewards.ts` | Modify | Region revive inside the `bossRecovery` block |
| `src/game/content/characters.ts` | Modify | Michael, Yeeho, Daboy, Leandre tuning numbers |
| `src/game/content/enemies.ts` | Modify | Boss signature powers (conditional, Task 4) |
| `scripts/balance-audit.mjs` | Modify | Write `docs/BALANCE_AUDIT_V03.md`; v0.3 title |
| `scripts/economy-audit.mjs` | Modify | Write `docs/ECONOMY_AUDIT_V03.md`; v0.3 title |
| `tests/domain/v03.test.mjs` | Create | Region-revive behaviour |
| `docs/BALANCE_AUDIT_V03.md` | Generated | New audit output |
| `docs/ECONOMY_AUDIT_V03.md` | Generated | New audit output |
| `docs/BALANCE_DELTAS_V03.md` | Create | Before/after table + which changes shipped |

---

## Task 1: Region revive

**Files:**
- Create: `tests/domain/v03.test.mjs`
- Modify: `src/game/balance/constants.ts`
- Modify: `src/game/core/progression/rewards.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `BALANCE.regionReviveHpPercent: 0.25`. `claimReward(run, reward, choice)` keeps its exact existing signature and return type (`RunState`).

**Behaviour being built.** On a boss reward claim (`reward.bossRecovery === true`), in this order:
1. Allies at `hp <= 0` are revived to `round(maxHp * regionReviveHpPercent)`, floored at 1.
2. Allies that were alive **before** step 1 receive the existing `bossRecoveryHpPercent` heal. Revived allies do not — the spec says they "enter the next region alive but low".
3. Every ally, revived included, receives the existing `+25% of missing PP` restoration (still multiplied by 1.25 when the run holds `blue-tonic-cap`).

- [ ] **Step 1: Write the failing test**

Create `tests/domain/v03.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../../.domain-build/core/progression/run.js';
import { claimReward } from '../../.domain-build/core/progression/rewards.js';
import { BALANCE } from '../../.domain-build/balance/constants.js';

const bossReward = { tier:'boss', coins:0, relicChoices:[], upgradeChoices:[], bossRecovery:true, spoilsChoices:[] };

test('region clear revives KO allies to 25% Max HP without giving them the survivor heal', () => {
  assert.equal(BALANCE.regionReviveHpPercent, 0.25);
  const run = createRun(['earl','hans','leandre'], 4242);
  run.party[0].hp = 0;    // Earl,    maxHp 110 -> revived to round(110*.25) = 28
  run.party[1].hp = 40;   // Hans,    maxHp  92 -> 40 + round(92*.30) = 68
  run.party[2].hp = 100;  // Leandre, maxHp 100 -> already full, stays 100

  const next = claimReward(run, bossReward);

  assert.equal(next.party[0].hp, 28, 'KO ally revived to 25% Max HP, not 25% + 30%');
  assert.equal(next.party[1].hp, 68, 'living ally keeps the existing 30% survivor heal');
  assert.equal(next.party[2].hp, 100, 'full-HP ally is still capped at Max HP');
});

test('a revived ally also receives the boss PP restoration', () => {
  const run = createRun(['earl','hans','leandre'], 4242);
  run.party[0].hp = 0;
  run.party[0].abilityPP['knuckle-up'] = 2; // max 18, missing 16, +round(16*.25) = +4

  const next = claimReward(run, bossReward);

  assert.equal(next.party[0].abilityPP['knuckle-up'], 6);
});

test('a non-boss reward never revives anyone', () => {
  const run = createRun(['earl','hans','leandre'], 4242);
  run.party[0].hp = 0;
  const next = claimReward(run, { tier:'normal', coins:0, relicChoices:[], upgradeChoices:[], spoilsChoices:[] });
  assert.equal(next.party[0].hp, 0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/v03.test.mjs`
Expected: FAIL — first assertion trips because `BALANCE.regionReviveHpPercent` is `undefined`, and Earl stays at `hp: 0`.

- [ ] **Step 3: Add the constant**

In `src/game/balance/constants.ts`, add directly below `bossRecoveryMissingPpPercent: 0.25,`:

```ts
  regionReviveHpPercent: 0.25,
```

- [ ] **Step 4: Implement the revive**

In `src/game/core/progression/rewards.ts`, replace the `if(reward.bossRecovery){ … }` block with:

```ts
  if(reward.bossRecovery){
    const survivorIds=new Set(run.party.filter(member=>member.hp>0).map(member=>member.characterId));
    for(const member of run.party){
      const c=getCharacter(member.characterId);
      if(member.hp<=0)member.hp=Math.max(1,Math.round(c.stats.maxHp*BALANCE.regionReviveHpPercent));
      else if(survivorIds.has(member.characterId))member.hp=Math.min(c.stats.maxHp,member.hp+Math.round(c.stats.maxHp*BALANCE.bossRecoveryHpPercent));
      for(const id of c.abilities){
        const a=getAbility(id);
        const max=a.maxPP+(member.upgradedAbilities.includes(id)?a.upgrade.maxPPDelta??0:0);
        const missing=max-member.abilityPP[id];
        member.abilityPP[id]=Math.min(max,member.abilityPP[id]+Math.round(missing*BALANCE.bossRecoveryMissingPpPercent*(run.relicIds.includes('blue-tonic-cap')?1.25:1)));
      }
    }
  }
```

`survivorIds` is captured before the loop mutates anything, so a revived ally never falls through into the survivor heal.

- [ ] **Step 5: Run the test to verify it passes**

Run: `node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node --test tests/domain/v03.test.mjs`
Expected: 3/3 PASS.

- [ ] **Step 6: Run the whole domain suite**

Run: `pnpm test`
Expected: all pass. If `tests/domain/progression.test.mjs` has a boss-recovery assertion that now sees a revived ally, update that expectation to the new behaviour — the new behaviour is the requirement.

- [ ] **Step 7: Commit**

```bash
git add src/game/balance/constants.ts src/game/core/progression/rewards.ts tests/domain/v03.test.mjs
git commit -m "feat(progression): revive KO allies at 25% Max HP on region clear"
```

---

## Task 2: Point the audits at v0.3 outputs and capture the post-revive baseline

The revive changes nothing the balance sim measures (it simulates single encounters, not runs), so this run confirms the refactor is inert and gives a clean pre-tuning reference in the new file.

**Files:**
- Modify: `scripts/balance-audit.mjs`
- Modify: `scripts/economy-audit.mjs`
- Generated: `docs/BALANCE_AUDIT_V03.md`, `docs/ECONOMY_AUDIT_V03.md`

**Interfaces:**
- Consumes: Task 1's domain changes.
- Produces: `docs/BALANCE_AUDIT_V03.md` and `docs/ECONOMY_AUDIT_V03.md`; Tasks 3–6 re-run the same command and read the same files.

- [ ] **Step 1: Retarget the balance audit**

In `scripts/balance-audit.mjs`, change the report title and the output path. The title line is inside the first `md = \`# Abungi v0.2 Character Balance Audit …\`` template:

```js
let md=`# Abungi v0.3 Character Balance Audit\n\nGenerated from the deterministic game engine with ${records.length.toLocaleString()} battles: all 165 three-character parties × 12 encounters × ${seeds.length} deterministic seeds. The policy is a conservative heuristic that uses healing, statuses, deployables, multi-target attacks and signatures; it is diagnostic, not a substitute for human playtesting. No consumable items or relics are injected, and Leandre begins encounters with 30 coins so Clearance Sale can be represented without unlimited economy.\n\n## Global pacing\n\n| Tier | Win rate | Avg rounds | Avg survivors | Ending HP |\n|---|---:|---:|---:|---:|\n`;
```

and the write at the bottom:

```js
mkdirSync('docs',{recursive:true});writeFileSync('docs/BALANCE_AUDIT_V03.md',md);
```

- [ ] **Step 2: Retarget the economy audit**

In `scripts/economy-audit.mjs`, change `# Abungi v0.2 Route & Economy Audit` to `# Abungi v0.3 Route & Economy Audit` in the first `md` template, and the final write to:

```js
writeFileSync('docs/ECONOMY_AUDIT_V03.md',md);
```

Leave `docs/BALANCE_AUDIT_V02.md` and `docs/ECONOMY_AUDIT_V02.md` in place — `tests/release/v02-ui.test.mjs` requires them, and they are the historical baseline this plan measures against.

- [ ] **Step 3: Run both audits**

```bash
node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node scripts/balance-audit.mjs && node scripts/economy-audit.mjs
```

Expected: `docs/BALANCE_AUDIT_V03.md` and `docs/ECONOMY_AUDIT_V03.md` are written. The balance run takes several minutes (7,920 simulated battles).

- [ ] **Step 4: Confirm the revive is inert for the encounter sim**

Compare `docs/BALANCE_AUDIT_V03.md` against the baseline table at the top of this plan. Every tier and character figure must be **identical** — the sim never calls `claimReward`. If any number moved, stop: something in Task 1 leaked into combat and must be fixed before tuning starts.

- [ ] **Step 5: Commit**

```bash
git add scripts/balance-audit.mjs scripts/economy-audit.mjs docs/BALANCE_AUDIT_V03.md docs/ECONOMY_AUDIT_V03.md
git commit -m "chore(audit): emit v0.3 audit reports alongside the v0.2 baseline"
```

---

## Task 3: Michael nudge

Michael is the single "directionally low" outlier at 76.8% (mean 82.2%). The spec's proposal: Max HP 96→104, Suppressing Fire power 55→60.

**Files:**
- Modify: `src/game/content/characters.ts`
- Generated: `docs/BALANCE_AUDIT_V03.md`

**Interfaces:**
- Consumes: Task 2's audit pipeline.
- Produces: no new names.

- [ ] **Step 1: Apply both changes**

In `src/game/content/characters.ts`, Michael's stats line — `maxHp:96` becomes `maxHp:104`:

```ts
  { id:'michael', displayName:'Michael', affinity:'tech', role:'Soldier / reliable ranged damage', stats:{maxHp:104,power:110,guard:84,speed:100}, passive:{id:'steady-aim',name:'Steady Aim',description:"Michael's first damaging skill each battle cannot miss and deals 10% extra damage."}, abilities:['rifle-burst','grenade','suppressing-fire','rally'], assetId:'character-michael' },
```

and Suppressing Fire's damage effect — `power: 55` becomes `power: 60`:

```ts
  ability({ id:'suppressing-fire', name:'Suppressing Fire', affinity:'tech', maxPP:7, target:'enemy-one', accuracy:95, description:'Damage and Slow for 2 turns.', effects:[{kind:'damage', power:60, target:'enemy-one', accuracy:95},{kind:'status', target:'enemy-one', statusId:'slow', duration:2, accuracy:95}], upgrade:{description:'Slow lasts 3 turns.', durationDelta:1} }),
```

The ability's `description` states no number, so no copy edit is needed.

- [ ] **Step 2: Re-run the audit**

```bash
node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node scripts/balance-audit.mjs
```

- [ ] **Step 3: Check gate G4 and the ceiling**

Read `docs/BALANCE_AUDIT_V03.md`:
- **G4:** Michael overall ≥ 79.0%. If he is still under, raise Max HP one more step to 110 and re-run once. If he overshoots past 84.0%, roll Suppressing Fire back to 58 and re-run.
- **G8:** no character overall above 90.0%. Michael appears in 45 of the 165 parties, so this change lifts other characters' averages slightly — confirm Nathaniel has not crossed 90.0%.
- **G9:** normal and elite tier win rates within ±3.0 pp of 92.7% / 80.8%.

Record the resulting Michael figure; Task 6 tabulates it.

- [ ] **Step 4: Run the domain suite**

Run: `pnpm test`
Expected: pass. If a domain test pins Michael's Max HP or Suppressing Fire's damage, update it to the new value.

- [ ] **Step 5: Commit**

```bash
git add src/game/content/characters.ts docs/BALANCE_AUDIT_V03.md
git commit -m "balance: raise Michael Max HP to 104 and Suppressing Fire to 60 power"
```

---

## Task 4: Boss ease, smallest change first

Bosses sit at 62.5% wins / 9.26 rounds / 29.1% ending HP. The spec offers two levers and says to "pick the smaller set of changes that hits target". This task applies the single-number lever first and only reaches for the second if the gates are still red.

**Files:**
- Modify: `src/game/balance/constants.ts`
- Modify (conditionally): `src/game/content/enemies.ts`
- Generated: `docs/BALANCE_AUDIT_V03.md`

**Interfaces:**
- Consumes: Task 3's audit state.
- Produces: no new names. `BALANCE.enemyTierHpMultiplier.boss` changes value only.

- [ ] **Step 1: Apply lever 1 — boss HP multiplier 1.55 → 1.50**

In `src/game/balance/constants.ts`:

```ts
  enemyTierHpMultiplier: { normal: 1.85, elite: 1.45, boss: 1.50 },
```

- [ ] **Step 2: Re-run the audit**

```bash
node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node scripts/balance-audit.mjs
```

- [ ] **Step 3: Evaluate the boss gates**

From the *Global pacing* table in `docs/BALANCE_AUDIT_V03.md`:
- **G1** boss win rate in 68.0%–75.0%
- **G2** boss avg rounds ≤ 9.26
- **G3** boss ending HP ≥ 33.0%
- **G9** normal within ±3.0 pp of 92.7%, elite within ±3.0 pp of 80.8% (this lever touches only the boss tier, so elite/normal must be unmoved)

If all four hold, **skip steps 4 and 5** — lever 1 alone is the smaller change and the task is done. Go to step 6.

- [ ] **Step 4: Only if a boss gate is still red — apply lever 2, the signature power trim**

The spec's proposal is ~10% off each boss all-target signature. In `src/game/content/enemies.ts`:

```ts
    move({id:'table-flip',name:'Table Flip',affinity:'might',target:'enemy-all',effects:[{kind:'damage',power:52,target:'enemy-all'}],weight:2,cooldown:2,condition:'self-below-half',signature:true})
```

```ts
    move({id:'enforcement-burst',name:'Enforcement Burst',affinity:'tech',target:'enemy-all',effects:[{kind:'damage',power:54,target:'enemy-all'}],weight:3,cooldown:2,condition:'self-below-35',signature:true})
```

```ts
    move({id:'night-swell',name:'Night Swell',affinity:'mystic',target:'enemy-all',effects:[{kind:'damage',power:45,target:'enemy-all'}],weight:2,cooldown:2,condition:'always',signature:true})
```

(58→52, 60→54, 50→45; each is a 10% trim rounded to a whole number.)

- [ ] **Step 5: Re-run and re-evaluate**

```bash
node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node scripts/balance-audit.mjs
```

Re-check G1–G3 and G9. If boss win rate now **overshoots** above 75.0%, revert `enemyTierHpMultiplier.boss` to `1.55` and keep only the signature trim, then re-run once more. Ship whichever of the three configurations (HP only / powers only / both) is the smallest set that clears G1–G3.

- [ ] **Step 6: Confirm the leader ceiling**

**G8:** no character overall win rate above 90.0% in `docs/BALANCE_AUDIT_V03.md`. Easing bosses lifts everyone's boss column; Nathaniel starts at 90.0% overall and 80.0% on boss, so he is the binding constraint. If he crosses 90.0%, back the boss ease down one notch (`boss: 1.52`, or revert one of the three signature trims) and re-run.

- [ ] **Step 7: Run the domain suite**

Run: `pnpm test`
Expected: pass. If a domain test pins a boss's Max HP or a signature move's power, update it to the shipped value.

- [ ] **Step 8: Commit**

```bash
git add src/game/balance/constants.ts src/game/content/enemies.ts docs/BALANCE_AUDIT_V03.md
git commit -m "balance: ease bosses to lift the boss-tier win rate out of the death spiral"
```

Note in the commit body which levers actually shipped.

---

## Task 5: Weak-vs-boss touches, measured after the boss ease

Yeeho 47.2%, Daboy 51.9% and Leandre 53.7% on boss. The boss ease from Task 4 lifts all three; only whoever is still below their gate gets a touch. The spec is explicit: light single touches, no kit rework.

**Files:**
- Modify: `src/game/content/characters.ts`
- Generated: `docs/BALANCE_AUDIT_V03.md`

**Interfaces:**
- Consumes: Task 4's shipped boss configuration and audit.
- Produces: no new names.

- [ ] **Step 1: Read the current boss column**

From `docs/BALANCE_AUDIT_V03.md` as regenerated at the end of Task 4, note the boss win rate for Yeeho, Daboy and Leandre. Apply a touch below **only** for those still under their gate (G5 ≥ 55.0%, G6 ≥ 57.0%, G7 ≥ 58.0%). Applying a touch to a character already past their gate would over-tune and risks G8.

- [ ] **Step 2: Yeeho — Max HP 90 → 96, if G5 is red**

His kit spends HP (`all-in` sacrifices 20% current HP; a poor `double-down` costs 12% Max HP), which is what bleeds him out across a 9-round boss fight. One stat, no kit change:

```ts
  { id:'yeeho', displayName:'Yeeho', affinity:'trick', role:'Gambler / calculated risk', stats:{maxHp:96,power:104,guard:78,speed:108}, passive:{id:'house-edge',name:'House Edge',description:'The first poor Double Down outcome each battle refunds 1 PP.'}, abilities:['loaded-dice','double-down','safe-bet','all-in'], assetId:'character-yeeho' },
```

- [ ] **Step 3: Daboy — On the Rocks 50 → 58 power, if G6 is red**

His only damage-plus-control move, and the one he leans on in long fights:

```ts
  ability({ id:'on-the-rocks', name:'On the Rocks', affinity:'trick', maxPP:7, target:'enemy-one', description:'58 power and Slow for 2 turns.', effects:[{kind:'damage', power:58, target:'enemy-one'},{kind:'status', target:'enemy-one', statusId:'slow', duration:2}], upgrade:{description:'Slow lasts 3 turns.', durationDelta:1} }),
```

The `description` states the number, so it is updated in the same edit (display copy is content — invariant 3).

- [ ] **Step 4: Leandre — Scatter 20 → 23 power per hit, if G7 is red**

Against a lone boss all four hits land on the same target, so this is the cleanest single-boss lever in his kit:

```ts
  ability({ id:'scatter', name:'Scatter', affinity:'trick', maxPP:16, target:'random-enemy', description:'Four random 23-power hits; a lone enemy takes all four.', effects:[{kind:'damage', power:23, hits:4, target:'random-enemy'}], upgrade:{description:'Each hit rises to 27 power.', powerDelta:4} }),
```

Both descriptions are updated to match the new numbers.

- [ ] **Step 5: Re-run the audit**

```bash
node scripts/clean-domain-build.mjs && npx tsc -p tsconfig.domain.json && node scripts/balance-audit.mjs
```

- [ ] **Step 6: Check every gate**

G1–G9 must all hold simultaneously in the final `docs/BALANCE_AUDIT_V03.md`. If a touch overshoots (a character's overall win rate climbing past the 82.2% mean by more than 4.5 pp, or G8 breaking), halve it — Yeeho to 93 Max HP, Daboy to 54 power, Leandre to 22 power — and re-run once.

- [ ] **Step 7: Run the domain suite**

Run: `pnpm test`
Expected: pass. Update any domain test that pins a changed stat or power.

- [ ] **Step 8: Commit**

```bash
git add src/game/content/characters.ts docs/BALANCE_AUDIT_V03.md
git commit -m "balance: light single touches for the weakest boss performers"
```

Name in the commit body which of the three touches actually shipped.

---

## Task 6: Record the deltas and verify

**Files:**
- Create: `docs/BALANCE_DELTAS_V03.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: the final `docs/BALANCE_AUDIT_V03.md`.
- Produces: nothing consumed downstream.

- [ ] **Step 1: Write the delta record**

Create `docs/BALANCE_DELTAS_V03.md` with the v0.2 → v0.3 comparison. Fill every `<…>` from the final `docs/BALANCE_AUDIT_V03.md`; leave no placeholder in the committed file.

```markdown
# Abungi v0.3 Balance Deltas

Baseline: `docs/BALANCE_AUDIT_V02.md` (7,920 battles). Result: `docs/BALANCE_AUDIT_V03.md` (same 7,920-battle harness, same seeds).

## Changes shipped

| Change | From | To | Rationale |
|---|---|---|---|
| Region revive (`regionReviveHpPercent`) | — | 0.25 | KO'd allies rejoin the run after a boss instead of staying dead |
| Michael Max HP | 96 | 104 | Weakest character at 76.8% |
| Suppressing Fire power | 55 | 60 | Same |
| `enemyTierHpMultiplier.boss` | 1.55 | <shipped value or "unchanged"> | Boss tier at 62.5% wins |
| Table Flip power | 58 | <shipped value or "unchanged"> | Same |
| Enforcement Burst power | 60 | <shipped value or "unchanged"> | Same |
| Night Swell power | 50 | <shipped value or "unchanged"> | Same |
| Yeeho Max HP | 90 | <shipped value or "unchanged"> | 47.2% vs bosses |
| On the Rocks power | 50 | <shipped value or "unchanged"> | 51.9% vs bosses |
| Scatter power per hit | 20 | <shipped value or "unchanged"> | 53.7% vs bosses |

## Tier pacing

| Tier | v0.2 win | v0.3 win | v0.2 rounds | v0.3 rounds | v0.2 ending HP | v0.3 ending HP |
|---|---:|---:|---:|---:|---:|---:|
| normal | 92.7% | <…> | 3.94 | <…> | 62.6% | <…> |
| elite | 80.8% | <…> | 6.05 | <…> | 42.4% | <…> |
| boss | 62.5% | <…> | 9.26 | <…> | 29.1% | <…> |

## Character inclusion

| Character | v0.2 overall | v0.3 overall | v0.2 boss | v0.3 boss |
|---|---:|---:|---:|---:|
| Nathaniel | 90.0% | <…> | 80.0% | <…> |
| Yatords | 88.4% | <…> | 70.7% | <…> |
| Greg | 88.3% | <…> | 72.8% | <…> |
| Earl | 82.6% | <…> | 58.9% | <…> |
| Hans | 81.1% | <…> | 73.9% | <…> |
| Jiro | 80.5% | <…> | 59.4% | <…> |
| Leandre | 80.1% | <…> | 53.7% | <…> |
| Marcus | 79.8% | <…> | 60.6% | <…> |
| Daboy | 78.6% | <…> | 51.9% | <…> |
| Yeeho | 77.8% | <…> | 47.2% | <…> |
| Michael | 76.8% | <…> | 58.1% | <…> |

## Gates

| Gate | Target | Result | Pass |
|---|---|---:|---|
| G1 boss win | 68.0%–75.0% | <…> | <…> |
| G2 boss rounds | ≤ 9.26 | <…> | <…> |
| G3 boss ending HP | ≥ 33.0% | <…> | <…> |
| G4 Michael overall | ≥ 79.0% | <…> | <…> |
| G5 Yeeho boss | ≥ 55.0% | <…> | <…> |
| G6 Daboy boss | ≥ 57.0% | <…> | <…> |
| G7 Leandre boss | ≥ 58.0% | <…> | <…> |
| G8 leader ceiling | ≤ 90.0% | <…> | <…> |
| G9 normal/elite drift | ±3.0 pp | <…> | <…> |

## Region revive, not covered by this audit

The encounter simulator resolves single battles and never calls `claimReward`, so the revive does not appear in any figure above. Its effect is run-level: a party that loses a member before a boss now enters the next region three-strong at low HP instead of two-strong. Verified by `tests/domain/v03.test.mjs`; it needs human playtesting to judge feel.
```

- [ ] **Step 2: Point the README at the new audits**

Add the two new files to whichever list in `README.md` already names `docs/BALANCE_AUDIT_V02.md` and `docs/ECONOMY_AUDIT_V02.md`, keeping the v0.2 entries as the baseline. Do not remove the `v0.2` / `Combat & UX Polish` wording — `tests/release/v02-ui.test.mjs` matches on it.

- [ ] **Step 3: Run every gate**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
```

Expected: all green. `pnpm lint` re-checks that no `TODO`/`TBD`/`FIXME` marker reached `src/` or `scripts/`, and that the domain still uses no `Math.random()`.

- [ ] **Step 4: Commit**

```bash
git add docs/BALANCE_DELTAS_V03.md README.md
git commit -m "docs: record the v0.3 balance deltas against the v0.2 audit baseline"
```

---

## Self-review notes

- **Spec coverage.** Region revive + `regionReviveHpPercent` → Task 1. Michael → Task 3. Boss ease (both proposed levers) → Task 4. Weak-vs-boss trio → Task 5. Guardrail (re-run `pnpm test` + audits, record before/after deltas, no leader past the prior max, no outlier left unchanged) → Tasks 2–6 and the G1–G9 gate table.
- **Deviation from the spec, flagged.** The spec asks the revive to emit `revive` + `heal` events. `claimReward` is a pure `RunState → RunState` function with no event channel and no consumer for one; adding a return-shape change would be an API change (and a save-schema question) serving nothing that exists. It is not built. Plan C's revive-rise animation is driven by the existing battle-time `revive` `CombatEvent`, which Revive Kit already emits — so the animation still ships and still plays. If a future region-clear scene needs the animation, that is the moment to add the channel.
- **Ordering rationale.** Task 4 measures before Task 5 deliberately: the boss ease lifts every character's boss column, so touching Yeeho/Daboy/Leandre first would stack two corrections and risk G8.
- **Naming consistency.** `regionReviveHpPercent`, `bossRecoveryHpPercent`, `bossRecoveryMissingPpPercent`, `enemyTierHpMultiplier.boss`, `claimReward`, `docs/BALANCE_AUDIT_V03.md`, `docs/ECONOMY_AUDIT_V03.md`, `docs/BALANCE_DELTAS_V03.md` are used identically throughout.
