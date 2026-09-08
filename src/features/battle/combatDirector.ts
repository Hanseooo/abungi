import { useEffect, useMemo, useState } from 'react';
import type { CombatEvent, SettingsState } from '../../game/core/types';

export interface CombatBeat {
  phase:'announce'|'resolve';
  events:CombatEvent[];
  action?:Extract<CombatEvent,{type:'actionStart'}>;
  targetIds:string[];
  chained?:boolean;
}

export function buildCombatBeats(events:CombatEvent[]):CombatBeat[]{
  const beats:CombatBeat[]=[];
  let current:CombatBeat|undefined;
  let announcement:CombatBeat|undefined;
  for(const event of events){
    if(event.type==='actionStart'){
      const targetIds:string[]=[];
      announcement={phase:'announce',events:[event],action:event,targetIds};
      beats.push(announcement);
      current={phase:'resolve',events:[],action:event,targetIds};
      beats.push(current);
      continue;
    }
    if('targetId' in event&&announcement&&!announcement.targetIds.includes(event.targetId))announcement.targetIds.push(event.targetId);
    // Every landed blow gets its own beat, so a multi-hit move drains HP one hit at a time.
    if(event.type==='hit'&&current?.events.some(prior=>prior.type==='damage')){
      current={phase:'resolve',events:[],action:current.action,targetIds:current.targetIds,chained:true};
      beats.push(current);
    }
    if(!current){current={phase:'resolve',events:[],targetIds:[]};beats.push(current);}
    current.events.push(event);
  }
  return beats.filter(beat=>beat.phase==='announce'||beat.events.length>0);
}

/** HP for every unit as of the end of `index`, so the bars drain with the presentation instead of ahead of it. */
export function hpAtBeat(startHp:Record<string,number>,beats:CombatBeat[],index:number):Record<string,number>{
  const hp={...startHp};
  for(let at=0;at<=index&&at<beats.length;at+=1)for(const event of beats[at].events){
    if(event.type==='damage')hp[event.targetId]=Math.max(0,(hp[event.targetId]??0)-event.amount);
    else if(event.type==='transfer')hp[event.toId]=Math.max(0,(hp[event.toId]??0)-event.amount);
    else if(event.type==='heal')hp[event.targetId]=(hp[event.targetId]??0)+event.amount;
  }
  return hp;
}

/** Reconstruct pre-action HP from the resolved state, then reveal only the current presentation beat. */
export function presentedHpAtBeat(finalHp:Record<string,number>,beats:CombatBeat[],index:number):Record<string,number>{
  const startHp={...finalHp};
  for(let at=beats.length-1;at>=0;at-=1)for(let eventIndex=beats[at].events.length-1;eventIndex>=0;eventIndex-=1){
    const event=beats[at].events[eventIndex];
    if(event.type==='damage')startHp[event.targetId]=(startHp[event.targetId]??0)+event.amount;
    else if(event.type==='transfer')startHp[event.toId]=(startHp[event.toId]??0)+event.amount;
    else if(event.type==='heal')startHp[event.targetId]=Math.max(0,(startHp[event.targetId]??0)-event.amount);
  }
  return hpAtBeat(startHp,beats,index);
}

export function combatBeatDuration(beat:CombatBeat,settings:Pick<SettingsState,'animationSpeed'|'reducedMotion'>):number{
  if(beat.phase==='announce'){
    const enemyAction=beat.action?.side==='enemy';
    const announceBase=enemyAction?640:260;
    if(settings.reducedMotion)return Math.max(enemyAction?180:70,Math.round(announceBase*.45/settings.animationSpeed));
    return Math.round(announceBase*combatPacing(beat)/settings.animationSpeed);
  }
  if(settings.reducedMotion)return Math.max(90,Math.round(220/settings.animationSpeed));
  if(beat.chained)return Math.round(215*combatPacing(beat)/settings.animationSpeed);
  const impacts=beat.events.filter(event=>['damage','heal','statusApplied','summon','deployableTrigger','revive','bossPhase','transfer','prevented','effectApplied'].includes(event.type)).length;
  return Math.round((410+Math.min(340,impacts*85))*combatPacing(beat)/settings.animationSpeed);
}

function combatPacing(beat:CombatBeat):number{
  switch(beat.action?.choreography){
    case 'melee':
    case 'ranged': return 1.25;
    case 'heavy':
    case 'explosive': return 1.32;
    case 'smoke':
    case 'mystic':
    case 'drain':
    case 'buff':
    case 'defense':
    case 'summon': return 1.3;
    default: return 1.28;
  }
}

export function combatPresentationDuration(events:CombatEvent[],settings:Pick<SettingsState,'animationSpeed'|'reducedMotion'>):number{
  const beats=buildCombatBeats(events);return Math.max(80,beats.reduce((sum,beat)=>sum+combatBeatDuration(beat,settings),0));
}

export function useCombatDirector(events:CombatEvent[],pulse:number,settings:Pick<SettingsState,'animationSpeed'|'reducedMotion'>){
  const beats=useMemo(()=>buildCombatBeats(events),[events,pulse]);const[cursor,setCursor]=useState({pulse,index:Math.max(0,beats.length-1)});const index=cursor.pulse===pulse?cursor.index:0;
  useEffect(()=>{if(!beats.length){setCursor({pulse,index:0});return;}setCursor({pulse,index:0});let cancelled=false;let timer:number|undefined;const advance=(at:number)=>{if(cancelled||at>=beats.length-1)return;timer=window.setTimeout(()=>{if(cancelled)return;setCursor({pulse,index:at+1});advance(at+1);},combatBeatDuration(beats[at],settings));};advance(0);return()=>{cancelled=true;if(timer)window.clearTimeout(timer);};},[pulse,beats.length,settings.animationSpeed,settings.reducedMotion]);
  const beat=beats[Math.min(index,Math.max(0,beats.length-1))];return{beats,index,beat,phase:beat?.phase,events:beat?.events??[],action:beat?.action,isPlaying:beats.length>0&&index<beats.length-1};
}
