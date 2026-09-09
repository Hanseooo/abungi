import { useState } from 'react';
import { useAppStore } from '../../app/appStore';
import { GameHeader } from '../../ui/components/GameHeader';
import { PaperButton } from '../../ui/components/PaperButton';
import { getAbility, getCharacter } from '../../game/content/characters';
import { previewRestChoice, type RestChoice } from '../../game/core/progression/rest';
import type { RecoveryChange } from '../../game/core/progression/fieldItems';
import type { RunState } from '../../game/core/types';

function RestMemberPreview({run,memberId,change}:{run:RunState;memberId:string;change:RecoveryChange|undefined}){
  const member=run.party.find(candidate=>candidate.characterId===memberId)!;const character=getCharacter(member.characterId);
  return <article className="rest-change" key={member.characterId}><strong>{character.displayName}</strong><span>HP {member.hp} → {change?.hpAfter??member.hp} ({(change?.hpAfter??member.hp)-member.hp>0?'+':''}{(change?.hpAfter??member.hp)-member.hp})</span><ul>{character.abilities.map(id=>{const ability=getAbility(id);const pp=change?.pp.find(entry=>entry.abilityId===id);const after=pp?.after??member.abilityPP[id];return <li key={id}><span>{ability.name}</span><strong>PP {member.abilityPP[id]} → {after} (+{after-member.abilityPP[id]})</strong></li>;})}</ul></article>;
}

function RestChoiceCard({run,choice,preview,disabled,onChoose}:{run:RunState;choice:RestChoice;preview:ReturnType<typeof previewRestChoice>;disabled:boolean;onChoose:()=>void}){
  const title=choice==='recover'?'Recover':'Refresh';
  return <button className={`rest-choice-card ${choice}`} disabled={disabled||!preview.legal} onClick={onChoose}>
    <span className={`rest-symbol ${choice==='recover'?'recover-symbol':'refresh-symbol'}`}/><h2>{title}</h2><p>{choice==='recover'?'Restore 35% Max HP to living allies. KO allies return at 10% Max HP.':'Restore 30% of missing PP across every move. Rounding happens once per move.'}</p>
    {choice==='refresh'&&<p className="rest-warning">Refresh leaves KO allies KO.</p>}
    {preview.legal?<section className="rest-preview" aria-label={`${title} preview`}><h3>PREVIEW</h3>{run.party.map(member=><RestMemberPreview key={member.characterId} run={run} memberId={member.characterId} change={preview.changes.find(change=>change.characterId===member.characterId)}/>)}</section>:<p className="rest-preview-reason" role="alert">{preview.reason}</p>}
    <b>CHOOSE {title.toUpperCase()}</b>
  </button>;
}

export function RestScreen(){
  const run=useAppStore(s=>s.run)!;const choose=useAppStore(s=>s.chooseRest);const leave=useAppStore(s=>s.leaveRest);const isResolving=useAppStore(s=>s.isResolving);const error=useAppStore(s=>s.error);const [confirmLeave,setConfirmLeave]=useState(false);
  const recover=previewRestChoice(run,'recover');const refresh=previewRestChoice(run,'refresh');const hasReviveKit=run.inventory.some(item=>item.itemId==='revive-kit');
  return <main className="screen rest-screen"><GameHeader title="A Quiet Patch" subtitle="Choose one recovery."/>
    <section className="rest-party" aria-label="Party at Rest">{run.party.map(p=>{const c=getCharacter(p.characterId);const pp=Object.values(p.abilityPP);return <div key={p.characterId}><strong>{c.displayName}</strong><span>{p.hp}/{c.stats.maxHp} HP</span><span>{pp.reduce((a,b)=>a+b,0)} PP left</span></div>})}</section>
    <section className="rest-choices" aria-label="Rest choices"><RestChoiceCard run={run} choice="recover" preview={recover} disabled={isResolving} onChoose={()=>void choose('recover')}/><RestChoiceCard run={run} choice="refresh" preview={refresh} disabled={isResolving} onChoose={()=>void choose('refresh')}/></section>
    {hasReviveKit&&<p className="rest-revive-note">Revive Kit can bring back one KO ally at 30% HP on the resolved route if a field use remains.</p>}
    {error&&<p className="inline-error" role="alert">{error}</p>}
    <footer className="rest-exit"><p>Leaving completes this Rest node without recovery and forfeits its sibling Shop.</p>{!confirmLeave?<PaperButton variant="quiet" disabled={isResolving} onClick={()=>setConfirmLeave(true)}>LEAVE WITHOUT RESTING</PaperButton>:<div className="rest-leave-confirm"><strong>Leave the Rest without recovering?</strong><span>The sibling Shop will be lost.</span><div><PaperButton variant="danger" disabled={isResolving} onClick={()=>void leave()}>CONFIRM LEAVE</PaperButton><PaperButton variant="quiet" disabled={isResolving} onClick={()=>setConfirmLeave(false)}>KEEP RESTING</PaperButton></div></div>}</footer>
  </main>;
}
