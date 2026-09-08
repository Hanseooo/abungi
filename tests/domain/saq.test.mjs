import test from 'node:test';
import assert from 'node:assert/strict';
import { applyIncomingEffects } from '../../.domain-build/core/combat/interception.js';
import { addEffect } from '../../.domain-build/core/combat/battleEffects.js';

function scenario({ saqHp = 116, round = 1, classMonitorRound = 0 } = {}) {
  const saq = { id: 'ally-0-saq', sourceId: 'saq', side: 'ally', hp: saqHp, maxHp: 116, alive: saqHp > 0, flags: classMonitorRound ? { classMonitorRound } : {} };
  const hans = { id: 'ally-1-hans', sourceId: 'hans', side: 'ally', hp: 92, maxHp: 92, alive: true, flags: {} };
  const foe = { id: 'enemy-0-wisp', sourceId: 'wisp', side: 'enemy', hp: 58, maxHp: 58, alive: true, flags: {} };
  const state = { round, effects: [], flags: {}, units: { [saq.id]: saq, [hans.id]: hans, [foe.id]: foe }, allies: [saq.id, hans.id], enemies: [foe.id] };
  addEffect(state, { id: 'protect', sourceUnitId: saq.id, targetUnitId: hans.id, expiry: 'source-turn-start', remaining: 1 });
  return { state, saq, hans, foe };
}

test('a 40-damage hit splits 20 to the recipient and 5 to Saq after Class Monitor', () => {
  const { state, saq, hans, foe } = scenario();
  const events = [];
  const recipientDamage = applyIncomingEffects(state, foe, hans, 40, events);
  assert.equal(recipientDamage, 20, 'recipient keeps B - floor(B/2)');
  assert.equal(saq.hp, 111, 'transfer is ceil(20/2) = 10, minus 5 prevented = 5');
  assert.deepEqual(events.filter(e => e.type === 'prevented'), [{ type: 'prevented', kind: 'class-monitor', targetId: saq.id, amount: 5 }]);
  assert.deepEqual(events.filter(e => e.type === 'transfer'), [{ type: 'transfer', fromId: hans.id, toId: saq.id, amount: 5 }]);
  assert.equal(state.effects.length, 0, 'the link is consumed by the first redirectable hit');
  assert.equal(saq.flags.readyTurns, 1);
  assert.equal(saq.flags.classMonitorRound, state.round);
});

test('the passive fires only once per round', () => {
  const { state, saq, hans, foe } = scenario({ classMonitorRound: 1, round: 1 });
  applyIncomingEffects(state, foe, hans, 40, []);
  assert.equal(saq.hp, 106, 'full ceil(20/2) = 10 transfer with the passive already used this round');
});

test('a hit too small to redirect leaves the link active and costs Saq nothing', () => {
  const { state, saq, hans, foe } = scenario();
  const recipientDamage = applyIncomingEffects(state, foe, hans, 1, []);
  assert.equal(recipientDamage, 1);
  assert.equal(saq.hp, 116);
  assert.equal(state.effects.length, 1, 'floor(1/2) = 0, so no positive share was redirected');
});

test('a lethal transfer KOs Saq, clears his link, and grants no Ready', () => {
  const { state, saq, hans, foe } = scenario({ saqHp: 3, classMonitorRound: 1, round: 1 });
  const events = [];
  applyIncomingEffects(state, foe, hans, 40, events);
  assert.equal(saq.hp, 0);
  assert.equal(saq.alive, false);
  assert.equal(saq.flags.readyTurns ?? 0, 0, 'a dead Saq cannot retain Ready');
  assert.ok(events.some(e => e.type === 'knockout' && e.targetId === saq.id));
});

test('a KO source cannot intercept; the recipient takes the whole hit', () => {
  const { state, saq, hans, foe } = scenario({ saqHp: 0 });
  const recipientDamage = applyIncomingEffects(state, foe, hans, 40, []);
  assert.equal(recipientDamage, 40);
  assert.equal(state.effects.length, 0, 'the dangling link is removed');
});

test('an unlinked ally is untouched by the pipeline', () => {
  const { state, saq, foe } = scenario();
  const recipientDamage = applyIncomingEffects(state, foe, state.units[saq.id], 40, []);
  assert.equal(recipientDamage, 40, 'Saq as an AoE target takes his own ordinary hit');
  assert.equal(state.effects.length, 1);
});
