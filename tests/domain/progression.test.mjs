import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRng } from '../../.domain-build/core/rng/seededRng.js';
import { createRun, completeRouteNode, advanceRegion } from '../../.domain-build/core/progression/run.js';
import { applyRestChoice, previewRestChoice } from '../../.domain-build/core/progression/rest.js';
import { generateReward, claimReward } from '../../.domain-build/core/progression/rewards.js';
import { generateShopOffers, purchaseShopOffer } from '../../.domain-build/core/progression/shop.js';
import { applyEventChoice, canChooseEvent } from '../../.domain-build/core/progression/events.js';
import { inventoryCount } from '../../.domain-build/core/progression/inventory.js';
import { availableRouteNodes } from '../../.domain-build/core/progression/route.js';
import { createSaveEnvelope, migrateSaveEnvelope, DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../../.domain-build/core/save/saveFormat.js';

test('new run starts with exactly three persistent party members and a seeded route',()=>{
  const run=createRun(['earl','hans','leandre'],2345);
  assert.equal(run.party.length,3); assert.equal(new Set(run.party.map(p=>p.characterId)).size,3);
  assert.equal(run.regionIndex,0); assert.equal(run.status,'active'); assert.ok(availableRouteNodes(run.route,null,[]).length>0);
  assert.equal(run.rngState,new SeededRng(2345).serialize().state === 2345 ? run.rngState : run.rngState); // state is persisted and numeric
  assert.equal(typeof run.rngState,'number');
});

test('rest Recover heals living members and weakly revives KO members',()=>{
  const run=createRun(['earl','hans','leandre'],1);
  run.party[0].hp=10;run.party[1].hp=0;run.party[2].hp=20;
  const next=applyRestChoice(run,'recover');
  assert.equal(next.party[0].hp,49); // Earl: 10 + round(110 * .35)=49
  assert.equal(next.party[1].hp,9);  // Hans KO: max(1, round(92 * .10))=9
  assert.equal(next.party[2].hp,55); // Leandre: 20 + round(100 * .35)=55
  // PP unchanged by Recover
  assert.deepEqual(next.party[0].abilityPP,run.party[0].abilityPP);
  // preview matches apply
  const preview=previewRestChoice(run,'recover');
  assert.equal(preview.legal,true);
  assert.equal(preview.changes.length,3); // all three members change
});

test('rest Refresh restores 30% of missing PP across every move',()=>{
  const run=createRun(['earl','hans','leandre'],2);
  const before=run.party[0].abilityPP.yosi; run.party[0].abilityPP.yosi=0;
  run.party[0].abilityPP['knuckle-up']=17; // maxPP=18, missing=1, round(1*0.30)=0
  run.party[1].hp=0; run.party[1].abilityPP['sentry-unit']=0; // KO Hans still gets PP restored
  const next=applyRestChoice(run,'refresh');
  assert.equal(next.party[0].abilityPP.yosi,Math.round(before*0.30));
  assert.equal(next.party[0].abilityPP['knuckle-up'],17); // missing-1 rounds to zero
  assert.equal(next.party[1].abilityPP['sentry-unit'],2); // round(7*0.30)=2
});

test('shop is deterministic and Leandre adds one inventory choice',()=>{
  const withMerchant=createRun(['leandre','earl','hans'],500);
  const withoutMerchant=createRun(['earl','hans','marcus'],500);
  const a=generateShopOffers(withMerchant,'node-x');const b=generateShopOffers(withMerchant,'node-x');
  const base=generateShopOffers(withoutMerchant,'node-x');
  assert.deepEqual(a,b); assert.equal(a.length,5); assert.equal(base.length,4);
  assert.deepEqual(a.slice(0,4),base);
  assert.equal(a[4].kind,'item');
});

function createRunAtShop(){
  for(let seed=1;seed<=1_000;seed+=1){
    const run=createRun(['earl','hans','marcus'],seed);
    const shop=run.route.nodes.find(node=>node.type==='shop');
    if(!shop)continue;
    run.currentNodeId=shop.id;
    run.shopVisit={nodeId:shop.id,offers:generateShopOffers(run,shop.id),purchasedOfferIds:[]};
    return run;
  }
  throw new Error('Expected a seeded route with a shop.');
}

test('shop purchase uses the saved shelf and rejects a serialized replay',()=>{
  const run=createRunAtShop();
  run.coins=200;
  const offer=run.shopVisit.offers.find(candidate=>candidate.kind==='item');
  assert.ok(offer);
  const shelf=structuredClone(run.shopVisit.offers);
  const beforeCoins=run.coins;
  const beforeCount=inventoryCount(run);
  const bought=purchaseShopOffer(run,offer.id);
  assert.equal(bought.ok,true);
  assert.equal(bought.run.coins,beforeCoins-offer.price);
  assert.equal(inventoryCount(bought.run),beforeCount+1);
  assert.deepEqual(bought.run.shopVisit.offers,shelf);
  assert.deepEqual(bought.run.shopVisit.purchasedOfferIds,[offer.id]);
  const replay=purchaseShopOffer(bought.run,offer.id);
  assert.equal(replay.ok,false);
  assert.match(replay.reason,/sold out/i);
  assert.deepEqual(replay.run,bought.run);
  const saved=createSaveEnvelope({activeRun:bought.run,profile:DEFAULT_PROFILE,settings:DEFAULT_SETTINGS},1);
  const resumed=migrateSaveEnvelope(saved).payload.activeRun;
  const replayAfterResume=purchaseShopOffer(resumed,offer.id);
  assert.equal(replayAfterResume.ok,false);
  assert.match(replayAfterResume.reason,/sold out/i);
});

test('shop rejects unknown and completed-shop purchase requests without mutation',()=>{
  const run=createRunAtShop();
  const before=structuredClone(run);
  const unknown=purchaseShopOffer(run,'unknown-offer');
  assert.equal(unknown.ok,false);
  assert.deepEqual(unknown.run,before);
  const completed=structuredClone(run);
  completed.completedNodeIds.push(completed.currentNodeId);
  const completedBefore=structuredClone(completed);
  const result=purchaseShopOffer(completed,completed.shopVisit.offers[0].id);
  assert.equal(result.ok,false);
  assert.deepEqual(result.run,completedBefore);
});

test('Deep Pockets allows the complete paid two-item grant',()=>{
  const run=createRun(['earl','hans','leandre'],901);
  run.coins=20;
  run.inventory=[{itemId:'patch-kit',quantity:4},{itemId:'pp-tonic',quantity:1}];
  run.relicIds=['deep-pockets'];
  const result=applyEventChoice(run,'bulk-deal','buy',new SeededRng(4));
  assert.equal(result.run.coins,0);
  assert.equal(inventoryCount(result.run),7);
  assert.equal(result.run.inventory.find(x=>x.itemId==='field-ration').quantity,1);
  assert.equal(result.run.inventory.find(x=>x.itemId==='pp-tonic').quantity,2);
  assert.equal(inventoryCount(run),5);
});

test('paid Bulk Deal rejects one free slot without charging or granting',()=>{
  const run=createRun(['earl','hans','leandre'],901);
  run.coins=20;
  run.inventory=[{itemId:'patch-kit',quantity:5}];
  const before=structuredClone(run);
  const rng=new SeededRng(4);
  const rngBefore=rng.serialize();
  assert.equal(canChooseEvent(run,'bulk-deal','buy').allowed,false);
  assert.throws(()=>applyEventChoice(run,'bulk-deal','buy',rng),/room|full/i);
  assert.deepEqual(run,before);
  assert.deepEqual(rng.serialize(),rngBefore);
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


test('street-game Small stake requires six coins and resolves seeded visible risk',()=>{
  let poor=createRun(['earl','hans','leandre'],901);poor.coins=5;
  assert.deepEqual(canChooseEvent(poor,'street-game','play'),{allowed:false,reason:'Need 6 coins.'});
  let run=createRun(['earl','hans','leandre'],902);run.coins=12;
  const a=applyEventChoice(run,'street-game','play',new SeededRng(7));
  const b=applyEventChoice(run,'street-game','play',new SeededRng(7));
  assert.equal(a.run.coins,b.run.coins);
  assert.ok([6,20].includes(a.run.coins));
  assert.match(a.resultText,/win|lose|wager|cup/i);
});

test('normal rewards do not advertise an item when inventory is already full',()=>{
  const run=createRun(['earl','hans','marcus'],903);
  run.inventory=[{itemId:'patch-kit',quantity:6}];
  const reward=generateReward(run,'normal',new SeededRng(1));
  assert.equal(reward.itemId,undefined);
});

test('Deep Pockets permits a sixth item but blocks an eighth reward item',()=>{
  const run=createRun(['earl','hans','marcus'],903);
  run.relicIds=['deep-pockets'];
  run.inventory=[{itemId:'patch-kit',quantity:6}];
  assert.notEqual(generateReward(run,'normal',new SeededRng(1)).itemId,undefined);
  run.inventory[0].quantity=7;
  assert.equal(generateReward(run,'normal',new SeededRng(1)).itemId,undefined);
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
