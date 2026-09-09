import { describe, expect, test } from 'vitest';
import type { BattleState, BattleUnit, CombatEvent } from '../../src/game/core/types';
import { combatFeedback, mechanicBadges } from '../../src/features/battle/BattleScreen';

const unit = (sourceId:string, flags:BattleUnit['flags'] = {}):BattleUnit => ({
  id:`ally-0-${sourceId}`, sourceId, displayName:sourceId, side:'ally', affinity:'neutral',
  maxHp:100, hp:100, power:100, guard:100, speed:100, statuses:[], alive:true,
  guardActive:false, flags, abilityPP:{}, upgradedAbilities:[],
});

const battle = (actor:BattleUnit, round=2):BattleState => ({
  encounterId:'normal-fastlane', tier:'normal', units:{[actor.id]:actor}, allies:[actor.id], enemies:[],
  round, turnOrder:[actor.id], turnIndex:0, phase:'input', deployables:[], effects:[], recentEnemyMoves:{},
  flags:{}, coinsDelta:0, availableCoins:0, relicIds:[],
});

describe('battle mechanic feedback', () => {
  test('shows only compact, actionable current-state badges', () => {
    expect(mechanicBadges(unit('saq', {readyTurns:1}), battle(unit('saq', {readyTurns:1})))).toEqual(['READY · DISMISSED +60%']);
    expect(mechanicBadges(unit('nathaniel'), {...battle(unit('nathaniel')), units:{'ally-0-nathaniel':{...unit('nathaniel'), hp:39}}})).toEqual(['DARK HUNGER · POWER +20%']);
    expect(mechanicBadges(unit('michael'), battle(unit('michael')))).toEqual(['STEADY AIM · READY']);
    expect(mechanicBadges(unit('michael', {steadyAimUsed:true}), battle(unit('michael', {steadyAimUsed:true})))).toEqual([]);
  });

  test('reports Ready and Class Monitor together when Saq is holding both', () => {
    const saq = unit('saq', {readyTurns:1});
    const state = battle(saq);
    state.effects = [{uid:'fx-1', id:'protect', sourceUnitId:saq.id, targetUnitId:'ally-1-hans', expiry:'source-turn-start', remaining:1}];
    expect(mechanicBadges(saq, state)).toEqual(['READY · DISMISSED +60%', 'CLASS MONITOR · READY']);
  });

  test('turns linked-effect events into readable outcome text', () => {
    const events:CombatEvent[] = [
      {type:'effectApplied', effectId:'protect', sourceId:'ally-0-saq', targetId:'ally-1-hans', remaining:1},
      {type:'prevented', kind:'class-monitor', targetId:'ally-0-saq', amount:5},
      {type:'transfer', fromId:'ally-1-hans', toId:'ally-0-saq', amount:7},
      {type:'ready', actorId:'ally-0-saq', active:true},
    ];
    expect(combatFeedback(events)).toEqual(['PROTECT APPLIED', 'CLASS MONITOR BLOCKED 5', 'SAQ COVERED 7', 'READY GAINED']);
  });

  test('names Ink Mark consumption instead of silently removing it', () => {
    expect(combatFeedback([{type:'effectRemoved', effectId:'ink-mark', targetId:'enemy-0-wisp', reason:'consumed'}])).toEqual(['INK MARK TRIGGERED']);
  });

  test('surfaces engine messages, the only report a passive payoff ever gets', () => {
    expect(combatFeedback([
      {type:'message', text:"Ink Mark adds 50% damage to Earl's hit."},
      {type:'message', text:'Momentum 2/3'},
    ])).toEqual(["INK MARK ADDS 50% DAMAGE TO EARL'S HIT.", 'MOMENTUM 2/3']);
  });
});
