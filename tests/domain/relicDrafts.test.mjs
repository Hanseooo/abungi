import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRng } from '../../.domain-build/core/rng/seededRng.js';
import { RELICS, getRelic } from '../../.domain-build/content/relics.js';
import { createRun } from '../../.domain-build/core/progression/run.js';
import { drawRelicIds, eligibleRelics } from '../../.domain-build/core/progression/relicDrafts.js';

test('boss drafts are deterministic, unique, and start above Common', () => {
  const run = createRun(['earl', 'hans', 'leandre'], 42);
  const ids = drawRelicIds(run, 'boss', 3, new SeededRng(42));

  assert.deepEqual(ids, drawRelicIds(run, 'boss', 3, new SeededRng(42)));
  assert.equal(ids.length, 3);
  assert.equal(new Set(ids).size, 3);
  assert.notEqual(getRelic(ids[0]).rarity, 'common');
});

test('Folded Tokens stop instead of falling back into Rare', () => {
  const run = createRun(['earl', 'hans', 'leandre'], 42);
  run.relicIds = RELICS.filter(relic => relic.rarity !== 'rare').map(relic => relic.id);

  assert.deepEqual(drawRelicIds(run, 'folded-tokens', 3, new SeededRng(42)), []);
});

test('relic drafts exclude owned relics and Spare Battery without Hans', () => {
  const run = createRun(['earl', 'leandre', 'greg'], 42);
  run.relicIds = ['cardboard-plate'];

  const ids = drawRelicIds(run, 'elite', 20, new SeededRng(5));
  assert.equal(ids.includes('cardboard-plate'), false);
  assert.equal(ids.includes('spare-battery'), false);
  assert.equal(eligibleRelics(run, 'shop').some(relic => relic.id === 'spare-battery'), false);
});
