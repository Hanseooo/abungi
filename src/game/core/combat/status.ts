import type { BattleUnit, StatusId, StatusInstance } from '../types.js';
import { BALANCE } from '../../balance/constants.js';

export function hasStatus(unit: BattleUnit, id: StatusId): boolean {
  return unit.statuses.some(status => status.id === id && status.remaining > 0);
}

export function effectivePower(unit: BattleUnit): number {
  let value = unit.power;
  if (hasStatus(unit, 'strength')) value *= BALANCE.status.strengthPowerMultiplier;
  if (hasStatus(unit, 'weaken')) value *= BALANCE.status.weakenPowerMultiplier;
  if (unit.sourceId === 'nathaniel' && unit.hp > 0 && unit.hp / unit.maxHp < 0.4) value *= 1.2;
  return value;
}

export function effectiveSpeed(unit: BattleUnit): number {
  let value = unit.speed;
  if (hasStatus(unit, 'haste')) value *= BALANCE.status.hasteSpeedMultiplier;
  if (hasStatus(unit, 'slow')) value *= BALANCE.status.slowSpeedMultiplier;
  return Math.round(value);
}

export function accuracyMultiplier(unit: BattleUnit): number {
  return hasStatus(unit, 'blind') ? BALANCE.status.blindAccuracyMultiplier : 1;
}

export function incomingDamageMultiplier(unit: BattleUnit): number {
  let value = 1;
  if (unit.guardActive) value *= BALANCE.guardDamageMultiplier;
  if (hasStatus(unit, 'fortified')) value *= BALANCE.status.fortifiedDamageMultiplier;
  if (hasStatus(unit, 'exposed')) value *= BALANCE.status.exposedDamageMultiplier;
  return value;
}

export function applyStatus(statuses: StatusInstance[], id: StatusId, duration: number): StatusInstance[] {
  const current = statuses.find(status => status.id === id);
  if (!current) return [...statuses, { id, remaining: duration }];
  return statuses.map(status => status.id === id ? { ...status, remaining: Math.max(status.remaining, duration) } : status);
}

export function tickStatuses(statuses: StatusInstance[]): StatusInstance[] {
  return statuses
    .map(status => ({ ...status, remaining: status.remaining - 1 }))
    .filter(status => status.remaining > 0);
}

export const NEGATIVE_STATUSES: StatusId[] = ['weaken', 'slow', 'blind', 'exposed'];
export const POSITIVE_STATUSES: StatusId[] = ['strength', 'haste', 'fortified'];
