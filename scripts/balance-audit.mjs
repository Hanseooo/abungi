import { mkdirSync, writeFileSync } from 'node:fs';
import { SeededRng, hashText } from '../.domain-build/core/rng/seededRng.js';
import { createBattle, resolveBattleCommand } from '../.domain-build/core/combat/battleEngine.js';
import { validatePlayerCommand } from '../.domain-build/core/combat/actions.js';
import { affinityMultiplier } from '../.domain-build/core/combat/affinity.js';
import { CHARACTERS, getAbility, getCharacter } from '../.domain-build/content/characters.js';
import { ENCOUNTERS, getEnemy } from '../.domain-build/content/enemies.js';

function combinations(values,k){const out=[];const walk=(start,pick)=>{if(pick.length===k){out.push([...pick]);return;}for(let i=start;i<=values.length-(k-pick.length);i++){pick.push(values[i]);walk(i+1,pick);pick.pop();}};walk(0,[]);return out;}
const parties=combinations(CHARACTERS.map(c=>c.id),3);
const statusRemaining=(unit,id)=>unit.statuses.find(s=>s.id===id)?.remaining??0;
const living=(battle,side)=> (side==='ally'?battle.allies:battle.enemies).map(id=>battle.units[id]).filter(u=>u?.alive);
const hpRatio=u=>u.hp/u.maxHp;

function targetForAbility(battle,actor,ability){
  if(ability.target==='enemy-one'||ability.target==='random-enemy'){
    const foes=living(battle,'enemy');
    return foes.sort((a,b)=>{
      const aa=affinityMultiplier(ability.affinity,a.affinity)*(1.15-hpRatio(a)*.15);
      const bb=affinityMultiplier(ability.affinity,b.affinity)*(1.15-hpRatio(b)*.15);
      return bb-aa;
    })[0]?.id;
  }
  if(ability.target==='ally-one'){
    const allies=living(battle,'ally');
    const hasHeal=ability.effects.some(e=>e.kind==='heal');
    const fort=ability.effects.some(e=>e.kind==='status'&&e.statusId==='fortified');
    const strength=ability.effects.some(e=>e.kind==='status'&&e.statusId==='strength');
    if(hasHeal||fort)return allies.sort((a,b)=>hpRatio(a)-hpRatio(b))[0]?.id;
    if(strength)return allies.sort((a,b)=>b.power-a.power)[0]?.id;
    return allies.filter(a=>a.id!==actor.id).sort((a,b)=>b.power-a.power)[0]?.id??actor.id;
  }
  return undefined;
}

function scoreAbility(battle,actor,ability,targetId){
  const foes=living(battle,'enemy');const allies=living(battle,'ally');const target=targetId?battle.units[targetId]:undefined;
  let score=0;
  for(const effect of ability.effects){
    if(effect.kind==='damage'){
      const hits=effect.hits??1;
      if(effect.target==='enemy-all')score+=foes.reduce((sum,foe)=>sum+effect.power*hits*affinityMultiplier(ability.affinity,foe.affinity),0);
      else if(target)score+=effect.power*hits*affinityMultiplier(ability.affinity,target.affinity);
      else score+=effect.power*hits;
    } else if(effect.kind==='heal'){
      const ts=effect.target==='ally-all'?allies:target?[target]:[];
      score+=ts.reduce((sum,u)=>sum+Math.min(u.maxHp-u.hp,Math.round(u.maxHp*effect.percentMaxHp))*1.55,0);
    } else if(effect.kind==='status'){
      let ts=[];
      if(effect.target==='self')ts=[actor];
      else if(effect.target==='ally-all')ts=allies;
      else if(effect.target==='enemy-all')ts=foes;
      else if(target)ts=[target];
      const base=['strength','haste','fortified'].includes(effect.statusId)?30:36;
      score+=ts.reduce((sum,u)=>sum+(statusRemaining(u,effect.statusId)<effect.duration?base:0),0);
    } else if(effect.kind==='summon'){
      const owned=battle.deployables.filter(d=>d.ownerId===actor.id);
      if(owned.length>=2)score-=200;
      else if(effect.summonId==='repair-drone')score+=allies.some(a=>hpRatio(a)<.78)?105:52;
      else score+=92;
    } else if(effect.kind==='cleanse'){
      score+=allies.reduce((sum,u)=>sum+u.statuses.filter(s=>['weaken','slow','blind','exposed'].includes(s.id)).length*28,0);
    } else if(effect.kind==='spendCoins')score-=effect.amount*.7;
    else if(effect.kind==='grantCoins')score+=effect.amount*.2;
    else if(effect.kind==='sacrificeHp')score-=actor.maxHp*effect.amount*.35;
  }
  if(ability.id==='overclock'){
    const owned=battle.deployables.filter(d=>d.ownerId===actor.id);
    score=owned.length?100+owned.filter(d=>!d.enhanced).length*35:statusRemaining(actor,'haste')<2?34:0;
  }
  if(ability.id==='breakaway')score+=Number(actor.flags.momentum??0)*30;
  if(ability.id==='clearance-sale')score=battle.availableCoins>=15&&battle.tier!=='normal'?125:20;
  if(ability.id==='all-in'&&hpRatio(actor)<.42)score-=80;
  if(ability.id==='abyssal-pact'&&hpRatio(actor)<.35)score-=90;
  if(ability.id==='double-down'&&hpRatio(actor)<.3)score-=45;
  if(ability.id==='life-drain'&&hpRatio(actor)<.62)score+=45;
  if(ability.id==='chefs-table'&&allies.filter(a=>hpRatio(a)<.8).length>=2)score+=70;
  if(ability.id==='full-cover'&&allies.filter(a=>statusRemaining(a,'fortified')===0).length>=2&&battle.tier!=='normal')score+=55;
  if(ability.id==='rally'&&allies.filter(a=>statusRemaining(a,'strength')===0).length>=2)score+=45;
  return score;
}

function chooseImmediateValue(battle){
  const actor=battle.units[battle.turnOrder[battle.turnIndex]];
  if(!actor||actor.side!=='ally')throw new Error('Expected player input turn');
  const character=getCharacter(actor.sourceId);const candidates=[];
  for(const abilityId of character.abilities){
    const ability=getAbility(abilityId);const targetId=targetForAbility(battle,actor,ability);const targetIds=targetId?[targetId]:[];
    const command={kind:'skill',actorId:actor.id,abilityId,targetIds};const legality=validatePlayerCommand(battle,command);
    if(legality.legal)candidates.push({command,score:scoreAbility(battle,actor,ability,targetId),abilityId});
  }
  if(hpRatio(actor)<.23)candidates.push({command:{kind:'guard',actorId:actor.id},score:68,abilityId:'guard'});
  candidates.sort((a,b)=>b.score-a.score||a.abilityId.localeCompare(b.abilityId));
  if(!candidates.length)return {kind:'guard',actorId:actor.id};
  return candidates[0].command;
}

/** Whom the enemy AI is most likely to hit next: it favours the lowest HP fraction 65% of the time. */
function likelyEnemyTarget(battle){
  return living(battle,'ally').sort((a,b)=>hpRatio(a)-hpRatio(b))[0];
}

/** Enemy damage headroom, learned from the enemy definitions the player can already read. */
function worstIncomingPower(battle){
  return Math.max(0,...living(battle,'enemy').flatMap(unit=>getEnemy(unit.sourceId).moves.flatMap(move=>move.effects.filter(e=>e.kind==='damage').map(e=>e.power))));
}

function chooseMechanicAware(battle){
  const actor=battle.units[battle.turnOrder[battle.turnIndex]];
  if(actor.sourceId==='saq'){
    const threatened=likelyEnemyTarget(battle);
    const linked=battle.effects.some(fx=>fx.id==='protect'&&fx.sourceUnitId===actor.id);
    const ppLeft=actor.abilityPP['take-your-seat']??0;
    const worst=worstIncomingPower(battle);
    if(!linked&&ppLeft>0&&threatened&&threatened.id!==actor.id&&hpRatio(threatened)<0.62&&worst>=50){
      return {kind:'skill',actorId:actor.id,abilityId:'take-your-seat',targetIds:[threatened.id]};
    }
    if(Number(actor.flags.readyTurns??0)>0&&(actor.abilityPP['dismissed']??0)>0){
      const foe=living(battle,'enemy').sort((a,b)=>hpRatio(a)-hpRatio(b))[0];
      if(foe)return {kind:'skill',actorId:actor.id,abilityId:'dismissed',targetIds:[foe.id]};
    }
  }
  return chooseImmediateValue(battle);
}

const POLICIES={
  'immediate-value':chooseImmediateValue,
  'mechanic-aware':chooseMechanicAware,
};
const POLICY_NAME=process.env.SPEC03_POLICY??'mechanic-aware';
const chooseCommand=battle=>POLICIES[POLICY_NAME]?.(battle)??chooseImmediateValue(battle);

const ROUND_CAP=30;
const COMMAND_CAP=180;
function regionFor(encounter){if(encounter.id==='boss-jonlow')return 0;if(encounter.id==='boss-klyde')return 1;if(encounter.id==='boss-warden')return 2;return encounter.tier==='elite'?1:0;}
function simulate(party,encounter,seed){
  const rng=new SeededRng(seed);let battle=createBattle(party,encounter.id,rng,{coins:30,regionIndex:regionFor(encounter)});let actions=0;
  const tally={protectCasts:0,protectTriggers:0,protectExpired:0,recipientAvoided:0,transferPaid:0,monitorPrevented:0,readyGranted:0,readySpent:0};
  while((battle.phase==='input'||battle.phase==='resolving')&&actions<COMMAND_CAP&&battle.round<=ROUND_CAP){
    if(battle.phase!=='input')throw new Error('Engine returned unresolved automatic state');
    const command=chooseCommand(battle);
    const resolution=resolveBattleCommand(battle,command,rng);
    for(const event of resolution.events){
      if(event.type==='effectApplied'&&event.effectId==='protect')tally.protectCasts++;
      if(event.type==='effectRemoved'&&event.effectId==='protect'&&event.reason==='consumed')tally.protectTriggers++;
      if(event.type==='effectRemoved'&&event.effectId==='protect'&&event.reason==='expired')tally.protectExpired++;
      if(event.type==='transfer')tally.transferPaid+=event.amount;
      if(event.type==='prevented'&&event.kind==='class-monitor')tally.monitorPrevented+=event.amount;
      if(event.type==='ready')event.active?tally.readyGranted++:tally.readySpent++;
    }
    battle=resolution.nextState;actions++;
  }
  const allies=battle.allies.map(id=>battle.units[id]);
  const outcome=battle.escaped?'escape':battle.phase==='victory'?'win':battle.phase==='defeat'?'defeat':'timeout';
  return {outcome,won:outcome==='win',rounds:battle.round,actions,survivors:allies.filter(a=>a.alive).length,hpRatio:allies.reduce((s,a)=>s+a.hp/a.maxHp,0)/allies.length,...tally};
}

if(process.env.SPEC03_TRACE){
  const rng=new SeededRng(Number(process.env.SPEC03_TRACE));
  let battle=createBattle(['saq','hans','marcus'],'normal-fastlane',rng,{coins:30,regionIndex:0});
  while(battle.phase==='input'&&battle.round<=ROUND_CAP){
    const command=chooseCommand(battle);
    console.log(`R${battle.round} ${battle.units[command.actorId].displayName}: ${command.abilityId??command.kind}`);
    battle=resolveBattleCommand(battle,command,rng).nextState;
  }
  console.log(`outcome=${battle.phase} effects=${JSON.stringify(battle.effects)}`);
  process.exit(0);
}

const SCREENING_SEEDS=[101,202,303,404,505,606,707,808,909,1010,1111,1212,1313,1414,1515,1616,1717,1818,1919,2020,2121,2222,2323,2424,2525,2626,2727,2828,2929,3030,3131,3232];
const EXPANDED_SEEDS=[...SCREENING_SEEDS,...Array.from({length:96},(_,i)=>4000+i*37)];
const seeds=process.env.SPEC03_SEEDS==='expanded'?EXPANDED_SEEDS:SCREENING_SEEDS;
const records=[];
for(const party of parties)for(const encounter of ENCOUNTERS)for(const seed of seeds){const mixed=(seed^party.join('').split('').reduce((a,c)=>Math.imul(a^c.charCodeAt(0),16777619)>>>0,2166136261)^encounter.id.length)>>>0;records.push({party,encounter:encounter.id,tier:encounter.tier,...simulate(party,encounter,mixed)});}

/** Hold two teammates fixed, swap the third, run the same encounter seeds. */
function matchedSlot(subjectId,alternativeId){
  const others=CHARACTERS.map(c=>c.id).filter(id=>id!==subjectId&&id!==alternativeId);
  const rows=[];
  for(const pair of combinations(others,2))for(const encounter of ENCOUNTERS)for(const seed of seeds){
    const scenarioSeed=(seed^hashText(`${pair.join('|')}|${encounter.id}`))>>>0;
    rows.push({
      pair,encounter:encounter.id,tier:encounter.tier,
      subject:simulate([subjectId,...pair],encounter,scenarioSeed),
      alternative:simulate([alternativeId,...pair],encounter,scenarioSeed),
    });
  }
  return rows;
}

const tiers=['normal','elite','boss'];
function summarize(rows){return {n:rows.length,winRate:rows.filter(r=>r.won).length/rows.length,rounds:rows.reduce((s,r)=>s+r.rounds,0)/rows.length,survivors:rows.reduce((s,r)=>s+r.survivors,0)/rows.length,hpRatio:rows.reduce((s,r)=>s+r.hpRatio,0)/rows.length,timeouts:rows.filter(r=>r.outcome==='timeout').length,defeats:rows.filter(r=>r.outcome==='defeat').length,escapes:rows.filter(r=>r.outcome==='escape').length,medianRounds:(()=>{const wins=rows.filter(r=>r.outcome==='win').map(r=>r.rounds).sort((a,b)=>a-b);return wins.length?wins[Math.floor(wins.length/2)]:0;})(),p90Rounds:(()=>{const wins=rows.filter(r=>r.outcome==='win').map(r=>r.rounds).sort((a,b)=>a-b);return wins.length?wins[Math.min(wins.length-1,Math.floor(wins.length*0.9))]:0;})()};}
const overall=summarize(records);const tierStats=Object.fromEntries(tiers.map(t=>[t,summarize(records.filter(r=>r.tier===t))]));
const characterStats=CHARACTERS.map(c=>{const rows=records.filter(r=>r.party.includes(c.id));const all=summarize(rows);const byTier=Object.fromEntries(tiers.map(t=>[t,summarize(rows.filter(r=>r.tier===t))]));return {id:c.id,name:c.displayName,...all,byTier};}).sort((a,b)=>b.winRate-a.winRate||b.hpRatio-a.hpRatio);

const fmtPct=n=>`${(n*100).toFixed(1)}%`;const fmt=n=>n.toFixed(2);
let md=`# Abungi v0.3 Character Balance Audit\n\nGenerated from the deterministic game engine with ${records.length.toLocaleString()} battles: all ${parties.length} three-character parties from ${CHARACTERS.length} characters × ${ENCOUNTERS.length} encounters × ${seeds.length} deterministic seeds. The policy is a conservative heuristic that uses healing, statuses, deployables, multi-target attacks and signatures; it is diagnostic, not a substitute for human playtesting. No consumable items or relics are injected, and Leandre begins encounters with 30 coins so Clearance Sale can be represented without unlimited economy.\n\n`;
md+=`Provenance: revision \`${process.env.SPEC03_REV ?? 'unrecorded'}\`, working tree \`${process.env.SPEC03_TREE ?? 'unrecorded'}\`, seeds \`${seeds.join(',')}\`, policy \`${process.env.SPEC03_POLICY ?? 'heuristic-v1'}\`, timeout cap ${ROUND_CAP} rounds / ${COMMAND_CAP} commands. Party rows share members, so they are not independent observations.\n\n## Global pacing\n\n| Tier | Win rate | Avg rounds | Median rounds | p90 rounds | Avg survivors | Ending HP | Timeouts | Defeats |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|\n`;
for(const t of tiers){const x=tierStats[t];md+=`| ${t} | ${fmtPct(x.winRate)} | ${fmt(x.rounds)} | ${x.medianRounds} | ${x.p90Rounds} | ${fmt(x.survivors)} | ${fmtPct(x.hpRatio)} | ${x.timeouts} | ${x.defeats} |\n`;}
md+=`\nOverall: ${fmtPct(overall.winRate)} wins, ${fmt(overall.rounds)} average rounds.\n\n## Character inclusion results\n\n| Character | Overall win | Normal | Elite | Boss | Avg rounds | Ending HP |\n|---|---:|---:|---:|---:|---:|---:|\n`;
for(const c of characterStats)md+=`| ${c.name} | ${fmtPct(c.winRate)} | ${fmtPct(c.byTier.normal.winRate)} | ${fmtPct(c.byTier.elite.winRate)} | ${fmtPct(c.byTier.boss.winRate)} | ${fmt(c.rounds)} | ${fmtPct(c.hpRatio)} |\n`;
const mid=characterStats.reduce((s,c)=>s+c.winRate,0)/characterStats.length;
const high=characterStats.filter(c=>c.winRate>mid+.045).map(c=>c.name);const low=characterStats.filter(c=>c.winRate<mid-.045).map(c=>c.name);
md+=`\n## Interpretation\n\n- Mean character-inclusion win rate: ${fmtPct(mid)}.\n- Directionally high (>4.5 percentage points above mean): ${high.length?high.join(', '):'none'}.\n- Directionally low (>4.5 percentage points below mean): ${low.length?low.join(', '):'none'}.\n- Do not tune from this table alone. Economy utility, player mastery, party synergy, consumables and route decisions are intentionally underrepresented.\n- Hans should be judged especially on boss/elite performance after the new deployable presentation is visible; perceived impact was a UX problem in v0.1.\n- Leandre's run-level value is undercounted because this encounter audit cannot price his extra shop offer.\n\n`;
// Protect diagnostics (Saq-inclusive parties only)
const saqRows=records.filter(r=>r.party.includes('saq'));
const totalProtectCasts=saqRows.reduce((s,r)=>s+r.protectCasts,0);
const totalProtectTriggers=saqRows.reduce((s,r)=>s+r.protectTriggers,0);
const totalProtectExpired=saqRows.reduce((s,r)=>s+r.protectExpired,0);
const totalTransferPaid=saqRows.reduce((s,r)=>s+r.transferPaid,0);
const totalMonitorPrevented=saqRows.reduce((s,r)=>s+r.monitorPrevented,0);
const totalReadyGranted=saqRows.reduce((s,r)=>s+r.readyGranted,0);
const totalReadySpent=saqRows.reduce((s,r)=>s+r.readySpent,0);
md+=`## Protect diagnostics (Saq-inclusive parties, ${saqRows.length} battles)\n\n| Metric | Count |\n|---|---:|\n`;
md+=`| Protect casts | ${totalProtectCasts} |\n`;
md+=`| Protect triggered (consumed) | ${totalProtectTriggers} |\n`;
md+=`| Protect expired unused | ${totalProtectExpired} |\n`;
md+=`| HP transferred to Saq | ${totalTransferPaid} |\n`;
md+=`| Class Monitor prevented | ${totalMonitorPrevented} |\n`;
md+=`| Ready granted | ${totalReadyGranted} |\n`;
md+=`| Ready spent | ${totalReadySpent} |\n`;
md+=`\nNote: recipient avoids the full intercepted hit; Saq pays transfer cost; party saves monitorPrevented. These are not the same number.\n\n`;

// Matched-slot comparison: Saq vs Marcus
const saqVsMarcus=matchedSlot('saq','marcus');
const tierGroups=['normal','elite','boss'];
md+=`## Matched-slot replacement: Saq vs Marcus (${saqVsMarcus.length} matched pairs)\n\n`;
md+=`_Same pair of teammates, same encounter, same seed. RNG diverges after turn 1. These are practical sample sizes, not a statistical guarantee._\n\n`;
md+=`| Tier | Saq win rate | Marcus win rate | Delta | Saq median rounds | Marcus median rounds |\n|---|---:|---:|---:|---:|---:|\n`;
for(const t of tierGroups){
  const tRows=saqVsMarcus.filter(r=>r.tier===t);
  const saqWin=tRows.filter(r=>r.subject.won).length/tRows.length;
  const marcWin=tRows.filter(r=>r.alternative.won).length/tRows.length;
  const delta=(saqWin-marcWin)*100;
  const saqMed=(()=>{const w=tRows.map(r=>r.subject.rounds).sort((a,b)=>a-b);return w[Math.floor(w.length/2)]??0;})();
  const marMed=(()=>{const w=tRows.map(r=>r.alternative.rounds).sort((a,b)=>a-b);return w[Math.floor(w.length/2)]??0;})();
  const flag=Math.abs(delta)>5?' ⚠️':'';
  md+=`| ${t} | ${fmtPct(saqWin)} | ${fmtPct(marcWin)} | ${delta.toFixed(1)}pp${flag} | ${saqMed} | ${marMed} |\n`;
}
md+='\n';

mkdirSync('docs',{recursive:true});writeFileSync('docs/BALANCE_AUDIT_V03.md',md);
console.log(md);
