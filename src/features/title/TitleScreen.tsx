import { useState } from 'react';
import { useAppStore } from '../../app/appStore';
import { PaperButton } from '../../ui/components/PaperButton';
import { TITLE_BACKGROUND } from '../../services/assets/assetRegistry';

export function TitleScreen(){
  const run=useAppStore(s=>s.run);const openNew=useAppStore(s=>s.openNewRun);const cont=useAppStore(s=>s.continueRun);const settings=useAppStore(s=>s.openSettings);const guide=useAppStore(s=>s.openGuide);const corrupt=useAppStore(s=>s.corruptSaveMessage);const reset=useAppStore(s=>s.resetCorruptSave);const booted=useAppStore(s=>s.booted);const notice=useAppStore(s=>s.notice);
  const[confirm,setConfirm]=useState(false);const hasRun=Boolean(run&&run.status==='active');
  if(!booted)return <main className="title-screen" style={{backgroundImage:`url(${TITLE_BACKGROUND})`}}><div className="title-mark"><span>HANDCRAFTED BATTLE THEATRE</span><h1>ABUNGI</h1><p>Loading the table…</p></div></main>;
  return <main className="title-screen" style={{backgroundImage:`url(${TITLE_BACKGROUND})`}}>
    <div className="title-scrim" />
    <section className="title-mark" aria-labelledby="game-title"><span className="tape-label">A THREE-PERSON ROGUELIKE</span><h1 id="game-title">ABUNGI</h1><p>Pick three. Read the room. Spend your PP wisely. Make it through all three regions.</p></section>
    <section className="title-actions">
      {corrupt&&<div className="recovery-notice" role="alert"><strong>Your local save needs repair.</strong><p>{corrupt}</p><PaperButton variant="danger" onClick={()=>void reset()}>RESET LOCAL SAVE</PaperButton></div>}
      {!corrupt&&<>
        {hasRun&&<PaperButton variant="ink" onClick={cont}>CONTINUE RUN <small>Region {run!.regionIndex+1}</small></PaperButton>}
        {!confirm?<PaperButton className="title-cta" onClick={()=>hasRun?setConfirm(true):openNew()}>{hasRun?'NEW RUN':'START NEW RUN'}</PaperButton>:<div className="confirm-strip"><p>Starting over replaces the active run only after you choose a new party.</p><div><PaperButton className="title-cta" onClick={()=>{setConfirm(false);openNew();}}>CHOOSE NEW PARTY</PaperButton><PaperButton variant="quiet" onClick={()=>setConfirm(false)}>KEEP CURRENT RUN</PaperButton></div></div>}
        <div className="title-secondary-actions"><PaperButton variant="quiet" onClick={()=>guide()}>FIELD GUIDE</PaperButton><PaperButton variant="quiet" onClick={settings}>SETTINGS</PaperButton></div>
      </>}
      {notice&&<p className="title-notice">{notice}</p>}
    </section>
    <footer className="title-footer"><span>OFFLINE AFTER FIRST LOAD</span><span>LOCAL SAVE</span><span>TOUCH + KEYBOARD</span></footer>
  </main>;
}
