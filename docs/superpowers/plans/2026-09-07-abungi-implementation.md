# Abungi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, playable, offline-capable Abungi PWA implementing the complete v0.1 specification, including all 11 characters, deterministic three-character JRPG combat, three-region route progression, rewards/economy, save/resume, responsive cardboard-theatre UI, local audio, and release verification.

**Architecture:** Clean Architecture Lite. `src/game/**` is pure TypeScript and owns deterministic combat, content, progression, route generation, and serialization rules; React only renders semantic game regions and dispatches commands. Stable IDs, generic effects, centralized balance, a serializable PRNG, and a `SaveRepository` port keep content and infrastructure replaceable.

**Tech Stack:** Node 22.x, pnpm, React 19, TypeScript, Vite 8, vite-plugin-pwa, Zustand, Zod, Vitest, Playwright, DOM/CSS/SVG, IndexedDB.

**Spec:** `docs/ABUNGI_SPEC.md`

## Global Constraints

- Node.js 22.x, minimum 22.12; do not migrate to Node 24.
- `packageManager` records the actual pnpm release used and `engines.node` is `22.x`.
- Static Vite application; Vercel is a deployment target, never a game-logic dependency.
- Game rules are pure TypeScript and never depend on React or IndexedDB.
- No `Math.random()` in deterministic game-domain logic.
- Display names and shop names are content, never IDs or behavior switches.
- Exactly three unique characters are selected from all 11 playable characters.
- Each character has the specified four moves, PP, passive, stats, and distinctive mechanics.
- HP/PP persist through battles; Guard is always a PP-free legal action.
- Enemies never reveal upcoming moves or predicted target/damage.
- Portrait mobile is canonical, but 768×1024, 1024×768, and 1440×900 are first-class layouts.
- Primary presentation uses local DOM/CSS/SVG assets, local audio, accessible interaction states, reduced motion, and no dashboard/glassmorphism/emoji game art.
- Saves are IndexedDB-backed, versioned, validated, migrated, and include active combat plus RNG state.
- The installed/offline production build must function without remote runtime assets.

---

### Task 1: Repository baseline, docs, and deterministic core contracts

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/game/core/types.ts`, `src/game/core/rng/seededRng.ts`, `src/game/balance/constants.ts`
- Create: `README.md`, `DESIGN.md`, `ARCHITECTURE_INVARIANTS.md`, `docs/ART_BIBLE.md`, `docs/ASSET_GENERATION_GUIDE.md`, `docs/ASSET_MANIFEST.md`, `scripts/assets/fetch_assets.py`
- Test: `src/game/core/rng/seededRng.test.ts`

**Interfaces:**
- Produces `SeededRng` with serializable `{seed,state}` and deterministic `next()`, `int()`, `pick()`, `chance()`.
- Produces stable shared combat/content/save types consumed by every later task.

- [ ] Write deterministic RNG tests first, including serialize/restore parity, and run them to confirm the missing implementation fails.
- [ ] Implement the minimal PRNG and core types; rerun the focused test to green.
- [ ] Add runtime/build configuration, PWA manifest configuration, design tokens, docs, asset manifest format, and safe standard-library fetch script.
- [ ] Run TypeScript/static checks available in the environment.

### Task 2: Data-driven content registry for characters, abilities, statuses, enemies, items, relics, and events

**Files:**
- Create: `src/game/content/characters.ts`, `abilities.ts`, `enemies.ts`, `items.ts`, `relics.ts`, `events.ts`, `shops.ts`, `contentRegistry.ts`, `schemas.ts`
- Test: `src/game/content/contentRegistry.test.ts`

**Interfaces:**
- Produces stable content lookup by ID and validated definitions for all 11 characters, 44 moves, 10 normal enemies, 3 elites, 3 bosses, >=12 relics, item set, and >=8 events.
- Ability definitions compose generic effects (`damage`, `heal`, `status`, `cleanse`, `multiHit`, `spendCoins`, `grantCoins`, `summon`, `restorePP`, `sacrificeHP`) plus narrow mechanic IDs where genuinely required.

- [ ] Write failing completeness/uniqueness tests covering 11×4 moves, display-name independence, required enemies/bosses, relic/event minimums, and content IDs.
- [ ] Enter the exact roster stats/passives/move names/PP/effects from the specification, plus enemy/item/relic/event/shop definitions.
- [ ] Add runtime content validation and rerun completeness tests.

### Task 3: Combat formulas, affinities, statuses, turn order, and action legality

**Files:**
- Create: `src/game/core/combat/affinity.ts`, `damage.ts`, `status.ts`, `turnOrder.ts`, `actions.ts`
- Test: `src/game/core/combat/combatRules.test.ts`

**Interfaces:**
- Produces affinity multipliers, damage/heal calculations, status ticking, speed-modified next-round order, PP/coin/target legality, Guard modifier, KO/victory/defeat predicates.

- [ ] Write failing tests for the full affinity cycle, damage variance/crit with deterministic RNG, Guard, Blind, healing cap, PP spend/0-PP rejection, Speed changes affecting the next round, status duration, KO and outcome detection.
- [ ] Implement minimal pure functions using only centralized balance values.
- [ ] Refactor shared modifiers only after the full focused suite is green.

### Task 4: Character-specific mechanics and generic effect resolution

**Files:**
- Create: `src/game/core/effects/resolveEffects.ts`, `src/game/core/combat/mechanics.ts`, `src/game/core/combat/battleReducer.ts`
- Test: `src/game/core/combat/characterMechanics.test.ts`

**Interfaces:**
- Produces `resolvePlayerAction(state, command) -> {nextState, events}` and registered mechanic handlers keyed by mechanic/effect IDs, never display names.

- [ ] Write failing seeded tests for Earl First Responder/Yosi Blind, Greg coin bonuses, Michael Steady Aim, Marcus Bulkhead, Hans deployable slots/duration/Overclock, Yeeho bounded outcomes/refund/self-damage, Jiro/Daboy duration extension, Nathaniel health-risk/lifedrain, Yatords Momentum/Breakaway, and Leandre shop/coin mechanics.
- [ ] Implement generic effect resolution and narrow registered mechanic handlers until tests pass.
- [ ] Add rapid-command/input-lock guard at the state-machine boundary and verify duplicate command rejection.

### Task 5: Enemy AI, encounters, and complete battle loop

**Files:**
- Create: `src/game/core/combat/enemyAi.ts`, `encounters.ts`, `battleEngine.ts`
- Test: `src/game/core/combat/battleEngine.test.ts`

**Interfaces:**
- Produces legal weighted enemy choices with repetition constraints, encounter setup, automatic enemy turns, boss phases/summons, and complete round progression.

- [ ] Write failing tests proving AI chooses only legal actions, does not require intent exposure, respects heal/summon thresholds and signature repetition limits, and Warden phases trigger once.
- [ ] Implement 10 normal archetypes, Broker/Ironclad/Night Maw, Jonlow/Klyde/Warden encounter behaviors.
- [ ] Simulate deterministic representative encounters and tune centralized HP/power/reward scaling toward 3–6 normal, 4–7 elite, and 6–10 boss rounds without HP sponges.

### Task 6: Three-region run, route safety, rewards, shop/rest/event progression, upgrades, and meta profile

**Files:**
- Create: `src/game/core/progression/run.ts`, `route.ts`, `rewards.ts`, `economy.ts`, `events.ts`, `profile.ts`
- Test: `src/game/core/progression/progression.test.ts`

**Interfaces:**
- Produces seeded connected region graphs, node resolution, reward choices, relic/skill-upgrade application, six-slot inventory, shop offers with Leandre bonus, rest Recover/Refresh, event effects, boss transitions, run victory/defeat and profile statistics.

- [ ] Write failing route property tests for connectivity, boss reachability, recovery opportunity, no unavoidable elite chain, and deterministic generation.
- [ ] Write failing economy/reward/rest/event tests including Leandre extra offer, item capacity, upgrade-at-most-once, boss recovery and three-region completion.
- [ ] Implement progression functions and rerun deterministic tests.

### Task 7: Versioned IndexedDB save repository and app coordination

**Files:**
- Create: `src/services/save/SaveRepository.ts`, `indexedDbSaveRepository.ts`, `schema.ts`, `migrations.ts`, `src/app/appStore.ts`, `appState.ts`
- Test: `src/services/save/save.test.ts`

**Interfaces:**
- Produces version-1 save envelopes `{schemaVersion,timestamp,revision,payload}`, validation/migration, active battle/RNG persistence, friendly corruption result, and Zustand application commands that autosave committed transitions.

- [ ] Write failing serialization, validation, v1 migration, corruption, revision and RNG/battle-resume tests.
- [ ] Implement repository port plus IndexedDB adapter with memory fallback for tests.
- [ ] Wire state coordination so action resolution is authoritative before animation and save commits follow meaningful transitions.

### Task 8: Handcrafted-cardboard asset system, local audio, and reusable motion choreography

**Files:**
- Create: `src/services/assets/assetRegistry.ts`, `src/services/audio/audioEngine.ts`, `src/ui/components/CutoutArt.tsx`, `src/ui/motion/battleMotion.ts`, local SVG assets under `src/assets/**`, local WAV assets under `public/audio/**`
- Test: `src/services/assets/assetRegistry.test.ts`, `src/services/audio/audioEngine.test.ts`

**Interfaces:**
- Produces stable asset IDs for replaceable cutouts/backgrounds, local audio cues/music with master/music/SFX controls and mobile unlock, and event-to-animation choreography independent of combat outcome.

- [ ] Write failing asset lookup/fallback and audio graceful-degradation preference tests.
- [ ] Create distinct SVG/cardboard silhouettes/props for all player/enemy/elite/boss identities plus region/title scenes; no emoji or avatar circles.
- [ ] Generate lightweight original local SFX/music WAVs and wire audio unlock/settings.
- [ ] Implement transform/opacity choreography for lunge, projectile, hit/heavy hit, heal, buff/debuff, summon, defeat, critical, multi-hit, victory, hit-stop/wobble/damage numbers and reduced-motion/1×/2×/3× settings.

### Task 9: React game screens and responsive battle UX

**Files:**
- Create/modify: `src/main.tsx`, `src/app/App.tsx`, feature components under `src/features/{title,party-select,route,battle,reward,shop,rest,event,results,settings}/`, shared UI under `src/ui/**`, CSS modules/global tokens.
- Test: component/integration tests where local tooling allows; Playwright specs in `tests/e2e/abungi.spec.ts`.

**Interfaces:**
- Produces all 10 required screens with semantic battle regions (`enemyStage`, `allyStage`, `battleHUD`, `actionTray`, `combatMessage`, `utilityControls`) and command flows into the pure game/app layers.

- [ ] Build title/continue/new-run and exactly-three party selection with full roster previews.
- [ ] Build route, shop, rest, event, reward, results, and settings screens with explicit disabled/error states.
- [ ] Build battle screen where four moves are immediately scannable, target selection is two-step, items/Guard are reachable, enemy intent is never displayed, input locks during resolution, and disabled actions explain why.
- [ ] Add keyboard shortcuts/focus rings/touch targets/status labels and responsive compact/medium/wide CSS using semantic regions rather than scaled-phone framing.

### Task 10: PWA/offline/update UX and release QA

**Files:**
- Modify: `vite.config.ts`, `src/app/App.tsx`, `README.md`; create `tests/e2e/abungi.spec.ts`, `vercel.json` if cache rules need explicit static headers.

**Interfaces:**
- Produces installable Workbox-generated PWA with precached app/game/audio/art assets, safe update notice outside forced combat reloads, offline indicator, and Vercel-portable static deployment.

- [ ] Run unit tests, typecheck/lint, production build, preview and critical browser flow: launch → new run → select 3 → battle skills/Guard/items → victory/reward → map → shop purchase → rest → save/reload/continue.
- [ ] Inspect 390×844, 768×1024, 1024×768, and 1440×900 screenshots and correct clipping, overflow, hierarchy, touch size, artwork overlap, AI-dashboard aesthetics, and awkward desktop scaling.
- [ ] Verify service worker/manifest/offline reload/active-run resume/no console-breaking errors when browser tooling is available.
- [ ] Search repository for `TODO|TBD|FIXME|Math.random`, display-name branching, hard-coded shop name in components, emojis and broken/remote gameplay asset URLs; resolve release violations.
- [ ] Package the source, tests, lockfile, configs, docs, and local assets without node_modules/caches/transient screenshots into `abungi-v0.1.zip`.
