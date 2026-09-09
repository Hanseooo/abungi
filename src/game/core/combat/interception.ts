import type { BattleState, BattleUnit, CombatEvent } from '../types.js';
import { BALANCE } from '../../balance/constants.js';
import { clearEffectsForUnit, consumeEffect, findEffect } from './battleEffects.js';

function loseHp(unit: BattleUnit, amount: number): number {
  const before = unit.hp;
  unit.hp = Math.max(0, before - amount);
  unit.alive = unit.hp > 0;
  return before - unit.hp;
}

/**
 * Runs the incoming-effect stage of one hostile hit, between existing relic mitigation
 * and the recipient's HP loss. Returns the recipient's final damage.
 *
 * Transferred damage takes NO second defensive pass and cannot recurse: it is applied
 * directly here, never through damageOne.
 *
 * Part D inserts Script evaluation at the marked seam, before the Protect split.
 */
export function applyIncomingEffects(
  state: BattleState, attacker: BattleUnit, target: BattleUnit, damage: number, events: CombatEvent[],
): number {
  let amount = damage;

  const script = findEffect(state, 'script', target.id);
  if (script && amount >= Math.ceil(BALANCE.ken.scriptThresholdPercent * target.maxHp)) {
    // A share of the hit rather than a flat block, so one Script keeps meaning something
    // against a boss swing instead of shaving a fixed 10 off a region-3 hit.
    const prevented = Math.min(Math.max(BALANCE.ken.scriptPreventFloor, Math.round(amount * BALANCE.ken.scriptPreventPercent)), amount);
    amount -= prevented;
    consumeEffect(state, script.uid, events);
    events.push({ type: 'prevented', kind: 'script', targetId: target.id, amount: prevented });
  }

  const link = findEffect(state, 'protect', target.id);
  if (!link) return amount;

  const source = state.units[link.sourceUnitId];
  if (!source?.alive) { clearEffectsForUnit(state, link.sourceUnitId, events); return amount; }

  const redirected = Math.floor(amount / 2);
  if (redirected <= 0) return amount;

  let transfer = Math.ceil(redirected / 2);
  const passiveAvailable = source.sourceId === 'saq' && Number(source.flags.classMonitorRound ?? 0) !== state.round;
  if (passiveAvailable && transfer > 0) {
    const prevented = Math.min(BALANCE.saq.classMonitorPrevention, transfer);
    transfer -= prevented;
    source.flags.classMonitorRound = state.round;
    events.push({ type: 'prevented', kind: 'class-monitor', targetId: source.id, amount: prevented });
  }

  consumeEffect(state, link.uid, events);

  if (transfer > 0) {
    const paid = loseHp(source, transfer);
    events.push({ type: 'transfer', fromId: target.id, toId: source.id, amount: paid });
    if (!source.alive) { events.push({ type: 'knockout', targetId: source.id }); clearEffectsForUnit(state, source.id, events); }
  }

  if (source.alive) { source.flags.readyTurns = 1; events.push({ type: 'ready', actorId: source.id, active: true }); }

  return amount - redirected;
}
