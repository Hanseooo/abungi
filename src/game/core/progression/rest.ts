import type { RunState } from '../types.js';
import { BALANCE } from '../../balance/constants.js';
import { getAbility, getCharacter } from '../../content/characters.js';

const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
export type RestChoice='recover'|'refresh';

export function applyRestChoice(input:RunState,choice:RestChoice):RunState {
  const run=clone(input);
  for(const member of run.party){
    const character=getCharacter(member.characterId);
    if(choice==='recover'){
      if(member.hp>0) member.hp=Math.min(character.stats.maxHp,member.hp+Math.round(character.stats.maxHp*BALANCE.restRecoverPercent));
    }else{
      for(const id of character.abilities){
        const max=getAbility(id).maxPP+(member.upgradedAbilities.includes(id)?getAbility(id).upgrade.maxPPDelta??0:0);
        const missing=Math.max(0,max-member.abilityPP[id]);
        member.abilityPP[id]=Math.min(max,member.abilityPP[id]+Math.round(missing*BALANCE.restRefreshMissingPercent*(run.relicIds.includes('blue-tonic-cap')?1.25:1)));
      }
    }
  }
  return run;
}
