import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRng } from '../../.domain-build/core/rng/seededRng.js';
import { createRun, completeRouteNode } from '../../.domain-build/core/progression/run.js';
import { generateReward, claimReward } from '../../.domain-build/core/progression/rewards.js';
import { createSaveEnvelope, migrateSaveEnvelope, validateSaveShape, DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../../.domain-build/core/save/saveFormat.js';
import { createBattle } from '../../.domain-build/core/combat/battleEngine.js';

const baseRun = () => createRun(['earl','hans','marcus'], 123);

test('save envelope is versioned, revisioned and contains serializable active battle state',()=>{
  const run=createRun(['earl','hans','yeeho'],123);
  const envelope=createSaveEnvelope({activeRun:run,profile:DEFAULT_PROFILE,settings:DEFAULT_SETTINGS},7,'2026-09-07T10:00:00.000Z');
  assert.equal(envelope.schemaVersion,3);assert.equal(envelope.revision,7);assert.equal(envelope.payload.activeRun.seed,run.seed);
  assert.equal(JSON.parse(JSON.stringify(envelope)).payload.activeRun.rngState,run.rngState);
});

test('save validation rejects corrupt and structurally incomplete v1 payloads',()=>{
  assert.equal(validateSaveShape(null).valid,false);
  assert.equal(validateSaveShape({schemaVersion:1,revision:1,payload:{}}).valid,false);
  assert.equal(validateSaveShape({schemaVersion:99,revision:1,payload:{}}).valid,false);
});

test('migration accepts v3 unchanged and rejects unsupported future versions',()=>{
  const good=createSaveEnvelope({activeRun:null,profile:DEFAULT_PROFILE,settings:DEFAULT_SETTINGS},1,'2026-09-07T10:00:00.000Z');
  assert.deepEqual(migrateSaveEnvelope(good),good);
  assert.throws(()=>migrateSaveEnvelope({...good,schemaVersion:4}),/newer|unsupported/i);
});

test('V2 saves migrate to V3 with an empty effect collection on an active battle', () => {
  const battle = createBattle(['earl','hans','marcus'], 'normal-fastlane', new SeededRng(777), { coins: 30 });
  delete battle.effects;
  const v2 = {
    schemaVersion: 2, timestamp: '2026-09-08T00:00:00.000Z', revision: 4,
    payload: { activeRun: { ...baseRun(), activeBattle: battle }, profile: DEFAULT_PROFILE, settings: DEFAULT_SETTINGS },
  };
  const migrated = migrateSaveEnvelope(v2);
  assert.equal(migrated.schemaVersion, 3);
  assert.deepEqual(migrated.payload.activeRun.activeBattle.effects, []);
  assert.equal(migrated.payload.activeRun.coins, baseRun().coins);
});

test('a V3 save round-trips its effect collection unchanged', () => {
  const battle = createBattle(['earl','hans','marcus'], 'normal-fastlane', new SeededRng(777), { coins: 30 });
  battle.effects = [{ uid: 'fx-1', id: 'protect', sourceUnitId: battle.allies[0], targetUnitId: battle.allies[1], expiry: 'source-turn-start', remaining: 1 }];
  const envelope = createSaveEnvelope({ activeRun: { ...baseRun(), activeBattle: battle }, profile: DEFAULT_PROFILE, settings: DEFAULT_SETTINGS }, 5);
  const restored = migrateSaveEnvelope(JSON.parse(JSON.stringify(envelope)));
  assert.deepEqual(restored.payload.activeRun.activeBattle.effects, battle.effects);
});

test('a future schema version is rejected without a partial result', () => {
  assert.throws(() => migrateSaveEnvelope({ schemaVersion: 4, timestamp: 'x', revision: 1, payload: {} }), /newer, unsupported/);
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
  assert.equal(migrated.schemaVersion,3);
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

test('loading a save drops relics retired by a content update instead of corrupting the run',()=>{
  const run=baseRun();
  run.relicIds=['cardboard-plate','reinforced-stance','sticky-label'];
  const profile={...DEFAULT_PROFILE,discoveredRelics:['lucky-centavo','thermos']};
  const envelope=createSaveEnvelope({activeRun:run,profile,settings:DEFAULT_SETTINGS},1);
  const loaded=migrateSaveEnvelope(JSON.parse(JSON.stringify(envelope)));
  assert.deepEqual(loaded.payload.activeRun.relicIds,['cardboard-plate']);
  assert.deepEqual(loaded.payload.profile.discoveredRelics,['thermos']);
});
