import type { PartyMemberRunState, RunState } from '../types.js';
import { SeededRng } from '../rng/seededRng.js';
import { abilityMaxPp, getCharacter } from '../../content/characters.js';
import { BALANCE } from '../../balance/constants.js';
import { generateRegionRoute } from './route.js';

const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;

export function createRun(partyIds:string[], seed:number):RunState {
  if(partyIds.length!==3||new Set(partyIds).size!==3) throw new Error('Choose exactly three unique characters.');
  const rng=new SeededRng(seed);
  const route=generateRegionRoute(0,rng);
  const party:PartyMemberRunState[]=partyIds.map(characterId=>{
    const c=getCharacter(characterId);
    return {characterId,hp:c.stats.maxHp,abilityPP:abilityMaxPp(characterId),upgradedAbilities:[]};
  });
  return {
    id:`run-${rng.seed}`,
    seed:rng.seed,
    rngState:rng.serialize().state,
    regionIndex:0,
    route,
    currentNodeId:null,
    completedNodeIds:[],
    party,
    coins:30,
    inventory:[{itemId:'patch-kit',quantity:1},{itemId:'pp-tonic',quantity:1}],
    relicIds:[],
    activeBattle:null,
    pendingReward:null,
    score:0,
    status:'active',
  };
}

export function completeRouteNode(input:RunState,nodeId:string):RunState {
  const run=clone(input);
  if(!run.route.nodes.some(n=>n.id===nodeId)) throw new Error(`Unknown route node: ${nodeId}`);
  if(!run.completedNodeIds.includes(nodeId)) run.completedNodeIds.push(nodeId);
  run.currentNodeId=nodeId;
  run.activeBattle=null;
  run.score+=10;
  return run;
}

export function advanceRegion(input:RunState):RunState {
  const run=clone(input);
  const next=run.regionIndex+1;
  if(next>=BALANCE.regionCount){run.status='victory';run.activeBattle=null;run.pendingReward=null;run.score+=250;return run;}
  run.regionIndex=next;
  const rng=new SeededRng(run.seed,run.rngState);
  run.route=generateRegionRoute(next,rng);
  run.rngState=rng.serialize().state;
  run.currentNodeId=null;
  run.completedNodeIds=[];
  run.activeBattle=null;
  run.pendingReward=null;
  run.score+=75;
  return run;
}
