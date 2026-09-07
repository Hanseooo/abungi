import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

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
