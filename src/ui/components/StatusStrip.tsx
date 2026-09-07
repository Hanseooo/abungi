import type { StatusInstance } from '../../game/core/types';
import { STATUS_GUIDE_MAP } from '../../game/content/guide';
import { useAppStore } from '../../app/appStore';
export function StatusStrip({statuses}:{statuses:StatusInstance[]}){
  const open=useAppStore(s=>s.openStatusInfo);if(!statuses.length)return <span className="status-empty">No status</span>;
  return <div className="status-strip" aria-label="Active statuses">{statuses.map(s=>{const guide=STATUS_GUIDE_MAP.get(s.id);return <button type="button" title={`${guide?.name??s.id}: ${guide?.description??''}`} onClick={event=>{event.stopPropagation();open(s.id)}} className={`status status-${s.id}`} key={s.id}>{guide?.short??s.id.toUpperCase()} <b>{s.remaining}</b><span className="status-info-dot">i</span></button>})}</div>;
}
