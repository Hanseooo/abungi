import type { BattleState } from '../types.js';
import { effectiveSpeed } from './status.js';

export function calculateTurnOrder(state: Pick<BattleState, 'units'>): string[] {
  return Object.values(state.units)
    .filter(unit => unit.alive && unit.hp > 0)
    .sort((a, b) => effectiveSpeed(b) - effectiveSpeed(a) || a.id.localeCompare(b.id))
    .map(unit => unit.id);
}
