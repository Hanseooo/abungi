import type { BattleEffectInstance, StatusInstance } from '../../game/core/types';
import { EFFECT_GUIDE_MAP, STATUS_GUIDE_MAP } from '../../game/content/guide';
import { useAppStore } from '../../app/appStore';

export function StatusStrip({statuses,effects=[]}:{statuses:StatusInstance[];effects?:BattleEffectInstance[]}){
  const openStatus=useAppStore(s=>s.openStatusInfo);
  const openEffect=useAppStore(s=>s.openEffectInfo);
  if(!statuses.length&&!effects.length)return <span className="status-empty">No status</span>;
  return <div className="status-strip" aria-label="Active statuses and effects">
    {statuses.map(s=>{const guide=STATUS_GUIDE_MAP.get(s.id);return <button type="button" title={`${guide?.name??s.id}: ${guide?.description??''}`} onClick={event=>{event.stopPropagation();openStatus(s.id)}} className={`status status-${s.id}`} key={s.id}>{guide?.short??s.id.toUpperCase()} <b>{s.remaining}</b><span className="status-info-dot">i</span></button>})}
    {effects.map(effect=>{const guide=EFFECT_GUIDE_MAP.get(effect.id);return <button type="button" title={`${guide?.name??effect.id}: ${guide?.anchor??''}`} onClick={event=>{event.stopPropagation();openEffect(effect.id)}} className={`status effect-${effect.id} ${guide?.positive?'effect-positive':'effect-negative'}`} key={effect.uid}>{guide?.short??effect.id.toUpperCase()} <b>{effect.remaining}</b><span className="status-info-dot">i</span></button>})}
  </div>;
}
