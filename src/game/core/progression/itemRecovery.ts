import { getAbility, getCharacter } from '../../content/characters.js';

export interface PpRecoveryTarget {
  characterId?: string;
  sourceId?: string;
  abilityPP?: Record<string, number>;
  upgradedAbilities?: string[];
}
export interface PpRestoration { abilityId: string; before: number; after: number; }

export function previewItemPp(member: PpRecoveryTarget, amount: number, relicIds: string[]): PpRestoration | null {
  const charId = member.characterId ?? member.sourceId;
  if (!charId || !member.abilityPP) return null;
  const char = getCharacter(charId);
  const scaled = Math.round(amount * (relicIds.includes('blue-tonic-cap') ? 1.25 : 1));
  let best: PpRestoration | null = null;
  for (const abilityId of char.abilities) {
    const before = member.abilityPP[abilityId] ?? 0;
    const ability = getAbility(abilityId);
    const max = ability.maxPP + (member.upgradedAbilities?.includes(abilityId) ? ability.upgrade.maxPPDelta ?? 0 : 0);
    if (before >= max) continue;
    if (best === null || before < best.before) {
      best = { abilityId, before, after: Math.min(max, before + scaled) };
    }
  }
  return best;
}
