import { useEffect, useMemo, useState } from 'react';
import type { CombatEvent, SettingsState } from '../../game/core/types';

export interface CombatBeat {
  phase:'announce'|'resolve';
  events:CombatEvent[];
  action?:Extract<CombatEvent,{type:'actionStart'}>;
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
    if(!current){current={phase:'resolve',events:[]};beats.push(current);}
    current.events.push(event);
  }
  return beats.filter(beat=>beat.phase==='announce'||beat.events.length>0);
}

export function combatBeatDuration(beat:CombatBeat,settings:Pick<SettingsState,'animationSpeed'|'reducedMotion'>):number{
  if(beat.phase==='announce'){
    const announceBase=beat.action?.side==='enemy'?340:210;
    return settings.reducedMotion?Math.max(70,Math.round(announceBase*.45/settings.animationSpeed)):Math.round(announceBase/settings.animationSpeed);
  }
  if(settings.reducedMotion)return Math.max(90,Math.round(220/settings.animationSpeed));
  const impacts=beat.events.filter(event=>['damage','heal','statusApplied','summon','deployableTrigger','revive','bossPhase'].includes(event.type)).length;
  const multi=beat.events.filter(event=>event.type==='damage').length;
  return Math.round((410+Math.min(340,impacts*85)+Math.min(180,Math.max(0,multi-1)*60))/settings.animationSpeed);
}

export function combatPresentationDuration(events:CombatEvent[],settings:Pick<SettingsState,'animationSpeed'|'reducedMotion'>):number{
  const beats=buildCombatBeats(events);return Math.max(80,beats.reduce((sum,beat)=>sum+combatBeatDuration(beat,settings),0));
}

export function useCombatDirector(events:CombatEvent[],pulse:number,settings:Pick<SettingsState,'animationSpeed'|'reducedMotion'>){
  const beats=useMemo(()=>buildCombatBeats(events),[events,pulse]);const[index,setIndex]=useState(Math.max(0,beats.length-1));
  useEffect(()=>{if(!beats.length){setIndex(0);return;}setIndex(0);let cancelled=false;let timer:number|undefined;const advance=(at:number)=>{if(cancelled||at>=beats.length-1)return;timer=window.setTimeout(()=>{if(cancelled)return;setIndex(at+1);advance(at+1);},combatBeatDuration(beats[at],settings));};advance(0);return()=>{cancelled=true;if(timer)window.clearTimeout(timer);};},[pulse,beats.length,settings.animationSpeed,settings.reducedMotion]);
  const beat=beats[Math.min(index,Math.max(0,beats.length-1))];return{beats,index,beat,phase:beat?.phase,events:beat?.events??[],action:beat?.action,isPlaying:beats.length>0&&index<beats.length-1};
}
