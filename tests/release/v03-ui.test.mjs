import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

test('route forks explain their one-way choice and require confirmation before entering', () => {
  const route = read('src/features/route/RouteScreen.tsx');
  const css = read('src/styles.css');
  assert.match(route, /CHOOSE ONE/);
  assert.match(route, /The other route will be skipped/);
  assert.match(route, /ENTER \{label\[pendingNode\.type\]\}/);
  assert.match(route, /CHANGE CHOICE/);
  assert.match(route, /route-choice-selected/);
  assert.match(css, /\.route-choice-guide \{/);
  assert.match(css, /\.route-node\.will-skip \{/);
});

test('field inventory gives its scroll row a definite viewport-bounded height', () => {
  const css = read('src/styles.css');
  const dialog = css.match(/\.field-inventory-dialog \{[^}]*\}/s)?.[0] ?? '';
  const panel = css.match(/\.field-inventory-panel \{[^}]*\}/s)?.[0] ?? '';
  const scroll = css.match(/\.field-inventory-scroll \{[^}]*\}/s)?.[0] ?? '';
  assert.match(dialog, /(?<!-)height:\s*calc\(100dvh\s*-\s*16px\)/);
  assert.match(dialog, /overflow:\s*hidden/);
  assert.match(panel, /(?<!-)height:\s*100%/);
  assert.match(scroll, /overflow-y:\s*auto/);
});

test('field inventory distinguishes clearing a selection from closing the modal', () => {
  const route = read('src/features/route/RouteScreen.tsx');
  assert.match(route, /Choose an item to preview its effect/);
  assert.match(route, /CLEAR SELECTION/);
  assert.match(route, /disabled=\{isResolving\|\|\(!selection&&!discardingItemId\)\}/);
  assert.match(route, /CLOSE INVENTORY/);
});

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

test('mobile deployables use their own row and return to the ally stage on wider screens', () => {
  const css = read('src/styles.css');
  const mobile = css.slice(0, css.indexOf('@media (min-width: 600px)'));
  const medium = css.slice(css.lastIndexOf('@media (min-width: 600px)'), css.indexOf('@media (min-width: 768px)'));
  assert.match(mobile, /grid-template-areas:\s*"utility"\s*"enemy"\s*"message"\s*"ally"\s*"deployables"\s*"hud"\s*"actions"/, 'mobile battle layout must reserve a deployables row');
  assert.match(css, /\.deployable-field \{[^}]*grid-area:\s*deployables/s, 'mobile deployables must not share the ally row');
  assert.match(medium, /\.deployable-field \{[^}]*grid-area:\s*ally/s, 'wider screens restore deployables to the battlefield');
});

test('the v0.1 skill-button markup names are gone from the stylesheet', () => {
  const css = read('src/styles.css');
  assert.doesNotMatch(css, /\.skill-button/, '.skill-button is dead CSS; markup renders .skill-slot/.skill-main');
  assert.doesNotMatch(css, /\.skill-key/, '.skill-key is dead CSS; markup renders .keycap');
});

test('the combat message paints above the VFX layer and its ASSEMBLE banner', () => {
  const css = read('src/styles.css');
  const layerZ = Number(css.match(/\.battle-vfx-layer \{[^}]*z-index:\s*(\d+)/s)?.[1]);
  const messageZ = Number(css.match(/\.combat-message \{[^}]*z-index:\s*(\d+)/s)?.[1]);
  assert.ok(Number.isFinite(layerZ), '.battle-vfx-layer must declare a z-index');
  assert.ok(Number.isFinite(messageZ), '.combat-message must declare a z-index');
  assert.ok(messageZ > layerZ, `.combat-message z-index ${messageZ} must exceed .battle-vfx-layer ${layerZ}`);
  assert.match(css, /\.combat-message \{[^}]*position:\s*relative/s);
});

test('the multi-target enemy count is a cornered badge, not floating inline text', () => {
  const css = read('src/styles.css');
  const block = css.match(/\.vfx-multihit \{[^}]*\}/s)?.[0] ?? '';
  assert.match(block, /top:\s*2px/, '.vfx-multihit must pin to a fixed corner, not a percentage');
  assert.match(block, /right:\s*2px/);
  const shared = css.match(/\.vfx-multihit, \.vfx-summon-mark \{[^}]*\}/s)?.[0] ?? '';
  assert.match(shared, /border:\s*2px solid var\(--ink\)/, 'the badge keeps the .target-corner ink border');
});

const shortScreenBlock = css => css.match(/@media \(max-height: 700px\) and \(max-width: 599px\) \{[\s\S]*?\n\}/)?.[0];

test('the short-screen media query hides no status or skill information', () => {
  const block = shortScreenBlock(read('src/styles.css'));
  assert.ok(block, 'short-screen media query is missing');
  assert.doesNotMatch(block, /display:\s*none/, 'nothing may be hidden outright on short screens except the decorative info dot');
  assert.match(block, /\.action-tray \{[^}]*overflow-y:\s*auto/s, 'the tray scrolls instead of hiding rows');
  assert.match(block, /\.unit-label \.status-strip \{/,'status keeps an explicit compact layout rule');
});

test('the skill description collapses to a clamp rather than vanishing', () => {
  const block = shortScreenBlock(read('src/styles.css')) ?? '';
  assert.match(block, /\.skill-main > small \{[^}]*-webkit-line-clamp:\s*2/s);
});

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
  assert.doesNotMatch(battle, /nextMove|predictedTarget|predictedDamage|targetForecast/i, 'enemy predictions must stay hidden');
});

test('the reward coin pop inherits the saved 1x/2x/3x speed setting', () => {
  const reward = read('src/features/reward/RewardScreen.tsx');
  const css = read('src/styles.css');
  assert.match(reward, /speed-\$\{settings\.animationSpeed\}x/, 'the reward screen must expose the saved speed setting');
  assert.match(css, /\.reward-screen\.speed-2x\s*\{[^}]*--anim-scale:\s*\.5/s);
  assert.match(css, /\.reward-screen\.speed-3x\s*\{[^}]*--anim-scale:\s*\.333/s);
});
