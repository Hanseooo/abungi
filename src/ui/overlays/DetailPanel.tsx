import type { ReactNode } from 'react';
import type { OverlayState } from '../../app/appStore';
import { useAppStore } from '../../app/appStore';
import { getAbility, getCharacter } from '../../game/content/characters';
import { getEnemy } from '../../game/content/enemies';
import { getItem } from '../../game/content/items';
import { STATUS_GUIDE_MAP } from '../../game/content/guide';
import { AffinityMark } from '../components/AffinityMark';
import { PaperButton } from '../components/PaperButton';

function TargetLabel({target}:{target:string}){return <span className="detail-chip">{target.replaceAll('-',' ').toUpperCase()}</span>}
export function DetailPanel({overlay}:{overlay:Exclude<OverlayState,null|{kind:'settings'}|{kind:'guide'}>}){
  const close=useAppStore(s=>s.closeOverlay);const openGuide=useAppStore(s=>s.openGuide);
  let body:ReactNode;let title='Details';let kicker='INFO';
  if(overlay.kind==='move'){
    const a=getAbility(overlay.abilityId);title=a.name;kicker='MOVE INFO';
    body=<><div className="detail-hero"><AffinityMark affinity={a.affinity}/><TargetLabel target={a.target}/><span className="detail-chip">PP {a.maxPP}</span>{a.accuracy&&<span className="detail-chip">ACC {a.accuracy}%</span>}</div><p className="detail-lead">{a.description}</p><h3>Effects</h3><ul className="detail-list">{a.effects.map((effect,index)=><li key={index}>{effect.kind==='damage'?`${effect.hits??1}× ${effect.power} power damage`:effect.kind==='heal'?`Heal ${Math.round(effect.percentMaxHp*100)}% Max HP`:effect.kind==='status'?`${effect.statusId} for ${effect.duration} turns`:effect.kind==='summon'?`Deploy ${effect.summonId} for ${effect.duration} turns`:effect.kind==='sacrificeHp'?`Sacrifice ${Math.round(effect.amount*100)}% ${effect.basis} HP`:effect.kind==='spendCoins'?`Spend ${effect.amount} coins`:effect.kind==='grantCoins'?`Gain ${effect.amount} coins on ${effect.trigger}`:effect.kind==='cleanse'?`Remove ${effect.count} negative status(es)`:effect.kind==='restorePP'?`Restore ${effect.amount} PP`:'Effect'}</li>)}</ul><div className="upgrade-note"><strong>{a.name}+</strong><p>{a.upgrade.description}</p></div></>;
  } else if(overlay.kind==='status'){
    const status=STATUS_GUIDE_MAP.get(overlay.statusId)!;title=status.name;kicker='STATUS';
    body=<><div className={`status-detail-mark status-${status.id}`}>{status.short}</div><p className="detail-lead">{status.description}</p><div className="rule-note"><strong>Duration rule</strong><p>A displayed 2 means the affected unit still has two of its turns under this effect. Applying/refreshing it does not immediately consume one.</p></div></>;
  } else if(overlay.kind==='character'){
    const c=getCharacter(overlay.characterId);title=c.displayName;kicker='CHARACTER';
    body=<><div className="detail-hero"><AffinityMark affinity={c.affinity}/><span className="detail-chip">HP {c.stats.maxHp}</span><span className="detail-chip">POW {c.stats.power}</span><span className="detail-chip">GRD {c.stats.guard}</span><span className="detail-chip">SPD {c.stats.speed}</span></div><p className="detail-lead">{c.role}</p><div className="passive-note"><strong>{c.passive.name}</strong><p>{c.passive.description}</p></div><div className="kit-list">{c.abilities.map(id=>{const a=getAbility(id);return <button key={id} onClick={()=>useAppStore.getState().openMoveInfo(id)}><span>{a.name}</span><AffinityMark affinity={a.affinity} small/><small>{a.description}</small></button>})}</div></>;
  } else if(overlay.kind==='item'){
    const item=getItem(overlay.itemId);title=item.name;kicker=`${item.rarity.toUpperCase()} ITEM`;
    body=<><div className="detail-hero"><span className={`rarity-stamp rarity-${item.rarity}`}>{item.rarity.toUpperCase()}</span><TargetLabel target={item.target}/><span className="detail-chip">BASE {item.price} COINS</span></div><p className="detail-lead">{item.description}</p><div className="rule-note"><strong>Stacking</strong><p>Status items refresh the same status rather than multiplying it. Different buffs can coexist.</p></div></>;
  } else {
    const enemy=getEnemy(overlay.enemyId);title=enemy.displayName;kicker=enemy.tier.toUpperCase();
    body=<><div className="detail-hero"><AffinityMark affinity={enemy.affinity}/><span className="detail-chip">HP {enemy.stats.maxHp}</span><span className="detail-chip">POW {enemy.stats.power}</span><span className="detail-chip">GRD {enemy.stats.guard}</span><span className="detail-chip">SPD {enemy.stats.speed}</span></div><p className="detail-lead">Visible profile only. Abungi never reveals which move this enemy will use next.</p><h3>Known move set</h3><ul className="detail-list">{enemy.moves.map(move=><li key={move.id}><strong>{move.name}</strong> · {move.affinity.toUpperCase()}</li>)}</ul></>;
  }
  return <section className="overlay-paper detail-panel"><header className="overlay-heading"><span className="tape-label">{kicker}</span><h2>{title}</h2></header><div className="detail-scroll">{body}</div><footer className="overlay-actions"><PaperButton variant="quiet" onClick={()=>openGuide()}>FIELD GUIDE</PaperButton><PaperButton variant="ink" onClick={close}>BACK TO GAME</PaperButton></footer></section>;
}
