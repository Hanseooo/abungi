import { useState } from 'react';
import { useAppStore } from '../../app/appStore';
import { AFFINITY_GUIDE, MECHANIC_GUIDE, STATUS_GUIDE } from '../../game/content/guide';
import { CHARACTERS, getAbility } from '../../game/content/characters';
import { ITEMS } from '../../game/content/items';
import { AffinityMark } from '../components/AffinityMark';
import { PaperButton } from '../components/PaperButton';

type Tab='mechanics'|'effects'|'characters'|'items';
export function GuidePanel({initial}:{initial?:string}){
  const close=useAppStore(s=>s.closeOverlay);const openCharacter=useAppStore(s=>s.openCharacterInfo);const openItem=useAppStore(s=>s.openItemInfo);
  const [tab,setTab]=useState<Tab>((['mechanics','effects','characters','items'].includes(initial??'')?initial:'mechanics') as Tab);
  return <section className="overlay-paper guide-panel" aria-labelledby="guide-title">
    <header className="overlay-heading"><span className="tape-label">FIELD GUIDE</span><h2 id="guide-title">How the Table Works</h2><p>Exact rules, not mystery text. Enemy future moves remain hidden.</p></header>
    <nav className="guide-tabs" aria-label="Guide sections">{(['mechanics','effects','characters','items'] as const).map(id=><button key={id} className={tab===id?'selected':''} onClick={()=>setTab(id)}>{id.toUpperCase()}</button>)}</nav>
    <div className="guide-scroll">
      {tab==='mechanics'&&<><section className="affinity-wheel-guide"><h3>Affinity cycle</h3><div className="affinity-chain">{AFFINITY_GUIDE.slice(0,4).map((entry,index)=><div key={entry.id}><AffinityMark affinity={entry.id}/><strong>{entry.name}</strong>{index<3&&<span>→</span>}</div>)}<div><span className="cycle-back">↺</span><small>Tech → Might</small></div></div><p>Neutral has no strengths or weaknesses.</p></section><div className="guide-card-grid">{MECHANIC_GUIDE.map(entry=><article key={entry.id}><h3>{entry.title}</h3><p>{entry.text}</p></article>)}</div></>}
      {tab==='effects'&&<div className="guide-card-grid status-guide-grid">{STATUS_GUIDE.map(entry=><article className={`guide-status status-${entry.id}`} key={entry.id}><h3>{entry.name}</h3><span>{entry.positive?'POSITIVE':'NEGATIVE'}</span><p>{entry.description}</p><small>Duration decreases after the affected unit completes a later turn.</small></article>)}</div>}
      {tab==='characters'&&<div className="guide-roster">{CHARACTERS.map(c=><article key={c.id}><div className="guide-row-title"><h3>{c.displayName}</h3><AffinityMark affinity={c.affinity} small/></div><p>{c.role}</p><strong>{c.passive.name}</strong><small>{c.passive.description}</small><ul>{c.abilities.map(id=><li key={id}>{getAbility(id).name}</li>)}</ul><button onClick={()=>openCharacter(c.id)}>FULL KIT</button></article>)}</div>}
      {tab==='items'&&<div className="guide-card-grid">{ITEMS.map(item=><article className={`rarity-${item.rarity}`} key={item.id}><div className="guide-row-title"><h3>{item.name}</h3><span className="rarity-stamp">{item.rarity.toUpperCase()}</span></div><p>{item.description}</p><small>{item.price} base coins · {item.category}</small><button onClick={()=>openItem(item.id)}>DETAILS</button></article>)}</div>}
    </div>
    <footer className="overlay-actions"><PaperButton variant="ink" onClick={close}>CLOSE GUIDE</PaperButton></footer>
  </section>;
}
