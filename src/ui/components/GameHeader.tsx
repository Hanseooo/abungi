import { useAppStore } from '../../app/appStore';
import { PaperButton } from './PaperButton';
export function GameHeader({title,subtitle}:{title:string;subtitle?:string}){
  const openSettings=useAppStore(s=>s.openSettings);const openGuide=useAppStore(s=>s.openGuide);const run=useAppStore(s=>s.run);const saveHealth=useAppStore(s=>s.saveHealth);
  return <header className="game-header"><div><span className="eyebrow">{run?`REGION ${run.regionIndex+1} · ${run.coins} COINS`:'ABUNGI'}</span><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div><div className="header-tools">{saveHealth==='error'&&<span className="save-tag" role="status">SAVE ISSUE</span>}<PaperButton variant="quiet" onClick={()=>openGuide()} aria-label="Open field guide">GUIDE</PaperButton><PaperButton variant="quiet" onClick={openSettings} aria-label="Open settings">SETTINGS</PaperButton></div></header>;
}
