import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRng } from '../../.domain-build/core/rng/seededRng.js';
import { createBattle, resolveBattleCommand } from '../../.domain-build/core/combat/battleEngine.js';
import { validatePlayerCommand as validatePlayerCommandForV02 } from '../../.domain-build/core/combat/actions.js';
import { createRun } from '../../.domain-build/core/progression/run.js';
import { generateRegionRoute, validateRoute, minimumCombatNodesToBoss } from '../../.domain-build/core/progression/route.js';
import { generateReward } from '../../.domain-build/core/progression/rewards.js';
import { generateShopOffers } from '../../.domain-build/core/progression/shop.js';
import { ITEMS, getItem } from '../../.domain-build/content/items.js';
import { BOSS_AFFINITY_POOLS } from '../../.domain-build/content/enemies.js';
import { resolveScene } from '../../.domain-build/content/scenes.js';
import { applyEventChoice, canChooseEvent as canChooseEventForV02 } from '../../.domain-build/core/progression/events.js';

function actorBySource(state, sourceId) {
  const unit = Object.values(state.units).find(unit => unit.sourceId === sourceId);
  assert.ok(unit, `missing ${sourceId}`);
  return unit;
}
function forceTurn(state, actorId) {
  state.turnOrder = [actorId, ...state.turnOrder.filter(id => id !== actorId)];
  state.turnIndex = 0;
  state.phase = 'input';
  return state;
}

test('boss affinity is seeded, secret-form compatible, and constrained to boss-specific pools', () => {
  for (const [encounterId, bossId] of [['boss-jonlow','jonlow'],['boss-klyde','klyde'],['boss-warden','warden']]) {
    const a = createBattle(['earl','jiro','hans'], encounterId, new SeededRng(12345), { regionIndex: 2 });
    const b = createBattle(['earl','jiro','hans'], encounterId, new SeededRng(12345), { regionIndex: 2 });
    const aBoss = actorBySource(a, bossId);
    const bBoss = actorBySource(b, bossId);
    assert.equal(aBoss.affinity, bBoss.affinity);
    assert.ok(BOSS_AFFINITY_POOLS[bossId].includes(aBoss.affinity));
    assert.equal(a.flags.bossAffinity, aBoss.affinity);
  }
});

test('all items declare rarity and the v0.2 tactical items exist', () => {
  assert.ok(ITEMS.every(item => ['common','uncommon','rare'].includes(item.rarity)));
  assert.equal(getItem('power-snack').rarity, 'uncommon');
  assert.equal(getItem('guard-patch').rarity, 'uncommon');
  assert.equal(getItem('revive-kit').rarity, 'rare');
});

test('same-status buffs refresh duration without stacking intensity', () => {
  let battle = createBattle(['earl','hans','marcus'], 'normal-scrap', new SeededRng(201));
  const earl = actorBySource(battle,'earl');
  earl.statuses = [{id:'strength', remaining:1}];
  forceTurn(battle, earl.id);
  const result = resolveBattleCommand(battle,{kind:'item',actorId:earl.id,itemId:'power-snack',targetIds:[earl.id]},new SeededRng(202));
  const strength = result.nextState.units[earl.id].statuses.filter(s=>s.id==='strength');
  assert.equal(strength.length,1);
  assert.equal(strength[0].remaining,2,'newly applied two-turn buff must not tick on the same action');
});

test('Revive Kit can revive a KO ally while at least one party member is still acting', () => {
  let battle = createBattle(['earl','hans','marcus'], 'normal-scrap', new SeededRng(301));
  const earl = actorBySource(battle,'earl');
  const hans = actorBySource(battle,'hans');
  hans.hp = 0; hans.alive = false;
  forceTurn(battle,earl.id);
  const result = resolveBattleCommand(battle,{kind:'item',actorId:earl.id,itemId:'revive-kit',targetIds:[hans.id]},new SeededRng(302));
  const revived = result.nextState.units[hans.id];
  assert.equal(revived.alive,true);
  assert.ok(revived.hp >= Math.round(revived.maxHp*0.29));
  assert.ok(result.events.some(e=>e.type==='revive'&&e.targetId===hans.id));
});

test('every generated route requires at least two pre-boss combat nodes and remains valid', () => {
  for (let seed=1; seed<=250; seed++) {
    const route=generateRegionRoute(seed%3,new SeededRng(seed));
    const verdict=validateRoute(route);
    assert.equal(verdict.valid,true,`${seed}: ${verdict.errors.join(', ')}`);
    assert.ok(minimumCombatNodesToBoss(route)>=2,`seed ${seed} only forces ${minimumCombatNodesToBoss(route)} fights`);
  }
});

test('normal encounter rewards scale with the actual enemy composition', () => {
  const run=createRun(['earl','hans','marcus'],401);
  const light=generateReward(run,'normal',new SeededRng(1),'normal-scrap');
  const heavy=generateReward(run,'normal',new SeededRng(1),'normal-oddities');
  assert.ok(heavy.coins>light.coins,`${heavy.coins} should exceed ${light.coins}`);
});

test('shop shelves are deterministic, unique, and include rarity metadata', () => {
  const run=createRun(['leandre','earl','hans'],501); run.coins=999;
  const offers=generateShopOffers(run,'r1-shop-test');
  assert.equal(offers.length,5);
  assert.equal(new Set(offers.map(o=>o.contentId)).size,offers.length);
  assert.ok(offers.every(o=>o.rarity));
  assert.deepEqual(offers,generateShopOffers(run,'r1-shop-test'));
});

test('Three Cups is a seeded visible-risk wager rather than guaranteed profit', () => {
  const run=createRun(['earl','hans','marcus'],601); run.coins=20;
  const a=applyEventChoice(run,'street-game','play',new SeededRng(1));
  const b=applyEventChoice(run,'street-game','play',new SeededRng(1));
  assert.equal(a.run.coins,b.run.coins);
  assert.match(a.resultText,/win|lose|cup|wager/i);
  assert.ok([15,25].includes(a.run.coins),`unexpected result ${a.run.coins}`);
});

test('scene dialogue is seeded and relationship-aware without display-name branching', () => {
  const a=resolveScene('boss-jonlow-intro',{seed:700,regionIndex:0,partyIds:['jiro','hans','earl']});
  const b=resolveScene('boss-jonlow-intro',{seed:700,regionIndex:0,partyIds:['jiro','hans','earl']});
  assert.deepEqual(a,b);
  assert.equal(a.relationshipId,'siblings-jonlow-jiro');
  assert.ok(a.lines.some(line=>/brother|cook|home/i.test(line.text)));
  const klyde=resolveScene('boss-klyde-intro',{seed:701,regionIndex:1,partyIds:['earl','hans','jiro']});
  assert.equal(klyde.relationshipId,'siblings-klyde-earl');
});

test('Hans deployable triggers emit explicit presentation events',()=>{
  let battle=createBattle(['hans','earl','marcus'],'normal-scrap',new SeededRng(801));
  const hans=actorBySource(battle,'hans'); forceTurn(battle,hans.id);
  const result=resolveBattleCommand(battle,{kind:'skill',actorId:hans.id,abilityId:'sentry-unit',targetIds:[]},new SeededRng(802));
  assert.ok(result.events.some(e=>e.type==='deployableTrigger'&&e.deployableType==='sentry'&&e.effect==='damage'));
});

test('normal fights offer a small strategic spoils choice instead of only automatic value',()=>{
  const run=createRun(['earl','hans','marcus'],901);
  const reward=generateReward(run,'normal',new SeededRng(9),'normal-smokes');
  assert.equal(reward.spoilsChoices.length,2);
  assert.equal(new Set(reward.spoilsChoices.map(choice=>choice.id)).size,2);
  assert.ok(reward.spoilsChoices.every(choice=>['cash','patch','scavenge','ppcache'].includes(choice.id)));
});

test('tactical items emit choreography that matches their visible effect family',()=>{
  const cases=[
    ['power-snack','buff'],
    ['guard-patch','defense'],
    ['smoke-bomb','smoke'],
    ['revive-kit','heavy'],
  ];
  for(const [itemId,expected] of cases){
    let battle=createBattle(['earl','hans','marcus'],'normal-scrap',new SeededRng(1000));
    const earl=actorBySource(battle,'earl');
    if(itemId==='revive-kit'){const hans=actorBySource(battle,'hans');hans.hp=0;hans.alive=false;forceTurn(battle,earl.id);const result=resolveBattleCommand(battle,{kind:'item',actorId:earl.id,itemId,targetIds:[hans.id]},new SeededRng(1001));assert.equal(result.events.find(e=>e.type==='actionStart')?.choreography,expected);continue;}
    forceTurn(battle,earl.id);
    const targetIds=itemId==='smoke-bomb'?[]:[earl.id];
    const result=resolveBattleCommand(battle,{kind:'item',actorId:earl.id,itemId,targetIds},new SeededRng(1001));
    assert.equal(result.events.find(e=>e.type==='actionStart')?.choreography,expected,`${itemId} should present as ${expected}`);
  }
});

test('boss scenes carry stable visual assets and relationship scenes surface the related party cutout',()=>{
  const jonlow=resolveScene('boss-jonlow-intro',{seed:1100,regionIndex:0,partyIds:['jiro','hans','earl']});
  assert.equal(jonlow.focusAssetId,'boss-jonlow');
  assert.equal(jonlow.companionAssetId,'character-jiro');
  const klyde=resolveScene('boss-klyde-intro',{seed:1101,regionIndex:1,partyIds:['earl','hans','jiro']});
  assert.equal(klyde.focusAssetId,'boss-klyde');
  assert.equal(klyde.companionAssetId,'character-earl');
});

test('battle items reject no-op uses so scarce inventory is never silently wasted',()=>{
  const make=()=>createBattle(['earl','hans','marcus'],'normal-scrap',new SeededRng(1200));

  let battle=make();let actor=battle.units[battle.turnOrder[battle.turnIndex]];const earl=actorBySource(battle,'earl');earl.hp=earl.maxHp;forceTurn(battle,actor.id);
  let result=validateItem(battle,{kind:'item',actorId:actor.id,itemId:'patch-kit',targetIds:[earl.id]});
  assert.equal(result.legal,false);assert.match(result.reason,/full|hp/i);

  battle=make();actor=battle.units[battle.turnOrder[battle.turnIndex]];const hans=actorBySource(battle,'hans');forceTurn(battle,actor.id);
  result=validateItem(battle,{kind:'item',actorId:actor.id,itemId:'pp-tonic',targetIds:[hans.id]});
  assert.equal(result.legal,false);assert.match(result.reason,/pp|full/i);

  battle=make();actor=battle.units[battle.turnOrder[battle.turnIndex]];const marcus=actorBySource(battle,'marcus');forceTurn(battle,actor.id);
  result=validateItem(battle,{kind:'item',actorId:actor.id,itemId:'cleanser',targetIds:[marcus.id]});
  assert.equal(result.legal,false);assert.match(result.reason,/negative|cleanse/i);

  battle=make();actor=battle.units[battle.turnOrder[battle.turnIndex]];const buffTarget=actorBySource(battle,'earl');buffTarget.statuses=[{id:'strength',remaining:2}];forceTurn(battle,actor.id);
  result=validateItem(battle,{kind:'item',actorId:actor.id,itemId:'power-snack',targetIds:[buffTarget.id]});
  assert.equal(result.legal,false);assert.match(result.reason,/strength|already|turn/i);

  battle=make();actor=battle.units[battle.turnOrder[battle.turnIndex]];for(const id of battle.allies)battle.units[id].hp=battle.units[id].maxHp;forceTurn(battle,actor.id);
  result=validateItem(battle,{kind:'item',actorId:actor.id,itemId:'field-ration',targetIds:[]});
  assert.equal(result.legal,false);assert.match(result.reason,/full|hp/i);
});

function validateItem(state,command){
  return validatePlayerCommandForV02(state,command);
}

test('elite and event arrival scenes resolve to the actual encounter/event identity',()=>{
  const elite=resolveScene('elite-intro',{seed:1300,regionIndex:0,partyIds:['earl','hans','jiro'],encounterId:'elite-broker'});
  assert.equal(elite.title,'The Broker');
  assert.equal(elite.focusAssetId,'elite-broker');
  assert.ok(elite.lines.some(line=>/broker|deal|price|coin/i.test(line.text)));

  const event=resolveScene('event-arrival',{seed:1301,regionIndex:0,partyIds:['earl','hans','jiro'],eventId:'street-game'});
  assert.equal(event.title,'Three Cups');
  assert.equal(event.theme,'game');
  assert.ok(event.lines.some(line=>/cup|wager|coin|odds/i.test(line.text)));
});

test('events disable costly choices whose reward cannot currently be received',()=>{
  const fullPack=createRun(['earl','hans','marcus'],1400);fullPack.inventory=[{itemId:'patch-kit',quantity:6}];
  let legality=canChooseEventForV02(fullPack,'old-locker','force');
  assert.equal(legality.allowed,false);assert.match(legality.reason,/pack|inventory|full/i);
  legality=canChooseEventForV02(fullPack,'old-locker','leave');assert.equal(legality.allowed,true);

  const fullHp=createRun(['earl','hans','marcus'],1401);fullHp.coins=20;
  legality=canChooseEventForV02(fullHp,'night-cart','eat');
  assert.equal(legality.allowed,false);assert.match(legality.reason,/hp|full/i);
  legality=canChooseEventForV02(fullHp,'night-cart','pass');assert.equal(legality.allowed,true);
});

test('event arrival dialogue never gives lines to party characters who are not present',()=>{
  const party=['earl','jiro','leandre'];
  for(const eventId of ['loose-crate','old-locker','repair-bench']){
    for(let seed=1;seed<=50;seed++){
      const scene=resolveScene('event-arrival',{seed,regionIndex:0,partyIds:party,eventId});
      for(const line of scene.lines){
        assert.notEqual(line.speaker,'Hans',`${eventId} seed ${seed} spoke as absent Hans`);
        assert.notEqual(line.speaker,'Marcus',`${eventId} seed ${seed} spoke as absent Marcus`);
      }
    }
  }
});

test('Nathaniel Life Drain keeps sustain meaningful without erasing his health-risk identity',()=>{
  for(const upgraded of [false,true]){
    let battle=createBattle(['nathaniel','earl','marcus'],'normal-scrap',new SeededRng(upgraded?1502:1500));
    const nathaniel=actorBySource(battle,'nathaniel');nathaniel.hp=30;
    if(upgraded)nathaniel.upgradedAbilities.push('life-drain');
    forceTurn(battle,nathaniel.id);
    const enemy=battle.enemies.find(id=>battle.units[id].alive);
    const result=resolveBattleCommand(battle,{kind:'skill',actorId:nathaniel.id,abilityId:'life-drain',targetIds:[enemy]},new SeededRng(upgraded?1503:1501));
    const damage=result.events.find(e=>e.type==='damage'&&e.targetId===enemy);
    const heal=result.events.find(e=>e.type==='heal'&&e.targetId===nathaniel.id);
    assert.ok(damage&&heal,'Life Drain should damage and heal');
    const expected=Math.max(1,Math.round(damage.amount*(upgraded?0.45:0.35)));
    assert.equal(heal.amount,expected,`Life Drain should heal ${upgraded?'45':'35'}% of damage`);
  }
});

test('Three Cups is a variance choice, not a positive-expectation vending machine',()=>{
  let total=0;
  for(let seed=1;seed<=1000;seed++){
    const run=createRun(['earl','hans','marcus'],1600+seed);run.coins=20;
    total+=applyEventChoice(run,'street-game','play',new SeededRng(seed)).run.coins;
  }
  const average=total/1000;
  assert.ok(average>=19.4&&average<=20.6,`expected a near-fair wager, got average ${average.toFixed(2)} coins from 20`);
});
