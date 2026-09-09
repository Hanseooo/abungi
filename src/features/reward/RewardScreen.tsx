import { useState } from 'react';
import { useAppStore } from '../../app/appStore';
import { getRelic } from '../../game/content/relics';
import { getAbility, getCharacter } from '../../game/content/characters';
import { getItem } from '../../game/content/items';
import { PaperButton } from '../../ui/components/PaperButton';
import { GameHeader } from '../../ui/components/GameHeader';
import { BALANCE } from '../../game/balance/constants';
export function RewardScreen(){
  const run=useAppStore(s=>s.run)!;const reward=run.pendingReward!;const claim=useAppStore(s=>s.claimRewardChoice);const openItem=useAppStore(s=>s.openItemInfo);const settings=useAppStore(s=>s.settings);
  const[relic,setRelic]=useState(reward.relicChoices[0]);const[upgrade,setUpgrade]=useState(reward.upgradeChoices[0]);const[spoils,setSpoils]=useState(reward.spoilsChoices[0]?.id);
  const needsChoice=reward.relicChoices.length>0||reward.upgradeChoices.length>0||reward.spoilsChoices.length>0;
  return <main className={`screen reward-screen speed-${settings.animationSpeed}x ${settings.reducedMotion?'reduced-motion':''}`}><GameHeader title={reward.tier==='boss'?'Boss Cleared':reward.tier==='elite'?'Elite Spoils':'Battle Reward'} subtitle={`${reward.coins} encounter-scaled coins are secured. ${reward.bossRecovery?'Boss recovery will also restore part of the party.':''}`}/>
    <section className="reward-ledger"><div><span>COINS</span><strong>+{reward.coins}</strong></div><div><span>CAUGHT BREATH</span><strong>+{Math.round(BALANCE.postVictoryHpPercent*100)}% HP</strong></div>{reward.itemId&&<button className="reward-ledger-item" onClick={()=>openItem(reward.itemId!)}><span>FOUND ITEM</span><strong>{getItem(reward.itemId).name}</strong><small>{getItem(reward.itemId).rarity.toUpperCase()} · INFO</small></button>}{reward.bossRecovery&&<div><span>RECOVERY</span><strong>HP + PP</strong></div>}</section>
    {reward.spoilsChoices.length>0&&<section className="choice-section spoils-section"><h2>Choose your spoils</h2><p className="choice-explainer">The fight already paid its base coins.</p><div className="choice-grid">{reward.spoilsChoices.map(option=><button key={option.id} className={`reward-choice spoils-choice ${spoils===option.id?'selected':''}`} aria-pressed={spoils===option.id} onClick={()=>setSpoils(option.id)}><span className="spoils-stamp">{option.id.toUpperCase()}</span><strong>{option.label}</strong><p>{option.description}</p>{option.itemId&&<small>{getItem(option.itemId).name}</small>}</button>)}</div></section>}
    {reward.relicChoices.length>0&&<section className="choice-section"><h2>Choose one relic</h2><div className="choice-grid">{reward.relicChoices.map(id=>{const r=getRelic(id);return <button key={id} className={`reward-choice ${relic===id?'selected':''}`} aria-pressed={relic===id} onClick={()=>setRelic(id)}><span className="relic-rivet"/><strong>{r.name}</strong><p>{r.description}</p></button>})}</div></section>}
    {reward.upgradeChoices.length>0&&<section className="choice-section"><h2>Upgrade one skill</h2><div className="choice-grid">{reward.upgradeChoices.map(x=>{const c=getCharacter(x.characterId),a=getAbility(x.abilityId);const key=`${x.characterId}:${x.abilityId}`;const selected=upgrade&&`${upgrade.characterId}:${upgrade.abilityId}`===key;return <button key={key} className={`reward-choice ${selected?'selected':''}`} aria-pressed={Boolean(selected)} onClick={()=>setUpgrade(x)}><span className="upgrade-plus">+</span><strong>{c.displayName} · {a.name}+</strong><p>{a.upgrade.description}</p></button>})}</div></section>}
    <footer className="sticky-actions single"><PaperButton variant="ink" disabled={needsChoice&&((reward.relicChoices.length>0&&!relic)||(reward.upgradeChoices.length>0&&!upgrade)||(reward.spoilsChoices.length>0&&!spoils))} onClick={()=>void claim(relic,upgrade,spoils)}>TAKE REWARD & CONTINUE</PaperButton></footer>
  </main>;
}
