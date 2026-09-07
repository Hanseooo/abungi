import type { ProfileState, RunState, SettingsState } from '../types.js';

export const SAVE_SCHEMA_VERSION = 1 as const;
export const DEFAULT_PROFILE:ProfileState={runsStarted:0,wins:0,bestScore:0,bossesDefeated:0,discoveredRelics:[],discoveredEnemies:[],characterUsage:{}};
export const DEFAULT_SETTINGS:SettingsState={masterMuted:false,musicVolume:0.55,sfxVolume:0.75,animationSpeed:2,reducedMotion:false};

export interface SavePayload {activeRun:RunState|null;profile:ProfileState;settings:SettingsState}
export interface SaveEnvelopeV1 {schemaVersion:1;timestamp:string;revision:number;payload:SavePayload}

export function createSaveEnvelope(payload:SavePayload,revision:number,timestamp=new Date().toISOString()):SaveEnvelopeV1{
  return {schemaVersion:SAVE_SCHEMA_VERSION,timestamp,revision:Math.max(0,Math.floor(revision)),payload};
}

const isRecord=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
export function validateSaveShape(raw:unknown):{valid:boolean;errors:string[]} {
  const errors:string[]=[];
  if(!isRecord(raw)){return{valid:false,errors:['Save is not an object.']};}
  if(raw.schemaVersion!==1)errors.push('Unsupported save schema version.');
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

export function migrateSaveEnvelope(raw:unknown):SaveEnvelopeV1{
  if(!isRecord(raw))throw new Error('Save is corrupt or unreadable.');
  const version=raw.schemaVersion;
  if(typeof version!=='number')throw new Error('Save has no schema version.');
  if(version>SAVE_SCHEMA_VERSION)throw new Error('Save was created by a newer, unsupported version of Abungi.');
  if(version<1)throw new Error('Save schema version is unsupported.');
  // v1 is the first release. Future migrations are appended here in order.
  const verdict=validateSaveShape(raw);if(!verdict.valid)throw new Error(`Save validation failed: ${verdict.errors.join(' ')}`);
  return raw as unknown as SaveEnvelopeV1;
}
