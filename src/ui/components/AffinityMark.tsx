import type { Affinity } from '../../game/core/types';
const glyph:Record<Affinity,string>={might:'M',tech:'T',trick:'K',mystic:'Y',neutral:'N'};
export function AffinityMark({affinity,small=false}:{affinity:Affinity;small?:boolean}){return <span className={`affinity affinity-${affinity}${small?' affinity-small':''}`} aria-label={`${affinity} affinity`}><b aria-hidden="true">{glyph[affinity]}</b><span>{affinity}</span></span>;}
