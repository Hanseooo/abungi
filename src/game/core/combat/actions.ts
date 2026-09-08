import type { AbilityDefinition, BattleCommand, BattleState, BattleUnit, EffectDefinition } from '../types.js';
import { getAbility, getCharacter } from '../../content/characters.js';
import { getItem } from '../../content/items.js';
import { NEGATIVE_STATUSES } from './status.js';
import { EFFECT_LIFETIMES, findEffect } from './battleEffects.js';
import { BALANCE } from '../../balance/constants.js';
import { previewItemPp } from '../progression/itemRecovery.js';

export interface ActionLegality { legal:boolean; reason?:string }

export function livingTargets(state: BattleState, side:'ally'|'enemy'): BattleUnit[] {
  const ids = side === 'ally' ? state.allies : state.enemies;
  return ids.map(id=>state.units[id]).filter(Boolean).filter(unit=>unit.alive && unit.hp>0);
}

export function validateAbilityTargets(state:BattleState, actor:BattleUnit, ability:AbilityDefinition, targetIds:string[]): ActionLegality {
  const targetUnits = targetIds.map(id=>state.units[id]).filter(Boolean);
  const allAlive = targetUnits.every(unit=>unit.alive && unit.hp>0);
  if (!allAlive && targetIds.length>0) return {legal:false,reason:'That target is no longer available.'};
  const foes = actor.side === 'ally' ? 'enemy' : 'ally';
  switch (ability.target) {
    case 'self': return targetIds.length===0 || targetIds[0]===actor.id ? {legal:true}:{legal:false,reason:'This skill targets its user.'};
    case 'enemy-one': case 'random-enemy':
      return targetUnits.length===1 && targetUnits[0].side===foes ? {legal:true}:{legal:false,reason:'Choose one living enemy.'};
    case 'enemy-all': return {legal:livingTargets(state,foes).length>0,reason:'No enemies remain.'};
    case 'ally-one': return targetUnits.length===1 && targetUnits[0].side===actor.side ? {legal:true}:{legal:false,reason:'Choose one living ally.'};
    case 'ally-all': return {legal:livingTargets(state,actor.side).length>0,reason:'No allies remain.'};
  }
}


function itemTargetUnits(state:BattleState, actor:BattleUnit, target:'self'|'ally-one'|'ally-all'|'enemy-one'|'enemy-all'|'random-enemy', targetIds:string[]):BattleUnit[]{
  if(target==='self')return [actor];
  if(target==='ally-all')return livingTargets(state,actor.side);
  if(target==='enemy-all')return livingTargets(state,actor.side==='ally'?'enemy':'ally');
  return targetIds.map(id=>state.units[id]).filter((unit):unit is BattleUnit=>Boolean(unit));
}

function itemWouldHaveEffect(state:BattleState, actor:BattleUnit, item:ReturnType<typeof getItem>, targetIds:string[]):ActionLegality{
  const targets=itemTargetUnits(state,actor,item.target,targetIds);
  if(item.effects.length===0)return {legal:true};
  const useful=item.effects.some(effect=>{
    if(effect.kind==='healPercent'||effect.kind==='healPartyPercent')return targets.some(target=>target.alive&&target.hp<target.maxHp);
    if(effect.kind==='restorePP')return targets.some(target=>previewItemPp(target,effect.amount,state.relicIds)!==null);
    if(effect.kind==='cleanse')return targets.some(target=>target.statuses.some(status=>NEGATIVE_STATUSES.includes(status.id)));
    if(effect.kind==='status')return targets.some(target=>{const existing=target.statuses.find(status=>status.id===effect.statusId);return !existing||existing.remaining<effect.duration;});
    if(effect.kind==='revive')return targets.some(target=>!target.alive||target.hp<=0);
    return true;
  });
  if(useful)return {legal:true};
  if(item.effects.some(effect=>effect.kind==='restorePP'))return {legal:false,reason:'That ally already has full PP.'};
  if(item.effects.some(effect=>effect.kind==='cleanse'))return {legal:false,reason:'That ally has no negative status to cleanse.'};
  const status=item.effects.find((effect):effect is Extract<(typeof item.effects)[number],{kind:'status'}>=>effect.kind==='status');
  if(status)return {legal:false,reason:`${getStatusLabel(status.statusId)} is already active for ${status.duration} or more turns.`};
  if(item.effects.some(effect=>effect.kind==='healPercent'||effect.kind==='healPartyPercent'))return {legal:false,reason:'HP is already full for every affected ally.'};
  return {legal:false,reason:'That item would have no effect right now.'};
}

function getStatusLabel(id:string):string{return id.replace(/(^.|-.)/g,part=>part.replace('-','').toUpperCase());}

export function validatePlayerCommand(state:BattleState, command:BattleCommand):ActionLegality {
  if (state.phase !== 'input') return {legal:false,reason:'An action is already resolving.'};
  const actor = state.units[command.actorId];
  if (!actor || !actor.alive || actor.side !== 'ally') return {legal:false,reason:'That character cannot act.'};
  if (state.turnOrder[state.turnIndex] !== actor.id) return {legal:false,reason:'It is not that character’s turn.'};
  if (command.kind === 'guard') return {legal:true};
  if (command.kind === 'item') {
    const item=getItem(command.itemId);
    if(item.escape&&state.tier!=='normal') return {legal:false,reason:'Smoke Bomb can only escape normal battles, not elites or bosses.'};
    if(item.targetKo){
      if(command.targetIds.length!==1)return{legal:false,reason:'Choose one KO ally.'};
      const target=state.units[command.targetIds[0]];
      if(!target||target.side!=='ally'||target.alive||target.hp>0)return{legal:false,reason:'Revive Kit can only target a KO ally.'};
      return{legal:true};
    }
    const pseudo:AbilityDefinition={id:item.id,name:item.name,affinity:'neutral',maxPP:0,target:item.target,description:item.description,effects:[],upgrade:{description:''}};
    const targets=validateAbilityTargets(state,actor,pseudo,command.targetIds);
    if(!targets.legal)return targets;
    return itemWouldHaveEffect(state,actor,item,command.targetIds);
  }
  const character = getCharacter(actor.sourceId);
  if (!character.abilities.includes(command.abilityId)) return {legal:false,reason:'That skill does not belong to this character.'};
  const ability = getAbility(command.abilityId);
  if ((actor.abilityPP?.[ability.id] ?? 0) <= 0) return {legal:false,reason:'No PP remaining.'};
  if (ability.id === 'clearance-sale') {
    const cost = actor.upgradedAbilities?.includes(ability.id) ? BALANCE.leandreClearanceCoinCost - 5 : BALANCE.leandreClearanceCoinCost;
    if (state.availableCoins < cost) return {legal:false,reason:`Need ${cost} coins.`};
  }
  if ((ability.id === 'sentry-unit' || ability.id === 'repair-drone') && state.deployables.filter(d=>d.ownerId===actor.id).length >= BALANCE.maxDeployables) {
    return {legal:false,reason:'Deployable slots are full.'};
  }
  const protectEffect=ability.effects.find(effect=>effect.kind==='applyEffect'&&effect.effectId==='protect');
  if(protectEffect){
    const targetId=command.targetIds[0];
    if(targetId===actor.id) return {legal:false,reason:'Protect must cover another ally, not its caster.'};
    const existing=targetId?findEffect(state,'protect',targetId):undefined;
    if(existing&&existing.sourceUnitId===actor.id) return {legal:false,reason:'That ally is already protected until your next turn.'};
  }
  const scriptEffect=ability.effects.find((effect): effect is Extract<EffectDefinition,{kind:'applyEffect'}>=>effect.kind==='applyEffect'&&effect.effectId==='script');
  if(scriptEffect){
    const candidates=scriptEffect.target==='ally-all'
      ? livingTargets(state,actor.side)
      : command.targetIds.map(id=>state.units[id]).filter((unit):unit is BattleUnit=>Boolean(unit));
    const gains=candidates.some(candidate=>{
      const existing=findEffect(state,'script',candidate.id);
      return !existing||existing.remaining<EFFECT_LIFETIMES.script.remaining;
    });
    if(!gains) return {legal:false,reason:scriptEffect.target==='ally-all'?'Every living ally already carries an equal Script.':'That ally already carries an equal Script.'};
  }
  return validateAbilityTargets(state,actor,ability,command.targetIds);
}
