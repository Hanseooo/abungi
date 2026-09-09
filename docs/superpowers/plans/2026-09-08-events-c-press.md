# Events C: The Press Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans`, single-threaded, with checkbox tracking. Read Parts A and B before implementation.

**Goal:** Recycle one owned Common relic through a safe exchange or clearly disclosed destructive gamble.

**Architecture:** Extend B's atomic selection with one relic ID. Build output eligibility from real relic definitions and ownership, resolve randomness only at commit, and reuse EventScreen's confirmation flow.

**Tech Stack:** Existing TypeScript, React, Node domain tests, Vitest and Playwright.

**Spec:** [Events specification](../specs/2026-09-08-events-transformation-run-variety.md), sections 7.2, 11, 13 slice 3 and 14. Depends on Spec 01 relic rarity.

## Global constraints

- “Accept Common relics only.”
- “The press can never output Rare.”
- “Uncommon and Rare relics cannot be pressed or exchanged.”
- “Display destruction prominently and confirm before commit.”
- “Existing saves load unchanged. This specification introduces no new persisted field and no schema version bump.”
- Retain free Leave, original event RNG transaction ownership, B's validation-before-mutation, and A's project constraints.

## Prerequisite and concrete tuning decision

The current working tree already has `RelicDefinition.rarity: ItemRarity`, eight Common definitions and the Rare tier. Do not implement those again. Before C1 run the existing relic/domain tests and inspect `relicDrafts.ts` ownership/character rules. “Present in a dirty tree” is not proof that Spec 01 slice 3 passed verification.

The spec does not say what a 45% Uncommon or 35% Common roll does when that output pool is empty. Proposed no-waste rule: disable Risk the press unless both pools have at least one eligible result, with a visible reason. This retains exact 45/35/20 odds. Safe exchange only needs a Common result. Do not silently reroll, promote to Rare, or turn missing stock into extra destruction. Record acceptance of this rule before execution.

## Files

| Task | Existing production files | Tests |
|---|---|---|
| C1 | `src/game/content/events.ts`, `src/game/core/progression/events.ts` | `tests/domain/events.test.mjs` |
| C2 | `src/features/event/EventScreen.tsx`, `src/styles.css`, `src/game/content/scenes.ts` | `tests/e2e/abungi.spec.ts`, `tests/vitest/eventCommit.test.ts` |

No new files. C extends B's existing contract, not a separate press API.

### C1: Common-only eligibility and outcome

**Acceptance:** Safe exchange removes exactly one chosen Common and awards a different unowned Common. Risk yields 45% Uncommon, 35% Common, 20% destruction, never Rare or the sacrificed ID. Invalid or exhausted selections spend nothing and consume zero RNG.

**Interfaces:** Extend `EventSelection` with `{kind:'pressRelic';relicId:string}`. Extend `EventEffect` with `{kind:'pressRelic';mode:'safe'|'risk'}`. `applyEventChoice` and `canChooseEvent` retain B's widened signatures. Private `pressPools(run:RunState,relicId:string)` returns `{common:RelicDefinition[];uncommon:RelicDefinition[]}`. Do not export it for tests.

**Content:** Add `the-press`, title “The Press”, theme `press`, category `transmutation`, weight .5. Text “The rollers flatten old promises into something else.” Choices `safe` (“Safe exchange”), `risk` (“Risk the press”), `leave` (“Leave”). Only these effect modes, no input rarity configuration.

- [ ] Run `pnpm test:domain` and inspect existing `tests/domain/relicDrafts.test.mjs`. If the prerequisite fails, report its actual failure and pause only C, continuing independent D planning/execution as authorized.
- [ ] Add a main domain test using real `createRun` state with an owned `cardboard-plate`, and a real generated press node. Safe exchange must leave the original input intact, remove cardboard-plate in the result, keep total relic count, and add an unowned Common. Also sample fixed real RNG seeds to exercise each risky branch and assert ownership/count: a destruction result has exactly one fewer relic and unchanged non-relic resources. Record one fixed seed per branch after discovering it using the actual RNG, not a mocked roll.
- [ ] Add a critical failure test selecting `blue-tonic-cap` as input. `canChooseEvent` denies and `applyEventChoice` throws before changing input/RNG. Use the same failure test to verify exhausted permitted stock does not become Rare output.
- [ ] Run `pnpm test:domain` red before adding effects. Implement pools from `RELICS`, excluding every currently owned ID and the selected input explicitly. Preserve the known character gate: `spare-battery` is eligible only with Hans. Do not call `drawRelicIds` with a combat source because those weights do not express press probabilities.
- [ ] Validate selected ownership and `getRelic(id).rarity === 'common'`. For entry without selection, check whether any owned Common can satisfy the mode. Reasons: “Need an owned Common relic.”, “No unowned Common relic is available.”, “No unowned Uncommon relic is available.” With selection, repeat the precise check before mutation.
- [ ] Resolve only after all validation:

```ts
let outputId:string|undefined;
if (effect.mode === 'safe') {
  outputId = rng.pick(common).id;
} else {
  const roll = rng.next();
  if (roll < .45) outputId = rng.pick(uncommon).id;
  else if (roll < .80) outputId = rng.pick(common).id;
}
run.relicIds.splice(run.relicIds.indexOf(selection.relicId),1);
if (outputId) run.relicIds.push(outputId);
```

Result text names both sacrificed and awarded relic, or explicitly says the input was destroyed. This uses effect-specific draws under A's proposed one-commit interpretation. If literal one-draw behavior was chosen, revise this algorithm before execution. Keep profile discovery through the existing store logic.
- [ ] Run `pnpm test:domain`, `pnpm test:vitest`, `pnpm typecheck`. Checkpoint C1. Suggested commit: `feat: exchange and press Common relics`.

Concrete C1 pair, appended to A's test file with `getRelic` imported from `../../.domain-build/content/relics.js`:

```js
test('event safe press replaces one Common with a different unowned Common', () => {
  const run=runAtEvent('the-press');
  run.relicIds=['cardboard-plate'];
  const before=structuredClone(run);
  const result=applyEventChoice(run,'the-press','safe',new SeededRng(5),
    {kind:'pressRelic',relicId:'cardboard-plate'});
  assert.equal(result.run.relicIds.length,1);
  assert.notEqual(result.run.relicIds[0],'cardboard-plate');
  assert.equal(getRelic(result.run.relicIds[0]).rarity,'common');
  assert.deepEqual(run,before);
});

test('event press rejects Rare input before consuming RNG', () => {
  const run=runAtEvent('the-press');
  run.relicIds=['blue-tonic-cap'];
  const before=structuredClone(run);
  const rng=new SeededRng(5);
  const rngBefore=rng.serialize();
  assert.throws(() => applyEventChoice(run,'the-press','risk',rng,
    {kind:'pressRelic',relicId:'blue-tonic-cap'}),/Common/i);
  assert.deepEqual(run,before);
  assert.deepEqual(rng.serialize(),rngBefore);
});
```

### C2: Explicit destruction confirmation

**Acceptance:** Only owned Common inputs can be selected. Safe and risk outcomes are understandable before Confirm. Cancel leaves the entire run unchanged. Reload cannot retry a resolved roll.

- [ ] Add one main browser flow selecting Risk the press, reading its input name and “20%: destroyed” before confirming, then reload and assert that same committed relic outcome. Add one cancellation/focus failure path. Use a real engine-produced event save and real relic definitions at the storage boundary. Run `pnpm test:e2e --grep 'event'` red.
- [ ] Extend B's local steps with `press-input` and the shared `confirm`. Show the owned Common name, rarity and description. Show Safe's guaranteed different Common outcome. Risk must list “45%: unowned Uncommon”, “35%: different unowned Common”, “20%: your selected relic is destroyed”. When a mode lacks stock, use C1's visible, focusable reason.
- [ ] Keep the selected input highlighted through confirmation. Confirm text is “Confirm exchange” or “Confirm risky press”, and Back/Cancel follow B's focus restoration. Do not display a supposed output before the commit because this is an outcome, not a derived offer.
- [ ] Use `.event-theme-press` with the existing theatre shapes. Skip optional roller animation initially, show the result directly. This satisfies reduced-motion behavior without another timeline. Add arrival variants “One relic enters. Read the odds before you pull the lever.” and “The rollers do not promise to give anything back.”
- [ ] Extend `tests/vitest/eventCommit.test.ts` to cover the real store press action once, then a replay after parsing the persisted save. Assert no second RNG draw, removal, score increment or discovery update on replay. Keep the save repository as the only mocked boundary.
- [ ] Run `pnpm test:e2e --grep 'event'`, `pnpm test:vitest`, `pnpm test:release`, `pnpm typecheck`. Checkpoint C2. Suggested commit: `feat: confirm destructive relic pressing`.

## Slice exit

Record correctness separately from balance. D's audit owns press usage on live versus dead affinity relics, outcomes by rarity and destruction rates. Do not infer acceptable destruction risk from a passing probability test. Proceed to [Part D](2026-09-08-events-d-recruitment-validation.md).
