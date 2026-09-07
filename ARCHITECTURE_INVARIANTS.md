# Abungi Architecture Invariants

These are release-level constraints. Refactors may change file structure, but should not violate these rules without an explicit architecture decision.

1. **Pure domain core.** Damage, affinities, PP, status duration, Guard, turn order, enemy AI, rewards, route generation, and seeded randomness live under `src/game/` and do not import React, DOM APIs, IndexedDB, or audio.
2. **React is presentation/coordination.** Feature components render game state and issue commands. They do not contain generic combat formulas.
3. **Stable IDs, editable display copy.** Character, move, enemy, shop, event, relic, and asset IDs are stable. Human-readable names remain content. Michael can be renamed without changing combat code; `SHOP_CONFIG.displayName` can change without editing the shop component.
4. **Seeded randomness only in domain logic.** `Math.random()` is forbidden from game-domain code. `SeededRng` is serializable, and its state is persisted after committed state transitions.
5. **Content is data-driven.** The roster, abilities, enemies, encounters, items, relics, events, and shop name live in content modules. Generic behavior is composed from reusable effects with narrowly scoped mechanic IDs where needed.
6. **Centralized balance.** Frequently tuned multipliers and progression values live in `src/game/balance/constants.ts`, not scattered through React components.
7. **Autosave follows committed state.** State is resolved first, then the resulting run/RNG/battle snapshot is saved. Animations never own authoritative game state.
8. **Save access is ported.** Domain logic does not know IndexedDB. `SaveRepository` is the boundary, `IndexedDbSaveRepository` is the browser adapter, and every persisted envelope has schema version, revision, timestamp, and validated payload.
9. **Offline runtime has no remote gameplay dependencies.** Art and audio use local URLs. Service worker precaching is responsible for the static application shell and gameplay assets after first successful load.
10. **Responsive layout is CSS-owned.** Battle components expose semantic regions; they do not branch on device model or orientation. Wide layouts redistribute the same regions.
11. **Enemy intent remains hidden.** UI may show HP, affinity, statuses, buffs/debuffs, and visible phase changes. It must not show next enemy move, predicted target, or predicted damage.
12. **Input is single-commit.** Battle commands are rejected/ignored while resolution is in progress. UI also overlays an input lock during presentation.
13. **Assets are replaceable by stable ID.** Battle/content code references `assetId`; local SVG cutouts can later be replaced by approved illustrations without changing rule code.
14. **No Vercel business logic.** Vercel is a static deployment target only. The app must remain portable to any static host with HTTPS/service-worker support.
