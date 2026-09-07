import type { CSSProperties } from 'react';
import { useAppStore } from '../../app/appStore';
import { availableRouteNodes } from '../../game/core/progression/route';
import type { NodeType } from '../../game/core/types';
import { GameHeader } from '../../ui/components/GameHeader';
import { PaperButton } from '../../ui/components/PaperButton';
import { getCharacter } from '../../game/content/characters';
import { Meter } from '../../ui/components/Meter';
import { regionBackgroundUrl } from '../../services/assets/assetRegistry';
const label:Record<NodeType,string>={battle:'FIGHT',elite:'ELITE',rest:'REST',shop:'SHOP',event:'EVENT',boss:'BOSS'};
export function RouteScreen(){const run=useAppStore(s=>s.run)!;const select=useAppStore(s=>s.selectNode);const notice=useAppStore(s=>s.notice);const error=useAppStore(s=>s.error);const abandon=useAppStore(s=>s.abandonRun);
 const last=run.currentNodeId&&run.completedNodeIds.includes(run.currentNodeId)?run.currentNodeId:null;const available=new Set(availableRouteNodes(run.route,last,run.completedNodeIds).map(n=>n.id));const stages=[...new Set(run.route.nodes.map(n=>n.stage))];
 return <main className="screen route-screen" style={{'--region-bg':`url(${regionBackgroundUrl(run.regionIndex)})`} as CSSProperties}><GameHeader title={`Region ${run.regionIndex+1}`} subtitle="Choose your path. HP and PP carry forward; enemies never reveal their next move."/>
  <section className="route-party-strip">{run.party.map(p=>{const c=getCharacter(p.characterId);return <div className={`route-party-member ${p.hp<=0?'ko':''}`} key={p.characterId}><strong>{c.displayName}</strong><Meter value={p.hp} max={c.stats.maxHp} label={`${c.displayName} HP`}/><small>{Object.values(p.abilityPP).reduce((a,b)=>a+b,0)} total PP</small></div>})}</section>
  {notice&&<p className="paper-notice">{notice}</p>}{error&&<p className="inline-error" role="alert">{error}</p>}
  <section className="route-map" aria-label="Branching route">{stages.map(stage=><div className="route-stage" key={stage}><span className="stage-index">{stage===stages.at(-1)?'END':String(stage+1).padStart(2,'0')}</span><div className="route-lanes">{run.route.nodes.filter(n=>n.stage===stage).map(node=>{const done=run.completedNodeIds.includes(node.id);const active=available.has(node.id);return <button key={node.id} disabled={!active} onClick={()=>void select(node.id)} className={`route-node node-${node.type} ${done?'done':''} ${active?'reachable':''}`}><span className="node-mark" aria-hidden="true"/><b>{label[node.type]}</b><small>{done?'CLEARED':active?'AVAILABLE':'LOCKED'}</small></button>})}</div></div>)}</section>
  <aside className="route-legend"><span><i className="legend-fight"/>Combat</span><span><i className="legend-recovery"/>Recovery/economy</span><span><i className="legend-event"/>Unknown event</span></aside>
  <footer className="route-footer"><PaperButton variant="danger" onClick={()=>void abandon()}>ABANDON RUN</PaperButton></footer>
 </main>}
