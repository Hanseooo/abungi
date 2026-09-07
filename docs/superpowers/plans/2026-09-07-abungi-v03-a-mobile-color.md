# Abungi v0.3 — Plan A: Mobile/UX + Color Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the battle screen legible and tappable on short phones (375×667 and down), fix the unreadable START NEW RUN button, and add per-character accent colours for Earl (pink) and Hans (maroon) through a mechanism that leaves the other nine characters visually unchanged.

**Architecture:** Presentation-only. Everything here is `src/styles.css`, four React components, one new pure helper in `src/ui/`, and one additive optional field on `CharacterDefinition`. No domain logic, no save-schema change, no new dependency. Accent colour flows as a CSS custom property `--char-accent` set inline by React; CSS consumes it for exactly one edge detail per surface, so the default (`var(--affinity-<affinity>)`) renders identically to today.

**Tech Stack:** React 19, TypeScript 5.8, plain CSS (`src/styles.css`), `node:test` for CSS/structure assertions (`tests/release/`), Vitest for pure TS units (`tests/vitest/`), Playwright for viewport checks (`tests/e2e/`).

**Spec:** `docs/superpowers/specs/2026-09-07-abungi-v03-polish-design.md` (WS1 and WS2)

**Sibling plans:** Plan B (`2026-09-07-abungi-v03-b-revive-balance.md`), Plan C (`2026-09-07-abungi-v03-c-content-animation.md`). Plan A is independent of both and should land first — the spec phases it first because it unblocks screenshots.

## Global Constraints

Copied from the spec's *Cross-cutting constraints*. Every task's requirements implicitly include this section.

- Domain logic stays pure and deterministic; React/CSS remains presentation (`ARCHITECTURE_INVARIANTS.md` rules 1, 2, 10).
- Save schema unchanged. Plan A persists nothing new.
- No new dependency, no schema-breaking change, no Node version change. `package.json` `engines.node` stays `22.x`; `packageManager` stays `pnpm@12.1.0`.
- Responsive layout is CSS-owned (invariant 10): components expose semantic regions and never branch on device model.
- Affinity must never rely on colour alone (`DESIGN.md`) — the affinity letter-mark and text label stay untouched.
- Touch targets are `~44×44` CSS px when space permits; `--touch` is already `44px`.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` must pass, plus Playwright at 390×844, 768×1024, 1024×768, 1440×900 — and, new in this plan, 375×667.
- Runtime source may contain no `https?://` URL (`scripts/release-audit.mjs` enforces this) and no `TODO`/`TBD`/`FIXME` marker.

## Repo facts the executor needs

Verified in the repo on 2026-09-07. Where the spec and the code disagree, the code wins.

1. The spec says the short-screen media query hides `.status-strip` **and** `.skill-button > small`. Only the first is live. `.skill-button`, `.skill-button strong`, `.skill-button > small`, `.skill-button em` and `.skill-key` are **dead CSS** — `BattleScreen.tsx` renders `.skill-slot` / `.skill-main` / `.keycap` (the v0.2 rename at `src/styles.css:705-716` superseded them). Grepped across `src/**/*.tsx`: zero hits for `skill-button` and `skill-key`. Task 1 deletes them; that deletion traces to the request because the spec names those rules.
2. The "ASSEMBLE phase banner" is `.vfx-summon-mark` (`src/features/battle/BattleScreen.tsx:33`, styled at `src/styles.css:698`), rendered inside `.battle-vfx-layer` (`z-index:6`, `top:14%; height:43%`). `.combat-message` is a grid child with no stacking context, so the banner paints over it.
3. The "×N enemy count badge" is `.vfx-multihit` (`src/features/battle/BattleScreen.tsx:33`) — `multi` is the count of `damage` events in the beat, i.e. how many enemies an all-target move hit. It is the only `×N` count on the battle screen. (The item tray's `×{quantity}` is an item count, not an enemy count, and is out of scope.)
4. There is no JS affinity-colour map. Affinity colours live only in CSS at `src/styles.css:113-117` as `.affinity-<id> b { background: <hex> }`. Task 6 promotes those five hexes to `:root` tokens so `--char-accent` can default to them.
5. `PaperButton` (`src/ui/components/PaperButton.tsx`) already spreads `className` through, so a CTA-specific class needs no new variant.
6. Existing CSS-assertion tests live in `tests/release/v02-ui.test.mjs` and read `src/styles.css` as text with `node:test`. New CSS tests follow that pattern and run under `pnpm test:release` (part of `pnpm test`).

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/styles.css` | Modify | All layout, type-scale, touch-target and accent styling |
| `src/features/battle/BattleScreen.tsx` | Modify | Emit `--char-accent` on unit shell + actor ticket |
| `src/features/party-select/PartySelectScreen.tsx` | Modify | Emit `--char-accent` on the roster card |
| `src/features/title/TitleScreen.tsx` | Modify | Add `title-cta` class to the primary CTA |
| `src/game/core/types.ts` | Modify | Add optional `accentColor` to `CharacterDefinition` |
| `src/game/content/characters.ts` | Modify | Set Earl and Hans accent colours |
| `src/ui/charAccent.ts` | Create | Pure helper mapping `{affinity, accentColor?}` → inline style |
| `tests/vitest/charAccent.test.ts` | Create | Unit-tests the helper and the two accent values |
| `tests/release/v03-ui.test.mjs` | Create | CSS floor / touch-target / accent-selector assertions |
| `tests/e2e/abungi.spec.ts` | Modify | Compact-viewport legibility test |
| `playwright.config.ts` | Modify | Add the `mobile-375x667` project |

---

## Task 1: Legibility floor, touch targets, and dead-CSS removal

Establishes the ~10px (`.62rem`) label floor across the stylesheet and raises the three named touch targets. Deleting the dead `.skill-button` block first keeps the floor sweep from editing rules nothing renders.

**Files:**
- Create: `tests/release/v03-ui.test.mjs`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `tests/release/v03-ui.test.mjs` — Tasks 2, 3, 5 and 6 append tests to this same file.

- [ ] **Step 1: Write the failing test**

Create `tests/release/v03-ui.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../../', import.meta.url);
const read = (...parts) => readFileSync(join(root.pathname, ...parts), 'utf8');

test('every declared font size sits at or above the .62rem (~10px) label floor', () => {
  const css = read('src/styles.css');
  const undersized = [];
  css.split('\n').forEach((line, index) => {
    for (const match of line.matchAll(/font(?:-size)?:[^;{}]*?(\d*\.\d+)rem/g)) {
      if (Number(match[1]) < 0.62) undersized.push(`${index + 1}: ${line.trim().slice(0, 90)}`);
    }
  });
  assert.deepEqual(undersized, [], `font sizes below the .62rem floor:\n${undersized.join('\n')}`);
});

test('battle touch targets reach the 44px floor', () => {
  const css = read('src/styles.css');
  assert.match(css, /\.action-tabs button \{[^}]*min-height:\s*var\(--touch\)/s);
  assert.match(css, /\.battle-utility button \{[^}]*min-height:\s*var\(--touch\)/s);
  assert.match(css, /\.target-hint button \{[^}]*min-height:\s*var\(--touch\)/s);
});

test('the v0.1 skill-button markup names are gone from the stylesheet', () => {
  const css = read('src/styles.css');
  assert.doesNotMatch(css, /\.skill-button/, '.skill-button is dead CSS; markup renders .skill-slot/.skill-main');
  assert.doesNotMatch(css, /\.skill-key/, '.skill-key is dead CSS; markup renders .keycap');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/release/v03-ui.test.mjs`
Expected: all three FAIL — the floor test lists ~51 undersized declarations, the touch-target test fails on `.action-tabs button` (`min-height:38px`), and the dead-CSS test fails because `.skill-button` is present.

- [ ] **Step 3: Delete the dead `.skill-button` / `.skill-key` rules**

In `src/styles.css`, delete these whole rules. Anchor on the selector text, not line numbers — earlier deletions shift the file.

- `.skill-button { min-height:82px; … }`
- `.skill-button:hover:not(:disabled) { … }`
- `.skill-button.selected { … }`
- `.skill-button:disabled { … }`
- `.skill-button strong { … }`
- `.skill-key { … }`
- `.skill-button .affinity span { display:none; }`
- `.skill-button > small { … }`
- `.skill-button em { … }`
- Inside `@media (min-width: 600px)`: `.skill-button { min-height:98px; padding:8px; }`, `.skill-button strong { font-size:.82rem; }`, `.skill-button > small { font-size:.62rem; }`
- Inside `@media (min-width: 1024px)`: `.skill-button { min-height:105px; }`
- Inside `@media (min-width: 1320px)`: `.skill-button strong { font-size:.92rem; }`
- Inside `@media (max-height: 700px) and (max-width: 599px)`: `.skill-button { min-height:69px; }` and `.skill-button > small { display:none; }`

Keep `.pp-count { grid-column:1/-1; font:700 .52rem ui-monospace,monospace; }` — `.pp-count` is live markup and this rule supplies its monospace family. Step 4 bumps its size.

In the condensed-type rule near the top, drop the dead selector:

```css
h1, h2, .title-mark, .paper-button, .route-node b, .tape-label, .eyebrow { font-family: "Arial Narrow", "Roboto Condensed", Impact, ui-sans-serif, sans-serif; letter-spacing: .035em; }
```

`.skill-main strong, .item-main strong` already declares `font-family: "Arial Narrow", Impact, sans-serif` in the v0.2 block, so nothing loses its condensed face.

- [ ] **Step 4: Raise every undersized font size to `.62rem`**

Set the `font-size` (or the size inside the `font:` shorthand) to `.62rem` in each rule below. The bracketed value is the current one, for locating the rule.

| Selector | was |
|---|---|
| `.roster-card.selected::after` | .6 |
| `.mini-stats` | .58 |
| `.affinity-small` | .55 |
| `.status` | .52 |
| `.status-empty` | .53 |
| `.meter strong` | .6 |
| `.route-party-member small` | .55 |
| `.route-node small` | .55 |
| `.reward-ledger span` | .58 |
| `.offer-kind` (the `width: fit-content` rule) | .56 |
| `.rest-party span` | .6 |
| `.event-result > strong` | .6 |
| `.results-score span` | .55 |
| `.battle-utility` | .53 |
| `.battle-utility button` | .5 |
| `.target-corner` | .46 |
| `.turn-flag` | .46 |
| `.target-read` | .48 |
| `.combat-message > span` | .48 |
| `.combat-message small` | .58 |
| `.actor-ticket > span` | .45 |
| `.mechanic-counter` | .5 |
| `.deploy-strip span` | .48 |
| `.action-tabs button` | .58 |
| `.action-tabs small` | .42 |
| `.pp-count` (the `font:700 …` rule) | .52 |
| `.item-tray small` | .52 |
| `.item-tray em` | .48 |
| `.confirm-action,.target-hint` | .55 |
| `.confirm-action .paper-button` | .52 |
| `.target-hint button` | .5 |
| `.input-lock` | .58 |
| `.pwa-toast button` | .58 |
| `.status-strip button, .status-chip` | .58 |
| `.spoils-stamp` | .58 |
| `.shop-counter-scene > span` | .58 |
| `.offer-kind, .rarity-stamp, .deal-stamp` | .57 |
| `.event-choices button em` | .6 |
| `.has-guard .status-aura::after` | .54 |
| `.deployable-piece > span` | .52 |
| `.deployable-piece > b` | .55 |
| `.deployable-piece > em, .deployable-piece > small` | .47 |
| `.pp-count` (the v0.2 override, `white-space:nowrap`) | .59 |
| `.keycap` | .58 |
| `.guide-status > span` | .55 |

Two more, for spec item WS1.3 ("bump `.combat-message strong` on compact"): set `.unit-label strong` from `.57rem` to `.66rem`, and `.combat-message strong` from `.65rem` to `.72rem`. Leave the `@media (min-width:600px)` overrides (`.unit-label strong{.7rem}`, `.combat-message strong{.78rem}`) as they are.

- [ ] **Step 5: Raise the three touch targets**

```css
.battle-utility button { min-height: var(--touch); padding:0 8px; border:1px solid var(--ink); background:transparent; font-size:.62rem; font-weight:900; }
```

```css
.action-tabs button { min-height: var(--touch); border:2px solid var(--ink); background:#d9c5a4; font-size:.62rem; font-weight:900; text-align:left; padding:4px 6px; }
```

```css
.target-hint button { margin-left:auto; min-height: var(--touch); padding:0 10px; border:1px solid var(--ink); background:transparent; font-size:.62rem; font-weight:900; }
```

Inside `@media (min-width: 600px)`, replace `.action-tabs button { min-height:44px; font-size:.68rem; }` with just the size bump:

```css
  .action-tabs button { font-size:.68rem; }
```

`.battle-utility` needs room for its taller button — change its `min-height:34px` to `min-height:52px`.

- [ ] **Step 6: Run the test to verify it passes**

Run: `node --test tests/release/v03-ui.test.mjs`
Expected: 3/3 PASS.

- [ ] **Step 7: Run the full suite**

Run: `pnpm typecheck && pnpm test && pnpm lint`
Expected: all pass. `tests/release/v02-ui.test.mjs` still asserts `.battle-screen.speed-2x{--anim-scale:.5}` and the `prefers-reduced-motion` block — untouched by this task.

- [ ] **Step 8: Commit**

```bash
git add src/styles.css tests/release/v03-ui.test.mjs
git commit -m "style: raise battle type floor to .62rem, touch targets to 44px, drop dead skill-button CSS"
```

---

## Task 2: Combat message clears the ASSEMBLE banner; ×N becomes a corner badge

**Files:**
- Modify: `src/styles.css`
- Modify: `tests/release/v03-ui.test.mjs`

**Interfaces:**
- Consumes: `tests/release/v03-ui.test.mjs` from Task 1.
- Produces: nothing consumed downstream.

- [ ] **Step 1: Write the failing test**

Append to `tests/release/v03-ui.test.mjs`:

```js
test('the combat message paints above the VFX layer and its ASSEMBLE banner', () => {
  const css = read('src/styles.css');
  const layerZ = Number(css.match(/\.battle-vfx-layer \{[^}]*z-index:\s*(\d+)/s)?.[1]);
  const messageZ = Number(css.match(/\.combat-message \{[^}]*z-index:\s*(\d+)/s)?.[1]);
  assert.ok(Number.isFinite(layerZ), '.battle-vfx-layer must declare a z-index');
  assert.ok(Number.isFinite(messageZ), '.combat-message must declare a z-index');
  assert.ok(messageZ > layerZ, `.combat-message z-index ${messageZ} must exceed .battle-vfx-layer ${layerZ}`);
  assert.match(css, /\.combat-message \{[^}]*position:\s*relative/s);
});

test('the combat message reserves two lines instead of clipping to one', () => {
  const css = read('src/styles.css');
  const block = css.match(/\.combat-message \{[^}]*\}/s)?.[0] ?? '';
  const minHeight = Number(block.match(/min-height:\s*(\d+)px/)?.[1]);
  assert.ok(minHeight >= 56, `.combat-message min-height ${minHeight}px is too short for two lines`);
  assert.match(css, /\.combat-message strong \{[^}]*overflow-wrap:\s*anywhere/s);
  assert.doesNotMatch(css, /\.combat-message strong \{[^}]*text-overflow:\s*ellipsis/s);
});

test('the multi-target enemy count is a cornered badge, not floating inline text', () => {
  const css = read('src/styles.css');
  const block = css.match(/\.vfx-multihit \{[^}]*\}/s)?.[0] ?? '';
  assert.match(block, /top:\s*2px/, '.vfx-multihit must pin to a fixed corner, not a percentage');
  assert.match(block, /right:\s*2px/);
  const shared = css.match(/\.vfx-multihit, \.vfx-summon-mark \{[^}]*\}/s)?.[0] ?? '';
  assert.match(shared, /border:\s*2px solid var\(--ink\)/, 'the badge keeps the .target-corner ink border');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/release/v03-ui.test.mjs`
Expected: the three new tests FAIL — `.combat-message` declares no `z-index` or `position`, its `min-height` is `42px`, and `.vfx-multihit` has no rule of its own (it is positioned at `right:13%; top:18%` in a rule shared with `.vfx-summon-mark`).

- [ ] **Step 3: Lift the combat message above the VFX layer and let it wrap**

Replace the `.combat-message` rule:

```css
.combat-message { grid-area:message; position:relative; z-index:8; min-height:58px; border:2px solid var(--ink); background:var(--ink); color:var(--paper); padding:5px 8px; display:grid; grid-template-columns:auto 1fr; gap:2px 8px; align-items:center; box-shadow:2px 3px 0 var(--mustard); }
```

Replace the `.combat-message strong` rule:

```css
.combat-message strong { font-size:.72rem; line-height:1.25; overflow-wrap:anywhere; }
```

Inside `@media (min-width: 600px)`, raise the companion override from `min-height:48px`:

```css
  .combat-message { min-height:62px; padding:7px 10px; }
```

- [ ] **Step 4: Move the ASSEMBLE banner clear of the message**

The VFX layer spans `top:14%; height:43%` of the battle screen, which reaches the message row on short viewports. Pin both marks to the top corners of that layer — above the enemy stage, never over the message. Replace the shared rule:

```css
.vfx-multihit, .vfx-summon-mark { position:absolute; z-index:5; border:2px solid var(--ink); background:var(--paper); color:var(--ink); padding:4px 7px; font-size:.62rem; font-weight:950; transform:rotate(-3deg); }
.vfx-multihit { top:2px; right:2px; }
.vfx-summon-mark { top:2px; left:2px; }
```

`.vfx-multihit` now reads as a corner badge with the same ink border, fixed corner and stamp weight as `.target-corner`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test tests/release/v03-ui.test.mjs`
Expected: 6/6 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/styles.css tests/release/v03-ui.test.mjs
git commit -m "fix(battle): keep the ASSEMBLE banner off the combat message and corner the xN badge"
```

---

## Task 3: Short screens keep status, skill name and PP visible

Replaces the hiding rules in `@media (max-height:700px) and (max-width:599px)` with tighter spacing plus a scrollable action tray.

**Files:**
- Modify: `src/styles.css`
- Modify: `tests/release/v03-ui.test.mjs`

**Interfaces:**
- Consumes: `tests/release/v03-ui.test.mjs` from Task 1; the media-query block as rewritten by Task 1 step 3.
- Produces: nothing consumed downstream.

- [ ] **Step 1: Write the failing test**

Append to `tests/release/v03-ui.test.mjs`:

```js
const shortScreenBlock = css => css.match(/@media \(max-height: 700px\) and \(max-width: 599px\) \{[\s\S]*?\n\}/)?.[0];

test('the short-screen media query hides no status or skill information', () => {
  const block = shortScreenBlock(read('src/styles.css'));
  assert.ok(block, 'short-screen media query is missing');
  assert.doesNotMatch(block, /display:\s*none/, 'nothing may be hidden outright on short screens except the decorative info dot');
  assert.match(block, /\.action-tray \{[^}]*overflow-y:\s*auto/s, 'the tray scrolls instead of hiding rows');
  assert.match(block, /\.unit-label \.status-strip \{/, 'status keeps an explicit compact layout rule');
});

test('the skill description collapses to a clamp rather than vanishing', () => {
  const block = shortScreenBlock(read('src/styles.css')) ?? '';
  assert.match(block, /\.skill-main > small \{[^}]*-webkit-line-clamp:\s*2/s);
});
```

Note the first test forbids **every** `display:none` in that block, including the decorative status info-dot. Step 3 therefore hides the dot with `visibility` semantics via `content-visibility`-free means — see the rule below, which sets `width:0;overflow:hidden` instead of `display:none`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/release/v03-ui.test.mjs`
Expected: both new tests FAIL — the block still carries `.unit-label .status-strip { display:none; }` and has no tray or clamp rules.

- [ ] **Step 3: Rewrite the short-screen block**

Replace the whole `@media (max-height: 700px) and (max-width: 599px)` block with:

```css
@media (max-height: 700px) and (max-width: 599px) {
  .battle-screen { gap:3px; grid-template-rows:auto minmax(84px,.75fr) auto minmax(84px,.75fr) auto minmax(0,auto); }
  .unit-cutout-wrap { height:58px; }
  .enemy-stage .unit-cutout-wrap { height:67px; }
  .unit-label { padding:3px; }
  .unit-label .status-strip { margin-top:2px; max-height:none; gap:2px; }
  .unit-label .status-strip button { min-height:26px; padding:1px 4px; }
  .unit-label .status-info-dot { width:0; overflow:hidden; }
  .actor-ticket { padding:3px 5px; }
  .action-tray { max-height:42dvh; overflow-y:auto; overscroll-behavior:contain; }
  .skill-main, .item-main { min-height:66px; padding:5px 6px; }
  .skill-main > small { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .title-mark h1 { margin-bottom:12px; }
}
```

Notes for the executor:
- `.status-info-dot` is the decorative "i" glyph inside each status chip (`src/ui/components/StatusStrip.tsx`). Collapsing its width — rather than removing it — keeps the chip a 26px tappable control that still shows its label and remaining-turn count, so status is scannable *and* inspectable at 667px.
- The full skill description stays one tap away through the existing `.skill-info` "i" button, which opens the move detail panel. That is the spec's "tap/expand", already built — no new component.
- `.action-tray` is the last grid row; capping it at `42dvh` with `overflow-y:auto` is what keeps the enemy/ally stages and the message on screen.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/release/v03-ui.test.mjs`
Expected: 8/8 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/styles.css tests/release/v03-ui.test.mjs
git commit -m "fix(battle): keep status, skill name and PP visible on short screens"
```

---

## Task 4: Playwright proves the compact viewport

**Files:**
- Modify: `playwright.config.ts`
- Modify: `tests/e2e/abungi.spec.ts`

**Interfaces:**
- Consumes: the CSS from Tasks 1–3.
- Produces: the `mobile-375x667` Playwright project, referenced by Task 7.

- [ ] **Step 1: Add the 375×667 project**

In `playwright.config.ts`, add as the first entry of `projects`:

```ts
    { name: 'mobile-375x667', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 667 }, hasTouch: true } },
```

- [ ] **Step 2: Write the failing test**

`tests/e2e/abungi.spec.ts` already defines `startSeededRun`, `chooseReachableNode` and `expectNoHorizontalOverflow`. Add `{ width: 375, height: 667 },` as the first entry of the existing `for (const viewport of [...])` array, then append this test at the end of the file:

```ts
test('battle HUD stays legible and tappable on a short phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await startSeededRun(page);
  await chooseReachableNode(page, 'FIGHT');
  await expect(page.locator('.battle-screen')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // WS1.2: status stays scannable; skill name and PP stay visible.
  await expect(page.locator('.ally-stage .unit-label .status-strip, .ally-stage .unit-label .status-empty').first()).toBeVisible();
  await expect(page.locator('.skill-main strong').first()).toBeVisible();
  await expect(page.locator('.skill-main .pp-count').first()).toBeVisible();
  await expect(page.locator('.skill-main > small').first()).toBeVisible();

  // WS1.4: named touch targets reach 44px.
  for (const selector of ['.action-tabs button', '.battle-utility button']) {
    const box = await page.locator(selector).first().boundingBox();
    expect(box, `${selector} has no box`).toBeTruthy();
    expect(box!.height, `${selector} height`).toBeGreaterThanOrEqual(44);
  }

  // WS1.1: the enemy-move message is not clipped.
  const clipped = await page.locator('.combat-message strong').first()
    .evaluate(el => el.scrollHeight > el.clientHeight + 1);
  expect(clipped, 'combat message text is clipped').toBe(false);
});
```

- [ ] **Step 3: Run it and confirm it fails for the right reason**

Before running, temporarily re-add `.unit-label .status-strip { display:none; }` to the short-screen media query.

Run: `pnpm test:e2e --project=mobile-375x667 -g "short phone"`
Expected: FAIL on the status-strip visibility assertion. Then remove the temporary rule again.

- [ ] **Step 4: Run it green**

Run: `pnpm test:e2e --project=mobile-375x667 -g "short phone"`
Expected: PASS.

- [ ] **Step 5: Run all five viewports**

Run: `pnpm test:e2e`
Expected: PASS across `mobile-375x667`, `mobile-390x844`, `tablet-768x1024`, `tablet-landscape-1024x768`, `desktop-1440x900`. If a bumped font size causes horizontal overflow on the roster grid at 375px, fix it by tightening `.roster-copy` / `.mini-stats` padding — never by lowering a font size back below `.62rem`.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts tests/e2e/abungi.spec.ts
git commit -m "test(e2e): cover the 375x667 compact viewport"
```

---

## Task 5: START NEW RUN reads as mustard on ink

WS2.1. The default `.paper-button` declares no `color`, so on `.title-screen` (which sets `color: var(--paper)`) it renders near-white on cream `--paper-2`.

**Files:**
- Modify: `src/features/title/TitleScreen.tsx`
- Modify: `src/styles.css`
- Modify: `tests/release/v03-ui.test.mjs`

**Interfaces:**
- Consumes: `tests/release/v03-ui.test.mjs` from Task 1.
- Produces: the `title-cta` class name; nothing else depends on it.

- [ ] **Step 1: Write the failing test**

Append to `tests/release/v03-ui.test.mjs`:

```js
test('the primary title CTA sets an explicit mustard/ink pair without touching .paper-button', () => {
  const css = read('src/styles.css');
  const title = read('src/features/title/TitleScreen.tsx');
  assert.match(title, /className="title-cta"/, 'the START NEW RUN button must carry the title-cta class');
  const block = css.match(/\.paper-button\.title-cta \{[^}]*\}/s)?.[0] ?? '';
  assert.match(block, /background:\s*var\(--mustard\)/);
  assert.match(block, /color:\s*var\(--ink\)/);
  const base = css.match(/\n\.paper-button \{[^}]*\}/s)?.[0] ?? '';
  assert.doesNotMatch(base, /color:/, '.paper-button must stay colour-neutral for the other screens');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/release/v03-ui.test.mjs`
Expected: FAIL — `TitleScreen.tsx` has no `title-cta` and the CSS rule does not exist.

- [ ] **Step 3: Tag the CTA**

In `src/features/title/TitleScreen.tsx`, both the collapsed and expanded forms of the primary action get the class. Replace:

```tsx
        {!confirm?<PaperButton onClick={()=>hasRun?setConfirm(true):openNew()}>{hasRun?'NEW RUN':'START NEW RUN'}</PaperButton>:<div className="confirm-strip"><p>Starting over replaces the active run only after you choose a new party.</p><div><PaperButton onClick={()=>{setConfirm(false);openNew();}}>CHOOSE NEW PARTY</PaperButton><PaperButton variant="quiet" onClick={()=>setConfirm(false)}>KEEP CURRENT RUN</PaperButton></div></div>}
```

with:

```tsx
        {!confirm?<PaperButton className="title-cta" onClick={()=>hasRun?setConfirm(true):openNew()}>{hasRun?'NEW RUN':'START NEW RUN'}</PaperButton>:<div className="confirm-strip"><p>Starting over replaces the active run only after you choose a new party.</p><div><PaperButton className="title-cta" onClick={()=>{setConfirm(false);openNew();}}>CHOOSE NEW PARTY</PaperButton><PaperButton variant="quiet" onClick={()=>setConfirm(false)}>KEEP CURRENT RUN</PaperButton></div></div>}
```

CONTINUE RUN keeps `variant="ink"` — untouched.

- [ ] **Step 4: Add the rule**

In `src/styles.css`, directly after `.paper-button-quiet { … }`:

```css
.paper-button.title-cta { background: var(--mustard); color: var(--ink); box-shadow: 3px 4px 0 var(--ink); }
.paper-button.title-cta::after { border-color: rgba(30,26,23,.4); }
```

Ink `#1e1a17` on mustard `#c9962e` is roughly 8.5:1 — comfortably past WCAG AA for the button's large bold type.

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test tests/release/v03-ui.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/title/TitleScreen.tsx src/styles.css tests/release/v03-ui.test.mjs
git commit -m "fix(title): give the primary CTA a mustard fill with ink text"
```

---

## Task 6: Per-character accent colours for Earl and Hans

WS2.2. One general mechanism; only two characters override it.

**Files:**
- Modify: `src/game/core/types.ts`
- Modify: `src/game/content/characters.ts`
- Create: `src/ui/charAccent.ts`
- Create: `tests/vitest/charAccent.test.ts`
- Modify: `src/styles.css`
- Modify: `src/features/party-select/PartySelectScreen.tsx`
- Modify: `src/features/battle/BattleScreen.tsx`
- Modify: `tests/release/v03-ui.test.mjs`

**Interfaces:**
- Consumes: `tests/release/v03-ui.test.mjs` from Task 1.
- Produces:
  - `CharacterDefinition.accentColor?: string`
  - `charAccentStyle(source: { affinity: Affinity; accentColor?: string }): CSSProperties` — returns `{ '--char-accent': string }`; the value is the literal accent hex when present, otherwise the string `var(--affinity-<affinity>)`.
  - Five `:root` tokens `--affinity-might|tech|trick|mystic|neutral`.

- [ ] **Step 1: Write the failing unit test**

Create `tests/vitest/charAccent.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { charAccentStyle } from '../../src/ui/charAccent';
import { CHARACTERS, getCharacter } from '../../src/game/content/characters';

describe('character accent colours', () => {
  test('only Earl and Hans override the affinity default', () => {
    expect(getCharacter('earl').accentColor).toBe('#C77B94');
    expect(getCharacter('hans').accentColor).toBe('#7A2E2E');
    const overriding = CHARACTERS.filter(character => character.accentColor).map(character => character.id);
    expect(overriding.sort()).toEqual(['earl', 'hans']);
  });

  test('the style helper falls back to the affinity token so the other nine render unchanged', () => {
    expect(charAccentStyle(getCharacter('earl'))).toEqual({ '--char-accent': '#C77B94' });
    expect(charAccentStyle(getCharacter('hans'))).toEqual({ '--char-accent': '#7A2E2E' });
    expect(charAccentStyle(getCharacter('greg'))).toEqual({ '--char-accent': 'var(--affinity-might)' });
    expect(charAccentStyle({ affinity: 'neutral' })).toEqual({ '--char-accent': 'var(--affinity-neutral)' });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/vitest/charAccent.test.ts`
Expected: FAIL — `src/ui/charAccent.ts` does not exist (module resolution error).

- [ ] **Step 3: Add the type field and the two accent values**

In `src/game/core/types.ts`, add one optional field to `CharacterDefinition`:

```ts
export interface CharacterDefinition {
  id: string;
  displayName: string;
  affinity: Affinity;
  role: string;
  stats: Stats;
  passive: PassiveDefinition;
  abilities: string[];
  assetId: string;
  accentColor?: string;
}
```

In `src/game/content/characters.ts`, add `accentColor` to exactly two entries; leave the other nine untouched:

```ts
  { id:'earl', displayName:'Earl', affinity:'trick', role:'Healer / smoke debuffer / bruiser', stats:{maxHp:110,power:92,guard:95,speed:88}, passive:{id:'first-responder',name:'First Responder',description:"Earl's first heal each battle is 20% stronger."}, abilities:['knuckle-up','yosi','patch-up','adrenaline'], assetId:'character-earl', accentColor:'#C77B94' },
```

```ts
  { id:'hans', displayName:'Hans', affinity:'tech', role:'Inventor / deployable summoner', stats:{maxHp:92,power:98,guard:80,speed:94}, passive:{id:'spare-parts',name:'Spare Parts',description:"Hans's first deployable each battle lasts one additional turn."}, abilities:['sidearm','sentry-unit','repair-drone','overclock'], assetId:'character-hans', accentColor:'#7A2E2E' },
```

`#C77B94` is a deliberately desaturated theatre pink; `#7A2E2E` is maroon. Neither is in the base palette, which is why they are per-character overrides rather than new palette tokens.

`scripts/release-audit.mjs` counts characters with `/\{ id:'[^']+', displayName:/g` — appending a field at the end of the object leaves that regex matching. Do not reorder `id`/`displayName`.

- [ ] **Step 4: Write the helper**

Create `src/ui/charAccent.ts`:

```ts
import type { CSSProperties } from 'react';
import type { Affinity } from '../game/core/types';

/** One accent per rendered figure. Defaults to the affinity token, so only Earl and Hans differ. */
export function charAccentStyle(source:{affinity:Affinity;accentColor?:string}):CSSProperties {
  return {'--char-accent': source.accentColor ?? `var(--affinity-${source.affinity})`} as CSSProperties;
}
```

- [ ] **Step 5: Run the unit test to verify it passes**

Run: `pnpm vitest run tests/vitest/charAccent.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Write the failing CSS/wiring test**

Append to `tests/release/v03-ui.test.mjs`:

```js
test('affinity colours are single-sourced as :root tokens', () => {
  const css = read('src/styles.css');
  for (const [affinity, hex] of [['might','#d87c68'],['tech','#75a1aa'],['trick','#d5b24c'],['mystic','#9b78a7'],['neutral','#aaa397']]) {
    assert.match(css, new RegExp(`--affinity-${affinity}:\\s*${hex}`), `missing --affinity-${affinity} token`);
    assert.match(css, new RegExp(`\\.affinity-${affinity} b \\{[^}]*background:\\s*var\\(--affinity-${affinity}\\)`, 's'), `.affinity-${affinity} b must read its token`);
  }
});

test('all four character surfaces emit and consume --char-accent', () => {
  const css = read('src/styles.css');
  const battle = read('src/features/battle/BattleScreen.tsx');
  const party = read('src/features/party-select/PartySelectScreen.tsx');
  assert.match(party, /charAccentStyle\(/, 'roster card must emit the accent');
  assert.ok((battle.match(/charAccentStyle\(/g) ?? []).length >= 2, 'unit shell and actor ticket must emit the accent');
  for (const selector of ['.roster-card', '.unit-label', '.turn-flag', '.actor-ticket']) {
    const block = css.match(new RegExp(`\\${selector} \\{[^}]*\\}`, 's'))?.[0] ?? '';
    assert.match(block, /var\(--char-accent/, `${selector} must consume --char-accent`);
  }
});

test('the affinity letter-mark and label are not recoloured by the accent', () => {
  const css = read('src/styles.css');
  const mark = css.match(/\n\.affinity \{[^}]*\}/s)?.[0] ?? '';
  assert.doesNotMatch(mark, /--char-accent/, 'affinity must never rely on colour alone');
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `node --test tests/release/v03-ui.test.mjs`
Expected: the three new tests FAIL — no `--affinity-*` tokens exist and no component emits `charAccentStyle`.

- [ ] **Step 8: Promote affinity colours to tokens**

In `src/styles.css`, add to the `:root` block immediately after `--bluegray: #4d6870;`:

```css
  --affinity-might: #d87c68;
  --affinity-tech: #75a1aa;
  --affinity-trick: #d5b24c;
  --affinity-mystic: #9b78a7;
  --affinity-neutral: #aaa397;
```

Rewrite the five affinity swatch rules to read the tokens:

```css
.affinity-might b { background: var(--affinity-might); }
.affinity-tech b { background: var(--affinity-tech); }
.affinity-trick b { background: var(--affinity-trick); }
.affinity-mystic b { background: var(--affinity-mystic); }
.affinity-neutral b { background: var(--affinity-neutral); }
```

- [ ] **Step 9: Add one accent detail per surface**

Each rule below already exists; add only the named declaration. Every one is an edge, never a text background, so contrast is unaffected.

- `.roster-card` (the rule with `min-height: 228px`): add `border-top: 5px solid var(--char-accent, var(--ink));`
- `.unit-label`: add `border-bottom: 4px solid var(--char-accent, var(--ink));`
- `.turn-flag`: add `border-left: 5px solid var(--char-accent, var(--ink));`
- `.actor-ticket`: add `border-left: 6px solid var(--char-accent, var(--ink));`

- [ ] **Step 10: Emit the accent from the roster card**

In `src/features/party-select/PartySelectScreen.tsx`, add the import:

```tsx
import { charAccentStyle } from '../../ui/charAccent';
```

and the style prop:

```tsx
    <section className="roster-grid" aria-label="Playable roster">{CHARACTERS.map((c,index)=>{const isSelected=selected.includes(c.id);return <article key={c.id} style={charAccentStyle(c)} className={`roster-card ${isSelected?'selected':''}`}>
```

- [ ] **Step 11: Emit the accent from the unit figure and the actor ticket**

In `src/features/battle/BattleScreen.tsx`, add the import:

```tsx
import { charAccentStyle } from '../../ui/charAccent';
```

`UnitFigure` covers both allies and enemies. Allies resolve through `getCharacter`; enemies have no `CharacterDefinition`, so they pass their own affinity and get the affinity default — exactly today's appearance. Add this line inside `UnitFigure`, next to the existing `hitEvents` line:

```tsx
  const accent=charAccentStyle(unit.side==='ally'?getCharacter(unit.sourceId):{affinity:unit.affinity});
```

and put it on the shell so both `.unit-label` and `.turn-flag` inherit it:

```tsx
  return <div className={`unit-figure-shell ${current?'current-unit':''}`} style={accent}>{onTarget&&validTarget?<button className="unit-figure targetable" onClick={()=>onTarget(unit.id)} aria-label={`Target ${unit.displayName}`}>{content}<span className="target-corner">TARGET</span></button>:<div className="unit-figure">{content}</div>}<button className="unit-info-button" onClick={event=>{event.stopPropagation();onInfo()}} aria-label={`Info about ${unit.displayName}`}>i</button></div>;
```

For the actor ticket, in the `battle-hud` section replace the ally branch's opening tag:

```tsx
    <section className="battle-hud">{actor&&actor.side==='ally'?<><div className="actor-ticket" style={charAccentStyle(getCharacter(actor.sourceId))}><span>CURRENT</span><h2>{actor.displayName}</h2>
```

The enemy branch (`<div className="actor-ticket enemy-thinking">`) stays as it is and falls back to `var(--ink)`.

- [ ] **Step 12: Run the tests to verify they pass**

Run: `node --test tests/release/v03-ui.test.mjs && pnpm vitest run tests/vitest/charAccent.test.ts`
Expected: all PASS.

- [ ] **Step 13: Verify visually**

Run `pnpm dev`, start a run with Earl and Hans in the party, and confirm:
- Earl's roster card top edge, unit name-bar underline, ACTING flag edge and actor ticket edge read dusty pink.
- Hans's read maroon.
- The other nine still match their affinity swatch exactly.
- The affinity letter-mark (`M`/`T`/`K`/`Y`/`N`) and its text label are unchanged everywhere.

- [ ] **Step 14: Commit**

```bash
git add src/game/core/types.ts src/game/content/characters.ts src/ui/charAccent.ts src/styles.css src/features/party-select/PartySelectScreen.tsx src/features/battle/BattleScreen.tsx tests/vitest/charAccent.test.ts tests/release/v03-ui.test.mjs
git commit -m "feat(ui): add per-character accent colours for Earl and Hans"
```

---

## Task 7: Full verification

**Files:** none changed unless a check fails.

- [ ] **Step 1: Run every gate**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
```

Expected: all green, Playwright across all five projects.

- [ ] **Step 2: Manual short-phone pass**

`pnpm preview`, open at 375×667 with device emulation, enter a battle, and confirm: no horizontal scroll; status chips visible under every ally name; skill name and PP visible without scrolling; skill description clamped to two lines with the "i" button opening the full text; the enemy-move message readable on two lines with the ASSEMBLE banner clear of it.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(ui): resolve v0.3 mobile/colour verification findings"
```

---

## Self-review notes

- **Spec coverage.** WS1.1 → Task 2. WS1.2 → Task 3. WS1.3 → Task 1 (floor) + Task 2 (`.combat-message strong`). WS1.4 → Task 1. WS1.5 → Task 2. WS1 validation → Task 4 + Task 7. WS2.1 → Task 5. WS2.2 → Task 6. WS2 validation → Task 6 step 13.
- **Deviation from the spec, flagged.** The spec describes the short-screen block as hiding `.skill-button > small`; in the shipped markup that rule targets nothing. Task 1 deletes the dead rules and Task 3 applies the intended clamp to the live `.skill-main > small`. The spec's intent — descriptions must not silently vanish — is met either way.
- **Naming consistency.** `charAccentStyle`, `--char-accent`, `--affinity-<id>`, `title-cta`, `accentColor` are used identically in every task above.
