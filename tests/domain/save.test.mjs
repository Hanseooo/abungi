import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRng } from '../../.domain-build/core/rng/seededRng.js';
import { createRun, completeRouteNode } from '../../.domain-build/core/progression/run.js';
import { generateReward, claimReward } from '../../.domain-build/core/progression/rewards.js';
import { createSaveEnvelope, migrateSaveEnvelope, validateSaveShape, DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../../.domain-build/core/save/saveFormat.js';

test('save envelope is versioned, revisioned and contains serializable active battle state',()=>{
  const run=createRun(['earl','hans','yeeho'],123);
  const envelope=createSaveEnvelope({activeRun:run,profile:DEFAULT_PROFILE,settings:DEFAULT_SETTINGS},7,'2026-09-07T10:00:00.000Z');
  assert.equal(envelope.schemaVersion,2);assert.equal(envelope.revision,7);assert.equal(envelope.payload.activeRun.seed,run.seed);
  assert.equal(JSON.parse(JSON.stringify(envelope)).payload.activeRun.rngState,run.rngState);
});

test('save validation rejects corrupt and structurally incomplete v1 payloads',()=>{
  assert.equal(validateSaveShape(null).valid,false);
  assert.equal(validateSaveShape({schemaVersion:1,revision:1,payload:{}}).valid,false);
  assert.equal(validateSaveShape({schemaVersion:99,revision:1,payload:{}}).valid,false);
});

test('migration accepts v2 unchanged and rejects unsupported future versions',()=>{
  const good=createSaveEnvelope({activeRun:null,profile:DEFAULT_PROFILE,settings:DEFAULT_SETTINGS},1,'2026-09-07T10:00:00.000Z');
  assert.deepEqual(migrateSaveEnvelope(good),good);
  assert.throws(()=>migrateSaveEnvelope({...good,schemaVersion:3}),/newer|unsupported/i);
});

test('v1 save with full run state migrates to v2 preserving party, inventory, upgrades, relics, and RNG',()=>{
  const rng=new SeededRng(43);
  let run=createRun(['earl','hans','marcus'],43);
  run.party[0].hp=10;run.party[0].abilityPP.yosi=0;
  run=completeRouteNode(run,run.route.startNodeIds[0]);
  const reward=generateReward(run,'boss',rng);
  const claimed=claimReward(run,reward,{relicId:reward.relicChoices[0],upgrade:reward.upgradeChoices[0]});
  const envelope=createSaveEnvelope({activeRun:claimed,profile:{...DEFAULT_PROFILE,runsStarted:3,wins:1,bestScore:500},settings:DEFAULT_SETTINGS},5,'2026-09-08T00:00:00.000Z');
  const migrated=migrateSaveEnvelope(envelope);
  assert.equal(migrated.schemaVersion,2);
  assert.equal(migrated.payload.activeRun.rngState,claimed.rngState);
  assert.deepEqual(migrated.payload.activeRun.inventory,claimed.inventory);
  assert.deepEqual(migrated.payload.activeRun.relicIds,claimed.relicIds);
  assert.deepEqual(migrated.payload.activeRun.party.map(p=>p.upgradedAbilities),claimed.party.map(p=>p.upgradedAbilities));
  assert.equal(migrated.payload.activeRun.fieldUsesSpent,0);
  assert.equal(migrated.payload.activeRun.shopVisit,null);
  assert.equal(migrated.payload.profile.runsStarted,3);
  assert.equal(migrated.payload.profile.bestScore,500);
  assert.equal(migrated.payload.settings.animationSpeed,DEFAULT_SETTINGS.animationSpeed);
});
