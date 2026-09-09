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

test('a hit at exactly 20% of Max HP consumes Script and prevents the 10 HP floor', () => {
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
  // Script prevents 30% of 40 = 12, leaving B=28; recipient keeps 14; R=14; transfer ceil(14/2)=7 minus 5 = 2.
  assert.equal(damage, 14);
  assert.equal(saq.hp, 114);
  assert.equal(events.filter(e => e.type === 'prevented').map(e => e.kind).join(','), 'script,class-monitor');
});

test('Script cannot trigger on the protector transfer', () => {
  const { state, saq, hans, foe } = scenario({ withProtect: true });
  addEffect(state, { id: 'script', sourceUnitId: state.units['ally-0-ken'].id, targetUnitId: saq.id, expiry: 'source-turn-start', remaining: 2 });
  applyIncomingEffects(state, foe, hans, 40, []);
  assert.equal(state.effects.some(e => e.id === 'script' && e.targetUnitId === saq.id), true, 'the transfer takes no second defensive pass');
});

import { SeededRng } from '../../.domain-build/core/rng/seededRng.js';
import { createBattle, resolveBattleCommand } from '../../.domain-build/core/combat/battleEngine.js';

const kenParty = (members = ['ken','michael','marcus'], seed = 777) =>
  createBattle(members, 'normal-fastlane', new SeededRng(seed), { coins: 30 });
const unitOf = (battle, sourceId) => battle.allies.concat(battle.enemies).find(id => battle.units[id].sourceId === sourceId);
const advanceTo = (battle, unitId, rng) => {
  while (battle.turnOrder[battle.turnIndex] !== unitId) battle = resolveBattleCommand(battle, { kind: 'guard', actorId: battle.turnOrder[battle.turnIndex] }, rng).nextState;
  return battle;
};

test('Fresh Ink cannot consume the mark it is about to apply', () => {
  const rng = new SeededRng(777);
  let battle = kenParty();
  const kenId = unitOf(battle, 'ken');
  const foeId = battle.enemies[0];
  battle = advanceTo(battle, kenId, rng);
  const resolution = resolveBattleCommand(battle, { kind: 'skill', actorId: kenId, abilityId: 'fresh-ink', targetIds: [foeId] }, rng);
  assert.equal(resolution.events.filter(e => e.type === 'effectRemoved' && e.effectId === 'ink-mark').length, 0);
  assert.equal(resolution.nextState.effects.filter(e => e.id === 'ink-mark').length, 1);
});

test('another ally consuming the mark adds 35% plus the 15% passive, once per round', () => {
  const rng = new SeededRng(777);
  let battle = kenParty();
  const kenId = unitOf(battle, 'ken');
  const michaelId = unitOf(battle, 'michael');
  const foeId = battle.enemies[0];
  battle.effects.push({ uid: 'fx-mark', id: 'ink-mark', sourceUnitId: kenId, targetUnitId: foeId, expiry: 'source-turn-start', remaining: 2 });
  battle = advanceTo(battle, michaelId, rng);
  const resolution = resolveBattleCommand(battle, { kind: 'skill', actorId: michaelId, abilityId: 'rifle-burst', targetIds: [foeId] }, rng);
  assert.ok(resolution.events.some(e => e.type === 'message' && e.text.includes('50% damage')), 'mark 35% plus Collaborative Work 15%');
  assert.equal(resolution.nextState.effects.filter(e => e.id === 'ink-mark').length, 0);
  assert.equal(Number(resolution.nextState.units[kenId].flags.collaborativeWorkRound), battle.round);
});

test('Ken consuming his own mark gets 35% and does not trigger his passive', () => {
  const rng = new SeededRng(777);
  let battle = kenParty();
  const kenId = unitOf(battle, 'ken');
  const foeId = battle.enemies[0];
  battle.effects.push({ uid: 'fx-mark', id: 'ink-mark', sourceUnitId: kenId, targetUnitId: foeId, expiry: 'source-turn-start', remaining: 2 });
  battle = advanceTo(battle, kenId, rng);
  const resolution = resolveBattleCommand(battle, { kind: 'skill', actorId: kenId, abilityId: 'needlework', targetIds: [foeId] }, rng);
  // The consuming hit takes 1.35 + 0.20 Needlework = 1.55x damage; the other two hits are unchanged.
  assert.ok(resolution.events.some(e => e.type === 'message' && e.text.includes('55% damage')), 'mark 35% plus Needlework 20%, no passive');
  assert.equal(resolution.events.filter(e => e.type === 'message' && e.text.includes('% damage')).length, 1, 'the bonus applies once per action, not per hit');
});

test('a mark cannot be consumed twice by one multi-hit action', () => {
  const rng = new SeededRng(777);
  let battle = kenParty(['ken','leandre','marcus']);
  const kenId = unitOf(battle, 'ken');
  const leandreId = unitOf(battle, 'leandre');
  battle.effects.push({ uid: 'fx-mark', id: 'ink-mark', sourceUnitId: kenId, targetUnitId: battle.enemies[0], expiry: 'source-turn-start', remaining: 2 });
  battle = advanceTo(battle, leandreId, rng);
  const resolution = resolveBattleCommand(battle, { kind: 'skill', actorId: leandreId, abilityId: 'scatter', targetIds: [battle.enemies[0]] }, rng);
  assert.equal(resolution.events.filter(e => e.type === 'effectRemoved' && e.effectId === 'ink-mark').length, 1);
});

import { validatePlayerCommand } from '../../.domain-build/core/combat/actions.js';

test('Protective Script is rejected when it would add no new or later Script', () => {
  const battle = kenParty();
  const kenId = unitOf(battle, 'ken');
  const marcusId = unitOf(battle, 'marcus');
  battle.turnIndex = battle.turnOrder.indexOf(kenId);
  battle.effects.push({ uid: 'fx-s', id: 'script', sourceUnitId: kenId, targetUnitId: marcusId, expiry: 'source-turn-start', remaining: 2 });
  const verdict = validatePlayerCommand(battle, { kind: 'skill', actorId: kenId, abilityId: 'protective-script', targetIds: [marcusId] });
  assert.equal(verdict.legal, false);
  assert.match(verdict.reason, /already/i);
});

test('Blackwork spends a mark Ken set himself, and hits without one', () => {
  const foeId = kenParty().enemies[0];
  const hit = (withMark) => {
    const battle = kenParty();
    const kenId = unitOf(battle, 'ken');
    const foe = battle.units[foeId];
    foe.hp = foe.maxHp = 9999;
    if (withMark) battle.effects.push({ uid: 'fx-m', id: 'ink-mark', sourceUnitId: kenId, targetUnitId: foeId, expiry: 'source-turn-start', remaining: 2 });
    battle.turnIndex = battle.turnOrder.indexOf(kenId);
    const before = battle.units[foeId].hp;
    const next = resolveBattleCommand(battle, { kind: 'skill', actorId: kenId, abilityId: 'blackwork', targetIds: [foeId] }, new SeededRng(31)).nextState;
    return { dealt: before - next.units[foeId].hp, marks: next.effects.filter(e => e.id === 'ink-mark').length };
  };
  const bare = hit(false);
  const marked = hit(true);
  assert.equal(bare.dealt > 0, true, 'Blackwork must stay usable with no mark standing');
  assert.equal(marked.marks, 0, 'Blackwork left the mark unspent');
  assert.equal(marked.dealt > bare.dealt, true, `mark added nothing: ${bare.dealt} -> ${marked.dealt}`);
});

test('Needlework stays legal with no mark available', () => {
  const battle = kenParty();
  const kenId = unitOf(battle, 'ken');
  battle.turnIndex = battle.turnOrder.indexOf(kenId);
  assert.equal(validatePlayerCommand(battle, { kind: 'skill', actorId: kenId, abilityId: 'needlework', targetIds: [battle.enemies[0]] }).legal, true);
});
