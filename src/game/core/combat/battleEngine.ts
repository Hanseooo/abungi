import type {
  AbilityDefinition, BattleCommand, BattleResolution, BattleState, BattleUnit, CombatEvent,
  EffectDefinition, EnemyMoveDefinition, EncounterTier, PartyMemberRunState, StatusInstance, TargetMode,
} from '../types.js';
import type { SeededRng } from '../rng/seededRng.js';
import { BALANCE } from '../../balance/constants.js';
import { abilityMaxPp, getAbility, getCharacter } from '../../content/characters.js';
import { BOSS_AFFINITY_POOLS, getEncounter, getEnemy } from '../../content/enemies.js';
import { getItem, type ItemDefinition } from '../../content/items.js';
import { calculateTurnOrder } from './turnOrder.js';
import { accuracyMultiplier, applyStatus, effectiveSpeed, NEGATIVE_STATUSES, POSITIVE_STATUSES } from './status.js';
import { calculateDamage } from './damage.js';
import { chooseEnemyMove, chooseEnemyTargets } from './enemyAi.js';
import { livingTargets, validatePlayerCommand } from './actions.js';

const clone = <T>(value:T):T => JSON.parse(JSON.stringify(value)) as T;

function choreographyForAbility(ability:AbilityDefinition):NonNullable<AbilityDefinition['choreography']>{
  if(ability.choreography)return ability.choreography;
  if(ability.effects.some(effect=>effect.kind==='summon'))return 'summon';
  if(ability.effects.some(effect=>effect.kind==='heal')&&!ability.effects.some(effect=>effect.kind==='damage'))return 'buff';
  const damage=ability.effects.find(effect=>effect.kind==='damage');
  if(damage?.hits&&damage.hits>1)return 'multi-hit';
  if(ability.name.toLowerCase().match(/grenade|broadside/))return 'explosive';
  if(ability.name.toLowerCase().match(/yosi|smoke/))return 'smoke';
  if(ability.name.toLowerCase().match(/rifle|sidearm|gun|fire/))return 'ranged';
  if(ability.name.toLowerCase().includes('drain'))return 'drain';
  if(ability.affinity==='mystic')return 'mystic';
  if((damage?.power??0)>=100)return 'heavy';
  if(!damage)return ability.effects.some(effect=>effect.kind==='status')?'buff':'utility';
  return 'melee';
}

function choreographyForItem(item:ItemDefinition):NonNullable<AbilityDefinition['choreography']>{
  if(item.escape)return 'smoke';
  if(item.category==='revive')return 'heavy';
  if(item.effects.some(effect=>effect.kind==='status'&&effect.statusId==='fortified'))return 'defense';
  if(item.effects.some(effect=>effect.kind==='status'))return 'buff';
  if(item.effects.some(effect=>effect.kind==='healPercent'||effect.kind==='healPartyPercent'||effect.kind==='restorePP'))return 'buff';
  if(item.effects.some(effect=>effect.kind==='damage'))return 'ranged';
  return 'utility';
}

function characterUnit(characterId:string, index:number, persisted?:PartyMemberRunState):BattleUnit {
  const c = getCharacter(characterId);
  const statuses:StatusInstance[] = c.passive.id === 'bulkhead' ? [{id:'fortified',remaining:1}] : [];
  return {
    id:`ally-${index}-${c.id}`, sourceId:c.id, displayName:c.displayName, side:'ally', affinity:c.affinity,
    ...c.stats, hp:Math.max(0,Math.min(c.stats.maxHp,persisted?.hp ?? c.stats.maxHp)), statuses,
    alive:(persisted?.hp ?? c.stats.maxHp)>0, guardActive:false,
    abilityPP:{...(persisted?.abilityPP ?? abilityMaxPp(c.id))}, upgradedAbilities:[...(persisted?.upgradedAbilities ?? [])], flags:{},
  };
}

function clampRegionIndex(regionIndex:number):number {
  return Math.max(0, Math.min(BALANCE.regionCount - 1, Math.trunc(regionIndex)));
}

function enemyUnit(
  enemyId:string,
  index:number,
  prefix='enemy',
  options?:{encounterTier?:EncounterTier;regionIndex?:number;applyTierScale?:boolean},
):BattleUnit {
  const e=getEnemy(enemyId);
  const regionIndex=clampRegionIndex(options?.regionIndex ?? 0);
  const tier=options?.encounterTier ?? e.tier;
  const tierHp=options?.applyTierScale===false ? 1 : BALANCE.enemyTierHpMultiplier[tier];
  const maxHp=Math.round(e.stats.maxHp*tierHp*BALANCE.regionEnemyHpMultiplier[regionIndex]);
  const power=Math.round(e.stats.power*BALANCE.regionEnemyPowerMultiplier[regionIndex]);
  return {
    id:`${prefix}-${index}-${e.id}`, sourceId:e.id, displayName:e.displayName, side:'enemy', affinity:e.affinity,
    ...e.stats,maxHp,power,hp:maxHp,statuses:[],alive:true,guardActive:false,flags:{},
  };
}

export function createBattle(
  partyIds:string[], encounterId:string, rng:SeededRng, options?:{party?:PartyMemberRunState[];coins?:number;relicIds?:string[];regionIndex?:number}
):BattleState {
  if (partyIds.length!==3 || new Set(partyIds).size!==3) throw new Error('A battle requires exactly three unique party members.');
  const encounter=getEncounter(encounterId);
  const units:Record<string,BattleUnit>={};
  const allies=partyIds.map((id,index)=> {
    const unit=characterUnit(id,index,options?.party?.find(member=>member.characterId===id)); units[unit.id]=unit; return unit.id;
  });
  const regionIndex=clampRegionIndex(options?.regionIndex ?? 0);
  const enemies=encounter.enemies.map((id,index)=>{const unit=enemyUnit(id,index,'enemy',{encounterTier:encounter.tier,regionIndex});units[unit.id]=unit;return unit.id;});
  let rolledBossAffinity:BattleUnit['affinity']|undefined;
  if(encounter.tier==='boss'){
    const boss=enemies.map(id=>units[id]).find(unit=>BOSS_AFFINITY_POOLS[unit.sourceId]);
    if(boss){rolledBossAffinity=rng.pick(BOSS_AFFINITY_POOLS[boss.sourceId]);boss.affinity=rolledBossAffinity;}
  }
  const state:BattleState={
    id:`battle-${encounterId}-${rng.serialize().state}`, encounterId, tier:encounter.tier, units, allies, enemies,
    round:1,turnOrder:[],turnIndex:0,phase:'input',deployables:[],recentEnemyMoves:{},flags:{},coinsDelta:0,
    availableCoins:options?.coins ?? 0,relicIds:[...(options?.relicIds ?? [])],
  };
  state.flags.regionIndex=regionIndex;
  if(rolledBossAffinity)state.flags.bossAffinity=rolledBossAffinity;
  if(state.relicIds.includes('bike-bearing')) for(const id of allies) units[id].speed=Math.round(units[id].speed*1.10);
  if(state.relicIds.includes('jumper-cable')) for(const id of allies) {
    const unit=units[id]; if(!unit.abilityPP) continue;
    const lowest=Object.keys(unit.abilityPP).sort((a,b)=>unit.abilityPP![a]-unit.abilityPP![b])[0];
    if(!lowest) continue;
    const ability=getAbility(lowest);
    const max=ability.maxPP+(unit.upgradedAbilities?.includes(lowest)?ability.upgrade.maxPPDelta??0:0);
    unit.abilityPP[lowest]=Math.min(max,unit.abilityPP[lowest]+2);
  }
  state.turnOrder=calculateTurnOrder(state);
  // Advance through any opening enemy turns so callers always receive an actionable player state when possible.
  return advanceAutomaticTurns(state,rng,[]).nextState;
}

export function getCurrentActor(state:BattleState):BattleUnit {
  const id=state.turnOrder[state.turnIndex];
  const actor=state.units[id];
  if(!actor) throw new Error('Battle has no current actor.');
  return actor;
}

function upgraded(actor:BattleUnit,ability:AbilityDefinition):boolean { return actor.upgradedAbilities?.includes(ability.id) ?? false; }
function upgradedPower(actor:BattleUnit,ability:AbilityDefinition,base:number):number { return base + (upgraded(actor,ability) ? ability.upgrade.powerDelta ?? 0 : 0); }
function upgradedDuration(actor:BattleUnit,ability:AbilityDefinition,base:number):number { return base + (upgraded(actor,ability) ? ability.upgrade.durationDelta ?? 0 : 0); }
function upgradedHeal(actor:BattleUnit,ability:AbilityDefinition,base:number):number { return base * (upgraded(actor,ability) ? ability.upgrade.healScale ?? 1 : 1); }

function targetIdsFor(state:BattleState,actor:BattleUnit,mode:TargetMode,requested:string[],rng:SeededRng):string[] {
  const foeSide=actor.side==='ally'?'enemy':'ally';
  if(mode==='self') return [actor.id];
  if(mode==='ally-all') return livingTargets(state,actor.side).map(v=>v.id);
  if(mode==='enemy-all') return livingTargets(state,foeSide).map(v=>v.id);
  if(mode==='ally-one' || mode==='enemy-one') return requested.length ? [requested[0]] : [];
  if(mode==='random-enemy') {
    const foes=livingTargets(state,foeSide);
    return foes.length ? [rng.pick(foes).id] : [];
  }
  return [];
}

function setHp(unit:BattleUnit,value:number):void { unit.hp=Math.max(0,Math.min(unit.maxHp,Math.round(value))); unit.alive=unit.hp>0; }

function relicAffinityBonus(state:BattleState,actor:BattleUnit,affinity:AbilityDefinition['affinity']):number {
  if(actor.side!=='ally') return 1;
  const ids:Record<string,string>={might:'red-stitch',tech:'copper-trace',mystic:'violet-thread',trick:'marked-card'};
  const relic=ids[affinity]; return relic&&state.relicIds.includes(relic)?1.10:1;
}

function damageOne(
  state:BattleState,actor:BattleUnit,target:BattleUnit,power:number,affinity:AbilityDefinition['affinity'],rng:SeededRng,
  events:CombatEvent[],opts?:{cannotMiss?:boolean;accuracy?:number;outgoing?:number;onHitHealPercent?:number}
):{hit:boolean;damage:number;killed:boolean;critical:boolean} {
  const accuracy=Math.max(0,Math.min(1,(opts?.accuracy ?? 100)/100*accuracyMultiplier(actor)));
  if(!opts?.cannotMiss && !rng.chance(accuracy)) { events.push({type:'miss',actorId:actor.id,targetId:target.id}); return {hit:false,damage:0,killed:false,critical:false}; }
  const wasAlive=target.alive;
  let result=calculateDamage({attacker:actor,defender:target,power,moveAffinity:affinity,rng,outgoingMultiplier:(opts?.outgoing??1)*relicAffinityBonus(state,actor,affinity)});
  if(target.side==='ally'&&state.relicIds.includes('cardboard-plate')&&!state.flags.cardboardPlateUsed){state.flags.cardboardPlateUsed=true;result={...result,amount:Math.max(1,Math.round(result.amount*0.65))};}
  setHp(target,target.hp-result.amount);
  events.push({type:'hit',targetId:target.id,heavy:power>=100},{type:'damage',targetId:target.id,amount:result.amount,critical:result.critical,affinity:result.affinity});
  if(result.critical&&actor.side==='ally'&&state.relicIds.includes('lucky-centavo')&&!state.flags.luckyCentavoUsed){state.flags.luckyCentavoUsed=true;state.availableCoins+=5;state.coinsDelta+=5;events.push({type:'coin',amount:5});}
  if(opts?.onHitHealPercent && result.amount>0) {
    const before=actor.hp; setHp(actor,actor.hp+Math.round(result.amount*opts.onHitHealPercent));
    const healed=actor.hp-before; if(healed>0) events.push({type:'heal',targetId:actor.id,amount:healed});
  }
  const killed=wasAlive&&!target.alive;
  if(killed) {
    events.push({type:'knockout',targetId:target.id});
    if(target.side==='ally'&&state.relicIds.includes('chalk-outline')&&!state.flags.chalkOutlineUsed){
      state.flags.chalkOutlineUsed=true;state.availableCoins+=15;state.coinsDelta+=15;events.push({type:'coin',amount:15});
    }
  }
  return {hit:true,damage:result.amount,killed,critical:result.critical};
}

function healOne(state:BattleState,actor:BattleUnit,target:BattleUnit,percent:number,ability:AbilityDefinition|undefined,events:CombatEvent[],mechanicId?:string):number {
  if(!target.alive) return 0;
  let adjusted=ability?upgradedHeal(actor,ability,percent):percent;
  if(actor.side==='ally'&&state.relicIds.includes('first-aid-tape')&&!state.flags.firstAidTapeUsed){adjusted*=1.20;state.flags.firstAidTapeUsed=true;}
  if(target.side==='ally'&&state.relicIds.includes('pressed-flower')) adjusted*=1.08;
  if(actor.sourceId==='earl' && !actor.flags.firstResponderUsed && mechanicId==='earl-first-heal') { adjusted*=1.2; actor.flags.firstResponderUsed=true; }
  const before=target.hp; setHp(target,target.hp+Math.round(target.maxHp*adjusted)); const amount=target.hp-before;
  if(amount>0) events.push({type:'heal',targetId:target.id,amount}); return amount;
}

function statusDuration(actor:BattleUnit,target:BattleUnit,ability:AbilityDefinition|undefined,effect:Extract<EffectDefinition,{kind:'status'}>):number {
  let duration=ability?upgradedDuration(actor,ability,effect.duration):effect.duration;
  if(target.side===actor.side && POSITIVE_STATUSES.includes(effect.statusId) && (actor.sourceId==='jiro'||actor.sourceId==='daboy')) duration+=1;
  return duration;
}

function statusOne(state:BattleState,actor:BattleUnit,target:BattleUnit,ability:AbilityDefinition|undefined,effect:Extract<EffectDefinition,{kind:'status'}>,rng:SeededRng,events:CombatEvent[],cannotMiss=false):void {
  const accuracy=Math.max(0,Math.min(1,(effect.accuracy ?? ability?.accuracy ?? 100)/100*accuracyMultiplier(actor)));
  if(!cannotMiss && !rng.chance(accuracy)) { events.push({type:'miss',actorId:actor.id,targetId:target.id}); return; }
  let duration=statusDuration(actor,target,ability,effect);
  if(actor.side==='ally'&&ability?.affinity==='trick'&&state.relicIds.includes('sticky-label')&&!state.flags.stickyLabelUsed){duration+=1;state.flags.stickyLabelUsed=true;}
  target.statuses=applyStatus(target.statuses,effect.statusId,duration);
  events.push({type:'statusApplied',targetId:target.id,statusId:effect.statusId,duration});
}

function cleanseOne(target:BattleUnit,count:number,events:CombatEvent[]):void {
  let remaining=count; const next:StatusInstance[]=[];
  for(const status of target.statuses) {
    if(remaining>0 && NEGATIVE_STATUSES.includes(status.id)) { events.push({type:'statusRemoved',targetId:target.id,statusId:status.id}); remaining--; }
    else next.push(status);
  }
  target.statuses=next;
}

function sacrifice(unit:BattleUnit,amount:number,basis:'max'|'current',floorAtOne:boolean,events:CombatEvent[]):void {
  const reference=basis==='max'?unit.maxHp:unit.hp; const cost=Math.max(1,Math.floor(reference*amount));
  const next=floorAtOne?Math.max(1,unit.hp-cost):Math.max(0,unit.hp-cost); const paid=unit.hp-next; setHp(unit,next);
  if(paid>0) events.push({type:'damage',targetId:unit.id,amount:paid,critical:false,affinity:'normal'});
}

interface AbilityContext { cannotMiss:boolean; outgoing:number; damagePowerOverride?:number; poorDoubleDown?:boolean; totalDamage:number; anyKo:boolean; sharedAccuracy:Record<string,boolean>; sharedMissEmitted:Record<string,boolean>; }

function prepareAbilityContext(state:BattleState,actor:BattleUnit,ability:AbilityDefinition,rng:SeededRng,events:CombatEvent[]):AbilityContext {
  const ctx:AbilityContext={cannotMiss:false,outgoing:1,totalDamage:0,anyKo:false,sharedAccuracy:{},sharedMissEmitted:{}};
  const damaging=ability.effects.some(effect=>effect.kind==='damage');
  if(actor.sourceId==='michael' && damaging && !actor.flags.steadyAimUsed) { ctx.cannotMiss=true;ctx.outgoing*=1.1;actor.flags.steadyAimUsed=true; }
  if(ability.mechanicId==='cannot-miss') ctx.cannotMiss=true;
  if(ability.id==='loaded-dice') ctx.damagePowerOverride=rng.int(55,90)+(upgraded(actor,ability)?ability.upgrade.powerDelta??0:0);
  if(ability.id==='double-down') {
    const good=rng.chance(0.60); ctx.damagePowerOverride=(good?110:55)+(good&&upgraded(actor,ability)?ability.upgrade.powerDelta??0:0);
    if(!good) {
      ctx.poorDoubleDown=true; sacrifice(actor,0.12,'max',true,events);
      if(!actor.flags.houseEdgeRefunded) { actor.abilityPP![ability.id]=Math.min(ability.maxPP,actor.abilityPP![ability.id]+1);actor.flags.houseEdgeRefunded=true;events.push({type:'message',text:'House Edge refunds 1 PP.'}); }
    }
  }
  if(actor.sourceId==='yatords') ctx.outgoing*=1+Number(actor.flags.momentum??0)*BALANCE.yMomentumDamagePerStack;
  return ctx;
}

function passesSharedMoveAccuracy(
  actor:BattleUnit,target:BattleUnit,ability:AbilityDefinition|undefined,context:AbilityContext,rng:SeededRng,events:CombatEvent[]
):boolean|undefined {
  if(!ability?.accuracy || target.side===actor.side) return undefined;
  if(context.cannotMiss) return true;
  if(!(target.id in context.sharedAccuracy)) {
    const chance=Math.max(0,Math.min(1,ability.accuracy/100*accuracyMultiplier(actor)));
    context.sharedAccuracy[target.id]=rng.chance(chance);
  }
  const hit=context.sharedAccuracy[target.id];
  if(!hit&&!context.sharedMissEmitted[target.id]) {
    context.sharedMissEmitted[target.id]=true;
    events.push({type:'miss',actorId:actor.id,targetId:target.id});
  }
  return hit;
}

function resolveEffects(
  state:BattleState,actor:BattleUnit,effects:EffectDefinition[],ability:AbilityDefinition|undefined,requestedTargets:string[],rng:SeededRng,events:CombatEvent[],ctx?:AbilityContext
):AbilityContext {
  const context=ctx ?? {cannotMiss:false,outgoing:1,totalDamage:0,anyKo:false,sharedAccuracy:{},sharedMissEmitted:{}};
  for(const effect of effects) {
    if(state.phase==='victory'||state.phase==='defeat') break;
    if(effect.kind==='sacrificeHp') { sacrifice(actor,effect.amount,effect.basis,effect.floorAtOne,events); continue; }
    if(effect.kind==='spendCoins') {
      const cost=ability?.id==='clearance-sale'&&upgraded(actor,ability)?Math.max(0,effect.amount+(ability.upgrade.coinCostDelta??0)):effect.amount;
      state.availableCoins-=cost;state.coinsDelta-=cost;events.push({type:'coin',amount:-cost});continue;
    }
    if(effect.kind==='grantCoins') { if(effect.trigger==='always'||context.anyKo){state.availableCoins+=effect.amount;state.coinsDelta+=effect.amount;events.push({type:'coin',amount:effect.amount});} continue; }
    if(effect.kind==='summon') {
      const existing=state.deployables.filter(item=>item.ownerId===actor.id);
      if(existing.length>=BALANCE.maxDeployables) continue;
      let duration=effect.duration;
      if(actor.sourceId==='hans'&&!actor.flags.sparePartsUsed){duration+=1;actor.flags.sparePartsUsed=true;}
      if(actor.sourceId==='hans'&&state.relicIds.includes('spare-battery')) duration+=1;
      state.deployables.push({id:`deploy-${actor.id}-${state.round}-${state.deployables.length}`,ownerId:actor.id,type:effect.summonId,remainingTurns:duration,enhanced:false,sourceAbilityId:ability?.id});
      events.push({type:'summon',ownerId:actor.id,summonId:effect.summonId});continue;
    }
    if(effect.kind==='restorePP') {
      for(const id of targetIdsFor(state,actor,effect.target,requestedTargets,rng)) {
        const target=state.units[id]; if(!target?.abilityPP) continue;
        const char=getCharacter(target.sourceId);
        for(const abilityId of char.abilities) {const amount=Math.round(effect.amount*(state.relicIds.includes('blue-tonic-cap')?1.25:1));target.abilityPP[abilityId]=Math.min(getAbility(abilityId).maxPP,target.abilityPP[abilityId]+amount);}
      }
      continue;
    }
    const ids=targetIdsFor(state,actor,effect.target,requestedTargets,rng);
    if(effect.kind==='heal') { for(const id of ids){const target=state.units[id];if(target)healOne(state,actor,target,effect.percentMaxHp,ability,events,effect.mechanicId);}continue; }
    if(effect.kind==='cleanse') { for(const id of ids){const target=state.units[id];if(target)cleanseOne(target,effect.count,events);}continue; }
    if(effect.kind==='status') { for(const id of ids){const target=state.units[id];if(!target)continue;const shared=passesSharedMoveAccuracy(actor,target,ability,context,rng,events);if(shared===false)continue;statusOne(state,actor,target,ability,effect,rng,events,shared===true||context.cannotMiss);}continue; }
    if(effect.kind==='damage') {
      const hitCount=effect.hits??1;
      for(let hit=0;hit<hitCount;hit++) {
        const hitTargets=effect.target==='random-enemy'?targetIdsFor(state,actor,effect.target,requestedTargets,rng):ids;
        for(const id of hitTargets) {
          const target=state.units[id]; if(!target?.alive) continue;
          let power=context.damagePowerOverride ?? upgradedPower(actor,ability!,effect.power);
          let outgoing=context.outgoing;
          if(effect.mechanicId==='boarding-rush' && target.hp/target.maxHp<0.5) outgoing*=1.25;
          if(effect.mechanicId==='pedal-strike' && effectiveSpeed(actor)>effectiveSpeed(target)) outgoing*=1.15;
          if(effect.mechanicId==='breakaway') power+=25*Number(actor.flags.momentum??0);
          const drain=effect.mechanicId==='life-drain'?(upgraded(actor,ability!)?0.45:0.35):effect.mechanicId==='enemy-life-drain'?0.35:0;
          const shared=passesSharedMoveAccuracy(actor,target,ability,context,rng,events);if(shared===false)continue;
          const result=damageOne(state,actor,target,power,ability?.affinity ?? actor.affinity,rng,events,{cannotMiss:shared===true||context.cannotMiss,accuracy:shared===undefined?effect.accuracy??ability?.accuracy:undefined,outgoing,onHitHealPercent:drain});
          context.totalDamage+=result.damage;context.anyKo ||= result.killed;
          if(result.killed && actor.sourceId==='greg'&&!actor.flags.spoilsUsed){actor.flags.spoilsUsed=true;state.availableCoins+=5;state.coinsDelta+=5;events.push({type:'coin',amount:5});}
        }
      }
    }
  }
  return context;
}

function gainYatordsMomentum(state:BattleState,actor:BattleUnit,events:CombatEvent[]):void {
  if(actor.sourceId!=='yatords') return;
  const actorIndex=state.turnOrder.indexOf(actor.id);
  const hasLaterEnemy=state.turnOrder.slice(actorIndex+1).some(id=>state.units[id]?.alive&&state.units[id].side==='enemy');
  if(!hasLaterEnemy) return;
  const current=Number(actor.flags.momentum??0);
  actor.flags.momentum=Math.min(BALANCE.maxMomentum,current+1);
  events.push({type:'message',text:`Momentum ${actor.flags.momentum}/${BALANCE.maxMomentum}`});
}

function resolveHansSpecial(state:BattleState,actor:BattleUnit,ability:AbilityDefinition,events:CombatEvent[]):boolean {
  if(ability.id!=='overclock') return false;
  const deployables=state.deployables.filter(item=>item.ownerId===actor.id);
  if(deployables.length===0){const effect:Extract<EffectDefinition,{kind:'status'}>={kind:'status',target:'self',statusId:'haste',duration:2};statusOne(state,actor,actor,ability,effect,{chance:()=>true} as unknown as SeededRng,events,true);}
  else {
    const extension=1+(upgraded(actor,ability)?ability.upgrade.durationDelta??0:0);
    for(const deployable of deployables){deployable.enhanced=true;deployable.remainingTurns+=extension;}
    events.push({type:'message',text:`Deployables overclocked +${extension} turn${extension===1?'':'s'}.`});
  }
  return true;
}

function triggerDeployables(state:BattleState,actor:BattleUnit,rng:SeededRng,events:CombatEvent[]):void {
  if(actor.sourceId!=='hans') return;
  for(const deployable of state.deployables.filter(item=>item.ownerId===actor.id)) {
    const sourceAbilityId=deployable.sourceAbilityId ?? (deployable.type==='sentry'?'sentry-unit':'repair-drone');
    const sourceAbility=getAbility(sourceAbilityId);
    const upgradeScale=upgraded(actor,sourceAbility)?sourceAbility.upgrade.summonPowerScale??1:1;
    if(deployable.type==='sentry') {
      const foes=livingTargets(state,'enemy'); if(foes.length){const target=rng.pick(foes);const power=Math.round(34*upgradeScale*(deployable.enhanced?1.35:1));const result=damageOne(state,actor,target,power,'tech',rng,events,{cannotMiss:true});events.push({type:'deployableTrigger',ownerId:actor.id,deployableId:deployable.id,deployableType:'sentry',targetId:target.id,effect:'damage',amount:result.damage,enhanced:deployable.enhanced});}
    } else {
      const allies=livingTargets(state,'ally'); if(allies.length){const target=[...allies].sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];const before=target.hp;setHp(target,target.hp+Math.round(target.maxHp*0.14*upgradeScale*(deployable.enhanced?1.35:1)));const amount=target.hp-before;if(amount>0)events.push({type:'heal',targetId:target.id,amount});events.push({type:'deployableTrigger',ownerId:actor.id,deployableId:deployable.id,deployableType:'repair-drone',targetId:target.id,effect:'heal',amount,enhanced:deployable.enhanced});}
    }
    deployable.remainingTurns-=1;
  }
  state.deployables=state.deployables.filter(item=>item.remainingTurns>0);
}

function tickOnlyExisting(unit:BattleUnit,before:StatusInstance[],events:CombatEvent[]):void {
  const old=new Set(before.map(status=>status.id));
  const refreshed=new Set(events.filter((event):event is Extract<CombatEvent,{type:'statusApplied'}>=>event.type==='statusApplied'&&event.targetId===unit.id).map(event=>event.statusId));
  const next:StatusInstance[]=[];
  for(const status of unit.statuses){
    if(!old.has(status.id)||refreshed.has(status.id)){next.push(status);continue;}
    const remaining=status.remaining-1;
    if(remaining>0)next.push({...status,remaining});else events.push({type:'statusRemoved',targetId:unit.id,statusId:status.id});
  }
  unit.statuses=next;
}

function checkOutcome(state:BattleState,events:CombatEvent[]):boolean {
  const alliesAlive=state.allies.some(id=>state.units[id]?.alive);
  const enemiesAlive=state.enemies.some(id=>state.units[id]?.alive);
  if(!enemiesAlive){state.phase='victory';events.push({type:'victory'});return true;}
  if(!alliesAlive){state.phase='defeat';events.push({type:'defeat'});return true;}
  return false;
}

function summonWardenDrone(state:BattleState,events:CombatEvent[]):void {
  const warden=state.enemies.map(id=>state.units[id]).find(unit=>unit?.sourceId==='warden'&&unit.alive);
  if(!warden) return;
  const ratio=warden.hp/warden.maxHp;
  if(ratio<=0.60&&!state.flags.wardenDroneSummoned){
    const regionIndex=typeof state.flags.regionIndex==='number'?state.flags.regionIndex:0;
    state.flags.wardenDroneSummoned=true; const unit=enemyUnit('dronelet',state.enemies.length,'summon',{encounterTier:'normal',regionIndex,applyTierScale:false});state.units[unit.id]=unit;state.enemies.push(unit.id);events.push({type:'summon',ownerId:warden.id,summonId:'dronelet'});
  }
  if(ratio<=0.35&&!state.flags.wardenPhaseTwo){state.flags.wardenPhaseTwo=true;warden.statuses=applyStatus(warden.statuses,'haste',99);events.push({type:'statusApplied',targetId:warden.id,statusId:'haste',duration:99},{type:'bossPhase',actorId:warden.id,phaseId:'warden-aggressive',label:'AGGRESSIVE PROTOCOL'},{type:'message',text:'The Warden shifts into an aggressive protocol.'});}
}

function advanceIndex(state:BattleState):void {
  do { state.turnIndex+=1; } while(state.turnIndex<state.turnOrder.length && !state.units[state.turnOrder[state.turnIndex]]?.alive);
  if(state.turnIndex>=state.turnOrder.length){state.round+=1;state.turnOrder=calculateTurnOrder(state);state.turnIndex=0;}
}

function enemyMoveEffects(move:EnemyMoveDefinition):EffectDefinition[]{return move.effects;}

function resolveEnemyTurn(state:BattleState,actor:BattleUnit,rng:SeededRng,events:CombatEvent[]):void {
  actor.guardActive=false;
  const before=clone(actor.statuses);
  const move=chooseEnemyMove(state,actor,rng); const targets=chooseEnemyTargets(state,actor,move,rng);
  events.push({type:'actionStart',actorId:actor.id,label:move.name,actionId:move.id,choreography:move.choreography,side:'enemy',signature:move.signature===true&&state.tier==='boss'});
  const pseudo:AbilityDefinition={id:move.id,name:move.name,affinity:move.affinity,maxPP:99,target:move.target,description:'',effects:move.effects,upgrade:{description:''}};
  resolveEffects(state,actor,enemyMoveEffects(move),pseudo,targets,rng,events);
  const history=state.recentEnemyMoves[actor.id]??[];state.recentEnemyMoves[actor.id]=[...history,move.id].slice(-4);
  if(move.once) actor.flags.usedOnceMoves=[...new Set([...String(actor.flags.usedOnceMoves??'').split(',').filter(Boolean),move.id])].join(',');
  tickOnlyExisting(actor,before,events);checkOutcome(state,events);summonWardenDrone(state,events);
}

function advanceAutomaticTurns(input:BattleState,rng:SeededRng,events:CombatEvent[]):BattleResolution {
  const state=input;
  while(state.phase!=='victory'&&state.phase!=='defeat') {
    const actor=getCurrentActor(state);
    if(actor.side==='ally'){actor.guardActive=false;state.phase='input';break;}
    state.phase='resolving';resolveEnemyTurn(state,actor,rng,events);
    if(state.phase !== 'resolving') break;
    advanceIndex(state);
  }
  return {nextState:state,events};
}

function resolveItem(state:BattleState,actor:BattleUnit,command:Extract<BattleCommand,{kind:'item'}>,rng:SeededRng,events:CombatEvent[]):void {
  const item=getItem(command.itemId);
  if(item.escape) {
    if(state.tier!=='normal'){events.push({type:'message',text:'Smoke Bomb cannot escape this fight.'});return;}
    state.escaped=true;state.phase='victory';events.push({type:'message',text:'The party slips away in the smoke.'},{type:'victory'});return;
  }
  const ids=targetIdsFor(state,actor,item.target,command.targetIds,rng);
  for(const effect of item.effects){
    if(effect.kind==='healPercent'||effect.kind==='healPartyPercent'){for(const id of ids){const target=state.units[id];if(target)healOne(state,actor,target,effect.percent,undefined,events);}}
    else if(effect.kind==='status'){for(const id of ids){const target=state.units[id];if(target){target.statuses=applyStatus(target.statuses,effect.statusId,effect.duration);events.push({type:'statusApplied',targetId:target.id,statusId:effect.statusId,duration:effect.duration});}}}
    else if(effect.kind==='cleanse'){for(const id of ids){const target=state.units[id];if(target)cleanseOne(target,effect.count,events);}}
    else if(effect.kind==='restorePP'){for(const id of ids){const target=state.units[id];if(target?.abilityPP){const abilityId=Object.keys(target.abilityPP).sort((a,b)=>target.abilityPP![a]-target.abilityPP![b])[0];if(abilityId){const amount=Math.round(effect.amount*(state.relicIds.includes('blue-tonic-cap')?1.25:1));const before=target.abilityPP[abilityId];const max=getAbility(abilityId).maxPP+(target.upgradedAbilities?.includes(abilityId)?getAbility(abilityId).upgrade.maxPPDelta??0:0);target.abilityPP[abilityId]=Math.min(max,before+amount);const restored=target.abilityPP[abilityId]-before;if(restored>0)events.push({type:'message',text:`${target.displayName}'s ${getAbility(abilityId).name} recovered ${restored} PP.`});}}}}
    else if(effect.kind==='revive'){for(const id of ids){const target=state.units[id];if(target&&!target.alive){const amount=Math.max(1,Math.round(target.maxHp*effect.percentMaxHp));setHp(target,amount);events.push({type:'revive',targetId:target.id,amount},{type:'heal',targetId:target.id,amount});}}}
    else if(effect.kind==='damage'){for(const id of ids){const target=state.units[id];if(target?.alive)damageOne(state,actor,target,effect.power,'neutral',rng,events,{cannotMiss:true});}}
  }
}

export function resolveBattleCommand(input:BattleState,command:BattleCommand,rng:SeededRng):BattleResolution {
  const legality=validatePlayerCommand(input,command); if(!legality.legal) throw new Error(legality.reason ?? 'Illegal action');
  const state=clone(input); const events:CombatEvent[]=[]; const actor=state.units[command.actorId];
  actor.guardActive=false; const before=clone(actor.statuses); state.phase='resolving';
  if(command.kind==='guard') {
    actor.guardActive=true;events.push({type:'actionStart',actorId:actor.id,label:'Guard',actionId:'guard',choreography:'defense',side:'ally'},{type:'guard',actorId:actor.id});gainYatordsMomentum(state,actor,events);
  } else if(command.kind==='item') {
    const item=getItem(command.itemId);events.push({type:'actionStart',actorId:actor.id,label:item.name,actionId:command.itemId,choreography:choreographyForItem(item),side:'ally'});gainYatordsMomentum(state,actor,events);resolveItem(state,actor,command,rng,events);
  } else {
    const ability=getAbility(command.abilityId);actor.abilityPP![ability.id]-=1;events.push({type:'actionStart',actorId:actor.id,label:ability.name,actionId:ability.id,choreography:choreographyForAbility(ability),side:'ally'});gainYatordsMomentum(state,actor,events);
    const context=prepareAbilityContext(state,actor,ability,rng,events);
    if(!resolveHansSpecial(state,actor,ability,events)) resolveEffects(state,actor,ability.effects,ability,command.targetIds,rng,events,context);
    if(ability.id==='breakaway') actor.flags.momentum=0;
    triggerDeployables(state,actor,rng,events);
  }
  tickOnlyExisting(actor,before,events);
  if(checkOutcome(state,events)) return {nextState:state,events};
  summonWardenDrone(state,events);
  advanceIndex(state);return advanceAutomaticTurns(state,rng,events);
}

export function exportPartyFromBattle(state:BattleState):PartyMemberRunState[] {
  return state.allies.map(id=>state.units[id]).map(unit=>({characterId:unit.sourceId,hp:unit.hp,abilityPP:{...(unit.abilityPP??{})},upgradedAbilities:[...(unit.upgradedAbilities??[])]}));
}
