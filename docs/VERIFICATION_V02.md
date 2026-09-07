# Abungi v0.2 Verification Record

This file records what was actually verified in the implementation sandbox for the v0.2 Combat & UX Polish release.

## Environment

- Node.js: `v22.16.0` (compatible with the required Node 22.x baseline)
- Intended package manager: `pnpm@12.1.0` from `package.json`
- Global TypeScript parser/compiler available: 5.8.3

## Verified locally without downloaded dependencies

- Pure domain TypeScript compiles with `tsc -p tsconfig.domain.json`.
- Full deterministic Node domain suite passes.
- Release-structure/static UI contract suite passes.
- Repository release audit passes (required files, roster/ability counts, local assets, prohibited patterns, no `Math.random()` in domain logic).
- Full TS/TSX application source parses with `tsc -p tsconfig.app.json --noCheck`.
- Character balance audit executes 7,920 deterministic battles across all 165 three-character parties, all 12 encounter definitions, and four seeds without simulation crashes/stalls. Results are in `docs/BALANCE_AUDIT_V02.md`.
- Route/economy audit inspects 10,000 generated regions plus 6,000 sampled shops and 1,000 reward rolls per normal encounter. Results are in `docs/ECONOMY_AUDIT_V02.md`.

## Dependency-backed checks blocked by sandbox network

The sandbox cannot resolve `registry.npmjs.org` (`EAI_AGAIN`). Corepack therefore cannot fetch pnpm 12.1.0 and npm cannot fetch project dependencies. As a result, the following commands cannot truthfully be claimed as executed successfully in this sandbox:

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
pnpm preview
```

In particular, the actual Vite production bundle, Playwright browser run, service-worker registration, installability and offline production reload must be rerun on a connected machine.

`vercel.json` intentionally uses `pnpm install --no-frozen-lockfile` because the sandbox could not regenerate the lockfile's transitive resolution sections while offline.

## Connected-machine release gate

With Node 22.x and working npm-registry access:

```bash
corepack enable
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
pnpm preview
```

Then verify the production preview once online, switch the browser offline, reload, and continue an active run. Do not consider the PWA/offline layer independently verified until that succeeds.
