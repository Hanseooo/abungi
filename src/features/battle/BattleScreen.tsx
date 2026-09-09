import { useEffect, useState, type CSSProperties } from 'react';
import { useAppStore, currentActorAvailability, inventoryItems } from '../../app/appStore';
import type { AbilityDefinition, BattleEffectInstance, BattleState, BattleUnit, CombatEvent, TargetMode } from '../../game/core/types';
import { getAbility, getCharacter } from '../../game/content/characters';
import { getEnemy } from '../../game/content/enemies';
import { affinityLabel } from '../../game/core/combat/affinity';
import { BALANCE } from '../../game/balance/constants';
import { validatePlayerCommand, type ActionLegality } from '../../game/core/combat/actions';
import { previewItemPp } from '../../game/core/progression/itemRecovery';
import { CutoutArt } from '../../ui/components/CutoutArt';
import { AffinityMark } from '../../ui/components/AffinityMark';
import { Meter } from '../../ui/components/Meter';
import { StatusStrip } from '../../ui/components/StatusStrip';
import { PaperButton } from '../../ui/components/PaperButton';
import { regionBackgroundUrl } from '../../services/assets/assetRegistry';
import { audioEngine } from '../../services/audio/audioEngine';
import { buildCombatBeats, presentedHpAtBeat, useCombatDirector } from './combatDirector';
import { charAccentStyle } from '../../ui/charAccent';

function assetFor(unit:BattleUnit){return unit.side==='ally'?getCharacter(unit.sourceId).assetId:getEnemy(unit.sourceId).assetId;}
function relationship(move:AbilityDefinition|undefined,target:BattleUnit){return move?affinityLabel(move.affinity,target.affinity):'normal';}
function oneTarget(mode:TargetMode){return mode==='enemy-one'||mode==='ally-one';}
function targetSide(mode:TargetMode):'ally'|'enemy'|null{return mode==='ally-one'?'ally':mode==='enemy-one'?'enemy':null;}
function statusClass(unit:BattleUnit){return unit.statuses.map(status=>`has-${status.id}`).join(' ');}

export function mechanicBadges(unit:BattleUnit,battle:BattleState):string[]{
  const live=battle.units[unit.id]??unit;
  if(live.sourceId==='saq'){
    // Saq holds both at once often enough that showing only the first hid half his turn.
    const badges:string[]=[];
    if(Number(live.flags.readyTurns??0)>0)badges.push(`READY · DISMISSED +${Math.round((BALANCE.saq.dismissedReadyDamageMultiplier-1)*100)}%`);
    if(battle.effects.some(effect=>effect.id==='protect'&&effect.sourceUnitId===live.id)&&Number(live.flags.classMonitorRound??0)!==battle.round)badges.push('CLASS MONITOR · READY');
    if(badges.length)return badges;
  }
  if(live.sourceId==='ken'&&battle.effects.some(effect=>effect.id==='ink-mark'&&effect.sourceUnitId===live.id)&&Number(live.flags.collaborativeWorkRound??0)!==battle.round)return ['COLLAB WORK · READY'];
  if(live.sourceId==='nathaniel'&&live.hp>0&&live.hp/live.maxHp<.4)return ['DARK HUNGER · POWER +20%'];
  if(live.sourceId==='earl'&&!live.flags.firstResponderUsed)return ['FIRST RESPONSE · READY'];
  if(live.sourceId==='greg'&&!live.flags.spoilsUsed)return ['SPOILS · READY'];
  if(live.sourceId==='michael'&&!live.flags.steadyAimUsed)return ['STEADY AIM · READY'];
  if(live.sourceId==='yeeho'&&!live.flags.houseEdgeRefunded)return ['HOUSE EDGE · READY'];
  return [];
}

export function combatFeedback(events:CombatEvent[]):string[]{
  return events.flatMap(event=>{
    if(event.type==='effectApplied')return [`${event.effectId==='ink-mark'?'INK MARK':event.effectId.toUpperCase()} APPLIED`];
    if(event.type==='effectRemoved'&&event.reason==='consumed')return [`${event.effectId==='ink-mark'?'INK MARK':event.effectId.toUpperCase()} TRIGGERED`];
    if(event.type==='prevented')return [`${event.kind==='class-monitor'?'CLASS MONITOR':'SCRIPT'} BLOCKED ${event.amount}`];
    if(event.type==='transfer')return [`SAQ COVERED ${event.amount}`];
    if(event.type==='ready')return [event.active?'READY GAINED':'READY EXPIRED'];
    if(event.type==='message')return [event.text.toUpperCase()];
    return [];
  });
}

function UnitFigure({unit,presentedHp=unit.hp,move,onTarget,validTarget,itemPreview,pulse,events,effects,current,incoming=false,onInfo}:{unit:BattleUnit;presentedHp?:number;move?:AbilityDefinition;onTarget?:(id:string)=>void;validTarget:boolean;itemPreview?:string;pulse:number;events:CombatEvent[];effects:BattleEffectInstance[];current:boolean;incoming?:boolean;onInfo:()=>void}){
  const hitEvents=events.filter(e=>e.type==='damage'&&e.targetId===unit.id) as Extract<CombatEvent,{type:'damage'}>[];
  const accent=charAccentStyle(unit.side==='ally'?getCharacter(unit.sourceId):{affinity:unit.affinity});
  const healEvents=events.filter(e=>e.type==='heal'&&e.targetId===unit.id) as Extract<CombatEvent,{type:'heal'}>[];
  const preventedEvents=(events.filter(e=>e.type==='prevented') as Extract<CombatEvent,{type:'prevented'}>[]).filter(e=>e.targetId===unit.id);
  const transferEvents=(events.filter(e=>e.type==='transfer') as Extract<CombatEvent,{type:'transfer'}>[]).filter(e=>e.fromId===unit.id);
  const hit=events.some(e=>(e.type==='hit'||e.type==='damage')&&e.targetId===unit.id);const healed=healEvents.length>0;const stamped=events.some(e=>e.type==='statusApplied'&&e.targetId===unit.id);const guarding=events.some(e=>e.type==='guard'&&e.actorId===unit.id);const revived=events.some(e=>e.type==='revive'&&e.targetId===unit.id);const ko=events.some(e=>e.type==='knockout'&&e.targetId===unit.id);const acting=events.some(e=>e.type==='actionStart'&&e.actorId===unit.id);
  const presentedAlive=presentedHp>0;
  const content=<><div className={`unit-cutout-wrap ${statusClass(unit)} ${unit.guardActive?'has-guard':''} ${hit?'is-hit':''} ${healed?'is-healed':''} ${stamped?'is-status-stamp':''} ${guarding?'is-guarding':''} ${revived?'is-revived':''} ${ko||!presentedAlive?'is-ko':''} ${acting?'is-acting':''}`} data-pulse={pulse}><div className="status-aura" aria-hidden="true"><i/><i/><i/></div><CutoutArt assetId={assetFor(unit)} name={unit.displayName}/>{hitEvents.slice(-3).map((damage,index)=><span key={`d-${pulse}-${index}`} style={{'--pop-index':index} as CSSProperties} className={`number-pop ${damage.critical?'critical':''} affinity-${damage.affinity}`}>-{damage.amount}{damage.critical?' CRIT':''}{damage.affinity==='advantage'?' · ADV!':damage.affinity==='resisted'?' · RESIST':''}</span>)}{healEvents.slice(-2).map((heal,index)=><span key={`h-${pulse}-${index}`} style={{'--pop-index':index} as CSSProperties} className="number-pop heal-pop">+{heal.amount}</span>)}{preventedEvents.slice(-2).map((ev,index)=><span key={`pv-${pulse}-${index}`} style={{'--pop-index':index} as CSSProperties} className="number-pop shield-pop">BLOCKED {ev.amount}</span>)}{transferEvents.slice(-2).map((ev,index)=><span key={`tr-${pulse}-${index}`} style={{'--pop-index':index} as CSSProperties} className="number-pop shield-pop">SAQ +{ev.amount}</span>)}</div><div className={`unit-label ${presentedAlive?'':'is-down'}`}><div><strong>{unit.displayName}</strong><AffinityMark affinity={unit.affinity} small/></div><Meter value={presentedHp} max={unit.maxHp} label={`${unit.displayName} HP`}/><StatusStrip statuses={unit.statuses} effects={effects}/>{move&&unit.side==='enemy'&&validTarget&&<span className={`target-read target-${relationship(move,unit)}`}>{relationship(move,unit).toUpperCase()}</span>}{current&&<span className="turn-flag">ACTING</span>}{incoming&&<span className="enemy-target-flag">TARGET</span>}{!presentedAlive&&<span className="down-flag">DOWN</span>}</div></>;
  return <div className={`unit-figure-shell ${current?'current-unit':''} ${incoming?'incoming-target':''}`} style={accent}>{onTarget&&validTarget?<button className="unit-figure targetable" onClick={()=>onTarget(unit.id)} aria-label={`Target ${unit.displayName}`}>{content}<span className="target-corner">TARGET</span></button>:<div className="unit-figure">{content}</div>}{itemPreview&&validTarget&&<span className="item-target-preview">{itemPreview}</span>}<button className="unit-info-button" onClick={event=>{event.stopPropagation();onInfo()}} aria-label={`Info about ${unit.displayName}`}>i</button></div>;
}

function BattleVfx({action,events,phase,beatKey}:{action?:Extract<CombatEvent,{type:'actionStart'}>;events:CombatEvent[];phase?:'announce'|'resolve';beatKey:number}){
  if(!action)return null;const multi=events.filter(event=>event.type==='damage').length;const summon=events.find(event=>event.type==='summon');
  return <div className={`battle-vfx-layer phase-${phase} choreo-${action.choreography??'utility'} ${action.signature?'signature':''}`} aria-hidden="true" key={`${action.actorId}:${action.actionId}:${beatKey}`}><i className="vfx-path"/><i className="vfx-impact"/><i className="vfx-particle p1"/><i className="vfx-particle p2"/><i className="vfx-particle p3"/>{multi>1&&<span className="vfx-multihit">×{multi}</span>}{summon&&<span className="vfx-summon-mark">ASSEMBLE</span>}</div>;
}

function DeployableField({battle,events}:{battle:BattleState;events:CombatEvent[]}){
  const deployables=battle.deployables;
  if(!deployables.length)return null;
  return <div className="deployable-field" aria-label="Active deployables">{deployables.map(deployable=>{const trigger=events.find(event=>event.type==='deployableTrigger'&&event.deployableId===deployable.id) as Extract<CombatEvent,{type:'deployableTrigger'}>|undefined;return <div key={deployable.id} className={`deployable-piece ${deployable.type} ${deployable.enhanced?'enhanced':''} ${trigger?'triggered':''} ${trigger?.effect==='damage'?'firing':''} ${trigger?.effect==='heal'?'repairing':''}`}><div className="deployable-art" aria-hidden="true"><i/><i/><i/></div><span>{deployable.type==='sentry'?'SENTRY':'REPAIR DRONE'}</span><b>{deployable.remainingTurns}T</b>{deployable.enhanced&&<em>OVERCLOCK</em>}{trigger&&<small>{trigger.effect==='damage'?`FIRED · ${trigger.amount}`:`HEALED · ${trigger.amount}`}</small>}</div>})}</div>;
}

export function BattleScreen(){
  const entrance=useAppStore(s=>s.battleEntrance);const scenePending=useAppStore(s=>s.sceneQueue.length>0);
  const run=useAppStore(s=>s.run)!;const battle=run.activeBattle!;const isResolving=useAppStore(s=>s.isResolving);const allEvents=useAppStore(s=>s.battleEvents);const pulse=useAppStore(s=>s.battlePulse);const skill=useAppStore(s=>s.battleSkill);const guard=useAppStore(s=>s.battleGuard);const itemAction=useAppStore(s=>s.battleItem);const error=useAppStore(s=>s.error);const settings=useAppStore(s=>s.settings);const openSettings=useAppStore(s=>s.openSettings);const openMove=useAppStore(s=>s.openMoveInfo);const openItem=useAppStore(s=>s.openItemInfo);const openEnemy=useAppStore(s=>s.openEnemyInfo);const openCharacter=useAppStore(s=>s.openCharacterInfo);
  const director=useCombatDirector(allEvents,pulse,settings);const events=isResolving?director.events:allEvents;const action=director.action;const presentedActor=action?battle.units[action.actorId]:undefined;
  const finalHp=Object.fromEntries(Object.entries(battle.units).map(([id,unit])=>[id,unit.hp]));const presentedHp=entrance?presentedHpAtBeat(finalHp,buildCombatBeats(entrance.openingEvents),-1):isResolving?presentedHpAtBeat(finalHp,director.beats,director.index):finalHp;
  const enemyTargetIds=action?.side==='enemy'?director.beat?.targetIds.filter(id=>battle.units[id]?.side==='ally')??[]:[];
  const enemyTargetNames=enemyTargetIds.map(id=>battle.units[id]?.displayName).filter(Boolean).join(', ');
  const actor=battle.units[battle.turnOrder[battle.turnIndex]];const availability=currentActorAvailability(run)??[];const items=inventoryItems(run);
  const[selectedSkill,setSelectedSkill]=useState<AbilityDefinition|null>(null);const[selectedItem,setSelectedItem]=useState<(typeof items)[number]['definition']|null>(null);const[tray,setTray]=useState<'skills'|'items'>('skills');
  useEffect(()=>{setSelectedSkill(null);setSelectedItem(null);setTray('skills');},[actor?.id]);
  useEffect(()=>{if(!events.length)return;if(events.some(e=>e.type==='victory'))void audioEngine.sfx('victory');else if(events.some(e=>e.type==='defeat'))void audioEngine.sfx('defeat');else if(events.some(e=>e.type==='summon'))void audioEngine.sfx('summon');else if(events.some(e=>e.type==='coin'))void audioEngine.sfx('coin');else if(events.some(e=>e.type==='heal'||e.type==='revive'))void audioEngine.sfx('heal');else if(events.some(e=>e.type==='statusApplied'||e.type==='statusRemoved'||e.type==='effectApplied'||e.type==='effectRemoved'))void audioEngine.sfx('status');else if(events.some(e=>e.type==='hit'&&e.heavy))void audioEngine.sfx('heavy-hit');else if(events.some(e=>e.type==='hit'))void audioEngine.sfx('hit');},[director.index,pulse]);
  const selectedMode=selectedSkill?.target??selectedItem?.target??null;const side=selectedMode?targetSide(selectedMode):null;
  const submitAuto=()=>{if(isResolving||!actor)return;if(selectedSkill){let targets:string[]=[];if(selectedSkill.target==='random-enemy')targets=[battle.enemies.find(id=>battle.units[id].alive)!];void skill(actor.id,selectedSkill.id,targets);}else if(selectedItem){void itemAction(actor.id,selectedItem.id,[]);}setSelectedSkill(null);setSelectedItem(null);};
  const selectTarget=(id:string)=>{if(isResolving||!actor)return;if(selectedSkill)void skill(actor.id,selectedSkill.id,[id]);else if(selectedItem)void itemAction(actor.id,selectedItem.id,[id]);setSelectedSkill(null);setSelectedItem(null);};
  useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if(isResolving||!actor||actor.side!=='ally')return;if(event.key>='1'&&event.key<='4'){const entry=availability[Number(event.key)-1];if(entry?.legal){setTray('skills');setSelectedItem(null);setSelectedSkill(entry.ability);}event.preventDefault();}if(event.key==='Escape'){setSelectedSkill(null);setSelectedItem(null);event.preventDefault();}if(event.key==='Enter'&&selectedMode&&!oneTarget(selectedMode)){submitAuto();event.preventDefault();}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[actor?.id,isResolving,availability,selectedMode,selectedSkill,selectedItem]);
  const targetInstruction=selectedSkill?oneTarget(selectedSkill.target)?`Choose ${selectedSkill.target==='enemy-one'?'an enemy':'an ally'}.`:`Confirm ${selectedSkill.name}.`:selectedItem?oneTarget(selectedItem.target)?`Choose ${selectedItem.targetKo?'a KO ally':selectedItem.target==='enemy-one'?'an enemy':'an ally'}.`:`Confirm ${selectedItem.name}.`:null;
  const feedback=isResolving?combatFeedback(events):[];
  // Script, Protect, Class Monitor and Ink Mark all pay off on enemy turns, when the message
  // panel used to stay closed, so their only report never reached the player.
  const drawnByTaunt=action?.side==='enemy'&&enemyTargetIds.length>0&&enemyTargetIds.every(id=>battle.effects.some(fx=>fx.id==='taunt'&&fx.targetUnitId===id));
  const heavy=events.some(e=>e.type==='hit'&&e.heavy);const screenShake=heavy&&!settings.reducedMotion;const maxPp=(ability:AbilityDefinition)=>ability.maxPP+(actor?.upgradedAbilities?.includes(ability.id)?ability.upgrade.maxPPDelta??0:0);
  const actionMessage=action&&presentedActor?`${presentedActor.displayName} used ${action.label}!`:null;
  type BattleItem=(typeof items)[number]['definition'];
  const itemTargetCandidates=(item:BattleItem):string[]=>{
    if(!actor||actor.side!=='ally')return [];
    if(item.targetKo)return battle.allies.filter(id=>{const unit=battle.units[id];return Boolean(unit&&!unit.alive);});
    if(item.target==='ally-one')return battle.allies.filter(id=>battle.units[id]?.alive);
    if(item.target==='enemy-one'||item.target==='random-enemy')return battle.enemies.filter(id=>battle.units[id]?.alive);
    return [];
  };
  const itemTargetLegal=(item:BattleItem,targetId:string):ActionLegality=>{
    if(!actor||actor.side!=='ally')return {legal:false,reason:'No party member can act right now.'};
    return validatePlayerCommand(battle,{kind:'item',actorId:actor.id,itemId:item.id,targetIds:[targetId]});
  };
  const itemLegality=(item:BattleItem):ActionLegality=>{
    if(!actor||actor.side!=='ally')return {legal:false,reason:'Items can only be used on a party turn.'};
    if(item.target==='ally-one'||item.target==='enemy-one'||item.target==='random-enemy'||item.targetKo){
      const candidates=itemTargetCandidates(item);
      if(!candidates.length)return validatePlayerCommand(battle,{kind:'item',actorId:actor.id,itemId:item.id,targetIds:[]});
      const checks=candidates.map(id=>itemTargetLegal(item,id));
      return checks.find(check=>check.legal)??checks[0];
    }
    return validatePlayerCommand(battle,{kind:'item',actorId:actor.id,itemId:item.id,targetIds:[]});
  };
  const itemPpPreviewFor=(item:BattleItem,unit:BattleUnit)=>{const effect=item.effects.find(candidate=>candidate.kind==='restorePP');return effect?previewItemPp(unit,effect.amount,run.relicIds):null;};
  const groupPpPreviews=selectedItem?.target==='ally-all'?battle.allies.map(id=>battle.units[id]).filter(unit=>unit.alive).map(unit=>({unit,preview:itemPpPreviewFor(selectedItem,unit)})).filter(entry=>entry.preview):[];
  return <main className={`battle-screen speed-${settings.animationSpeed}x ${settings.reducedMotion?'reduced-motion':''} ${screenShake?'battle-shake':''} ${entrance?'encounter-entering':''} ${scenePending?'entrance-paused':''}`} style={{'--battle-bg':`url(${regionBackgroundUrl(run.regionIndex)})`,'--entrance-duration':`${entrance?.duration??2400}ms`} as CSSProperties}>
    <section className="battle-utility" aria-label="Battle utility"><span>ROUND <b>{battle.round}</b></span><span>{battle.tier==='normal'?'':`${battle.tier.toUpperCase()} · `}{battle.encounterId.replaceAll('-',' ').toUpperCase()}</span><span>{run.coins} COINS</span><button disabled={isResolving} onClick={openSettings}>SETTINGS</button></section>
    <section className="enemy-stage" aria-label="Enemies">{battle.enemies.map(id=>{const unit=battle.units[id];const valid=side==='enemy'&&unit.alive&&(!selectedItem||itemTargetLegal(selectedItem,id).legal);return <UnitFigure key={id} unit={unit} presentedHp={presentedHp[id]} effects={battle.effects.filter(effect=>effect.targetUnitId===unit.id)} move={selectedSkill??undefined} onTarget={side==='enemy'?selectTarget:undefined} validTarget={valid} pulse={pulse} events={events} current={presentedActor?.id===id} onInfo={()=>openEnemy(unit.sourceId)}/>})}</section>
    <BattleVfx action={action} events={events} phase={director.phase} beatKey={director.index}/>
    {entrance?<section className="combat-message encounter-banner" role="status"><strong>{battle.enemies.map(id=>battle.units[id].displayName).join(' & ')} appeared!</strong><small>Get ready. Fastest moves first.</small></section>:(error||(isResolving&&(action?.side!=='enemy'||feedback.length>0)))&&<section className={`combat-message ${error?'is-error':''}`} aria-live="polite"><strong>{isResolving?(actionMessage??'Resolving…'):error}</strong>{isResolving&&!error&&feedback.map((f,i)=><small key={i}>{f}</small>)}{isResolving&&error&&<small role="alert">{error}</small>}</section>}
    <section className="ally-stage" aria-label="Party">{battle.allies.map(id=>{const unit=battle.units[id];const valid=side==='ally'&&(selectedItem?itemTargetLegal(selectedItem,id).legal:unit.alive);const ppPreview=selectedItem?itemPpPreviewFor(selectedItem,unit):null;const itemPreview=ppPreview?`AUTO ${getAbility(ppPreview.abilityId).name} · PP ${ppPreview.before} → ${ppPreview.after}`:undefined;return <UnitFigure key={id} unit={unit} presentedHp={presentedHp[id]} effects={battle.effects.filter(effect=>effect.targetUnitId===unit.id)} move={selectedSkill??undefined} onTarget={side==='ally'?selectTarget:undefined} validTarget={valid} itemPreview={itemPreview} pulse={pulse} events={events} current={presentedActor?.id===id} incoming={director.phase==='announce'&&enemyTargetIds.includes(id)} onInfo={()=>openCharacter(unit.sourceId)}/>})}</section>
    <DeployableField battle={battle} events={events}/>
    <section className="battle-hud">{entrance?<div className="actor-ticket"><span>ENCOUNTER</span><h2>Take your places.</h2></div>:isResolving&&action?.side==='enemy'&&presentedActor?<div className="actor-ticket enemy-thinking enemy-action-ticket" aria-live="polite"><span>ENEMY</span><h2>{presentedActor.displayName}</h2><b className="enemy-move">{action.label}</b>{enemyTargetNames&&<span className="enemy-action-target">TARGET → {enemyTargetNames}{drawnByTaunt?' · DRAWN BY TAUNT':''}</span>}</div>:actor&&actor.side==='ally'?<><div className="actor-ticket" style={charAccentStyle(getCharacter(actor.sourceId))}><span>CURRENT</span><h2>{actor.displayName}</h2><AffinityMark affinity={actor.affinity}/><StatusStrip statuses={actor.statuses} effects={battle.effects.filter(effect=>effect.targetUnitId===actor.id)}/>{mechanicBadges(actor,battle).map(badge=><b className="mechanic-counter" key={badge}>{badge}</b>)}{actor.sourceId==='yatords'&&<b className="mechanic-counter">MOMENTUM {Number(actor.flags.momentum??0)}/3</b>}{actor.sourceId==='hans'&&<b className="mechanic-counter">DEPLOYS {battle.deployables.filter(d=>d.ownerId===actor.id).length}/2</b>}</div></>:<div className="actor-ticket enemy-thinking"><span>ENEMY TURN</span><h2>Watch the table.</h2></div>}</section>
    <section className={`action-tray ${isResolving?'locked':''}`} aria-busy={isResolving}>
      <div className="action-tabs"><button className={tray==='skills'?'selected':''} onClick={()=>{setTray('skills');setSelectedItem(null)}} disabled={isResolving}>SKILLS</button><button className={tray==='items'?'selected':''} onClick={()=>{setTray('items');setSelectedSkill(null)}} disabled={isResolving}>ITEMS</button><button className="guard-button" onClick={()=>actor&&void guard(actor.id)} disabled={isResolving||actor?.side!=='ally'}>GUARD <small>NO PP · -40% DMG</small></button></div>
      {tray==='skills'&&<div className="skill-grid">{availability.map((entry,index)=>{const pp=actor?.abilityPP?.[entry.ability.id]??0;const selected=selectedSkill?.id===entry.ability.id;return <div className={`skill-slot ${selected?'selected':''}`} key={entry.ability.id}><button className="skill-main" disabled={isResolving||!entry.legal} aria-pressed={selected} onClick={()=>{setSelectedItem(null);setSelectedSkill(selected?null:entry.ability)}}><span className="keycap">{index+1}</span><strong>{entry.ability.name}{actor?.upgradedAbilities?.includes(entry.ability.id)?'+':''}</strong><AffinityMark affinity={entry.ability.affinity} small/><span className="pp-count">PP <b>{pp}</b>/{maxPp(entry.ability)}</span><small>{entry.ability.id==='double-down'?'60%: 110 power · 40%: 55 + 12% Max HP cost':entry.ability.description}</small>{!entry.legal&&<em>{entry.reason}</em>}</button><button className="skill-info" onClick={()=>openMove(entry.ability.id)} aria-label={`Info about ${entry.ability.name}`}>i</button></div>})}</div>}
      {tray==='items'&&<div className="item-tray">{items.length?items.map(entry=>{const legality=itemLegality(entry.definition);const reason=legality.legal?null:(legality.reason??'Unavailable right now.').toUpperCase();const selected=selectedItem?.id===entry.itemId;return <div className={`item-slot rarity-${entry.definition.rarity}`} key={entry.itemId}><button className="item-main" disabled={isResolving||Boolean(reason)} aria-pressed={selected} onClick={()=>{setSelectedSkill(null);setSelectedItem(selected?null:entry.definition)}}><strong>{entry.definition.name} ×{entry.quantity}</strong><span className="rarity-stamp">{entry.definition.rarity.toUpperCase()}</span><small>{entry.definition.description}</small>{reason&&<em>{reason}</em>}</button><button className="item-info" onClick={()=>openItem(entry.itemId)} aria-label={`Info about ${entry.definition.name}`}>i</button></div>}):<p>Your pack is empty. Guard is always available.</p>}</div>}
      {groupPpPreviews.length>0&&<div className="battle-item-preview" aria-live="polite"><strong>PP PREVIEW</strong>{groupPpPreviews.map(entry=><span key={entry.unit.id}>{entry.unit.displayName}: {getAbility(entry.preview!.abilityId).name} {entry.preview!.before} → {entry.preview!.after}</span>)}</div>}
      {selectedMode&&!oneTarget(selectedMode)&&<div className="confirm-action"><span>{targetInstruction}</span><PaperButton variant="ink" disabled={isResolving} onClick={submitAuto}>CONFIRM USE</PaperButton><PaperButton variant="quiet" onClick={()=>{setSelectedSkill(null);setSelectedItem(null)}}>CANCEL</PaperButton></div>}
      {selectedMode&&oneTarget(selectedMode)&&<div className="target-hint" aria-live="polite">{targetInstruction} <button onClick={()=>{setSelectedSkill(null);setSelectedItem(null)}}>CANCEL</button></div>}
      {isResolving&&<div className="input-lock"><span className="resolving-bar"/>INPUT LOCKED · {director.index+1}/{Math.max(1,director.beats.length)} ACTION BEATS</div>}
    </section>
  </main>;
}
