import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addEffect, findEffect, findEffectFromSource, consumeEffect,
  tickSourceTurnStart, tickTargetTurnEnd, clearEffectsForUnit, clearAllEffects,
} from '../../.domain-build/core/combat/battleEffects.js';

const emptyState = () => ({ effects: [], flags: {} });

test('an added effect is findable by target and by source', () => {
  const state = emptyState();
  const effect = addEffect(state, { id: 'protect', sourceUnitId: 'ally-0-saq', targetUnitId: 'ally-1-hans', expiry: 'source-turn-start', remaining: 1 });
  assert.equal(state.effects.length, 1);
  assert.equal(findEffect(state, 'protect', 'ally-1-hans').uid, effect.uid);
  assert.equal(findEffectFromSource(state, 'protect', 'ally-0-saq').uid, effect.uid);
  assert.equal(findEffect(state, 'protect', 'ally-2-earl'), undefined);
});

test('uids stay unique across adds and removes', () => {
  const state = emptyState();
  const first = addEffect(state, { id: 'ink-mark', sourceUnitId: 'ally-0-ken', targetUnitId: 'enemy-0-wisp', expiry: 'source-turn-start', remaining: 2 });
  consumeEffect(state, first.uid, []);
  const second = addEffect(state, { id: 'ink-mark', sourceUnitId: 'ally-0-ken', targetUnitId: 'enemy-0-wisp', expiry: 'source-turn-start', remaining: 2 });
  assert.notEqual(first.uid, second.uid);
});

test('reapplication replaces rather than stacks, for the same source and for the same target', () => {
  const state = emptyState();
  addEffect(state, { id: 'protect', sourceUnitId: 'ally-0-saq', targetUnitId: 'ally-1-hans', expiry: 'source-turn-start', remaining: 1 });
  addEffect(state, { id: 'protect', sourceUnitId: 'ally-0-saq', targetUnitId: 'ally-2-earl', expiry: 'source-turn-start', remaining: 1 });
  assert.equal(state.effects.length, 1);
  assert.equal(state.effects[0].targetUnitId, 'ally-2-earl');

  addEffect(state, { id: 'script', sourceUnitId: 'ally-0-ken', targetUnitId: 'ally-1-hans', expiry: 'source-turn-start', remaining: 2 });
  addEffect(state, { id: 'script', sourceUnitId: 'ally-0-ken', targetUnitId: 'ally-1-hans', expiry: 'source-turn-start', remaining: 2 });
  assert.equal(state.effects.filter(e => e.id === 'script').length, 1);
});

test('a source-turn-start effect with remaining 2 survives one source turn and expires on the second', () => {
  const state = emptyState();
  addEffect(state, { id: 'ink-mark', sourceUnitId: 'ally-0-ken', targetUnitId: 'enemy-0-wisp', expiry: 'source-turn-start', remaining: 2 });
  const events = [];
  tickSourceTurnStart(state, 'ally-0-ken', events);
  assert.equal(state.effects.length, 1);
  assert.equal(state.effects[0].remaining, 1);
  tickSourceTurnStart(state, 'ally-0-ken', events);
  assert.equal(state.effects.length, 0);
  assert.deepEqual(events, [{ type: 'effectRemoved', effectId: 'ink-mark', targetId: 'enemy-0-wisp', reason: 'expired' }]);
});

test('another unit taking turns never expires a source-turn-start effect', () => {
  const state = emptyState();
  addEffect(state, { id: 'protect', sourceUnitId: 'ally-0-saq', targetUnitId: 'ally-1-hans', expiry: 'source-turn-start', remaining: 1 });
  tickSourceTurnStart(state, 'ally-1-hans', []);
  tickSourceTurnStart(state, 'enemy-0-wisp', []);
  assert.equal(state.effects.length, 1);
});

test('a target-turn-end effect expires on the recipient completing a turn, not on its source acting', () => {
  const state = emptyState();
  addEffect(state, { id: 'taxed', sourceUnitId: 'enemy-0-toll-hexer', targetUnitId: 'ally-1-hans', expiry: 'target-turn-end', remaining: 1 });
  tickSourceTurnStart(state, 'enemy-0-toll-hexer', []);
  assert.equal(state.effects.length, 1);
  tickTargetTurnEnd(state, 'ally-1-hans', []);
  assert.equal(state.effects.length, 0);
});

test('clearing a unit removes effects it sources and effects it carries', () => {
  const state = emptyState();
  addEffect(state, { id: 'protect', sourceUnitId: 'ally-0-saq', targetUnitId: 'ally-1-hans', expiry: 'source-turn-start', remaining: 1 });
  addEffect(state, { id: 'script', sourceUnitId: 'ally-2-ken', targetUnitId: 'ally-0-saq', expiry: 'source-turn-start', remaining: 2 });
  const events = [];
  clearEffectsForUnit(state, 'ally-0-saq', events);
  assert.equal(state.effects.length, 0);
  assert.equal(events.filter(e => e.reason === 'cleared').length, 2);
});

test('clearAllEffects empties the collection without emitting events', () => {
  const state = emptyState();
  addEffect(state, { id: 'protect', sourceUnitId: 'ally-0-saq', targetUnitId: 'ally-1-hans', expiry: 'source-turn-start', remaining: 1 });
  clearAllEffects(state);
  assert.deepEqual(state.effects, []);
});

import { SeededRng } from '../../.domain-build/core/rng/seededRng.js';
import { createBattle, resolveBattleCommand } from '../../.domain-build/core/combat/battleEngine.js';

test('a new battle starts with an empty effect collection', () => {
  const battle = createBattle(['earl','hans','marcus'], 'normal-fastlane', new SeededRng(777), { coins: 30 });
  assert.deepEqual(battle.effects, []);
});

test('a link survives the turn on which it was applied and is not expired by other units acting', () => {
  const rng = new SeededRng(777);
  let battle = createBattle(['earl','hans','marcus'], 'normal-fastlane', rng, { coins: 30 });
  const actorId = battle.turnOrder[battle.turnIndex];
  const otherAllyId = battle.allies.find(id => id !== actorId);
  battle.effects.push({ uid: 'fx-test', id: 'protect', sourceUnitId: actorId, targetUnitId: otherAllyId, expiry: 'source-turn-start', remaining: 1 });

  battle = resolveBattleCommand(battle, { kind: 'guard', actorId }, rng).nextState;
  assert.equal(battle.effects.length, 1, 'the effect must not expire during or immediately after the turn that applied it');
});
