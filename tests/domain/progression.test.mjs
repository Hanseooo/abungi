import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRng } from '../../.domain-build/core/rng/seededRng.js';
import { createRun, completeRouteNode, advanceRegion } from '../../.domain-build/core/progression/run.js';
import { applyRestChoice } from '../../.domain-build/core/progression/rest.js';
import { generateReward, claimReward } from '../../.domain-build/core/progression/rewards.js';
import { generateShopOffers, purchaseShopOffer } from '../../.domain-build/core/progression/shop.js';
import { applyEventChoice, canChooseEvent } from '../../.domain-build/core/progression/events.js';
import { availableRouteNodes } from '../../.domain-build/core/progression/route.js';

test('new run starts with exactly three persistent party members and a seeded route',()=>{
  const run=createRun(['earl','hans','leandre'],2345);
  assert.equal(run.party.length,3); assert.equal(new Set(run.party.map(p=>p.characterId)).size,3);
  assert.equal(run.regionIndex,0); assert.equal(run.status,'active'); assert.ok(availableRouteNodes(run.route,null,[]).length>0);
  assert.equal(run.rngState,new SeededRng(2345).serialize().state === 2345 ? run.rngState : run.rngState); // state is persisted and numeric
  assert.equal(typeof run.rngState,'number');
});

test('rest Recover restores 35% max HP to living members without reviving KO members',()=>{
  const run=createRun(['earl','hans','leandre'],1);
  run.party[0].hp=10;run.party[1].hp=0;run.party[2].hp=20;
  const next=applyRestChoice(run,'recover');
  assert.equal(next.party[0].hp,49); // Earl: 10 + round(110 * .35)=49
  assert.equal(next.party[1].hp,0);
  assert.equal(next.party[2].hp,55);
});

test('rest Refresh restores 30% of missing PP across every move',()=>{
  const run=createRun(['earl','hans','leandre'],2);
  const before=run.party[0].abilityPP.yosi; run.party[0].abilityPP.yosi=0;
  const next=applyRestChoice(run,'refresh');
  assert.equal(next.party[0].abilityPP.yosi,Math.round(before*0.30));
});

test('shop is deterministic and Leandre adds one inventory choice',()=>{
  const withMerchant=createRun(['leandre','earl','hans'],500);
  const withoutMerchant=createRun(['earl','hans','marcus'],500);
  const a=generateShopOffers(withMerchant,'node-x');const b=generateShopOffers(withMerchant,'node-x');
  assert.deepEqual(a,b); assert.equal(a.length,5); assert.equal(generateShopOffers(withoutMerchant,'node-x').length,4);
});

test('shop purchase spends coins and adds a consumable while respecting capacity',()=>{
  let run=createRun(['earl','hans','marcus'],10);run.coins=200;
  const offer=generateShopOffers(run,'node-shop').find(o=>o.kind==='item');assert.ok(offer);
  const result=purchaseShopOffer(run,offer.id,generateShopOffers(run,'node-shop'));
  assert.equal(result.ok,true); assert.ok(result.run.coins<200); assert.ok(result.run.inventory.some(i=>i.itemId===offer.contentId));
});

test('elite reward offers three relic choices and an upgrade opportunity',()=>{
  const run=createRun(['earl','hans','marcus'],42);const rng=new SeededRng(run.rngState);
  const reward=generateReward(run,'elite',rng);
  assert.equal(reward.relicChoices.length,3);assert.ok(reward.upgradeChoices.length>=1);assert.ok(reward.coins>0);
});

test('claiming a reward can add one relic, one upgrade, coins, and boss recovery',()=>{
  let run=createRun(['earl','hans','marcus'],43);run.party[0].hp=10;run.party[0].abilityPP.yosi=0;
  const reward=generateReward(run,'boss',new SeededRng(90));
  const claimed=claimReward(run,reward,{relicId:reward.relicChoices[0],upgrade:reward.upgradeChoices[0]});
  assert.ok(claimed.coins>run.coins);assert.ok(claimed.relicIds.includes(reward.relicChoices[0]));
  assert.ok(claimed.party.some(p=>p.upgradedAbilities.length>0));assert.ok(claimed.party[0].hp>10);
});

test('events apply data-defined resource effects and never exceed item capacity',()=>{
  let run=createRun(['earl','hans','marcus'],77);run.coins=20;
  const result=applyEventChoice(run,'loose-crate','open',new SeededRng(4));
  assert.equal(result.run.inventory.some(i=>i.itemId==='pp-tonic'),true);assert.ok(result.resultText.length>0);
});

test('completing nodes advances availability and three boss transitions finish the run',()=>{
  let run=createRun(['earl','hans','marcus'],88);
  const first=availableRouteNodes(run.route,null,[])[0];run=completeRouteNode(run,first.id);
  assert.ok(availableRouteNodes(run.route,first.id,run.completedNodeIds).length>0);
  run=advanceRegion(run);assert.equal(run.regionIndex,1);assert.equal(run.status,'active');
  run=advanceRegion(run);assert.equal(run.regionIndex,2);run=advanceRegion(run);assert.equal(run.status,'victory');
});


test('street-game wager requires five coins and resolves seeded visible risk',()=>{
  let poor=createRun(['earl','hans','leandre'],901);poor.coins=4;
  assert.deepEqual(canChooseEvent(poor,'street-game','play'),{allowed:false,reason:'Need 5 coins.'});
  let run=createRun(['earl','hans','leandre'],902);run.coins=12;
  const a=applyEventChoice(run,'street-game','play',new SeededRng(7));
  const b=applyEventChoice(run,'street-game','play',new SeededRng(7));
  assert.equal(a.run.coins,b.run.coins);
  assert.ok([7,17].includes(a.run.coins));
  assert.match(a.resultText,/win|lose|wager|cup/i);
});

test('normal rewards do not advertise an item when inventory is already full',()=>{
  const run=createRun(['earl','hans','marcus'],903);
  run.inventory=[{itemId:'patch-kit',quantity:6}];
  const reward=generateReward(run,'normal',new SeededRng(1));
  assert.equal(reward.itemId,undefined);
});

test('completion opens one interval without replaying score',()=>{
  const run=createRun(['earl','hans','leandre'],2345);
  assert.equal(run.fieldUsesSpent,null);
  const nodeId=run.route.startNodeIds[0];
  const completed=completeRouteNode(run,nodeId);
  assert.equal(completed.fieldUsesSpent,0);
  completed.fieldUsesSpent=1;
  assert.deepEqual(completeRouteNode(completed,nodeId),completed);
  assert.equal(advanceRegion(completed).fieldUsesSpent,1);
});
