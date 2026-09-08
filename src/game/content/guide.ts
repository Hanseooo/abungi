import type { Affinity, BattleEffectId, StatusId } from '../core/types.js';
import { BALANCE } from '../balance/constants.js';

export interface StatusGuideEntry {id:StatusId;name:string;short:string;description:string;positive:boolean}
export const STATUS_GUIDE:StatusGuideEntry[]=[
  {id:'strength',name:'Strength',short:'STR',positive:true,description:`Power ×${BALANCE.status.strengthPowerMultiplier}. Same-status reapplication refreshes duration; it does not stack the multiplier.`},
  {id:'weaken',name:'Weaken',short:'WEAK',positive:false,description:`Power ×${BALANCE.status.weakenPowerMultiplier}.`},
  {id:'haste',name:'Haste',short:'HASTE',positive:true,description:`Speed ×${BALANCE.status.hasteSpeedMultiplier}. Speed changes affect the next round's turn order.`},
  {id:'slow',name:'Slow',short:'SLOW',positive:false,description:`Speed ×${BALANCE.status.slowSpeedMultiplier}. Speed changes affect the next round's turn order.`},
  {id:'blind',name:'Blind',short:'BLIND',positive:false,description:`Hit chance ×${BALANCE.status.blindAccuracyMultiplier}. A move's damage and attached status share the same accuracy roll.`},
  {id:'fortified',name:'Fortified',short:'FORT',positive:true,description:`Incoming damage ×${BALANCE.status.fortifiedDamageMultiplier}. It can coexist with Guard, but Fortified does not stack with itself.`},
  {id:'exposed',name:'Exposed',short:'EXPOSED',positive:false,description:`Incoming damage ×${BALANCE.status.exposedDamageMultiplier}.`},
];
export const STATUS_GUIDE_MAP=new Map(STATUS_GUIDE.map(entry=>[entry.id,entry]));

export interface EffectGuideEntry {id:BattleEffectId;name:string;short:string;positive:boolean;anchor:string;trigger:string;description:string}
export const EFFECT_GUIDE:EffectGuideEntry[]=[
  {id:'protect',name:'Protect',short:'PROT',positive:true,anchor:'Until the start of the protector’s next turn.',trigger:'The first hit that redirects a positive share of damage.',description:`The protected ally keeps half of the incoming damage. The protector takes half of that redirected half, reduced by up to ${BALANCE.saq.classMonitorPrevention} HP once per round by Class Monitor. The protector's share takes no second Guard, Fortified or relic reduction, and it can knock the protector out. Protect does not cleanse, does not stop HP costs, and does not redirect the attack's status effects.`},
];
export const EFFECT_GUIDE_MAP=new Map(EFFECT_GUIDE.map(entry=>[entry.id,entry]));

export const AFFINITY_GUIDE:Array<{id:Affinity;name:string;beats?:Affinity;description:string}>=[
  {id:'might',name:'Might',beats:'trick',description:'Might has advantage against Trick.'},
  {id:'trick',name:'Trick',beats:'mystic',description:'Trick has advantage against Mystic.'},
  {id:'mystic',name:'Mystic',beats:'tech',description:'Mystic has advantage against Tech.'},
  {id:'tech',name:'Tech',beats:'might',description:'Tech has advantage against Might.'},
  {id:'neutral',name:'Neutral',description:'Neutral has no advantage or resistance relationships.'},
];

export const MECHANIC_GUIDE=[
  {id:'affinity',title:'Affinity',text:`Advantage deals ×${BALANCE.affinityAdvantage}; resistance deals ×${BALANCE.affinityResistance}. Might → Trick → Mystic → Tech → Might. Neutral is always normal.`},
  {id:'duration',title:'Status duration',text:'“2 turns” means the affected unit’s next two turns. Applying or refreshing the effect does not immediately consume one turn; duration decreases after that unit completes a later turn.'},
  {id:'guard',title:'Guard',text:`Guard costs no PP and reduces incoming damage to ${Math.round(BALANCE.guardDamageMultiplier*100)}% until that character’s next turn.`},
  {id:'pp',title:'PP attrition',text:'PP persists between encounters. Ordinary victories do not refill it, so route, item and Rest choices matter.'},
  {id:'speed',title:'Turn order',text:'Each living unit acts once per round. Speed determines order at the start of the round; mid-round Speed changes affect the next round.'},
  {id:'ready',title:'Ready',text:'A successful Protect leaves Saq Ready. Ready lasts through the end of his next completed turn, is spent by Dismissed even on a miss, does not stack, and is lost if he is knocked out.'},
  {id:'boss',title:'Boss forms',text:'Boss affinity is rolled from a small boss-specific pool when the battle begins. It is intentionally secret before the fight and does not rewrite the boss’s authored move affinities.'},
];
