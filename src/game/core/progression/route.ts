import type { NodeType, RegionRoute, RouteNode } from '../types.js';
import { SeededRng, hashText } from '../rng/seededRng.js';
import { ENCOUNTERS } from '../../content/enemies.js';
import { EVENTS } from '../../content/events.js';
import { BALANCE } from '../../balance/constants.js';

const BOSS_ENCOUNTERS = ['boss-jonlow','boss-klyde','boss-warden'] as const;
const NORMALS = ENCOUNTERS.filter(e => e.tier === 'normal').map(e => e.id);
const ELITES = ENCOUNTERS.filter(e => e.tier === 'elite').map(e => e.id);

const STAGE_POOLS: readonly (readonly NodeType[])[] = [
  ['battle'],                       // Every run opens with earned resources, not free value.
  ['battle','event','elite'],       // Optional risk/unknown branch.
  ['rest','shop'],                  // Guaranteed recovery/economy opportunity.
  ['battle'],                       // Second required fight before the boss.
  ['shop','rest','event'],          // Resource conversion / recovery / uncertainty.
  ['battle','event','elite'],       // Final pressure choice, paired with a guaranteed Rest lane.
];

function pickNodeType(stage:number, lane:number, rng:SeededRng):NodeType {
  const pool = STAGE_POOLS[stage % STAGE_POOLS.length];
  if (stage === 2) return lane === 0 ? 'rest' : 'shop';
  // A party that reaches the boss under ~60% HP has never won one, so recovery is always reachable
  // on the last stage. The other lane keeps the greed option: fight on, and arrive hurt by choice.
  if (stage === BALANCE.routeStagesBeforeBoss - 1 && lane === 0) return 'rest';
  if (pool.length === 1) return pool[0];
  return pool[rng.int(0, pool.length - 1)];
}

function makeNode(region:number, stage:number, lane:number, rng:SeededRng, assigned:Set<string>, recruitmentRegion:number, anchorAssigned:boolean):{node:RouteNode;anchorAssigned:boolean} {
  const type = pickNodeType(stage, lane, rng);
  const node:RouteNode = { id:`r${region + 1}-s${stage + 1}-l${lane + 1}`, stage, type, outgoing:[] };
  if (type === 'battle') node.encounterId = rng.pick(NORMALS);
  if (type === 'elite') node.encounterId = rng.pick(ELITES);
  if (type === 'event') {
    if (region === recruitmentRegion && !anchorAssigned) {
      node.eventId = 'fourth-chair';
      assigned.add('fourth-chair');
      return {node,anchorAssigned:true};
    }
    const pool = EVENTS.filter(event => event.weight > 0 && event.id !== 'fourth-chair');
    const unseen = pool.filter(event => !assigned.has(event.id));
    const chosen = rng.weightedPick(unseen.length ? unseen : pool);
    node.eventId = chosen.id;
    assigned.add(chosen.id);
  }
  return {node,anchorAssigned};
}

function buildRegion(regionIndex:number, rng:SeededRng, assigned:Set<string>, recruitmentRegion:number):RegionRoute {
  const stages:RouteNode[][] = [];
  let anchorAssigned=false;
  for (let stage=0; stage<BALANCE.routeStagesBeforeBoss; stage+=1) {
    const nodes = Array.from({length:2}, (_, lane) => {
      const made=makeNode(regionIndex, stage, lane, rng, assigned, recruitmentRegion, anchorAssigned);
      anchorAssigned=made.anchorAssigned;
      return made.node;
    });
    if (nodes.every(n => n.type === 'elite')) {
      nodes[0].type = 'battle';
      nodes[0].encounterId = rng.pick(NORMALS);
    }
    stages.push(nodes);
  }
  const boss:RouteNode = {
    id:`r${regionIndex + 1}-boss`, stage:BALANCE.routeStagesBeforeBoss, type:'boss',
    encounterId:BOSS_ENCOUNTERS[Math.min(regionIndex, BOSS_ENCOUNTERS.length - 1)], outgoing:[],
  };

  for (let stage=0; stage<stages.length; stage+=1) {
    const next = stage === stages.length - 1 ? [boss] : stages[stage + 1];
    for (let lane=0; lane<stages[stage].length; lane+=1) {
      const node=stages[stage][lane];
      if (next.length === 1) node.outgoing=[next[0].id];
      else if (stage % 2 === 0) node.outgoing=[next[lane].id];
      else node.outgoing=[next[lane].id,next[1-lane].id];
    }
  }

  return { regionIndex, nodes:[...stages.flat(), boss], startNodeIds:stages[0].map(n => n.id), bossNodeId:boss.id };
}

export function generateRegionRoute(regionIndex:number, rng:SeededRng):RegionRoute {
  const scratch = new SeededRng(rng.seed);
  const assigned = new Set<string>();
  const recruitmentRegion=1+(hashText(String(rng.seed))%2);
  let route:RegionRoute|undefined;
  for (let index=0; index<=regionIndex; index+=1) route=buildRegion(index, scratch, assigned, recruitmentRegion);
  return route!;
}

export function minimumCombatNodesToBoss(route:RegionRoute):number {
  const byId=new Map(route.nodes.map(node=>[node.id,node]));
  const memo=new Map<string,number>();
  const visit=(id:string):number=>{
    if(memo.has(id))return memo.get(id)!;
    const node=byId.get(id);if(!node)return Number.POSITIVE_INFINITY;
    if(id===route.bossNodeId)return 0;
    const self=node.type==='battle'||node.type==='elite'?1:0;
    const next=node.outgoing.map(visit);
    const value=self+(next.length?Math.min(...next):Number.POSITIVE_INFINITY);memo.set(id,value);return value;
  };
  return Math.min(...route.startNodeIds.map(visit));
}

export function validateRoute(route:RegionRoute):{valid:boolean; errors:string[]} {
  const errors:string[]=[];
  const byId = new Map(route.nodes.map(node=>[node.id,node]));
  if (!byId.has(route.bossNodeId)) errors.push('Boss node is missing.');
  for (const start of route.startNodeIds) if (!byId.has(start)) errors.push(`Unknown start node ${start}.`);
  for (const node of route.nodes) for (const target of node.outgoing) if (!byId.has(target)) errors.push(`${node.id} points to missing ${target}.`);

  const reachable = new Set<string>();
  const queue = [...route.startNodeIds];
  while (queue.length) {
    const id=queue.shift()!; if (reachable.has(id)) continue; reachable.add(id);
    for (const next of byId.get(id)?.outgoing ?? []) queue.push(next);
  }
  for (const node of route.nodes) if (!reachable.has(node.id)) errors.push(`${node.id} is unreachable.`);
  if (!reachable.has(route.bossNodeId)) errors.push('Boss is unreachable.');

  const unsafe = (id:string, seenRecovery:boolean, seen:Set<string>):boolean => {
    if (seen.has(id)) return false;
    const node=byId.get(id); if (!node) return true;
    const recovery = seenRecovery || node.type === 'rest' || node.type === 'shop';
    if (id === route.bossNodeId) return !recovery;
    const nextSeen=new Set(seen); nextSeen.add(id);
    return node.outgoing.some(next=>unsafe(next,recovery,nextSeen));
  };
  if (route.startNodeIds.some(id=>unsafe(id,false,new Set()))) errors.push('A boss path has no recovery opportunity.');

  for (const node of route.nodes) if (node.type === 'elite') {
    for (const next of node.outgoing) if (byId.get(next)?.type === 'elite') errors.push(`Elite chain ${node.id} -> ${next}.`);
  }
  if(minimumCombatNodesToBoss(route)<2) errors.push('A boss path contains fewer than two pre-boss combats.');
  return {valid:errors.length===0,errors};
}

export function availableRouteNodes(route:RegionRoute, currentNodeId:string|null, completedNodeIds:string[]):RouteNode[] {
  const completed=new Set(completedNodeIds);
  const ids = currentNodeId ? (route.nodes.find(n=>n.id===currentNodeId)?.outgoing ?? []) : route.startNodeIds;
  return ids.map(id=>route.nodes.find(n=>n.id===id)).filter((n):n is RouteNode=>Boolean(n) && !completed.has(n!.id));
}
