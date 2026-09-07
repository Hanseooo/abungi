import type { Affinity, BattleUnit } from '../types.js';
import type { SeededRng } from '../rng/seededRng.js';
import { BALANCE } from '../../balance/constants.js';
import { affinityLabel, affinityMultiplier } from './affinity.js';
import { effectivePower, incomingDamageMultiplier } from './status.js';

export interface DamageInput {
  attacker: BattleUnit;
  defender: BattleUnit;
  power: number;
  moveAffinity: Affinity;
  rng: SeededRng;
  forceCrit?: boolean;
  variance?: number;
  outgoingMultiplier?: number;
}

export interface DamageResult {
  amount: number;
  critical: boolean;
  affinity: 'advantage' | 'resisted' | 'normal';
}

export function calculateDamage(input: DamageInput): DamageResult {
  const raw = input.power * effectivePower(input.attacker) / 100;
  const mitigated = raw * 100 / (100 + Math.max(0, input.defender.guard));
  const affinity = affinityMultiplier(input.moveAffinity, input.defender.affinity);
  const variance = input.variance ?? (BALANCE.damageVarianceMin + input.rng.next() * (BALANCE.damageVarianceMax - BALANCE.damageVarianceMin));
  const critical = input.forceCrit ?? input.rng.chance(BALANCE.criticalChance);
  const crit = critical ? BALANCE.criticalMultiplier : 1;
  const incoming = incomingDamageMultiplier(input.defender);
  const outgoing = input.outgoingMultiplier ?? 1;
  const amount = Math.max(1, Math.round(mitigated * affinity * variance * crit * incoming * outgoing));
  return { amount, critical, affinity: affinityLabel(input.moveAffinity, input.defender.affinity) };
}
