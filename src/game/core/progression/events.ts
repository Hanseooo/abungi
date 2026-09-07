import type { RunState } from '../types.js';
import { getEvent } from '../../content/events.js';
import { SeededRng } from '../rng/seededRng.js';
import { RELICS } from '../../content/relics.js';
import { BALANCE } from '../../balance/constants.js';
import { getAbility, getCharacter } from '../../content/characters.js';

const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
export interface EventResolution {run:RunState;resultText:string;battleEncounterId?:string}
export function canChooseEvent(run:RunState,eventId:string,choiceId:string):{allowed:boolean;reason?:string}{
  const choice=getEvent(eventId).choices.find(c=>c.id===choiceId);if(!choice)return{allowed:false,reason:'Unknown choice.'};
  const spend=choice.effects.reduce((total,effect)=>{
    if(effect.kind==='coins'&&effect.amount<0)return total-effect.amount;
    if(effect.kind==='wagerCoins')return total+effect.cost;
    return total;
  },0);
  if(run.coins<spend)return{allowed:false,reason:`Need ${spend} coins.`};

  const inventoryFull=run.inventory.reduce((sum,entry)=>sum+entry.quantity,0)>=BALANCE.inventoryCapacity;
  const hasItemReward=choice.effects.some(effect=>effect.kind==='item');
  const onlyItemValue=choice.effects.every(effect=>effect.kind==='item'||(effect.kind==='coins'&&effect.amount<=0)||(effect.kind==='partyHpPercent'&&effect.amount<=0));
  if(inventoryFull&&hasItemReward&&onlyItemValue)return{allowed:false,reason:'Your pack is full; there is no room for that item.'};

  const relicReward=choice.effects.some(effect=>effect.kind==='randomRelic');
  if(relicReward&&RELICS.every(relic=>run.relicIds.includes(relic.id)))return{allowed:false,reason:'You have already discovered every relic this event can offer.'};

  const paidHealing=spend>0&&choice.effects.some(effect=>effect.kind==='partyHpPercent'&&effect.amount>0);
  if(paidHealing){
    const anyMissing=run.party.some(member=>{if(member.hp<=0)return false;const character=getCharacter(member.characterId);return member.hp<character.stats.maxHp;});
    if(!anyMissing)return{allowed:false,reason:'Every living ally is already at full HP.'};
  }
  const paidPp=spend>0&&choice.effects.some(effect=>effect.kind==='restoreMissingPpPercent'&&effect.amount>0);
  if(paidPp){
    const anyMissing=run.party.some(member=>{const character=getCharacter(member.characterId);return character.abilities.some(id=>{const ability=getAbility(id);const max=ability.maxPP+(member.upgradedAbilities.includes(id)?ability.upgrade.maxPPDelta??0:0);return member.abilityPP[id]<max;});});
    if(!anyMissing)return{allowed:false,reason:'The party already has full PP.'};
  }
  return{allowed:true};
}
export function applyEventChoice(input:RunState,eventId:string,choiceId:string,rng:SeededRng):EventResolution{
  const legality=canChooseEvent(input,eventId,choiceId);if(!legality.allowed)throw new Error(legality.reason);
  const run=clone(input);const event=getEvent(eventId);const choice=event.choices.find(c=>c.id===choiceId);if(!choice)throw new Error('Unknown event choice.');let battleEncounterId:string|undefined;let resultText=choice.resultText;
  for(const effect of choice.effects){
    if(effect.kind==='coins'){run.coins=Math.max(0,run.coins+effect.amount);continue;}
    if(effect.kind==='wagerCoins'){
      run.coins-=effect.cost;
      if(rng.chance(effect.winChance)){run.coins+=effect.payout;resultText=`${choice.resultText} You win ${effect.payout} coins.`;}
      else resultText=`${choice.resultText} You lose the ${effect.cost}-coin wager.`;
      continue;
    }
    if(effect.kind==='partyHpPercent'){for(const member of run.party){if(member.hp<=0)continue;const c=getCharacter(member.characterId);member.hp=Math.max(1,Math.min(c.stats.maxHp,member.hp+Math.round(c.stats.maxHp*effect.amount)));}continue;}
    if(effect.kind==='restoreMissingPpPercent'){for(const member of run.party){const c=getCharacter(member.characterId);for(const id of c.abilities){const a=getAbility(id);const max=a.maxPP+(member.upgradedAbilities.includes(id)?a.upgrade.maxPPDelta??0:0);const missing=Math.max(0,max-member.abilityPP[id]);member.abilityPP[id]=Math.min(max,member.abilityPP[id]+Math.round(missing*effect.amount*(run.relicIds.includes('blue-tonic-cap')?1.25:1)));}}continue;}
    if(effect.kind==='item'){const count=run.inventory.reduce((s,e)=>s+e.quantity,0);if(count<BALANCE.inventoryCapacity){const entry=run.inventory.find(e=>e.itemId===effect.itemId);if(entry)entry.quantity+=1;else run.inventory.push({itemId:effect.itemId,quantity:1});}else resultText=`${resultText} Your pack is full, so you leave the item behind.`;continue;}
    if(effect.kind==='randomRelic'){const pool=RELICS.filter(r=>!run.relicIds.includes(r.id));if(pool.length)run.relicIds.push(rng.pick(pool).id);continue;}
    if(effect.kind==='battle'){battleEncounterId=effect.encounterId;}
  }
  return{run,resultText,battleEncounterId};
}
