# Abungi v0.2 Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a strategic, readable, more game-like v0.2 with sequential combat presentation, information overlays, visible statuses/deployables, stronger route/reward/shop decisions, boss affinity variants, and short seeded theatre scenes.

**Architecture:** Keep game rules pure TypeScript and data-driven. Extend existing domain events/content schemas, add a presentation-only combat director and global overlay/scene layers in React, then rebalance only after deterministic simulations.

**Tech Stack:** Node 22, pnpm, React 19, TypeScript, Vite 8, Zustand, Zod, Vitest/Node domain tests, Playwright, DOM/CSS/SVG.

**Spec:** `docs/superpowers/specs/2026-09-07-abungi-v02-combat-ux-design.md`

## Global Constraints
- No Phaser/canvas game engine or large UI framework.
- No `Math.random()` in game-domain logic.
- Stable IDs, not display-name branching.
- Boss intent remains hidden until action commitment.
- Boss affinity is secret until battle intro.
- Cutscenes are skippable/replay-friendly.
- Same status does not stack intensity.
- Preserve responsive 390x844, 768x1024, 1024x768, 1440x900 layouts.

---

### Task 1: Domain schema and deterministic content
**Files:** modify `src/game/core/types.ts`; create `src/game/content/guide.ts`, `src/game/content/scenes.ts`; modify characters/enemies/items/events.
- [ ] Add failing tests for rarity, scene determinism, choreography metadata and boss affinity pools.
- [ ] Add stable metadata and seeded scene/dialogue resolver.
- [ ] Run domain tests green.

### Task 2: Boss affinity and battle-event readability
**Files:** modify `battleEngine.ts`, enemy content/tests.
- [ ] Add failing tests that boss affinity is seeded, saved in state, limited to allowed pools and stable for same seed.
- [ ] Add source/action metadata to combat events and explicit deployable trigger/phase events.
- [ ] Keep authored move affinities unchanged.
- [ ] Run battle tests green.

### Task 3: Items and status semantics
**Files:** modify `items.ts`, `actions.ts`, `battleEngine.ts` and tests.
- [ ] Add tests for Power Snack, Guard Patch, Revive Kit and full item legality.
- [ ] Verify same-status refresh/no-intensity stacking and two-turn semantics.
- [ ] Implement revive target handling without allowing post-defeat resurrection.
- [ ] Run item/status tests green.

### Task 4: Routes, rewards, events and shops
**Files:** modify route/rewards/events/shop content/core and tests.
- [ ] Add route tests requiring meaningful pre-boss combat and recovery while forbidding elite chains.
- [ ] Pay normal fights from encounter enemy reward ranges.
- [ ] Rework dominant event choices into visible-cost/seeded-risk tradeoffs.
- [ ] Curate unique shop shelves, rarity weighting, price variance and Leandre extra offer.
- [ ] Run progression tests and route Monte Carlo audit.

### Task 5: Overlay and guide UX
**Files:** create overlay components/Guide; modify app store/App/GameHeader/Party/Battle/Shop/Event.
- [ ] Add overlay state so Settings/Guide/details do not replace the gameplay screen.
- [ ] Add move/passive/status/item/enemy detail sheets with hover/focus + tap access.
- [ ] Add browser-facing regression for Settings return behavior.

### Task 6: Combat Director and battlefield effects
**Files:** create `features/battle/combatDirector.ts`, presentation components; modify BattleScreen/styles.
- [ ] Sequence event batches by actions at 1x/2x/3x.
- [ ] Show committed enemy move names before effects.
- [ ] Add reusable choreography families, multi-hit timing, affinity/crit feedback and status apply/expire feedback.
- [ ] Render persistent Hans deployables with trigger animations and Overclock state.
- [ ] Preserve reduced-motion alternative.

### Task 7: Theatre scenes and lore
**Files:** create scene overlay/screen and content; modify store transitions.
- [ ] Add post-party departure, region entrance, elite intro, boss intro/reveal, shop/event arrival accents and region-complete scenes.
- [ ] Add seeded dialogue variants and relationship-aware Jonlow/Jiro and Klyde/Earl variants without name branching.
- [ ] Make scenes short and skippable; do not replay the same blocking intro repeatedly in one run.

### Task 8: Responsive polish and balance audit
**Files:** styles, tests, balance constants only if evidence supports changes.
- [ ] Test four required viewports and keyboard/touch interactions.
- [ ] Simulate all 165 parties across normal/elite/boss content and compare encounter rounds/survival/value.
- [ ] Adjust only evidenced outliers; re-run simulations after each balance change.

### Task 9: Verification and package
**Files:** docs/tests/package artifacts.
- [ ] Run domain/release/type/lint/build/Playwright where environment permits.
- [ ] Audit unfinished-marker strings, Math.random usage, display-name branching, and package contents.
- [ ] Extract ZIP to a fresh directory and rerun dependency-free verification before delivery.
