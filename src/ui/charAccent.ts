import type { CSSProperties } from 'react';
import type { Affinity } from '../game/core/types';

/** One accent per rendered figure. Defaults to the affinity token, so only Earl and Hans differ. */
export function charAccentStyle(source:{affinity:Affinity;accentColor?:string}):CSSProperties {
  return {'--char-accent': source.accentColor ?? `var(--affinity-${source.affinity})`} as CSSProperties;
}
