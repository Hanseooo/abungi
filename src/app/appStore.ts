import { create } from 'zustand';
import { CHARACTERS, getAbility, getCharacter } from '../game/content/characters';
import { getEvent } from '../game/content/events';
import { getItem } from '../game/content/items';
import type { BattleCommand, CombatEvent, ProfileState, RewardSpoilsChoice, RunState, SettingsState } from '../game/core/types';
import { SeededRng } from '../game/core/rng/seededRng';
import { createBattle, exportPartyFromBattle, resolveBattleCommand } from '../game/core/combat/battleEngine';
import { validatePlayerCommand } from '../game/core/combat/actions';
import { createRun, completeRouteNode, advanceRegion } from '../game/core/progression/run';
import { availableRouteNodes } from '../game/core/progression/route';
import { applyRestChoice, type RestChoice } from '../game/core/progression/rest';
import { generateReward, claimReward } from '../game/core/progression/rewards';
import { generateShopOffers, purchaseShopOffer, type ShopOffer } from '../game/core/progression/shop';
import { applyEventChoice } from '../game/core/progression/events';
import { regionSceneId, resolveScene, type ResolvedScene, type SceneId } from '../game/content/scenes';
import type { StatusId } from '../game/core/types';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS, type SavePayload } from '../game/core/save/saveFormat';
import { createSaveRepository } from '../services/save/createSaveRepository';
import { combatPresentationDuration } from '../features/battle/combatDirector';

export type AppScreen='title'|'party'|'route'|'battle'|'reward'|'shop'|'rest'|'event'|'results';
export type OverlayState=null|{kind:'settings'}|{kind:'guide';section?:string}|{kind:'move';abilityId:string}|{kind:'status';statusId:StatusId}|{kind:'character';characterId:string}|{kind:'item';itemId:string}|{kind:'enemy';enemyId:string};
type SaveHealth='loading'|'ready'|'saving'|'error';
const repository=createSaveRepository();
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

function nodeForCurrent(run:RunState){return run.currentNodeId?run.route.nodes.find(n=>n.id===run.currentNodeId):undefined;}
function deriveScreen(run:RunState|null):AppScreen{
  if(!run)return'title';
  if(run.status!=='active')return'results';
  if(run.activeBattle)return'battle';
  if(run.pendingReward)return'reward';
  const node=nodeForCurrent(run);
  if(node&&!run.completedNodeIds.includes(node.id))return node.type==='shop'?'shop':node.type==='rest'?'rest':node.type==='event'?'event':'route';
  return'route';
}
function payload(run:RunState|null,profile:ProfileState,settings:SettingsState):SavePayload{return{activeRun:run,profile,settings};}

interface AppState{
  booted:boolean;screen:AppScreen;run:RunState|null;profile:ProfileState;settings:SettingsState;overlay:OverlayState;sceneQueue:ResolvedScene[];seenSceneKeys:string[];
  selectedParty:string[];isResolving:boolean;battleEvents:CombatEvent[];battlePulse:number;error:string|null;notice:string|null;
  saveHealth:SaveHealth;corruptSaveMessage:string|null;eventResult:string|null;online:boolean;
  initialize():Promise<void>;continueRun():void;openNewRun():void;backToTitle():void;toggleParty(id:string):void;confirmParty():Promise<void>;
  selectNode(id:string):Promise<void>;battleSkill(actorId:string,abilityId:string,targetIds:string[]):Promise<void>;battleGuard(actorId:string):Promise<void>;battleItem(actorId:string,itemId:string,targetIds:string[]):Promise<void>;
  claimRewardChoice(relicId?:string,upgrade?:{characterId:string;abilityId:string},spoilsId?:RewardSpoilsChoice['id']):Promise<void>;
  purchaseOffer(offerId:string):Promise<void>;leaveShop():Promise<void>;chooseRest(choice:RestChoice):Promise<void>;chooseEvent(choiceId:string):Promise<void>;finishEvent():void;
  openSettings():void;openGuide(section?:string):void;openMoveInfo(abilityId:string):void;openStatusInfo(statusId:StatusId):void;openCharacterInfo(characterId:string):void;openItemInfo(itemId:string):void;openEnemyInfo(enemyId:string):void;closeOverlay():void;dismissScene():void;updateSettings(next:Partial<SettingsState>):Promise<void>;clearError():void;resetCorruptSave():Promise<void>;abandonRun():Promise<void>;setOnline(online:boolean):void;
}

export const useAppStore=create<AppState>((set,get)=>{
  const persist=async(run=get().run,profile=get().profile,settings=get().settings)=>{
    set({saveHealth:'saving'});
    try{await repository.save(payload(run,profile,settings));set({saveHealth:'ready'});}catch(error){set({saveHealth:'error',notice:'Progress could not be saved locally. You can keep playing, but this session may not survive a reload.',error:error instanceof Error?error.message:'Local save failed.'});}
  };
  const enqueueScene=(sceneId:SceneId,key:string,run:RunState,options?:{extraLine?:{speaker:string;text:string};encounterId?:string;eventId?:string})=>{
    if(get().seenSceneKeys.includes(key))return;
    const resolved=resolveScene(sceneId,{seed:run.seed,regionIndex:run.regionIndex,partyIds:run.party.map(member=>member.characterId),encounterId:options?.encounterId,eventId:options?.eventId});
    const scene=options?.extraLine?{...resolved,lines:[...resolved.lines,options.extraLine]}:resolved;
    set(state=>({sceneQueue:[...state.sceneQueue,scene],seenSceneKeys:[...state.seenSceneKeys,key]}));
  };
  const startEncounter=async(run:RunState,encounterId:string)=>{
    const rng=new SeededRng(run.seed,run.rngState);
    const battle=createBattle(run.party.map(p=>p.characterId),encounterId,rng,{party:run.party,coins:run.coins,relicIds:run.relicIds,regionIndex:run.regionIndex});
    run.activeBattle=battle;run.rngState=rng.serialize().state;run.coins=battle.availableCoins;
    const discovered=new Set(get().profile.discoveredEnemies);for(const id of battle.enemies)discovered.add(battle.units[id].sourceId);
    const profile={...get().profile,discoveredEnemies:[...discovered]};set({run,profile,screen:'battle',battleEvents:[],eventResult:null,error:null});
    if(battle.tier==='elite')enqueueScene('elite-intro',`elite:${run.currentNodeId??battle.id}`,run,{encounterId,extraLine:{speaker:'TABLE',text:`${battle.enemies.map(id=>battle.units[id].displayName).join(' & ')} steps onto the stage.`}});
    if(battle.tier==='boss'){
      const sceneId=encounterId==='boss-jonlow'?'boss-jonlow-intro':encounterId==='boss-klyde'?'boss-klyde-intro':'boss-warden-intro';
      enqueueScene(sceneId,`boss:${run.regionIndex}:${encounterId}`,run,{encounterId,extraLine:{speaker:'FORM REVEAL',text:`Affinity: ${String(battle.flags.bossAffinity??'neutral').toUpperCase()}`}});
    }
    await persist(run,profile,get().settings);
  };
  const finishBattleIfNeeded=async(run:RunState,events:CombatEvent[],rng:SeededRng)=>{
    const battle=run.activeBattle;if(!battle)return;
    run.party=exportPartyFromBattle(battle);run.coins=battle.availableCoins;run.rngState=rng.serialize().state;
    if(battle.phase==='defeat'){
      run.status='defeat';run.activeBattle=null;const profile={...get().profile,bestScore:Math.max(get().profile.bestScore,run.score)};set({run,profile,screen:'results',isResolving:false});await persist(run,profile,get().settings);return;
    }
    if(battle.phase!=='victory')return;
    const node=nodeForCurrent(run);
    if(battle.escaped){run.activeBattle=null;if(node)run=completeRouteNode(run,node.id);set({run,screen:'route',notice:'Escaped safely. No battle rewards were gained.',isResolving:false});await persist(run,get().profile,get().settings);return;}
    const reward=generateReward(run,battle.tier,rng,battle.encounterId);run.rngState=rng.serialize().state;run.pendingReward=reward;run.activeBattle=null;
    let profile=get().profile;if(battle.tier==='boss')profile={...profile,bossesDefeated:profile.bossesDefeated+1};
    set({run,profile,screen:'reward',battleEvents:events,isResolving:false});await persist(run,profile,get().settings);
  };
  const execute=async(command:BattleCommand,itemId?:string)=>{
    const state=get();if(state.isResolving||!state.run?.activeBattle)return;
    const legality=validatePlayerCommand(state.run.activeBattle,command);if(!legality.legal){set({error:legality.reason??'That action is unavailable.'});return;}
    if(itemId){const entry=state.run.inventory.find(e=>e.itemId===itemId);if(!entry||entry.quantity<=0){set({error:'That item is no longer in your pack.'});return;}}
    set({isResolving:true,error:null});const run=clone(state.run);const rng=new SeededRng(run.seed,run.rngState);
    try{
      const resolution=resolveBattleCommand(run.activeBattle!,command,rng);run.activeBattle=resolution.nextState;run.rngState=rng.serialize().state;run.party=exportPartyFromBattle(resolution.nextState);run.coins=resolution.nextState.availableCoins;
      if(itemId){const entry=run.inventory.find(e=>e.itemId===itemId)!;entry.quantity-=1;run.inventory=run.inventory.filter(e=>e.quantity>0);}
      set(s=>({run,battleEvents:resolution.events,battlePulse:s.battlePulse+1}));await persist(run,get().profile,get().settings);
      const duration=combatPresentationDuration(resolution.events,get().settings);await sleep(duration);
      await finishBattleIfNeeded(run,resolution.events,rng);
      if(run.activeBattle?.phase==='input')set({isResolving:false});
    }catch(error){set({isResolving:false,error:error instanceof Error?error.message:'The action could not resolve.'});}
  };

  return{
    booted:false,screen:'title',run:null,profile:clone(DEFAULT_PROFILE),settings:clone(DEFAULT_SETTINGS),overlay:null,sceneQueue:[],seenSceneKeys:[],selectedParty:[],isResolving:false,battleEvents:[],battlePulse:0,error:null,notice:null,saveHealth:'loading',corruptSaveMessage:null,eventResult:null,online:navigator.onLine,
    async initialize(){const result=await repository.load();if(result.kind==='ok'){set({booted:true,run:result.save.payload.activeRun,profile:result.save.payload.profile,settings:result.save.payload.settings,saveHealth:'ready'});}else if(result.kind==='corrupt'){set({booted:true,saveHealth:'error',corruptSaveMessage:result.message});}else set({booted:true,saveHealth:'ready'});},
    continueRun(){const run=get().run;if(run)set({screen:deriveScreen(run),error:null,notice:null});},
    openNewRun(){set({screen:'party',selectedParty:[],error:null,notice:null});},
    backToTitle(){set({screen:'title',error:null,eventResult:null});},
    toggleParty(id){if(!CHARACTERS.some(c=>c.id===id))return;set(state=>{const selected=state.selectedParty.includes(id)?state.selectedParty.filter(x=>x!==id):state.selectedParty.length<3?[...state.selectedParty,id]:state.selectedParty;return{selectedParty:selected,error:state.selectedParty.length>=3&&!state.selectedParty.includes(id)?'A party has exactly three members. Remove one before choosing another.':null};});},
    async confirmParty(){const selected=get().selectedParty;if(selected.length!==3){set({error:'Choose exactly three characters to start a run.'});return;}const seed=Date.now()>>>0;const run=createRun(selected,seed);const usage={...get().profile.characterUsage};for(const id of selected)usage[id]=(usage[id]??0)+1;const profile={...get().profile,runsStarted:get().profile.runsStarted+1,characterUsage:usage};set({run,profile,screen:'route',error:null,notice:'Run started. HP and PP persist between fights.',sceneQueue:[],seenSceneKeys:[]});enqueueScene('party-departure',`run:${run.id}:departure`,run);enqueueScene(regionSceneId(0),`run:${run.id}:region:0`,run);await persist(run,profile,get().settings);},
    async selectNode(id){const current=get().run;if(!current||get().isResolving)return;const allowed=availableRouteNodes(current.route,current.currentNodeId&&current.completedNodeIds.includes(current.currentNodeId)?current.currentNodeId:null,current.completedNodeIds);const node=allowed.find(n=>n.id===id);if(!node){set({error:'That route node is not reachable yet.'});return;}let run=clone(current);run.currentNodeId=node.id;set({run,error:null,notice:null,eventResult:null});await persist(run,get().profile,get().settings);if(node.type==='battle'||node.type==='elite'||node.type==='boss'){await startEncounter(run,node.encounterId!);return;}set({screen:node.type});if(node.type==='shop')enqueueScene('shop-arrival',`shop:${node.id}:arrival`,run);if(node.type==='event'&&node.eventId)enqueueScene('event-arrival',`event:${node.id}:arrival`,run,{eventId:node.eventId});},
    battleSkill(actorId,abilityId,targetIds){return execute({kind:'skill',actorId,abilityId,targetIds});},
    battleGuard(actorId){return execute({kind:'guard',actorId});},
    battleItem(actorId,itemId,targetIds){return execute({kind:'item',actorId,itemId,targetIds},itemId);},
    async claimRewardChoice(relicId,upgrade,spoilsId){const current=get().run;if(!current?.pendingReward)return;let run=claimReward(current,current.pendingReward,{relicId,upgrade,spoilsId});if(relicId){const discovered=new Set(get().profile.discoveredRelics);discovered.add(relicId);set({profile:{...get().profile,discoveredRelics:[...discovered]}});}const node=nodeForCurrent(run);const clearedRegion=run.regionIndex;if(node)run=completeRouteNode(run,node.id);if(node?.type==='boss')run=advanceRegion(run);let profile=get().profile;if(run.status==='victory')profile={...profile,wins:profile.wins+1,bestScore:Math.max(profile.bestScore,run.score)};set({run,profile,screen:run.status==='victory'?'results':'route',notice:node?.type==='boss'&&run.status==='active'?`Region ${run.regionIndex+1} opens ahead.`:'Reward secured.'});if(node?.type==='boss'){enqueueScene('region-complete',`run:${run.id}:region-complete:${clearedRegion}`,run);if(run.status==='active')enqueueScene(regionSceneId(run.regionIndex),`run:${run.id}:region:${run.regionIndex}`,run);else enqueueScene('run-victory',`run:${run.id}:victory`,run);}await persist(run,profile,get().settings);},
    async purchaseOffer(offerId){const current=get().run;if(!current?.currentNodeId)return;const offers=generateShopOffers(current,current.currentNodeId);const result=purchaseShopOffer(current,offerId,offers);if(!result.ok){set({error:result.reason??'Purchase failed.'});return;}let profile=get().profile;const offer=offers.find(o=>o.id===offerId);if(offer?.kind==='relic'){const discovered=new Set(profile.discoveredRelics);discovered.add(offer.contentId);profile={...profile,discoveredRelics:[...discovered]};}set({run:result.run,profile,error:null,notice:'Purchase packed.'});await persist(result.run,profile,get().settings);},
    async leaveShop(){const current=get().run;const node=current&&nodeForCurrent(current);if(!current||!node)return;const run=completeRouteNode(current,node.id);set({run,screen:'route',notice:'You leave the shop and return to the route.'});enqueueScene('shop-exit',`shop:${node.id}:exit`,run);await persist(run,get().profile,get().settings);},
    async chooseRest(choice){const current=get().run;const node=current&&nodeForCurrent(current);if(!current||!node)return;let run=applyRestChoice(current,choice);run=completeRouteNode(run,node.id);set({run,screen:'route',notice:choice==='recover'?'The party recovers HP.':'The party refreshes missing PP.'});await persist(run,get().profile,get().settings);},
    async chooseEvent(choiceId){const current=get().run;const node=current&&nodeForCurrent(current);if(!current||!node?.eventId)return;const rng=new SeededRng(current.seed,current.rngState);try{const beforeRelics=new Set(current.relicIds);const result=applyEventChoice(current,node.eventId,choiceId,rng);let run=result.run;run.rngState=rng.serialize().state;let profile=get().profile;const gainedRelics=run.relicIds.filter(id=>!beforeRelics.has(id));if(gainedRelics.length){const discovered=new Set(profile.discoveredRelics);for(const id of gainedRelics)discovered.add(id);profile={...profile,discoveredRelics:[...discovered]};}set({profile});if(result.battleEncounterId){set({run,eventResult:result.resultText});await startEncounter(run,result.battleEncounterId);return;}run=completeRouteNode(run,node.id);set({run,profile,eventResult:result.resultText,error:null});await persist(run,profile,get().settings);}catch(error){set({error:error instanceof Error?error.message:'That choice is unavailable.'});}},
    finishEvent(){set({screen:'route',eventResult:null});},
    openSettings(){set({overlay:{kind:'settings'},error:null});},openGuide(section){set({overlay:{kind:'guide',section},error:null});},openMoveInfo(abilityId){set({overlay:{kind:'move',abilityId}});},openStatusInfo(statusId){set({overlay:{kind:'status',statusId}});},openCharacterInfo(characterId){set({overlay:{kind:'character',characterId}});},openItemInfo(itemId){set({overlay:{kind:'item',itemId}});},openEnemyInfo(enemyId){set({overlay:{kind:'enemy',enemyId}});},closeOverlay(){set({overlay:null,error:null});},dismissScene(){set(state=>({sceneQueue:state.sceneQueue.slice(1)}));},
    async updateSettings(next){const settings={...get().settings,...next};set({settings});await persist(get().run,get().profile,settings);},
    clearError(){set({error:null,notice:null});},
    async resetCorruptSave(){await repository.clear();set({run:null,profile:clone(DEFAULT_PROFILE),settings:clone(DEFAULT_SETTINGS),corruptSaveMessage:null,saveHealth:'ready',screen:'title',overlay:null,sceneQueue:[],seenSceneKeys:[]});},
    async abandonRun(){const run=get().run?{...get().run!,status:'defeat' as const}:null;const profile=run?{...get().profile,bestScore:Math.max(get().profile.bestScore,run.score)}:get().profile;set({run:null,profile,screen:'title',selectedParty:[],notice:'Run abandoned.',overlay:null,sceneQueue:[],seenSceneKeys:[]});await persist(null,profile,get().settings);},
    setOnline(online){set({online});},
  };
});

export function currentShopOffers(run:RunState|null):ShopOffer[]{return run?.currentNodeId?generateShopOffers(run,run.currentNodeId):[];}
export function currentEvent(run:RunState|null){const node=run&&nodeForCurrent(run);return node?.eventId?getEvent(node.eventId):null;}
export function currentActorAvailability(run:RunState|null){if(!run?.activeBattle)return null;const battle=run.activeBattle;const actor=battle.units[battle.turnOrder[battle.turnIndex]];if(!actor||actor.side!=='ally')return null;return getCharacter(actor.sourceId).abilities.map(abilityId=>{const ability=getAbility(abilityId);const target=ability.target==='enemy-one'||ability.target==='random-enemy'?battle.enemies.find(id=>battle.units[id].alive):ability.target==='ally-one'?battle.allies.find(id=>battle.units[id].alive):undefined;const legality=validatePlayerCommand(battle,{kind:'skill',actorId:actor.id,abilityId,targetIds:target?[target]:[]});return{ability,legal:legality.legal,reason:legality.reason};});}
export function inventoryItems(run:RunState|null){return(run?.inventory??[]).map(entry=>({...entry,definition:getItem(entry.itemId)}));}
