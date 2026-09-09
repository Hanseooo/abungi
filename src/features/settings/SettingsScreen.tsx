import { useEffect } from 'react';
import { useAppStore } from '../../app/appStore';
import { PaperButton } from '../../ui/components/PaperButton';
import { audioEngine } from '../../services/audio/audioEngine';

export function SettingsScreen(){
  const settings=useAppStore(s=>s.settings);const update=useAppStore(s=>s.updateSettings);const close=useAppStore(s=>s.closeOverlay);
  useEffect(()=>audioEngine.configure(settings),[settings]);
  return <section className="overlay-paper settings-panel" aria-labelledby="settings-title">
    <header className="overlay-heading"><span className="tape-label">LOCAL OPTIONS</span><h2 id="settings-title">Settings</h2><p>Audio and motion choices are saved locally.</p></header>
    <section className="settings-board">
      <label className="setting-row"><span><strong>Master audio</strong><small>Mute music and effects without changing individual levels.</small></span><input type="checkbox" checked={!settings.masterMuted} onChange={e=>void update({masterMuted:!e.target.checked})}/></label>
      <label className="setting-row"><span><strong>Music volume</strong><small>{Math.round(settings.musicVolume*100)}%</small></span><input type="range" min="0" max="1" step="0.05" value={settings.musicVolume} onChange={e=>void update({musicVolume:Number(e.target.value)})}/></label>
      <label className="setting-row"><span><strong>SFX volume</strong><small>{Math.round(settings.sfxVolume*100)}%</small></span><input type="range" min="0" max="1" step="0.05" value={settings.sfxVolume} onChange={e=>void update({sfxVolume:Number(e.target.value)})}/></label>
      <fieldset className="setting-row speed-setting"><legend><strong>Battle animation speed</strong><small>Rules are identical at every speed; only presentation timing changes.</small></legend><div>{([1,2,3] as const).map(v=><button className={settings.animationSpeed===v?'selected':''} key={v} onClick={()=>void update({animationSpeed:v})}>{v}×</button>)}</div></fieldset>
      <label className="setting-row"><span><strong>Reduced motion</strong><small>Uses fades/highlights instead of strong shake and large movement.</small></span><input type="checkbox" checked={settings.reducedMotion} onChange={e=>void update({reducedMotion:e.target.checked})}/></label>
    </section>
    <footer className="overlay-actions"><PaperButton variant="ink" onClick={close}>RETURN TO GAME</PaperButton></footer>
  </section>;
}
