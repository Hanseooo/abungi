import type { PartyMemberRunState, RunState } from '../types.js';
import { getEvent, type EventSelection } from '../../content/events.js';
import { SeededRng, hashText } from '../rng/seededRng.js';
import { CHARACTERS, getAbility, getCharacter } from '../../content/characters.js';
import { inventoryCapacity, inventoryCount } from './inventory.js';
import { drawRelicIds, eligibleRelics } from './relicDrafts.js';
import { RELICS, getRelic, type RelicDefinition } from '../../content/relics.js';
import { ITEMS, getItem } from '../../content/items.js';

const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;

function pressPools(run:RunState,relicId:string):{common:RelicDefinition[];uncommon:RelicDefinition[]} {
  const owned=new Set(run.relicIds);
  owned.add(relicId);
  const hasHans=run.party.some(member=>member.characterId==='hans');
  const eligible=RELICS.filter(relic=>!owned.has(relic.id)&&(relic.id!=='spare-battery'||hasHans));
  return {
    common:eligible.filter(relic=>relic.rarity==='common'),
    uncommon:eligible.filter(relic=>relic.rarity==='uncommon'),
  };
}
export interface EventResolution {run:RunState;resultText:string;battleEncounterId?:string}
export interface EventOffers {
  itemIds:string[];
  upgrades:Array<{characterId:string;abilityId:string}>;
  recruitIds:string[];
}

export function deriveEventOffers(run:RunState,nodeId:string):EventOffers {
  const node=run.route.nodes.find(candidate=>candidate.id===nodeId);
  if(!node||node.type!=='event'||!node.eventId)throw new Error('Event offers require a route event node.');
  const rng=new SeededRng(run.seed,(hashText(nodeId)^run.seed)>>>0);
  const distinct=<T>(pool:T[],count:number):T[]=>{const copy=[...pool];const picked:T[]=[];while(copy.length&&picked.length<count)picked.push(copy.splice(rng.int(0,copy.length-1),1)[0]);return picked;};
  if(node.eventId==='swap-meet')return {itemIds:distinct(ITEMS.filter(item=>item.rarity!=='rare'&&item.id!=='revive-kit').map(item=>item.id),3),upgrades:[],recruitIds:[]};
  if(node.eventId==='sparring-yard')return {itemIds:[],upgrades:distinct(run.party.flatMap(member=>getCharacter(member.characterId).abilities.filter(abilityId=>!member.upgradedAbilities.includes(abilityId)).map(abilityId=>({characterId:member.characterId,abilityId}))),3),recruitIds:[]};
  if(node.eventId==='fourth-chair')return {itemIds:[],upgrades:[],recruitIds:distinct(CHARACTERS.filter(character=>!run.party.some(member=>member.characterId===character.id)).map(character=>character.id),2)};
  return {itemIds:[],upgrades:[],recruitIds:[]};
}

type RecruitmentSelection = Extract<EventSelection,{kind:'recruit'}>;

function recruitmentValidation(run:RunState, selection:RecruitmentSelection):string|undefined {
  const node=run.currentNodeId&&run.route.nodes.find(candidate=>candidate.id===run.currentNodeId);
  if(!node||node.type!=='event'||node.eventId!=='fourth-chair'||run.completedNodeIds.includes(node.id))return 'This event is no longer available.';
  const offers=deriveEventOffers(run,node.id);
  if(!offers.recruitIds.includes(selection.candidateId))return 'That recruit is no longer available.';
  if(run.party.filter(member=>member.characterId===selection.outgoingCharacterId).length!==1)return 'Choose a current party member to replace.';
  const incoming=getCharacter(selection.candidateId);
  const outgoing=run.party.find(member=>member.characterId===selection.outgoingCharacterId)!;
  const expected=outgoing.upgradedAbilities.length;
  if(incoming.abilities.length<expected)return 'This recruit cannot inherit that many upgrades.';
  if(new Set(selection.upgradeIds).size!==selection.upgradeIds.length)return 'Choose distinct incoming upgrades.';
  if(selection.upgradeIds.length!==expected)return 'Choose exactly '+expected+' incoming upgrades.';
  for(const id of selection.upgradeIds){
    if(!incoming.abilities.includes(id))return 'Choose upgrades from the incoming character.';
  }
  return undefined;
}

export function previewRecruitment(run:RunState, selection:RecruitmentSelection):{member:PartyMemberRunState;warnings:string[]} {
  const reason=recruitmentValidation(run,selection);
  if(reason)throw new Error(reason);
  const incoming=getCharacter(selection.candidateId);
  const outgoing=run.party.find(member=>member.characterId===selection.outgoingCharacterId)!;
  const outgoingCharacter=getCharacter(outgoing.characterId);
  const livingRatio=outgoing.hp<=0?0:outgoing.hp/outgoingCharacter.stats.maxHp;
  const member:PartyMemberRunState={
    characterId:incoming.id,
    hp:outgoing.hp<=0?Math.max(1,Math.round(incoming.stats.maxHp*0.15)):Math.max(1,Math.min(incoming.stats.maxHp,Math.round(incoming.stats.maxHp*livingRatio))),
    abilityPP:{},
    upgradedAbilities:[...selection.upgradeIds],
  };
  const outgoingMax=outgoingCharacter.abilities.reduce((total,id)=>{
    const ability=getAbility(id);
    return total+ability.maxPP+(outgoing.upgradedAbilities.includes(id)?ability.upgrade.maxPPDelta??0:0);
  },0);
  const currentPP=outgoingCharacter.abilities.reduce((total,id)=>total+(outgoing.abilityPP[id]??0),0);
  const ppRatio=outgoingMax>0?Math.max(0,Math.min(1,currentPP/outgoingMax)):0;
  for(const id of incoming.abilities){
    const ability=getAbility(id);
    const max=ability.maxPP+(selection.upgradeIds.includes(id)?ability.upgrade.maxPPDelta??0:0);
    member.abilityPP[id]=Math.max(0,Math.min(max,Math.round(max*ppRatio)));
  }
  const warnings:string[]=[];
  if(outgoing.characterId==='hans')warnings.push('Replacing Hans leaves Spare Battery without an enabler.');
  if(outgoing.characterId==='leandre')warnings.push('Replacing Leandre removes Good Business\'s extra shop offer.');
  return {member,warnings};
}

export function previewEventChoice(run:RunState,eventId:string,choiceId:string):{hpDelta:number;ppDelta:number} {
  const choice=getEvent(eventId).choices.find(candidate=>candidate.id===choiceId);
  if(!choice)throw new Error('Unknown event choice.');
  let hpDelta=0;let ppDelta=0;
  for(const effect of choice.effects){
    if(effect.kind==='partyHpPercent')for(const member of run.party){
      if(member.hp<=0)continue;
      const character=getCharacter(member.characterId);
      const after=Math.max(1,Math.min(character.stats.maxHp,member.hp+Math.round(character.stats.maxHp*effect.amount)));
      hpDelta+=after-member.hp;
    }
    if(effect.kind==='restoreMissingPpPercent')for(const member of run.party){
      const character=getCharacter(member.characterId);
      for(const id of character.abilities){
        const ability=getAbility(id);
        const max=ability.maxPP+(member.upgradedAbilities.includes(id)?ability.upgrade.maxPPDelta??0:0);
        const before=member.abilityPP[id];
        const after=Math.min(max,before+Math.round(Math.max(0,max-before)*effect.amount*(run.relicIds.includes('blue-tonic-cap')?1.25:1)));
        ppDelta+=after-before;
      }
    }
  }
  return {hpDelta,ppDelta};
}

export function canChooseEvent(run:RunState,eventId:string,choiceId:string,selection?:EventSelection):{allowed:boolean;reason?:string}{
  const choice=getEvent(eventId).choices.find(c=>c.id===choiceId);if(!choice)return{allowed:false,reason:'Unknown choice.'};
  const special=choice.effects.find(effect=>effect.kind==='tradeItems'||effect.kind==='pawnItem'||effect.kind==='upgradeAbility'||effect.kind==='pressRelic'||effect.kind==='recruit');
  if(special){
    const node=run.currentNodeId&&run.route.nodes.find(candidate=>candidate.id===run.currentNodeId);
    if(!node||node.type!=='event'||node.eventId!==eventId||run.completedNodeIds.includes(node.id))return {allowed:false,reason:'This event is no longer available.'};
    if(!selection){
      if(special.kind==='pressRelic'){
        const ownedCommons=run.relicIds.filter(id=>{try{return getRelic(id).rarity==='common';}catch{return false;}});
        const pools=ownedCommons.map(id=>pressPools(run,id));
        if(!pools.some(pool=>pool.common.length))return{allowed:false,reason:'No unowned Common relic is available.'};
        if(special.mode==='risk'&&!pools.some(pool=>pool.common.length&&pool.uncommon.length))return{allowed:false,reason:'No unowned Uncommon relic is available.'};
        return{allowed:true};
      }
      if(special.kind==='recruit')return deriveEventOffers(run,node.id).recruitIds.length>=2?{allowed:true}:{allowed:false,reason:'No recruit candidates are available.'};
      return special.kind==='tradeItems'?{allowed:false,reason:'Need two items to trade.'}:special.kind==='pawnItem'?{allowed:false,reason:'Need an item to pawn.'}:{allowed:false,reason:'Choose an ability to train.'};
    }
    const offers=deriveEventOffers(run,node.id);
    if(special.kind==='tradeItems'){
      if(selection.kind!=='tradeItems'||selection.itemIds.length!==2)return {allowed:false,reason:'Need two items to trade.'};
      if(!offers.itemIds.includes(selection.offeredItemId))return {allowed:false,reason:'That offer is no longer available.'};
      const requested=new Map<string,number>();for(const id of selection.itemIds)requested.set(id,(requested.get(id)??0)+1);
      for(const [id,count] of requested){const owned=run.inventory.find(entry=>entry.itemId===id)?.quantity??0;if(owned<count)return {allowed:false,reason:'You no longer own those items.'};}
    }
    if(special.kind==='pawnItem'&&(selection.kind!=='pawnItem'||!(run.inventory.find(entry=>entry.itemId===selection.itemId)?.quantity)))return {allowed:false,reason:'Need an item to pawn.'};
    if(special.kind==='upgradeAbility'){
      if(!offers.upgrades.length)return {allowed:false,reason:'The party has no un-upgraded abilities.'};
      if(selection.kind!=='upgradeAbility'||!offers.upgrades.some(offer=>offer.characterId===selection.characterId&&offer.abilityId===selection.abilityId))return {allowed:false,reason:'That ability is no longer available.'};
    }
    if(special.kind==='pressRelic'){
      if(selection.kind!=='pressRelic')return{allowed:false,reason:'Need an owned Common relic.'};
      let relic:RelicDefinition;
      try{relic=getRelic(selection.relicId);}catch{return{allowed:false,reason:'Need an owned Common relic.'};}
      if(relic.rarity!=='common'||!run.relicIds.includes(selection.relicId))return{allowed:false,reason:'Need an owned Common relic.'};
      const pools=pressPools(run,selection.relicId);
      if(!pools.common.length)return{allowed:false,reason:'No unowned Common relic is available.'};
      if(special.mode==='risk'&&!pools.uncommon.length)return{allowed:false,reason:'No unowned Uncommon relic is available.'};
    }
    if(special.kind==='recruit'){
      if(selection.kind!=='recruit')return{allowed:false,reason:'Choose a recruit replacement.'};
      const reason=recruitmentValidation(run,selection);
      if(reason)return{allowed:false,reason};
    }
  }
  if(choice.requiresCharacterId&&!run.party.some(member=>member.characterId===choice.requiresCharacterId))return{allowed:false,reason:'The required character is not in your party.'};
  const spend=choice.effects.reduce((total,effect)=>{
    if(effect.kind==='coins'&&effect.amount<0)return total-effect.amount;
    if(effect.kind==='wagerCoins')return total+effect.cost;
    return total;
  },0);
  if(run.coins<spend)return{allowed:false,reason:`Need ${spend} coins.`};

  const itemRewardCount=choice.effects.filter(effect=>effect.kind==='item').length;
  const hasItemReward=itemRewardCount>0;
  const onlyItemValue=choice.effects.every(effect=>effect.kind==='item'||(effect.kind==='coins'&&effect.amount<=0)||(effect.kind==='partyHpPercent'&&effect.amount<=0));
  const hasResourceCost=choice.effects.some(effect=>(effect.kind==='coins'&&effect.amount<0)||effect.kind==='wagerCoins'||(effect.kind==='partyHpPercent'&&effect.amount<0));
  if(hasItemReward&&(hasResourceCost||onlyItemValue)&&inventoryCount(run)+itemRewardCount>inventoryCapacity(run))return{allowed:false,reason:'Your pack is too full; there is not enough room for those items.'};

  const relicReward=choice.effects.some(effect=>effect.kind==='randomRelic');
  if(relicReward&&!eligibleRelics(run,'folded-tokens').length)return{allowed:false,reason:'You already own every relic this event can offer.'};

  const paidHealing=spend>0&&choice.effects.some(effect=>effect.kind==='partyHpPercent'&&effect.amount>0);
  if(paidHealing){
    const anyMissing=run.party.some(member=>{if(member.hp<=0)return false;const character=getCharacter(member.characterId);return member.hp<character.stats.maxHp;});
    if(!anyMissing)return{allowed:false,reason:'Every living ally is already at full HP.'};
  }
  const paidPp=hasResourceCost&&choice.effects.some(effect=>effect.kind==='restoreMissingPpPercent'&&effect.amount>0);
  if(paidPp){
    if(previewEventChoice(run,eventId,choiceId).ppDelta<=0)return{allowed:false,reason:'The party already has full PP.'};
  }
  return{allowed:true};
}
export function applyEventChoice(input:RunState,eventId:string,choiceId:string,rng:SeededRng,selection?:EventSelection):EventResolution{
  const legality=canChooseEvent(input,eventId,choiceId,selection);if(!legality.allowed)throw new Error(legality.reason);
  const run=clone(input);const event=getEvent(eventId);const choice=event.choices.find(c=>c.id===choiceId);if(!choice)throw new Error('Unknown event choice.');let battleEncounterId:string|undefined;let resultText=choice.resultText;
  for(const effect of choice.effects){
    if(effect.kind==='recruit'){
      if(selection?.kind!=='recruit')throw new Error('Choose a recruit replacement.');
      const preview=previewRecruitment(run,selection);
      const index=run.party.findIndex(member=>member.characterId===selection.outgoingCharacterId);
      run.party[index]=preview.member;
      continue;
    }
    if(effect.kind==='pressRelic'){
      if(selection?.kind!=='pressRelic')throw new Error('Need an owned Common relic.');
      const pools=pressPools(run,selection.relicId);
      let outputId:string|undefined;
      if(effect.mode==='safe'){
        outputId=rng.pick(pools.common).id;
      }else{
        const roll=rng.next();
        if(roll<.45)outputId=rng.pick(pools.uncommon).id;
        else if(roll<.80)outputId=rng.pick(pools.common).id;
      }
      const sacrificed=getRelic(selection.relicId);
      run.relicIds.splice(run.relicIds.indexOf(selection.relicId),1);
      if(outputId){
        run.relicIds.push(outputId);
        resultText=choice.resultText+' '+sacrificed.name+' becomes '+getRelic(outputId).name+'.';
      }else resultText=choice.resultText+' '+sacrificed.name+' is destroyed.';
      continue;
    }
    if(effect.kind==='tradeItems'){
      if(selection?.kind!=='tradeItems')throw new Error('Need two items to trade.');
      const requested=new Map<string,number>();for(const id of selection.itemIds)requested.set(id,(requested.get(id)??0)+1);
      for(const [id,count] of requested){const entry=run.inventory.find(item=>item.itemId===id)!;entry.quantity-=count;}run.inventory=run.inventory.filter(item=>item.quantity>0);
      const offered=run.inventory.find(item=>item.itemId===selection.offeredItemId);if(offered)offered.quantity+=1;else run.inventory.push({itemId:selection.offeredItemId,quantity:1});continue;
    }
    if(effect.kind==='pawnItem'){
      if(selection?.kind!=='pawnItem')throw new Error('Need an item to pawn.');
      const entry=run.inventory.find(item=>item.itemId===selection.itemId)!;entry.quantity-=1;if(!entry.quantity)run.inventory=run.inventory.filter(item=>item.quantity>0);run.coins+=Math.floor(getItem(selection.itemId).price/2);continue;
    }
    if(effect.kind==='upgradeAbility'){
      if(selection?.kind!=='upgradeAbility')throw new Error('Choose an ability to train.');
      const member=run.party.find(item=>item.characterId===selection.characterId)!;member.upgradedAbilities.push(selection.abilityId);const ability=getAbility(selection.abilityId);if(ability.upgrade.maxPPDelta)member.abilityPP[ability.id]+=ability.upgrade.maxPPDelta;continue;
    }
    if(effect.kind==='coins'){run.coins=Math.max(0,run.coins+effect.amount);continue;}
    if(effect.kind==='wagerCoins'){
      run.coins-=effect.cost;
      if(rng.chance(effect.winChance)){run.coins+=effect.payout;resultText=`${choice.resultText} You win ${effect.payout} coins.`;}
      else resultText=`${choice.resultText} You lose the ${effect.cost}-coin wager.`;
      continue;
    }
    if(effect.kind==='partyHpPercent'){for(const member of run.party){if(member.hp<=0)continue;const c=getCharacter(member.characterId);member.hp=Math.max(1,Math.min(c.stats.maxHp,member.hp+Math.round(c.stats.maxHp*effect.amount)));}continue;}
    if(effect.kind==='restoreMissingPpPercent'){for(const member of run.party){const c=getCharacter(member.characterId);for(const id of c.abilities){const a=getAbility(id);const max=a.maxPP+(member.upgradedAbilities.includes(id)?a.upgrade.maxPPDelta??0:0);const missing=Math.max(0,max-member.abilityPP[id]);member.abilityPP[id]=Math.min(max,member.abilityPP[id]+Math.round(missing*effect.amount*(run.relicIds.includes('blue-tonic-cap')?1.25:1)));}}continue;}
    if(effect.kind==='item'){if(inventoryCount(run)<inventoryCapacity(run)){const entry=run.inventory.find(e=>e.itemId===effect.itemId);if(entry)entry.quantity+=1;else run.inventory.push({itemId:effect.itemId,quantity:1});}else resultText=`${resultText} Your pack is full, so you leave the item behind.`;continue;}
    if(effect.kind==='randomRelic'){const relicId=drawRelicIds(run,'folded-tokens',1,rng)[0];if(relicId)run.relicIds.push(relicId);continue;}
    if(effect.kind==='battle'){battleEncounterId=effect.encounterId;}
  }
  return{run,resultText,battleEncounterId};
}
