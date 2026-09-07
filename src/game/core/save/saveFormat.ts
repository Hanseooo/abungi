import type { ProfileState, RunState, SettingsState, ShopVisit } from '../types.js';
import { generateShopOffers } from '../progression/shop.js';

export const SAVE_SCHEMA_VERSION = 2 as const;
export const DEFAULT_PROFILE:ProfileState={runsStarted:0,wins:0,bestScore:0,bossesDefeated:0,discoveredRelics:[],discoveredEnemies:[],characterUsage:{}};
export const DEFAULT_SETTINGS:SettingsState={masterMuted:false,musicVolume:0.55,sfxVolume:0.75,animationSpeed:2,reducedMotion:false};

export interface SavePayload {activeRun:RunState|null;profile:ProfileState;settings:SettingsState}
export interface SaveEnvelopeV1 {schemaVersion:1;timestamp:string;revision:number;payload:SavePayload}
export interface SaveEnvelopeV2 {schemaVersion:2;timestamp:string;revision:number;payload:SavePayload;persistenceWarning?:string}

export function createSaveEnvelope(payload:SavePayload,revision:number,timestamp=new Date().toISOString()):SaveEnvelopeV2{
  return {schemaVersion:SAVE_SCHEMA_VERSION,timestamp,revision:Math.max(0,Math.floor(revision)),payload};
}

const isRecord=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
export function validateSaveShape(raw:unknown):{valid:boolean;errors:string[]} {
  const errors:string[]=[];
  if(!isRecord(raw)){return{valid:false,errors:['Save is not an object.']};}
  if(raw.schemaVersion!==2)errors.push('Unsupported save schema version.');
  if(typeof raw.timestamp!=='string')errors.push('Missing save timestamp.');
  if(typeof raw.revision!=='number'||!Number.isFinite(raw.revision))errors.push('Invalid save revision.');
  if(!isRecord(raw.payload))errors.push('Missing save payload.');
  else{
    if(!('activeRun' in raw.payload))errors.push('Missing activeRun.');
    if(!isRecord(raw.payload.profile))errors.push('Missing profile.');
    if(!isRecord(raw.payload.settings))errors.push('Missing settings.');
    const run=raw.payload.activeRun;
    if(run!==null&&(!isRecord(run)||typeof run.seed!=='number'||!Array.isArray(run.party)||!isRecord(run.route)||typeof run.rngState!=='number'))errors.push('Active run is structurally invalid.');
  }
  return{valid:errors.length===0,errors};
}

function migrateRunV1toV2(run:unknown):RunState {
  const r=run as RunState;
  const hasCompletedNode=Array.isArray(r.completedNodeIds)&&r.completedNodeIds.length>0;
  const hasAdvancedRegion=typeof r.regionIndex==='number'&&r.regionIndex>0&&!r.currentNodeId;
  const fieldUsesSpent:number|null=(hasCompletedNode||hasAdvancedRegion)?0:null;

  let shopVisit:ShopVisit|null=null;
  const nodes=(r.route as {nodes?:{id:string;type:string}[]})?.nodes;
  const currentNode=r.currentNodeId&&nodes?nodes.find(n=>n.id===r.currentNodeId):undefined;
  if(currentNode?.type==='shop'&&!r.activeBattle&&!r.pendingReward&&!r.completedNodeIds?.includes(currentNode.id)){
    try{shopVisit={nodeId:currentNode.id,offers:generateShopOffers(r,currentNode.id),purchasedOfferIds:[]};}
    catch{shopVisit=null;}
  }

  return {...r,fieldUsesSpent,shopVisit};
}

export function migrateSaveEnvelope(raw:unknown):SaveEnvelopeV2{
  if(!isRecord(raw))throw new Error('Save is corrupt or unreadable.');
  const version=raw.schemaVersion;
  if(typeof version!=='number')throw new Error('Save has no schema version.');
  if(version>2)throw new Error('Save was created by a newer, unsupported version of Abungi.');
  if(version<1)throw new Error('Save schema version is unsupported.');

  if(version===1){
    const v1=raw as unknown as SaveEnvelopeV1;
    if(typeof v1.timestamp!=='string'||typeof v1.revision!=='number'||!isRecord(v1.payload))
      throw new Error('Save validation failed: V1 envelope is malformed.');
    const run=v1.payload.activeRun;
    const migratedRun=run?migrateRunV1toV2(run):null;
    return {schemaVersion:2,timestamp:v1.timestamp,revision:v1.revision,payload:{...v1.payload,activeRun:migratedRun}};
  }

  // v2 — validate shape
  const verdict=validateSaveShape(raw);
  if(!verdict.valid)throw new Error(`Save validation failed: ${verdict.errors.join(' ')}`);
  return raw as unknown as SaveEnvelopeV2;
}
