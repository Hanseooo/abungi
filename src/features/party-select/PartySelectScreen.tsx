import { CHARACTERS } from '../../game/content/characters';
import { useAppStore } from '../../app/appStore';
import { CutoutArt } from '../../ui/components/CutoutArt';
import { AffinityMark } from '../../ui/components/AffinityMark';
import { PaperButton } from '../../ui/components/PaperButton';
import { GameHeader } from '../../ui/components/GameHeader';
import { charAccentStyle } from '../../ui/charAccent';

export function PartySelectScreen(){
  const selected=useAppStore(s=>s.selectedParty);const toggle=useAppStore(s=>s.toggleParty);const confirm=useAppStore(s=>s.confirmParty);const back=useAppStore(s=>s.backToTitle);const error=useAppStore(s=>s.error);const info=useAppStore(s=>s.openCharacterInfo);
  return <main className="screen party-screen"><GameHeader title="Choose Your Three" subtitle="Your party stays active together, and HP/PP persist through the run."/>
    <div className="selection-meter"><b>{selected.length}/3</b><span>{selected.length===3?'Ready to start.':'Choose 3 characters.'}</span></div>
    <section className="roster-grid" aria-label="Playable roster">{CHARACTERS.map((c,index)=>{const isSelected=selected.includes(c.id);return <article key={c.id} style={charAccentStyle(c)} className={`roster-card ${isSelected?'selected':''}`}>
      <button className="roster-select-hit" aria-pressed={isSelected} onClick={()=>toggle(c.id)} aria-label={`${isSelected?'Remove':'Select'} ${c.displayName}`}><span className="pick-number">{isSelected?selected.indexOf(c.id)+1:String(index+1).padStart(2,'0')}</span><CutoutArt assetId={c.assetId} name={c.displayName}/><span className="roster-copy"><strong>{c.displayName}</strong><AffinityMark affinity={c.affinity} small/><small>{c.role}</small></span><span className="mini-stats"><i>HP <b>{c.stats.maxHp}</b></i><i>POW <b>{c.stats.power}</b></i><i>GRD <b>{c.stats.guard}</b></i><i>SPD <b>{c.stats.speed}</b></i></span></button>
      <button className="roster-info" onClick={()=>info(c.id)} aria-label={`View ${c.displayName} kit`}>KIT + INFO</button>
    </article>;})}</section>
    {error&&<p className="inline-error" role="alert">{error}</p>}
    <footer className="sticky-actions"><PaperButton variant="quiet" onClick={back}>BACK</PaperButton><PaperButton variant="ink" disabled={selected.length!==3} onClick={()=>void confirm()}>START WITH {selected.length===3?selected.map(id=>CHARACTERS.find(c=>c.id===id)?.displayName).join(' · '):`${selected.length}/3`}</PaperButton></footer>
  </main>;
}
