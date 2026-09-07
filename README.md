# Abungi

**Current release: v0.2 — Combat & UX Polish**

Abungi is a single-player, offline-capable, mobile-first PWA roguelike built around **three-character turn-based party combat**. It uses a small five-affinity combat system, persistent HP/PP attrition, items, Guard, statuses, shops, relics, skill upgrades, events, elites, bosses, a three-region branching run, deterministic seeded randomness, and local save/resume.

The visual direction is a **handcrafted cardboard battle theatre** rather than a web dashboard. The implementation is DOM/CSS/SVG-first and keeps game rules in pure TypeScript so React remains a presentation/coordination layer.


## v0.2 Combat & UX Polish

v0.2 keeps the original deterministic engine but makes its systems substantially more legible and roguelite-focused:

- Field Guide plus move, status, character, item and visible-enemy detail overlays that always return to the underlying game screen.
- Sequential **announce → impact** combat presentation with named enemy skills after commitment, richer choreography families, status VFX and readable multi-hit/deployable feedback.
- Hans Sentry/Repair Drone pieces remain visible on the battlefield and explicitly show their own attacks/heals.
- Short seeded cardboard-theatre scenes for departure, regions, elites, bosses, events and shops; boss relationship variants include Jonlow/Jiro and Klyde/Earl. Scenes are skippable.
- Secret seeded boss affinity forms revealed only when the boss encounter begins.
- Stronger route pressure and encounter-scaled rewards so avoiding every fight is no longer the dominant strategy.
- Curated unique shop shelves, seeded price variation, item rarities, Power Snack, Guard Patch and rare Revive Kit.
- Same-status buffs refresh duration instead of stacking intensity. Newly applied 2-turn effects remain at 2 until the affected unit later completes a turn.
- Character/economy simulations are recorded in `docs/BALANCE_AUDIT_V02.md` and `docs/ECONOMY_AUDIT_V02.md`.

## Requirements

- Node.js **22.x** (minimum 22.12)
- pnpm (the repository records the intended package-manager version in `package.json`)
- A modern browser with IndexedDB and service-worker support for the full offline experience

Do **not** migrate this project to Node 24 without intentionally revisiting the specification.

## Install and run

```bash
pnpm install
pnpm dev
```

Open the local Vite URL, choose exactly three of the eleven characters, and start a run.

Useful commands:

```bash
pnpm test          # deterministic domain + release structure + Vitest content checks
pnpm typecheck     # full TypeScript check
pnpm lint          # release audit / prohibited-pattern scan
pnpm build         # production PWA build
pnpm preview       # serve dist locally
pnpm test:e2e      # Playwright critical flows at 4 required viewports
```

## Architecture

The project uses **Clean Architecture Lite**:

- `src/game/core/` — pure deterministic rules: combat, RNG, progression, save format.
- `src/game/balance/` — frequently tuned multipliers and limits.
- `src/game/content/` — data-driven characters, 44 abilities, enemies, encounters, items, relics, events, shop copy.
- `src/app/` — Zustand application coordination and autosave boundaries.
- `src/features/` — the ten required screens.
- `src/services/save/` — `SaveRepository` port + IndexedDB/Zod adapter.
- `src/services/audio/` — local, gracefully degrading audio playback.
- `src/services/assets/` — stable asset lookup.
- `src/ui/` — reusable tactile UI primitives.

See `ARCHITECTURE_INVARIANTS.md` for constraints that should remain true across refactors.

## Game controls

Touch is primary. In battle:

- Tap a skill, then tap a highlighted valid target when the skill is targeted.
- Team/self/random-target skills ask for explicit confirmation rather than firing on the first tap.
- Guard is always visible and costs 0 PP.
- Items live beside skills and use the same target-before-commit pattern.
- Keyboard: number keys `1–4` select the four moves, `Escape` cancels a selection, and `Enter` confirms non-single-target actions.

Enemy upcoming moves, target forecasts, and predicted damage are intentionally **not shown**.

## Saves and deterministic reloads

Abungi stores local state in IndexedDB behind `SaveRepository`. Saves contain schema version, timestamp, revision, profile/settings, active run, route, current HP/PP, inventory, relics, upgrades, RNG state, and active combat state.

A committed action resolves deterministic state first and then autosaves it. Refreshing the browser therefore does not reroll the action, route, reward, or enemy decision. Save loads are validated with Zod and migration infrastructure starts at schema v1. Corruption produces a recovery screen rather than crashing the app.

## Offline / PWA testing

After installing dependencies:

```bash
pnpm build
pnpm preview
```

Then in Chromium DevTools:

1. Load the preview once while online.
2. Confirm the application manifest is recognized and the service worker is active.
3. Start a run and commit at least one battle action.
4. Switch DevTools Network to **Offline**.
5. Reload. The app shell, local art/audio, and active run should still load.
6. Choose **Continue Run** and confirm the exact active battle resumes.

The PWA uses `vite-plugin-pwa`/Workbox. Updates are registered in prompt mode; a new service worker is never used to force-reload the page during combat.

## Responsive QA targets

The canonical composition is portrait mobile around **390×844**, but these viewports are explicitly supported and included in Playwright configuration:

- 390×844
- 768×1024
- 1024×768
- 1440×900

At wide widths the battle theatre redistributes into battlefield + command regions instead of scaling a phone rectangle. There is no orientation lock.

## Audio

All runtime sound is local under `public/audio/`: UI, confirm/cancel/error, hit/heavy-hit, heal/status, coins/dice, summon, victory/defeat, shop, battle music, and boss music. Audio unlocks after user interaction on mobile. Failure to initialize audio is non-fatal. Settings include master mute, music volume, SFX volume, 1×/2×/3× battle presentation speed, and Reduced Motion.

## Assets and replacement workflow

Current identity art is a coherent temporary vector/cardboard set under `public/assets/cutouts/` with stable IDs. Final illustrations can replace those files without touching battle logic.

1. Read `docs/ART_BIBLE.md` and `docs/ASSET_GENERATION_GUIDE.md`.
2. Generate/review art using previously approved characters as consistency references.
3. Export a transparent game-ready asset using the existing stable filename/ID.
4. Keep realistic runtime dimensions; do not ship giant raw generation files.
5. Update `docs/ASSET_MANIFEST.md` with provenance/license information.
6. Re-run `pnpm lint`, `pnpm test`, `pnpm build`, and the relevant Playwright viewport checks.

External supporting assets are opt-in only. `scripts/assets/fetch_assets.py` downloads **only** rows explicitly approved in `docs/ASSET_MANIFEST.md`, validates metadata/checksums when provided, and never participates in runtime loading. The current v0.2 bundle has no external approved downloads.

## Vercel deployment

Abungi is a static Vite application. No Vercel Functions or Vercel-specific game logic are required.

1. Import the repository into Vercel.
2. Use Node 22.x.
3. Install with pnpm.
4. Build command: `pnpm build`.
5. Output directory: `dist`.

`vercel.json` keeps the service worker and manifest revalidatable while allowing fingerprinted/static assets to cache aggressively. The same `dist/` can be hosted on another HTTPS static host.

## Documentation

- `docs/ABUNGI_SPEC.md` — source-of-truth product/game/technical specification.
- `DESIGN.md` — UI system and responsive/motion rules.
- `ARCHITECTURE_INVARIANTS.md` — maintainability constraints.
- `docs/ART_BIBLE.md` — visual consistency rules.
- `docs/ASSET_GENERATION_GUIDE.md` — prompts/replacement workflow.
- `docs/ASSET_MANIFEST.md` — local/external asset provenance.
- `docs/superpowers/plans/2026-09-07-abungi-implementation.md` — original implementation plan.
- `docs/superpowers/specs/2026-09-07-abungi-v02-combat-ux-design.md` — approved v0.2 polish design.
- `docs/superpowers/plans/2026-09-07-abungi-v02-polish.md` — v0.2 implementation plan.
- `docs/BALANCE_AUDIT_V02.md` — 7,920-battle character/pacing audit.
- `docs/ECONOMY_AUDIT_V02.md` — 10,000-route plus shop/reward/event economy audit.
- `docs/BALANCE_AUDIT_V03.md` — 7,920-battle v0.3 character/pacing audit.
- `docs/ECONOMY_AUDIT_V03.md` — v0.3 route plus shop/reward/event economy audit.
- `docs/VERIFICATION_V02.md` — exact v0.2 verification status, including the sandbox registry limitation.
