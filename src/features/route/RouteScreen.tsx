import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react';
import { useAppStore, inventoryItems } from '../../app/appStore';
import { availableRouteNodes } from '../../game/core/progression/route';
import { fieldAccess, fieldUseLimit, previewFieldItem, type FieldItemCommand, type FieldItemPreview } from '../../game/core/progression/fieldItems';
import type { NodeType, RunState } from '../../game/core/types';
import { GameHeader } from '../../ui/components/GameHeader';
import { PaperButton } from '../../ui/components/PaperButton';
import { getAbility, getCharacter } from '../../game/content/characters';
import { Meter } from '../../ui/components/Meter';
import { regionBackgroundUrl } from '../../services/assets/assetRegistry';
import { inventoryCapacity, inventoryCount } from '../../game/core/progression/inventory';

const label:Record<NodeType,string>={battle:'FIGHT',elite:'ELITE',rest:'REST',shop:'SHOP',event:'EVENT',boss:'BOSS'};

function RecoveryPreview({run,preview,itemName}:{run:RunState;preview:FieldItemPreview;itemName:string}){
  if(!preview.legal)return <p className="field-preview-reason" role="alert">{preview.reason}</p>;
  return <section className="field-preview" aria-live="polite">
    <h3>PREVIEW</h3>
    {preview.changes.map(change=>{const member=run.party.find(candidate=>candidate.characterId===change.characterId);if(!member)return null;const character=getCharacter(member.characterId);return <article className="field-change" key={change.characterId}>
      <strong>{character.displayName}</strong>
      {change.hpBefore!==change.hpAfter&&<span>HP {change.hpBefore} → {change.hpAfter} ({change.hpAfter-change.hpBefore>0?'+':''}{change.hpAfter-change.hpBefore})</span>}
      {change.pp.map(pp=><span key={pp.abilityId}>{getAbility(pp.abilityId).name} PP {pp.before} → {pp.after} (+{pp.after-pp.before})</span>)}
    </article>;})}
    <p className="field-preview-cost"><strong>COST · 1 {itemName}</strong><span>FIELD ACTION COST · 1 use</span></p>
  </section>;
}

export function RouteScreen(){
  const run=useAppStore(s=>s.run)!;const select=useAppStore(s=>s.selectNode);const notice=useAppStore(s=>s.notice);const error=useAppStore(s=>s.error);const abandon=useAppStore(s=>s.abandonRun);const isResolving=useAppStore(s=>s.isResolving);const scenePending=useAppStore(s=>s.sceneQueue.length>0);const useFieldItem=useAppStore(s=>s.useFieldItem);const discardItem=useAppStore(s=>s.discardItem);
  const [inventoryOpen,setInventoryOpen]=useState(false);const [selection,setSelection]=useState<FieldItemCommand|null>(null);const [discardingItemId,setDiscardingItemId]=useState<string|null>(null);const [pendingNodeId,setPendingNodeId]=useState<string|null>(null);const dialogRef=useRef<HTMLDialogElement>(null);
  const items=inventoryItems(run);const access=fieldAccess(run);const limit=fieldUseLimit(run);const remaining=run.fieldUsesSpent===null?null:Math.max(0,limit-run.fieldUsesSpent);const used=inventoryCount(run);const capacity=inventoryCapacity(run);
  const selectedItem=selection?items.find(entry=>entry.itemId===selection.itemId):undefined;const preview=selection?previewFieldItem(run,selection):null;const selectedIsSingle=selectedItem?.definition.target==='ally-one';
  const accessMessage=run.fieldUsesSpent===null?'Available after your first node.':remaining===0?'No field uses left. Complete another node.':access.reason??'Field recovery is available.';
  const openInventory=()=>{if(isResolving||scenePending)return;setSelection(null);setDiscardingItemId(null);setInventoryOpen(true);};
  const closeInventory=()=>{if(useAppStore.getState().isResolving)return;setInventoryOpen(false);setSelection(null);setDiscardingItemId(null);window.requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('[data-field-inventory-trigger]')?.focus());};
  const cancelDialog=(event:SyntheticEvent<HTMLDialogElement>)=>{event.preventDefault();closeInventory();};
  useEffect(()=>{const dialog=dialogRef.current;if(!dialog)return;if(inventoryOpen){if(!dialog.open)dialog.showModal();window.requestAnimationFrame(()=>{const initial=dialog.querySelector<HTMLButtonElement>('.field-item-select:not(:disabled)')??dialog.querySelector<HTMLButtonElement>('[data-dialog-close]');initial?.focus();});}else if(dialog.open)dialog.close();},[inventoryOpen]);
  const selectItem=(itemId:string,quantity:number)=>{if(isResolving||!access.legal)return;setDiscardingItemId(null);setSelection({itemId,expected:{runId:run.id,regionIndex:run.regionIndex,currentNodeId:run.currentNodeId,fieldUsesSpent:run.fieldUsesSpent,inventoryCount:quantity}});};
  const selectTarget=(targetId:string)=>setSelection(current=>current?{...current,targetId}:null);
  const confirmUse=async()=>{if(!selection||!preview?.legal||isResolving)return;const spentBefore=run.fieldUsesSpent;await useFieldItem(selection);const after=useAppStore.getState().run;if(after&&after.fieldUsesSpent!==spentBefore)closeInventory();};
  const confirmDiscard=async()=>{if(!discardingItemId||isResolving)return;const entry=run.inventory.find(item=>item.itemId===discardingItemId);if(!entry)return;const expected=entry.quantity;await discardItem(discardingItemId,expected);const after=useAppStore.getState().run;const stillThere=after?.inventory.find(item=>item.itemId===discardingItemId);if(!stillThere||stillThere.quantity!==expected)setDiscardingItemId(null);};
  const last=run.currentNodeId&&run.completedNodeIds.includes(run.currentNodeId)?run.currentNodeId:null;const available=new Set(availableRouteNodes(run.route,last,run.completedNodeIds).map(n=>n.id));const pendingNode=pendingNodeId&&available.has(pendingNodeId)?run.route.nodes.find(node=>node.id===pendingNodeId):undefined;const stages=[...new Set(run.route.nodes.map(n=>n.stage))];
  return <main className="screen route-screen" style={{'--region-bg':`url(${regionBackgroundUrl(run.regionIndex)})`} as CSSProperties}><GameHeader title={`Region ${run.regionIndex+1}`} subtitle="Choose your path. HP and PP carry forward; enemies never reveal their next move."/>
    <section className="route-party-strip" aria-label="Party status">{run.party.map(p=>{const c=getCharacter(p.characterId);return <div className={`route-party-member ${p.hp<=0?'ko':''}`} key={p.characterId}><strong>{c.displayName}</strong><Meter value={p.hp} max={c.stats.maxHp} label={`${c.displayName} HP`}/><small>{Object.values(p.abilityPP).reduce((a,b)=>a+b,0)} total PP</small></div>})}</section>
    <section className="route-resource-bar" aria-label="Run resources"><div><span>FIELD USE</span><strong>{remaining===null?'—':`${remaining}/${limit}`}</strong></div><div><span>PACK</span><strong>{used}/{capacity}</strong></div><PaperButton variant="ink" disabled={isResolving||scenePending} data-field-inventory-trigger aria-haspopup="dialog" onClick={openInventory}>INVENTORY</PaperButton></section>
    {run.fieldUsesSpent===null&&<p className="route-recovery-note">Available after your first node.</p>}{run.fieldUsesSpent!==null&&remaining===0&&<p className="route-recovery-note">No field uses left. Complete another node.</p>}
    {notice&&<p className="paper-notice">{notice}</p>}{error&&<p className="inline-error" role="alert">{error}</p>}
    <section className="route-map" aria-label="Branching route">{stages.map(stage=>{const stageNodes=run.route.nodes.filter(node=>node.stage===stage);const isChoice=stageNodes.filter(node=>available.has(node.id)).length>1;return <div className="route-stage" key={stage}><span className="stage-index">{stage===stages.at(-1)?'END':String(stage+1).padStart(2,'0')}</span><div className="route-lanes">{isChoice&&<div className="route-choice-guide"><strong>CHOOSE ONE</strong><span>Pick a node to continue. The other route will be skipped.</span></div>}{stageNodes.map(node=>{const done=run.completedNodeIds.includes(node.id);const active=available.has(node.id);const selected=pendingNodeId===node.id;const willSkip=Boolean(pendingNode&&active&&!selected);return <button key={node.id} disabled={!active||isResolving||scenePending} aria-pressed={selected} onClick={()=>setPendingNodeId(node.id)} className={`route-node node-${node.type} ${done?'done':''} ${active?'reachable':''} ${selected?'route-choice-selected':''} ${willSkip?'will-skip':''}`}><span className="node-mark" aria-hidden="true"/><b>{label[node.type]}</b><small>{done?'CLEARED':selected?'SELECTED':willSkip?'WILL SKIP':active?'AVAILABLE':'LOCKED'}</small></button>})}</div></div>})}</section>
    {pendingNode&&<section className="route-choice-confirm" aria-live="polite"><p><strong>{label[pendingNode.type]} SELECTED.</strong> Entering this node skips the other route.</p><div><PaperButton variant="ink" disabled={isResolving||scenePending} onClick={()=>void select(pendingNode.id)}>ENTER {label[pendingNode.type]}</PaperButton><PaperButton variant="quiet" disabled={isResolving||scenePending} onClick={()=>setPendingNodeId(null)}>CHANGE CHOICE</PaperButton></div></section>}
    <aside className="route-legend"><span><i className="legend-fight"/>Combat</span><span><i className="legend-recovery"/>Recovery/economy</span><span><i className="legend-event"/>Unknown event</span></aside>
    <footer className="route-footer"><PaperButton variant="danger" disabled={isResolving} onClick={()=>void abandon()}>ABANDON RUN</PaperButton></footer>

    <dialog ref={dialogRef} className="field-inventory-dialog" aria-labelledby="field-inventory-title" onCancel={cancelDialog}>
      <section className="overlay-paper field-inventory-panel">
        <header className="overlay-heading"><span className="tape-label">ROUTE INVENTORY</span><h2 id="field-inventory-title">Field Inventory</h2><p>Inspect every item, choose a target, and preview the exact result before spending it.</p></header>
        <div className="field-inventory-scroll">
          <div className="field-dialog-status"><span>FIELD USE · {remaining===null?'—':`${remaining}/${limit}`}</span><span>PACK · {used}/{capacity}</span></div>
          {!access.legal&&<p className="field-access-note">{accessMessage}</p>}
          {items.length===0?<p className="field-empty">Your pack is empty. There are no items to use or discard.</p>:<div className="field-item-list">{items.map(entry=>{const item=entry.definition;const fieldReason=!item.fieldCompatible?'BATTLE ONLY · Use this item during a fight.':!access.legal?accessMessage:null;const selected=selection?.itemId===entry.itemId;return <article className={`field-item-card rarity-${item.rarity} ${selected?'selected':''}`} key={entry.itemId}>
            <div className="field-item-heading"><strong>{item.name} ×{entry.quantity}</strong><span className="rarity-stamp">{item.rarity.toUpperCase()}</span></div><p>{item.description}</p><div className="field-item-actions"><button type="button" className="field-item-select" disabled={isResolving||Boolean(fieldReason)} aria-pressed={selected} onClick={()=>selectItem(entry.itemId,entry.quantity)}>SELECT ITEM</button><button type="button" className="field-item-discard" disabled={isResolving} aria-label={`Discard one ${item.name}`} onClick={()=>{setSelection(null);setDiscardingItemId(entry.itemId);}}>DISCARD</button></div>{fieldReason&&<small className="field-item-reason">{fieldReason}</small>}
            {discardingItemId===entry.itemId&&<div className="field-discard-confirm" role="alert"><p>Discard one {item.name}?</p><div><PaperButton variant="danger" disabled={isResolving} onClick={()=>void confirmDiscard()}>CONFIRM DISCARD</PaperButton><PaperButton variant="quiet" disabled={isResolving} onClick={()=>setDiscardingItemId(null)}>CANCEL</PaperButton></div></div>}
          </article>;})}</div>}
          {items.length>0&&access.legal&&!selection&&!discardingItemId&&<p className="field-selection-hint">Choose an item to preview its effect.</p>}
          {selectedItem&&selectedIsSingle&&<section className="field-target-section" aria-label="Select an ally"><h3>Choose an ally</h3><div className="field-ally-list">{run.party.map(member=>{const character=getCharacter(member.characterId);const candidate=selection?previewFieldItem(run,{...selection,targetId:member.characterId}):{legal:false,changes:[]};return <button type="button" className="field-ally-target" key={member.characterId} disabled={isResolving||!candidate.legal} aria-pressed={selection?.targetId===member.characterId} onClick={()=>selectTarget(member.characterId)}><strong>{character.displayName}</strong><span>{member.hp}/{character.stats.maxHp} HP</span>{candidate.legal?<small>AVAILABLE</small>:<small>{candidate.reason??'No effect'}</small>}</button>;})}</div></section>}
          {selectedItem&&<RecoveryPreview run={run} preview={preview??{legal:false,reason:'Choose an item.',changes:[]}} itemName={selectedItem.definition.name}/>} 
        </div>
        <footer className="overlay-actions field-dialog-actions"><PaperButton variant="ink" disabled={isResolving||!selection||!preview?.legal} onClick={()=>void confirmUse()}>CONFIRM USE</PaperButton><PaperButton variant="quiet" disabled={isResolving||(!selection&&!discardingItemId)} onClick={()=>{setSelection(null);setDiscardingItemId(null);}}>CLEAR SELECTION</PaperButton><PaperButton variant="quiet" disabled={isResolving} data-dialog-close onClick={closeInventory}>CLOSE INVENTORY</PaperButton></footer>
      </section>
    </dialog>
  </main>;
}
