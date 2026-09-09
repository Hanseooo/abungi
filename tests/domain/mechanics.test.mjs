import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRng } from '../../.domain-build/core/rng/seededRng.js';
import { createBattle, resolveBattleCommand } from '../../.domain-build/core/combat/battleEngine.js';
import { validatePlayerCommand } from '../../.domain-build/core/combat/actions.js';
import { chooseEnemyTargets, legalEnemyMoves } from '../../.domain-build/core/combat/enemyAi.js';
import { createRun } from '../../.domain-build/core/progression/run.js';
import { previewItemPp } from '../../.domain-build/core/progression/itemRecovery.js';
import { BALANCE } from '../../.domain-build/balance/constants.js';

function actorBySource(state, sourceId) {
  const unit=Object.values(state.units).find(u=>u.sourceId===sourceId);
  assert.ok(unit, `missing ${sourceId}`); return unit;
}
function forceTurn(state, actorId, enemyImmediatelyAfter=false) {
  const ids=state.turnOrder.filter(id=>id!==actorId);
  const enemies=ids.filter(id=>state.units[id]?.side==='enemy');
  const allies=ids.filter(id=>state.units[id]?.side==='ally');
  state.turnOrder=enemyImmediatelyAfter?[actorId,...enemies,...allies]:[actorId,...allies,...enemies];
  state.turnIndex=0;state.phase='input';return state;
}

test('Hans deploys a real sentry and Spare Parts adds one trigger of duration',()=>{
  const rng=new SeededRng(101); let battle=createBattle(['hans','earl','marcus'],'normal-scrap',rng);
  const hans=actorBySource(battle,'hans'); forceTurn(battle,hans.id);
  const result=resolveBattleCommand(battle,{kind:'skill',actorId:hans.id,abilityId:'sentry-unit',targetIds:[]},new SeededRng(202));
  assert.equal(result.nextState.deployables.length,1);
  const sentry=result.nextState.deployables[0];
  assert.equal(sentry.type,'sentry');
  // Starts at 4 with Spare Parts, then triggers immediately and has 3 future triggers remaining.
  assert.equal(sentry.remainingTurns,3);
  assert.ok(result.events.some(e=>e.type==='summon'&&e.summonId==='sentry'));
  assert.ok(result.events.some(e=>e.type==='damage'));
});

test('Hans cannot exceed two deployables and Overclock enhances active deployables',()=>{
  let battle=createBattle(['hans','earl','marcus'],'normal-scrap',new SeededRng(3));
  const hans=actorBySource(battle,'hans');
  for(const abilityId of ['sentry-unit','repair-drone']){
    forceTurn(battle,hans.id);
    battle=resolveBattleCommand(battle,{kind:'skill',actorId:hans.id,abilityId,targetIds:[]},new SeededRng(4)).nextState;
  }
  forceTurn(battle,hans.id);
  const illegal=validatePlayerCommand(battle,{kind:'skill',actorId:hans.id,abilityId:'sentry-unit',targetIds:[]});
  assert.equal(illegal.legal,false); assert.match(illegal.reason,/deploy/i);
  const before=battle.deployables.map(d=>d.remainingTurns);
  battle=resolveBattleCommand(battle,{kind:'skill',actorId:hans.id,abilityId:'overclock',targetIds:[]},new SeededRng(5)).nextState;
  assert.ok(battle.deployables.every(d=>d.enhanced));
  assert.ok(battle.deployables.every((d,i)=>d.remainingTurns>=before[i]));
});

test('Yeeho poor Double Down outcome is bounded, costs HP, and House Edge refunds first poor-outcome PP',()=>{
  let battle=createBattle(['yeeho','earl','marcus'],'normal-scrap',new SeededRng(7));
  const yeeho=actorBySource(battle,'yeeho'); forceTurn(battle,yeeho.id);
  const beforeHp=yeeho.hp; const beforePp=yeeho.abilityPP['double-down'];
  const result=resolveBattleCommand(battle,{kind:'skill',actorId:yeeho.id,abilityId:'double-down',targetIds:[battle.enemies[0]]},new SeededRng(1));
  const after=result.nextState.units[yeeho.id];
  assert.ok(after.hp < beforeHp);
  assert.equal(after.abilityPP['double-down'],beforePp);
  assert.equal(after.flags.houseEdgeRefunded,true);
  assert.ok(result.events.some(e=>e.type==='message'&&e.text.includes('House Edge')));
});

test('All In and Abyssal Pact sacrifice cannot self-KO',()=>{
  for(const [characterId,abilityId] of [['yeeho','all-in'],['nathaniel','abyssal-pact']]){
    let battle=createBattle([characterId,'earl','marcus'],'normal-scrap',new SeededRng(9));
    const actor=actorBySource(battle,characterId);actor.hp=1;forceTurn(battle,actor.id);
    const target=abilityId==='abyssal-pact'?[]:[battle.enemies[0]];
    const result=resolveBattleCommand(battle,{kind:'skill',actorId:actor.id,abilityId,targetIds:target},new SeededRng(8));
    assert.equal(result.nextState.units[actor.id].hp,1);
  }
});

test('Yatords gains Momentum when acting before a living enemy and Breakaway consumes it',()=>{
  let battle=createBattle(['yatords','earl','marcus'],'normal-scrap',new SeededRng(12));
  const yatords=actorBySource(battle,'yatords');
  for(let i=0;i<3;i++){
    forceTurn(battle,yatords.id,true);
    battle=resolveBattleCommand(battle,{kind:'skill',actorId:yatords.id,abilityId:'pedal-strike',targetIds:[battle.enemies.find(id=>battle.units[id].alive)]},new SeededRng(30+i)).nextState;
    if(battle.phase==='victory') break;
  }
  const stacks=Number(battle.units[yatords.id].flags.momentum??0);
  assert.ok(stacks>=1&&stacks<=3);
  if(battle.phase!=='victory'){
    forceTurn(battle,yatords.id,true);
    battle=resolveBattleCommand(battle,{kind:'skill',actorId:yatords.id,abilityId:'breakaway',targetIds:[battle.enemies.find(id=>battle.units[id].alive)]},new SeededRng(91)).nextState;
    assert.equal(Number(battle.units[yatords.id].flags.momentum??0),0);
  }
});

test('Leandre Clearance Sale explains insufficient funds and spends coins when legal',()=>{
  let poor=createBattle(['leandre','earl','marcus'],'normal-scrap',new SeededRng(13),{coins:10});
  const leandre=actorBySource(poor,'leandre');forceTurn(poor,leandre.id);
  const illegal=validatePlayerCommand(poor,{kind:'skill',actorId:leandre.id,abilityId:'clearance-sale',targetIds:[]});
  assert.equal(illegal.legal,false);assert.match(illegal.reason,/coin/i);

  let rich=createBattle(['leandre','earl','marcus'],'normal-scrap',new SeededRng(13),{coins:20});
  const merchant=actorBySource(rich,'leandre');forceTurn(rich,merchant.id);
  const result=resolveBattleCommand(rich,{kind:'skill',actorId:merchant.id,abilityId:'clearance-sale',targetIds:[]},new SeededRng(22));
  assert.equal(result.nextState.availableCoins,5);
  assert.equal(result.nextState.coinsDelta,-15);
  for(const id of result.nextState.allies){
    const statusIds=result.nextState.units[id].statuses.map(s=>s.id);
    assert.ok(statusIds.includes('strength'));assert.ok(statusIds.includes('haste'));
  }
});

test('Earl First Responder makes his first heal 30% stronger',()=>{
  let battle=createBattle(['earl','hans','marcus'],'normal-scrap',new SeededRng(15));
  const earl=actorBySource(battle,'earl');const hans=actorBySource(battle,'hans');hans.hp=10;forceTurn(battle,earl.id);
  const result=resolveBattleCommand(battle,{kind:'skill',actorId:earl.id,abilityId:'patch-up',targetIds:[hans.id]},new SeededRng(44));
  const healed=result.nextState.units[hans.id].hp-10;
  assert.equal(healed,Math.round(hans.maxHp*0.40*1.30));
});

test("Chef's Table fortifies the party, extended by Mise en Place",()=>{
  let battle=createBattle(['jiro','hans','marcus'],'normal-scrap',new SeededRng(15));
  const jiro=actorBySource(battle,'jiro');forceTurn(battle,jiro.id);
  const result=resolveBattleCommand(battle,{kind:'skill',actorId:jiro.id,abilityId:'chefs-table',targetIds:[]},new SeededRng(44));
  for(const id of result.nextState.allies){
    const fortified=result.nextState.units[id].statuses.find(s=>s.id==='fortified');
    assert.ok(fortified,'ally missing Fortified');
    assert.equal(fortified.remaining,2);
  }
});

test('boss enemy AI never allows immediate repeated signature move',()=>{
  const battle=createBattle(['earl','marcus','jiro'],'boss-klyde',new SeededRng(4));
  const klyde=actorBySource(battle,'klyde');
  battle.recentEnemyMoves[klyde.id]=['psycho-rush'];
  const legal=legalEnemyMoves(battle,klyde).map(m=>m.id);
  assert.ok(!legal.includes('psycho-rush'));
  assert.ok(legal.length>0);
});

test('KO resolves victory without requiring another input',()=>{
  let battle=createBattle(['michael','earl','marcus'],'normal-fastlane',new SeededRng(19));
  const michael=actorBySource(battle,'michael');
  for(const id of battle.enemies){battle.units[id].hp=1;battle.units[id].guard=0;}
  forceTurn(battle,michael.id);
  const result=resolveBattleCommand(battle,{kind:'skill',actorId:michael.id,abilityId:'grenade',targetIds:[]},new SeededRng(2));
  assert.equal(result.nextState.phase,'victory');
  assert.ok(result.events.some(e=>e.type==='victory'));
});

test('item legality is enforced in the domain for target side and Smoke Bomb tier',()=>{
  const normal=createBattle(['earl','hans','marcus'],'normal-scrap',new SeededRng(101));
  const actor=normal.units[normal.turnOrder[normal.turnIndex]];
  const enemyId=normal.enemies.find(id=>normal.units[id].alive);
  const allyId=normal.allies.find(id=>normal.units[id].alive);
  const invalidTarget=validatePlayerCommand(normal,{kind:'item',actorId:actor.id,itemId:'patch-kit',targetIds:[enemyId]});
  assert.equal(invalidTarget.legal,false);assert.match(invalidTarget.reason,/ally|target/i);
  normal.units[allyId].hp=Math.max(1,normal.units[allyId].hp-10);
  const validTarget=validatePlayerCommand(normal,{kind:'item',actorId:actor.id,itemId:'patch-kit',targetIds:[allyId]});
  assert.equal(validTarget.legal,true);

  const boss=createBattle(['earl','hans','marcus'],'boss-jonlow',new SeededRng(102));
  const bossActor=boss.units[boss.turnOrder[boss.turnIndex]];
  const noEscape=validatePlayerCommand(boss,{kind:'item',actorId:bossActor.id,itemId:'smoke-bomb',targetIds:[]});
  assert.equal(noEscape.legal,false);assert.match(noEscape.reason,/elite|boss|escape/i);
});

test('Hans deployable skill upgrades strengthen the matching sentry and repair drone',()=>{
  const sentryDamage=(upgraded)=>{
    let battle=createBattle(['hans','earl','marcus'],'normal-scrap',new SeededRng(501));
    const hans=actorBySource(battle,'hans');if(upgraded)hans.upgradedAbilities.push('sentry-unit');
    for(const id of battle.enemies)battle.units[id].guard=0;
    forceTurn(battle,hans.id);
    const result=resolveBattleCommand(battle,{kind:'skill',actorId:hans.id,abilityId:'sentry-unit',targetIds:[]},new SeededRng(77));
    return result.events.find(e=>e.type==='damage'&&result.nextState.units[e.targetId]?.side==='enemy')?.amount??0;
  };
  assert.ok(sentryDamage(true)>sentryDamage(false));

  const droneHeal=(upgraded)=>{
    let battle=createBattle(['hans','earl','marcus'],'normal-scrap',new SeededRng(502));
    const hans=actorBySource(battle,'hans');const earl=actorBySource(battle,'earl');earl.hp=10;
    if(upgraded)hans.upgradedAbilities.push('repair-drone');
    forceTurn(battle,hans.id);
    const result=resolveBattleCommand(battle,{kind:'skill',actorId:hans.id,abilityId:'repair-drone',targetIds:[]},new SeededRng(78));
    return result.events.find(e=>e.type==='heal'&&e.targetId===earl.id)?.amount??0;
  };
  assert.ok(droneHeal(true)>droneHeal(false));
});

test('The Warden summons once near 60% HP and enters a persistent Haste phase below 35%',()=>{
  let battle=createBattle(['michael','marcus','jiro'],'boss-warden',new SeededRng(610),{regionIndex:2});
  const warden=actorBySource(battle,'warden');
  warden.hp=Math.floor(warden.maxHp*0.34);
  const michael=actorBySource(battle,'michael');forceTurn(battle,michael.id);
  const result=resolveBattleCommand(battle,{kind:'skill',actorId:michael.id,abilityId:'rifle-burst',targetIds:[warden.id]},new SeededRng(611));
  const next=result.nextState;const nextWarden=actorBySource(next,'warden');
  assert.equal(next.flags.wardenDroneSummoned,true);
  assert.equal(next.flags.wardenPhaseTwo,true);
  assert.equal(next.enemies.filter(id=>next.units[id]?.sourceId==='dronelet').length,1);
  assert.ok(nextWarden.statuses.some(s=>s.id==='haste'));
  assert.ok(result.events.some(e=>e.type==='summon'&&e.summonId==='dronelet'));
});

test('battle items apply their state changes and emit readable feedback events',()=>{
  let tonic=createBattle(['earl','hans','marcus'],'normal-scrap',new SeededRng(710));
  const tonicActor=tonic.units[tonic.turnOrder[tonic.turnIndex]];const earl=actorBySource(tonic,'earl');
  earl.abilityPP['patch-up']=0;forceTurn(tonic,tonicActor.id);
  let result=resolveBattleCommand(tonic,{kind:'item',actorId:tonicActor.id,itemId:'pp-tonic',targetIds:[earl.id]},new SeededRng(711));
  assert.equal(result.nextState.units[earl.id].abilityPP['patch-up'],4);
  assert.ok(result.events.some(e=>e.type==='message'&&/PP/i.test(e.text)));

  let drink=createBattle(['earl','hans','marcus'],'normal-scrap',new SeededRng(712));
  const drinkActor=drink.units[drink.turnOrder[drink.turnIndex]];const hans=actorBySource(drink,'hans');forceTurn(drink,drinkActor.id);
  result=resolveBattleCommand(drink,{kind:'item',actorId:drinkActor.id,itemId:'energy-drink',targetIds:[hans.id]},new SeededRng(713));
  assert.ok(result.nextState.units[hans.id].statuses.some(s=>s.id==='haste'));
  assert.ok(result.events.some(e=>e.type==='statusApplied'&&e.targetId===hans.id&&e.statusId==='haste'));

  let smoke=createBattle(['earl','hans','marcus'],'normal-scrap',new SeededRng(714));
  const smokeActor=smoke.units[smoke.turnOrder[smoke.turnIndex]];forceTurn(smoke,smokeActor.id);
  result=resolveBattleCommand(smoke,{kind:'item',actorId:smokeActor.id,itemId:'smoke-bomb',targetIds:[]},new SeededRng(715));
  assert.equal(result.nextState.escaped,true);assert.equal(result.nextState.phase,'victory');

  let fullpp=createBattle(['earl','hans','marcus'],'normal-scrap',new SeededRng(716));
  const fppActor=fullpp.units[fullpp.turnOrder[fullpp.turnIndex]];const earlFull=actorBySource(fullpp,'earl');forceTurn(fullpp,fppActor.id);
  assert.equal(validatePlayerCommand(fullpp,{kind:'item',actorId:fppActor.id,itemId:'pp-tonic',targetIds:[earlFull.id]}).legal,false);
});

test('previewItemPp skips capped abilities and targets the most depleted',()=>{
  const member=createRun(['earl','hans','leandre'],12).party[0];
  member.abilityPP.yosi=5; // adrenaline stays full at 4
  assert.deepEqual(previewItemPp(member,4,[]),{abilityId:'yosi',before:5,after:8});
  member.abilityPP.yosi=8;
  assert.equal(previewItemPp(member,4,[]),null);
});


test('Yatords gains Momentum when Guarding or using an item before a living enemy',()=>{
  let guarded=createBattle(['yatords','earl','marcus'],'normal-scrap',new SeededRng(801));
  const cyclist=actorBySource(guarded,'yatords');forceTurn(guarded,cyclist.id);
  let result=resolveBattleCommand(guarded,{kind:'guard',actorId:cyclist.id},new SeededRng(802));
  assert.equal(Number(result.nextState.units[cyclist.id].flags.momentum??0),1);

  let itemBattle=createBattle(['yatords','earl','marcus'],'normal-scrap',new SeededRng(803));
  const itemCyclist=actorBySource(itemBattle,'yatords');forceTurn(itemBattle,itemCyclist.id);
  result=resolveBattleCommand(itemBattle,{kind:'item',actorId:itemCyclist.id,itemId:'energy-drink',targetIds:[itemCyclist.id]},new SeededRng(804));
  assert.equal(Number(result.nextState.units[itemCyclist.id].flags.momentum??0),1);
});

test('move accuracy is shared across Yosi damage and Blind instead of rolling twice',()=>{
  let battle=createBattle(['earl','hans','marcus'],'normal-scrap',new SeededRng(999));
  const earl=actorBySource(battle,'earl');const targetId=battle.enemies.find(id=>battle.units[id].alive);forceTurn(battle,earl.id);
  const result=resolveBattleCommand(battle,{kind:'skill',actorId:earl.id,abilityId:'yosi',targetIds:[targetId]},new SeededRng(1));
  const dealt=result.events.some(e=>e.type==='damage'&&e.targetId===targetId);
  const blind=result.nextState.units[targetId].statuses.some(s=>s.id==='blind');
  assert.equal(dealt,blind,'Yosi damage and Blind must share the same move accuracy result');
  assert.equal(result.events.some(e=>e.type==='miss'&&e.actorId===earl.id&&e.targetId===targetId),!dealt);
});

test('Second Wind heals the first ally each battle to fall under 30% Max HP',()=>{
  let fired=false;
  for(let seed=1;seed<=25&&!fired;seed+=1){
    const battle=createBattle(['earl','hans','marcus'],'normal-scrap',new SeededRng(seed),{relicIds:['second-wind']});
    const earl=actorBySource(battle,'earl');const hans=actorBySource(battle,'hans');
    hans.hp=Math.round(hans.maxHp*0.29);
    forceTurn(battle,earl.id,true);
    const result=resolveBattleCommand(battle,{kind:'guard',actorId:earl.id},new SeededRng(seed));
    if(result.nextState.flags.secondWindUsed){
      fired=true;
      const heal=result.events.find(event=>event.type==='heal'&&event.targetId===hans.id);
      assert.ok(heal,'Second Wind set its flag without healing');
      assert.equal(heal.amount,Math.round(hans.maxHp*0.15));
    }
  }
  assert.ok(fired,'Second Wind never fired across 25 seeds');
});

test('Old Bandana opens every battle with the party Fortified',()=>{
  const battle=createBattle(['earl','hans','yeeho'],'normal-scrap',new SeededRng(15),{relicIds:['old-bandana']});
  for(const id of battle.allies) assert.ok(battle.units[id].statuses.some(s=>s.id==='fortified'),'ally not Fortified');
  const bare=createBattle(['earl','hans','yeeho'],'normal-scrap',new SeededRng(15));
  for(const id of bare.allies) assert.ok(!bare.units[id].statuses.some(s=>s.id==='fortified'));
});

test('Duct Tape extends positive statuses allies apply, not negative ones',()=>{
  const battle=createBattle(['marcus','hans','earl'],'normal-scrap',new SeededRng(15),{relicIds:['duct-tape']});
  const marcus=actorBySource(battle,'marcus');const hans=actorBySource(battle,'hans');forceTurn(battle,marcus.id);
  const result=resolveBattleCommand(battle,{kind:'skill',actorId:marcus.id,abilityId:'brace',targetIds:[hans.id]},new SeededRng(44));
  assert.equal(result.nextState.units[hans.id].statuses.find(s=>s.id==='fortified').remaining,3);
});

test('Marcus Seawall pulls every single-target enemy attack off the weakest ally',()=>{
  const battle=createBattle(['marcus','nathaniel','earl'],'normal-scrap',new SeededRng(15));
  const marcus=actorBySource(battle,'marcus');
  const nathaniel=actorBySource(battle,'nathaniel');
  nathaniel.hp=1;
  const enemy=battle.units[battle.enemies[0]];
  const move={id:'probe',name:'Probe',affinity:'might',target:'enemy-one',effects:[],weight:1};
  const pick=(state,seed)=>chooseEnemyTargets(state,state.units[enemy.id],move,new SeededRng(seed))[0];
  const seeds=[1,2,3,4,5,6,7,8,9,10];
  assert.ok(seeds.some(seed=>pick(battle,seed)===nathaniel.id),'the weakest ally was never the default target');

  forceTurn(battle,marcus.id);
  const after=resolveBattleCommand(battle,{kind:'skill',actorId:marcus.id,abilityId:'seawall',targetIds:[]},new SeededRng(44)).nextState;
  for(const seed of seeds) assert.equal(pick(after,seed),marcus.id,`seed ${seed} ignored the Taunt`);
  assert.ok(after.units[marcus.id].statuses.some(status=>status.id==='fortified'&&status.remaining>=2),'Seawall did not Fortify Marcus');
});

test('Breakaway counts each Momentum stack once, as power, not power and a percentage',()=>{
  // Momentum used to add +25 power per stack AND the passive's +8% per stack to the same hit.
  // The stacks now convert to power only, so the payoff curve is stated entirely by the tooltip.
  const damageAtStacks=start=>{
    let battle=createBattle(['yatords','earl','marcus'],'normal-scrap',new SeededRng(12));
    const yatords=actorBySource(battle,'yatords');
    forceTurn(battle,yatords.id,true);
    battle.units[yatords.id].flags.momentum=start;
    const foe=battle.enemies.find(id=>battle.units[id].alive);
    const result=resolveBattleCommand(battle,{kind:'skill',actorId:yatords.id,abilityId:'breakaway',targetIds:[foe]},new SeededRng(91));
    const stacks=Number(battle.units[yatords.id].flags.momentum??0);
    assert.equal(stacks,start,'the stack count under test is the one the turn started with');
    const hit=result.events.find(e=>e.type==='damage'&&e.targetId===foe);
    assert.ok(hit,'Breakaway landed');
    return hit.amount;
  };
  // gainYatordsMomentum adds one stack before the ability resolves, so these are 1 and 3 stacks.
  const oneStack=damageAtStacks(0), threeStacks=damageAtStacks(2);
  const expected=(80+3*37)/(80+1*37);           // 191 / 117 = 1.633
  const doubleCounted=((80+3*25)/(80+1*25))*(1.24/1.08); // the old 1.695
  const ratio=threeStacks/oneStack;
  assert.ok(Math.abs(ratio-expected)<0.03,`ratio ${ratio.toFixed(3)} should track ${expected.toFixed(3)}`);
  assert.ok(Math.abs(ratio-doubleCounted)>0.03,`ratio ${ratio.toFixed(3)} must not track the old ${doubleCounted.toFixed(3)}`);
});

test('Regulars Only extends every status Daboy applies, not just the one positive one in his kit',()=>{
  let battle=createBattle(['daboy','jiro','marcus'],'normal-scrap',new SeededRng(77));
  const daboy=actorBySource(battle,'daboy'); const jiro=actorBySource(battle,'jiro');
  const foe=Object.values(battle.units).find(u=>u.side==='enemy');

  forceTurn(battle,daboy.id);
  const rocks=resolveBattleCommand(battle,{kind:'skill',actorId:daboy.id,abilityId:'on-the-rocks',targetIds:[foe.id]},new SeededRng(78));
  const slow=rocks.nextState.units[foe.id].statuses.find(s=>s.id==='slow');
  assert.equal(slow.remaining,3,'On the Rocks lists Slow for 2 turns; the passive makes it 3');

  // The positive half of the passive still works, and Jiro's version stays ally-and-positive only.
  let after=forceTurn(rocks.nextState,daboy.id);
  const pour=resolveBattleCommand(after,{kind:'skill',actorId:daboy.id,abilityId:'house-pour',targetIds:[jiro.id]},new SeededRng(79));
  assert.equal(pour.nextState.units[jiro.id].statuses.find(s=>s.id==='strength').remaining,3);
});

test('House Special pays Daboy for the debuffs his own kit applies',()=>{
  let battle=createBattle(['daboy','jiro','marcus'],'normal-scrap',new SeededRng(91));
  const daboy=actorBySource(battle,'daboy');
  const foeId=Object.values(battle.units).find(u=>u.side==='enemy').id;

  forceTurn(battle,daboy.id);
  const clean=resolveBattleCommand(battle,{kind:'skill',actorId:daboy.id,abilityId:'bottle-tap',targetIds:[foeId]},new SeededRng(92));
  const plain=clean.events.find(e=>e.type==='damage'&&e.targetId===foeId).amount;

  // Same seed, same hit, only Slow from his own On the Rocks separating the two.
  let slowed=forceTurn(battle,daboy.id);
  slowed=resolveBattleCommand(slowed,{kind:'skill',actorId:daboy.id,abilityId:'on-the-rocks',targetIds:[foeId]},new SeededRng(93)).nextState;
  slowed.units[foeId].hp=slowed.units[foeId].maxHp;
  forceTurn(slowed,daboy.id);
  const paid=resolveBattleCommand(slowed,{kind:'skill',actorId:daboy.id,abilityId:'bottle-tap',targetIds:[foeId]},new SeededRng(92));
  const bonus=paid.events.find(e=>e.type==='damage'&&e.targetId===foeId).amount;

  assert.ok(bonus>plain,`Bottle Tap into Slow should beat a clean one: ${bonus} vs ${plain}`);
  assert.equal(bonus,Math.round(plain*BALANCE.daboy.houseSpecialDamageMultiplier));
});
