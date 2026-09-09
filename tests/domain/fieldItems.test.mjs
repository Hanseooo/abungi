import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, completeRouteNode } from '../../.domain-build/core/progression/run.js';
import { applyFieldItem, discardFieldItem, fieldAccess, fieldUseLimit } from '../../.domain-build/core/progression/fieldItems.js';

test('field item heals once and spends one use without consuming RNG',()=>{
  let run=createRun(['earl','hans','leandre'],55);
  const nodeId=run.route.startNodeIds[0];
  run=completeRouteNode(run,nodeId);
  run.party[0].hp=10;
  const command={
    itemId:'patch-kit',targetId:'earl',
    expected:{runId:run.id,regionIndex:run.regionIndex,currentNodeId:run.currentNodeId,fieldUsesSpent:0,inventoryCount:1}
  };
  const result=applyFieldItem(run,command);
  assert.equal(result.ok,true);
  assert.equal(result.run.party[0].hp,49); // 10 + round(110*.35)=49
  assert.equal(result.run.fieldUsesSpent,1);
  assert.equal(result.run.rngState,run.rngState);
  // inventory reduced
  assert.equal(result.run.inventory.find(i=>i.itemId==='patch-kit'),undefined);
  const replay=applyFieldItem(result.run,command);
  assert.equal(replay.ok,false);
  assert.deepEqual(replay.run,result.run);
});

test('field use is blocked when the item would have no effect',()=>{
  let run=createRun(['earl','hans','leandre'],56);
  const nodeId=run.route.startNodeIds[0];
  run=completeRouteNode(run,nodeId);
  // Full HP party — patch-kit has no effect
  const command={
    itemId:'patch-kit',targetId:'earl',
    expected:{runId:run.id,regionIndex:run.regionIndex,currentNodeId:run.currentNodeId,fieldUsesSpent:0,inventoryCount:1}
  };
  const result=applyFieldItem(run,command);
  assert.equal(result.ok,false);
  assert.deepEqual(result.run,run);
});

test('discarding an item removes one quantity without spending a field use',()=>{
  const run=createRun(['earl','hans','leandre'],57);
  // No node needed — discard works before first node
  const result=discardFieldItem(run,'patch-kit',1);
  assert.equal(result.ok,true);
  assert.equal(result.run.inventory.find(i=>i.itemId==='patch-kit'),undefined);
  assert.equal(result.run.fieldUsesSpent,null);
  // Stale quantity rejected
  const stale=discardFieldItem(result.run,'patch-kit',1);
  assert.equal(stale.ok,false);
});

test('fieldUseLimit returns 2 base and fieldAccess gates correctly',()=>{
  let run=createRun(['earl','hans','leandre'],58);
  assert.equal(fieldUseLimit(run),2);
  assert.equal(fieldAccess(run).legal,false); // no completed node yet
  run=completeRouteNode(run,run.route.startNodeIds[0]);
  assert.equal(fieldAccess(run).legal,true);
  run.fieldUsesSpent=2;
  assert.equal(fieldAccess(run).legal,false); // uses exhausted
});
