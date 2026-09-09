import { useEffect, useRef } from 'react';
import { useAppStore } from '../../app/appStore';
import { SettingsScreen } from '../../features/settings/SettingsScreen';
import { GuidePanel } from './GuidePanel';
import { DetailPanel } from './DetailPanel';

const LABELS:Record<string,string>={settings:'Settings',guide:'Guide'};

export function GlobalOverlay(){
  const overlay=useAppStore(s=>s.overlay);const close=useAppStore(s=>s.closeOverlay);
  const dialogRef=useRef<HTMLDialogElement>(null);const openerRef=useRef<HTMLElement|null>(null);
  // A native modal dialog is the platform's focus trap, Escape handler and focus restore in one,
  // and the route inventory already uses this pattern. The element stays mounted so closing it
  // hands focus back to whatever opened it.
  useEffect(()=>{
    const dialog=dialogRef.current;if(!dialog)return;
    if(overlay){
      if(!dialog.open)openerRef.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
      if(!dialog.open)dialog.showModal();
      requestAnimationFrame(()=>{
        const first=dialog.querySelector<HTMLElement>('.overlay-position button:not(:disabled), .overlay-position a[href], .overlay-position input:not(:disabled), .overlay-position select:not(:disabled)');
        (first ?? dialog.querySelector<HTMLButtonElement>('.overlay-backdrop'))?.focus();
      });
    } else if(dialog.open){dialog.close();requestAnimationFrame(()=>openerRef.current?.focus());}
  },[overlay]);
  useEffect(()=>{const dialog=dialogRef.current;if(!dialog)return;const onKeyDown=(event:KeyboardEvent)=>{if(!overlay||event.key!=='Tab')return;const focusable=[...dialog.querySelectorAll<HTMLElement>('.overlay-position button:not(:disabled), .overlay-position a[href], .overlay-position input:not(:disabled), .overlay-position select:not(:disabled)')];if(!focusable.length)return;const first=focusable[0];const last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}};dialog.addEventListener('keydown',onKeyDown);return()=>dialog.removeEventListener('keydown',onKeyDown);},[overlay]);
  return <dialog ref={dialogRef} className="global-overlay" aria-label={overlay?LABELS[overlay.kind]??'Details':undefined} onClose={close}>
    {overlay&&<>
      <button className="overlay-backdrop" aria-label="Close overlay" onClick={close}/>
      <div className="overlay-position">{overlay.kind==='settings'?<SettingsScreen/>:overlay.kind==='guide'?<GuidePanel initial={overlay.section}/>:<DetailPanel overlay={overlay}/>}</div>
    </>}
  </dialog>;
}
