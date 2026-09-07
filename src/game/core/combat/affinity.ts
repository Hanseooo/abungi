import type { Affinity } from '../types.js';
import { BALANCE } from '../../balance/constants.js';

const ADVANTAGE: Record<Exclude<Affinity, 'neutral'>, Exclude<Affinity, 'neutral'>> = {
  might: 'trick',
  trick: 'mystic',
  mystic: 'tech',
  tech: 'might',
};

export function affinityMultiplier(attacking: Affinity, defending: Affinity): number {
  if (attacking === 'neutral' || defending === 'neutral') return 1;
  if (ADVANTAGE[attacking] === defending) return BALANCE.affinityAdvantage;
  if (ADVANTAGE[defending] === attacking) return BALANCE.affinityResistance;
  return 1;
}

export function affinityLabel(attacking: Affinity, defending: Affinity): 'advantage' | 'resisted' | 'normal' {
  const multiplier = affinityMultiplier(attacking, defending);
  if (multiplier > 1) return 'advantage';
  if (multiplier < 1) return 'resisted';
  return 'normal';
}
