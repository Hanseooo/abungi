import type { BattleEffectId, BattleEffectInstance, BattleState, CombatEvent } from '../types.js';

export interface EffectSpec {
  id: BattleEffectId;
  sourceUnitId: string;
  targetUnitId: string;
  expiry: BattleEffectInstance['expiry'];
  remaining: number;
}

/**
 * How long each effect lives, so content declares an effect id rather than a duration.
 * Protect: until the start of its source's next turn.
 * Ink Mark / Script: until the start of its source's second subsequent turn.
 * Taxed: until the recipient completes its next turn.
 */
export const EFFECT_LIFETIMES: Record<BattleEffectId, Pick<EffectSpec, 'expiry' | 'remaining'>> = {
  'protect': { expiry: 'source-turn-start', remaining: 1 },
  'ink-mark': { expiry: 'source-turn-start', remaining: 2 },
  'script': { expiry: 'source-turn-start', remaining: 2 },
  'taxed': { expiry: 'target-turn-end', remaining: 1 },
};

function nextUid(state: BattleState): string {
  const serial = Number(state.flags.effectSerial ?? 0) + 1;
  state.flags.effectSerial = serial;
  return `fx-${serial}`;
}

/**
 * Applies one effect. A source holds at most one effect of a given id, and a target
 * carries at most one effect of a given id, so reapplication replaces rather than stacks.
 */
export function addEffect(state: BattleState, spec: EffectSpec): BattleEffectInstance {
  state.effects = state.effects.filter(effect =>
    effect.id !== spec.id || (effect.sourceUnitId !== spec.sourceUnitId && effect.targetUnitId !== spec.targetUnitId));
  const effect: BattleEffectInstance = { uid: nextUid(state), ...spec };
  state.effects.push(effect);
  return effect;
}

export function findEffect(state: BattleState, id: BattleEffectId, targetUnitId: string): BattleEffectInstance | undefined {
  return state.effects.find(effect => effect.id === id && effect.targetUnitId === targetUnitId);
}

export function findEffectFromSource(state: BattleState, id: BattleEffectId, sourceUnitId: string): BattleEffectInstance | undefined {
  return state.effects.find(effect => effect.id === id && effect.sourceUnitId === sourceUnitId);
}

export function consumeEffect(state: BattleState, uid: string, events: CombatEvent[]): void {
  const effect = state.effects.find(candidate => candidate.uid === uid);
  if (!effect) return;
  state.effects = state.effects.filter(candidate => candidate.uid !== uid);
  events.push({ type: 'effectRemoved', effectId: effect.id, targetId: effect.targetUnitId, reason: 'consumed' });
}

/** Called before the unit's input becomes available, and before an enemy turn resolves. */
export function tickSourceTurnStart(state: BattleState, unitId: string, events: CombatEvent[]): void {
  const kept: BattleEffectInstance[] = [];
  for (const effect of state.effects) {
    if (effect.expiry !== 'source-turn-start' || effect.sourceUnitId !== unitId) { kept.push(effect); continue; }
    const remaining = effect.remaining - 1;
    if (remaining > 0) kept.push({ ...effect, remaining });
    else events.push({ type: 'effectRemoved', effectId: effect.id, targetId: effect.targetUnitId, reason: 'expired' });
  }
  state.effects = kept;
}

/** Called after the unit completes a turn. */
export function tickTargetTurnEnd(state: BattleState, unitId: string, events: CombatEvent[]): void {
  const kept: BattleEffectInstance[] = [];
  for (const effect of state.effects) {
    if (effect.expiry !== 'target-turn-end' || effect.targetUnitId !== unitId) { kept.push(effect); continue; }
    const remaining = effect.remaining - 1;
    if (remaining > 0) kept.push({ ...effect, remaining });
    else events.push({ type: 'effectRemoved', effectId: effect.id, targetId: effect.targetUnitId, reason: 'expired' });
  }
  state.effects = kept;
}

/** A KO source cannot leave a link waiting forever; a KO recipient loses what it carried. */
export function clearEffectsForUnit(state: BattleState, unitId: string, events: CombatEvent[]): void {
  const kept: BattleEffectInstance[] = [];
  for (const effect of state.effects) {
    if (effect.sourceUnitId === unitId || effect.targetUnitId === unitId) {
      events.push({ type: 'effectRemoved', effectId: effect.id, targetId: effect.targetUnitId, reason: 'cleared' });
    } else kept.push(effect);
  }
  state.effects = kept;
}

export function clearAllEffects(state: BattleState): void {
  state.effects = [];
}
