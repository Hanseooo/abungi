import { useAppStore, currentShopOffers } from '../../app/appStore';
import { SHOP_CONFIG } from '../../game/content/shops';
import { PaperButton } from '../../ui/components/PaperButton';
import { GameHeader } from '../../ui/components/GameHeader';
import { BALANCE } from '../../game/balance/constants';

export function ShopScreen(){
  const run=useAppStore(s=>s.run)!;const buy=useAppStore(s=>s.purchaseOffer);const leave=useAppStore(s=>s.leaveShop);const error=useAppStore(s=>s.error);const notice=useAppStore(s=>s.notice);const openItem=useAppStore(s=>s.openItemInfo);const offers=currentShopOffers(run);
  const used=run.inventory.reduce((s,e)=>s+e.quantity,0);
  return <main className="screen shop-screen"><GameHeader title={SHOP_CONFIG.displayName} subtitle="Each shelf has a job: recovery, resource, tactical, then a wildcard. Leandre adds one extra unique choice."/>
    <section className="shop-counter-scene" aria-hidden="true"><div className="shop-awning"/><div className="shop-lamp"/><div className="shop-counter"><i/><i/><i/></div><span>NO REFUNDS AFTER BOSS FIGHTS</span></section>
    <div className="shop-sign"><span>COINS IN POCKET</span><strong>{run.coins}</strong><small>{used}/{BALANCE.inventoryCapacity} inventory slots used</small></div>
    {notice&&<p className="paper-notice">{notice}</p>}{error&&<p className="inline-error" role="alert">{error}</p>}
    <section className="shop-shelf">{offers.map(o=>{const reason=run.coins<o.price?`NEED ${o.price-run.coins} MORE`:o.kind==='item'&&used>=BALANCE.inventoryCapacity?'PACK FULL':null;return <article className={`shop-offer rarity-${o.rarity} deal-${o.deal}`} key={o.id}><div className="offer-topline"><span className={`offer-kind kind-${o.kind}`}>{o.kind.toUpperCase()}</span><span className="rarity-stamp">{o.rarity.toUpperCase()}</span>{o.deal!=='standard'&&<span className="deal-stamp">{o.deal==='good'?'GOOD DEAL':'PRICEY'}</span>}</div><h2>{o.name}</h2><p>{o.description}</p><div className="shop-buy-row"><strong>{o.price} COINS</strong>{o.kind==='item'&&<button className="offer-info" onClick={()=>openItem(o.contentId)}>INFO</button>}<PaperButton disabled={Boolean(reason)} title={reason??undefined} onClick={()=>void buy(o.id)}>{reason??'BUY'}</PaperButton></div></article>})}</section>
    <p className="shop-footnote">Prices vary slightly by stop. Later regions improve rare-stock odds, but a shop is never guaranteed to solve your run.</p>
    <footer className="sticky-actions single"><PaperButton variant="ink" onClick={()=>void leave()}>LEAVE SHOP</PaperButton></footer>
  </main>;
}
