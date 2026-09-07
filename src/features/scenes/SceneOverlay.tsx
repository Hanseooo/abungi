import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../app/appStore';
import { getCharacter } from '../../game/content/characters';
import { CutoutArt } from '../../ui/components/CutoutArt';

interface SceneFigure { assetId:string; name:string; role:'focus'|'companion'|'party' }

export function SceneOverlay(){
  const scene=useAppStore(s=>s.sceneQueue[0]);
  const run=useAppStore(s=>s.run);
  const dismiss=useAppStore(s=>s.dismissScene);
  const reduced=useAppStore(s=>s.settings.reducedMotion);
  const[index,setIndex]=useState(0);
  useEffect(()=>setIndex(0),[scene?.id,scene?.sceneId]);
  useEffect(()=>{if(!scene)return;const key=(event:KeyboardEvent)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();if(index<scene.lines.length-1)setIndex(value=>value+1);else dismiss();}if(event.key==='Escape')dismiss();};addEventListener('keydown',key);return()=>removeEventListener('keydown',key);},[scene,index,dismiss]);
  const figures=useMemo<SceneFigure[]>(()=>{
    if(!scene)return [];
    const list:SceneFigure[]=[];
    if(scene.companionAssetId){
      const id=scene.companionAssetId.replace(/^character-/,'');
      const character=getCharacter(id);
      list.push({assetId:scene.companionAssetId,name:character.displayName,role:'companion'});
    }
    if(scene.focusAssetId)list.push({assetId:scene.focusAssetId,name:scene.title,role:'focus'});
    if(!list.length && run && ['party-departure','region-1-intro','region-2-intro','region-3-intro','region-complete','run-victory'].includes(scene.sceneId)){
      for(const member of run.party){const character=getCharacter(member.characterId);list.push({assetId:character.assetId,name:character.displayName,role:'party'});}
    }
    return list;
  },[scene,run?.id]);
  if(!scene)return null;const line=scene.lines[index];
  return <div className={`scene-overlay ${reduced?'reduced-motion':''} scene-${scene.sceneId} ${scene.theme?`scene-theme-${scene.theme}`:''}`} role="dialog" aria-modal="true" aria-label={scene.title}>
    <div className="scene-curtain left"/><div className="scene-curtain right"/>
    <section className="scene-stage">
      <div className="scene-backdrop-art" aria-hidden="true"><i className="scene-layer layer-back"/><i className="scene-layer layer-mid"/><i className="scene-layer layer-front"/></div>
      {figures.length>0&&<div className={`scene-figures count-${figures.length}`} aria-hidden="true">{figures.map((figure,figureIndex)=><div className={`scene-figure scene-figure-${figure.role}`} key={`${figure.assetId}:${figureIndex}`}><CutoutArt assetId={figure.assetId} name={figure.name}/><i className="scene-figure-shadow"/></div>)}</div>}
      <header><span>{scene.kicker}</span><h2>{scene.title}</h2></header>
      <div className="scene-dialogue"><strong>{line.speaker}</strong><p>{line.text}</p><small>{index+1}/{scene.lines.length}</small></div>
      <div className="scene-controls"><button className="scene-skip" onClick={dismiss}>SKIP</button><button className="scene-continue" onClick={()=>index<scene.lines.length-1?setIndex(value=>value+1):dismiss()}>{index<scene.lines.length-1?'NEXT':'CONTINUE'}</button></div>
    </section>
  </div>;
}
