import test from 'node:test';
import assert from 'node:assert/strict';
import { applyIncomingEffects } from '../../.domain-build/core/combat/interception.js';
import { addEffect } from '../../.domain-build/core/combat/battleEffects.js';

function scenario({ withProtect = false, targetMaxHp = 100 } = {}) {
  const ken = { id: 'ally-0-ken', sourceId: 'ken', side: 'ally', hp: 98, maxHp: 98, alive: true, flags: {} };
  const saq = { id: 'ally-1-saq', sourceId: 'saq', side: 'ally', hp: 116, maxHp: 116, alive: true, flags: {} };
  const hans = { id: 'ally-2-hans', sourceId: 'hans', side: 'ally', hp: targetMaxHp, maxHp: targetMaxHp, alive: true, flags: {} };
  const foe = { id: 'enemy-0-wisp', sourceId: 'wisp', side: 'enemy', hp: 58, maxHp: 58, alive: true, flags: {} };
  const state = { round: 1, effects: [], flags: {}, units: { [ken.id]: ken, [saq.id]: saq, [hans.id]: hans, [foe.id]: foe }, allies: [ken.id, saq.id, hans.id], enemies: [foe.id] };
  addEffect(state, { id: 'script', sourceUnitId: ken.id, targetUnitId: hans.id, expiry: 'source-turn-start', remaining: 2 });
  if (withProtect) addEffect(state, { id: 'protect', sourceUnitId: saq.id, targetUnitId: hans.id, expiry: 'source-turn-start', remaining: 1 });
  return { state, ken, saq, hans, foe };
}

test('a hit at exactly 20% of Max HP consumes Script and prevents 10', () => {
  const { state, hans, foe } = scenario();
  const events = [];
  const damage = applyIncomingEffects(state, foe, hans, 20, events);
  assert.equal(damage, 10);
  assert.equal(state.effects.filter(e => e.id === 'script').length, 0);
  assert.deepEqual(events.filter(e => e.type === 'prevented'), [{ type: 'prevented', kind: 'script', targetId: hans.id, amount: 10 }]);
});

test('a hit one point below the threshold leaves Script intact', () => {
  const { state, hans, foe } = scenario();
  const damage = applyIncomingEffects(state, foe, hans, 19, []);
  assert.equal(damage, 19);
  assert.equal(state.effects.filter(e => e.id === 'script').length, 1);
});

test('three small hits never accumulate to the threshold', () => {
  const { state, hans, foe } = scenario();
  for (let hit = 0; hit < 3; hit += 1) assert.equal(applyIncomingEffects(state, foe, hans, 12, []), 12);
  assert.equal(state.effects.filter(e => e.id === 'script').length, 1, 'the threshold is per hit, never per action');
});

test('Script resolves before Protect and neither pass is applied twice', () => {
  const { state, saq, hans, foe } = scenario({ withProtect: true });
  const events = [];
  const damage = applyIncomingEffects(state, foe, hans, 40, events);
  // Script prevents 10 leaving B=30; recipient keeps 15; R=15; transfer ceil(15/2)=8 minus 5 = 3.
  assert.equal(damage, 15);
  assert.equal(saq.hp, 113);
  assert.equal(events.filter(e => e.type === 'prevented').map(e => e.kind).join(','), 'script,class-monitor');
});

test('Script cannot trigger on the protector transfer', () => {
  const { state, saq, hans, foe } = scenario({ withProtect: true });
  addEffect(state, { id: 'script', sourceUnitId: state.units['ally-0-ken'].id, targetUnitId: saq.id, expiry: 'source-turn-start', remaining: 2 });
  applyIncomingEffects(state, foe, hans, 40, []);
  assert.equal(state.effects.some(e => e.id === 'script' && e.targetUnitId === saq.id), true, 'the transfer takes no second defensive pass');
});
