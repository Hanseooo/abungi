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
