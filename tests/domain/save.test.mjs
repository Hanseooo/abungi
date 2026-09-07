import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../../.domain-build/core/progression/run.js';
import { createSaveEnvelope, migrateSaveEnvelope, validateSaveShape, DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../../.domain-build/core/save/saveFormat.js';

test('save envelope is versioned, revisioned and contains serializable active battle state',()=>{
  const run=createRun(['earl','hans','yeeho'],123);
  const envelope=createSaveEnvelope({activeRun:run,profile:DEFAULT_PROFILE,settings:DEFAULT_SETTINGS},7,'2026-09-07T10:00:00.000Z');
  assert.equal(envelope.schemaVersion,1);assert.equal(envelope.revision,7);assert.equal(envelope.payload.activeRun.seed,run.seed);
  assert.equal(JSON.parse(JSON.stringify(envelope)).payload.activeRun.rngState,run.rngState);
});

test('save validation rejects corrupt and structurally incomplete v1 payloads',()=>{
  assert.equal(validateSaveShape(null).valid,false);
  assert.equal(validateSaveShape({schemaVersion:1,revision:1,payload:{}}).valid,false);
  assert.equal(validateSaveShape({schemaVersion:99,revision:1,payload:{}}).valid,false);
});

test('migration infrastructure accepts v1 and rejects unsupported future versions',()=>{
  const good=createSaveEnvelope({activeRun:null,profile:DEFAULT_PROFILE,settings:DEFAULT_SETTINGS},1,'2026-09-07T10:00:00.000Z');
  assert.deepEqual(migrateSaveEnvelope(good),good);
  assert.throws(()=>migrateSaveEnvelope({...good,schemaVersion:2}),/newer|unsupported/i);
});
