import type { CSSProperties } from 'react';
import type { Affinity } from '../game/core/types';

/** One accent per rendered figure: the character's affinity, so a border always reads as its type. */
export function charAccentStyle(source:{affinity:Affinity}):CSSProperties {
  return {'--char-accent': `var(--affinity-${source.affinity})`} as CSSProperties;
}
