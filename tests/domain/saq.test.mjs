import test from 'node:test';
import assert from 'node:assert/strict';
import { applyIncomingEffects } from '../../.domain-build/core/combat/interception.js';
import { addEffect, EFFECT_LIFETIMES, tickSourceTurnStart } from '../../.domain-build/core/combat/battleEffects.js';

function scenario({ saqHp = 116, round = 1, classMonitorRound = 0 } = {}) {
  const saq = { id: 'ally-0-saq', sourceId: 'saq', side: 'ally', hp: saqHp, maxHp: 116, alive: saqHp > 0, flags: classMonitorRound ? { classMonitorRound } : {} };
  const hans = { id: 'ally-1-hans', sourceId: 'hans', side: 'ally', hp: 92, maxHp: 92, alive: true, flags: {} };
  const foe = { id: 'enemy-0-wisp', sourceId: 'wisp', side: 'enemy', hp: 58, maxHp: 58, alive: true, flags: {} };
  const state = { round, effects: [], flags: {}, units: { [saq.id]: saq, [hans.id]: hans, [foe.id]: foe }, allies: [saq.id, hans.id], enemies: [foe.id] };
  addEffect(state, { id: 'protect', sourceUnitId: saq.id, targetUnitId: hans.id, expiry: 'source-turn-start', remaining: 1 });
  return { state, saq, hans, foe };
}

test('a 40-damage hit splits 20 to the recipient and 2 to Saq after Class Monitor', () => {
  const { state, saq, hans, foe } = scenario();
  const events = [];
  const recipientDamage = applyIncomingEffects(state, foe, hans, 40, events);
  assert.equal(recipientDamage, 20, 'recipient keeps B - floor(B/2)');
  assert.equal(saq.hp, 114, 'transfer is ceil(20/2) = 10, minus 8 prevented = 2');
  assert.deepEqual(events.filter(e => e.type === 'prevented'), [{ type: 'prevented', kind: 'class-monitor', targetId: saq.id, amount: 8 }]);
  assert.deepEqual(events.filter(e => e.type === 'transfer'), [{ type: 'transfer', fromId: hans.id, toId: saq.id, amount: 2 }]);
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

import { SeededRng } from '../../.domain-build/core/rng/seededRng.js';
import { createBattle, resolveBattleCommand } from '../../.domain-build/core/combat/battleEngine.js';

const saqParty = (encounter = 'normal-fastlane', seed = 777) =>
  createBattle(['saq','hans','marcus'], encounter, new SeededRng(seed), { coins: 30 });

test('Take Your Seat links Saq to a chosen ally and cannot target himself', () => {
  const rng = new SeededRng(777);
  let battle = saqParty();
  const saqId = battle.allies.find(id => battle.units[id].sourceId === 'saq');
  const hansId = battle.allies.find(id => battle.units[id].sourceId === 'hans');
  // Fast-forward to Saq's turn by guarding with whoever acts first.
  while (battle.turnOrder[battle.turnIndex] !== saqId) {
    battle = resolveBattleCommand(battle, { kind: 'guard', actorId: battle.turnOrder[battle.turnIndex] }, rng).nextState;
  }
  const resolution = resolveBattleCommand(battle, { kind: 'skill', actorId: saqId, abilityId: 'take-your-seat', targetIds: [hansId] }, rng);
  const link = resolution.nextState.effects.find(effect => effect.id === 'protect');
  assert.ok(link, 'the skill applies a protect link');
  assert.equal(link.sourceUnitId, saqId);
  assert.equal(link.targetUnitId, hansId);
  assert.ok(resolution.events.some(e => e.type === 'effectApplied' && e.effectId === 'protect'));
});

test('Ready expires at the end of Saq next completed turn if it is not spent', () => {
  const rng = new SeededRng(777);
  let battle = saqParty();
  const saqId = battle.allies.find(id => battle.units[id].sourceId === 'saq');
  battle.units[saqId].flags.readyTurns = 1;
  while (battle.turnOrder[battle.turnIndex] !== saqId) {
    battle = resolveBattleCommand(battle, { kind: 'guard', actorId: battle.turnOrder[battle.turnIndex] }, rng).nextState;
  }
  battle = resolveBattleCommand(battle, { kind: 'guard', actorId: saqId }, rng).nextState;
  assert.equal(Number(battle.units[saqId].flags.readyTurns ?? 0), 0, 'Ready survives the start of that turn, then expires when it completes');
});

test('Dismissed consumes Ready for extra power even when it misses', () => {
  const rng = new SeededRng(777);
  let battle = saqParty();
  const saqId = battle.allies.find(id => battle.units[id].sourceId === 'saq');
  battle.units[saqId].flags.readyTurns = 1;
  while (battle.turnOrder[battle.turnIndex] !== saqId) {
    battle = resolveBattleCommand(battle, { kind: 'guard', actorId: battle.turnOrder[battle.turnIndex] }, rng).nextState;
  }
  const foeId = battle.enemies.find(id => battle.units[id].alive);
  battle = resolveBattleCommand(battle, { kind: 'skill', actorId: saqId, abilityId: 'dismissed', targetIds: [foeId] }, rng).nextState;
  assert.equal(Number(battle.units[saqId].flags.readyTurns ?? 0), 0);
});

import { validatePlayerCommand } from '../../.domain-build/core/combat/actions.js';

test('Protect cannot target Saq himself', () => {
  const battle = saqParty();
  const saqId = battle.allies.find(id => battle.units[id].sourceId === 'saq');
  battle.turnIndex = battle.turnOrder.indexOf(saqId);
  const verdict = validatePlayerCommand(battle, { kind: 'skill', actorId: saqId, abilityId: 'take-your-seat', targetIds: [saqId] });
  assert.equal(verdict.legal, false);
  assert.match(verdict.reason, /another ally/i);
});

test('refreshing an identical Protect with no added lifetime is rejected', () => {
  const battle = saqParty();
  const saqId = battle.allies.find(id => battle.units[id].sourceId === 'saq');
  const hansId = battle.allies.find(id => battle.units[id].sourceId === 'hans');
  battle.turnIndex = battle.turnOrder.indexOf(saqId);
  addEffect(battle, { id: 'protect', sourceUnitId: saqId, targetUnitId: hansId, ...EFFECT_LIFETIMES.protect });
  const verdict = validatePlayerCommand(battle, { kind: 'skill', actorId: saqId, abilityId: 'take-your-seat', targetIds: [hansId] });
  assert.equal(verdict.legal, false);
  assert.match(verdict.reason, /already protected/i);
});

test('Protect stands through a full enemy round instead of expiring before it is tested',()=>{
  // Saq is mid-speed, so a one-turn link often lapsed before any single-target attack arrived.
  assert.equal(EFFECT_LIFETIMES.protect.remaining,2,'the link survives one source-turn tick');
  const state={round:1,effects:[],flags:{},units:{},allies:[],enemies:[]};
  addEffect(state,{id:'protect',sourceUnitId:'ally-0-saq',targetUnitId:'ally-1-hans',...EFFECT_LIFETIMES.protect});
  const events=[];
  tickSourceTurnStart(state,'ally-0-saq',events);
  assert.equal(state.effects.length,1,'still standing after Saq begins his next turn');
  tickSourceTurnStart(state,'ally-0-saq',events);
  assert.equal(state.effects.length,0,'gone by the turn after that');
});

test('a Protect with lifetime left to gain can be refreshed, an equal one cannot',()=>{
  const battle=createBattle(['saq','hans','earl'],'normal-scrap',new SeededRng(5));
  const saqId=battle.allies.find(id=>battle.units[id].sourceId==='saq');
  const hansId=battle.allies.find(id=>battle.units[id].sourceId==='hans');
  battle.turnOrder=[saqId,...battle.turnOrder.filter(id=>id!==saqId)];battle.turnIndex=0;battle.phase='input';
  const cmd={kind:'skill',actorId:saqId,abilityId:'take-your-seat',targetIds:[hansId]};

  battle.effects=[{uid:'fx-a',id:'protect',sourceUnitId:saqId,targetUnitId:hansId,expiry:'source-turn-start',remaining:EFFECT_LIFETIMES.protect.remaining}];
  assert.equal(validatePlayerCommand(battle,cmd).legal,false,'a full-length link is not worth recasting');

  battle.effects=[{uid:'fx-b',id:'protect',sourceUnitId:saqId,targetUnitId:hansId,expiry:'source-turn-start',remaining:1}];
  assert.equal(validatePlayerCommand(battle,cmd).legal,true,'a link down to its last turn can be renewed');
});
