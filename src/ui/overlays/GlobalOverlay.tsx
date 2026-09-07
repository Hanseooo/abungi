import { useEffect } from 'react';
import { useAppStore } from '../../app/appStore';
import { SettingsScreen } from '../../features/settings/SettingsScreen';
import { GuidePanel } from './GuidePanel';
import { DetailPanel } from './DetailPanel';

export function GlobalOverlay(){
  const overlay=useAppStore(s=>s.overlay);const close=useAppStore(s=>s.closeOverlay);
  useEffect(()=>{if(!overlay)return;const key=(event:KeyboardEvent)=>{if(event.key==='Escape')close();};addEventListener('keydown',key);return()=>removeEventListener('keydown',key);},[overlay,close]);
  if(!overlay)return null;
  return <div className="global-overlay" role="dialog" aria-modal="true"><button className="overlay-backdrop" aria-label="Close overlay" onClick={close}/><div className="overlay-position">{overlay.kind==='settings'?<SettingsScreen/>:overlay.kind==='guide'?<GuidePanel initial={overlay.section}/>:<DetailPanel overlay={overlay}/>}</div></div>;
}
