import { useEffect, useMemo, useState } from 'react';
import type { CombatEvent, SettingsState } from '../../game/core/types';

export interface CombatBeat {
  phase:'announce'|'resolve';
  events:CombatEvent[];
  action?:Extract<CombatEvent,{type:'actionStart'}>;
  chained?:boolean;
}

export function buildCombatBeats(events:CombatEvent[]):CombatBeat[]{
  const beats:CombatBeat[]=[];
  let current:CombatBeat|undefined;
  for(const event of events){
    if(event.type==='actionStart'){
      beats.push({phase:'announce',events:[event],action:event});
      current={phase:'resolve',events:[],action:event};
      beats.push(current);
      continue;
    }
    // Every landed blow gets its own beat, so a multi-hit move drains HP one hit at a time.
    if(event.type==='hit'&&current?.events.some(prior=>prior.type==='damage')){
      current={phase:'resolve',events:[],action:current.action,chained:true};
      beats.push(current);
    }
    if(!current){current={phase:'resolve',events:[]};beats.push(current);}
    current.events.push(event);
  }
  return beats.filter(beat=>beat.phase==='announce'||beat.events.length>0);
}

/** HP for every unit as of the end of `index`, so the bars drain with the presentation instead of ahead of it. */
export function hpAtBeat(startHp:Record<string,number>,beats:CombatBeat[],index:number):Record<string,number>{
  const hp={...startHp};
  for(let at=0;at<=index&&at<beats.length;at+=1)for(const event of beats[at].events){
    if(event.type==='damage')hp[event.targetId]=Math.max(0,(hp[event.targetId]??0)-event.amount);
    else if(event.type==='heal')hp[event.targetId]=(hp[event.targetId]??0)+event.amount;
  }
  return hp;
}

export function combatBeatDuration(beat:CombatBeat,settings:Pick<SettingsState,'animationSpeed'|'reducedMotion'>):number{
  if(beat.phase==='announce'){
    const announceBase=beat.action?.side==='enemy'?340:210;
    return settings.reducedMotion?Math.max(70,Math.round(announceBase*.45/settings.animationSpeed)):Math.round(announceBase/settings.animationSpeed);
  }
  if(settings.reducedMotion)return Math.max(90,Math.round(220/settings.animationSpeed));
  if(beat.chained)return Math.round(215/settings.animationSpeed);
  const impacts=beat.events.filter(event=>['damage','heal','statusApplied','summon','deployableTrigger','revive','bossPhase'].includes(event.type)).length;
  return Math.round((410+Math.min(340,impacts*85))/settings.animationSpeed);
}

export function combatPresentationDuration(events:CombatEvent[],settings:Pick<SettingsState,'animationSpeed'|'reducedMotion'>):number{
  const beats=buildCombatBeats(events);return Math.max(80,beats.reduce((sum,beat)=>sum+combatBeatDuration(beat,settings),0));
}

export function useCombatDirector(events:CombatEvent[],pulse:number,settings:Pick<SettingsState,'animationSpeed'|'reducedMotion'>){
  const beats=useMemo(()=>buildCombatBeats(events),[events,pulse]);const[index,setIndex]=useState(Math.max(0,beats.length-1));
  useEffect(()=>{if(!beats.length){setIndex(0);return;}setIndex(0);let cancelled=false;let timer:number|undefined;const advance=(at:number)=>{if(cancelled||at>=beats.length-1)return;timer=window.setTimeout(()=>{if(cancelled)return;setIndex(at+1);advance(at+1);},combatBeatDuration(beats[at],settings));};advance(0);return()=>{cancelled=true;if(timer)window.clearTimeout(timer);};},[pulse,beats.length,settings.animationSpeed,settings.reducedMotion]);
  const beat=beats[Math.min(index,Math.max(0,beats.length-1))];return{beats,index,beat,phase:beat?.phase,events:beat?.events??[],action:beat?.action,isPlaying:beats.length>0&&index<beats.length-1};
}
