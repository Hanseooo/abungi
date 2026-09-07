import type { RunState, ShopOffer } from '../types.js';
import { ITEMS, type ItemDefinition } from '../../content/items.js';
import { RELICS } from '../../content/relics.js';
import { BALANCE } from '../../balance/constants.js';
import { SHOP_CONFIG } from '../../content/shops.js';
import { SeededRng } from '../rng/seededRng.js';

export type { ShopOffer };
export interface PurchaseResult {ok:boolean;reason?:string;run:RunState}
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;

function hashText(text:string):number{let h=2166136261;for(const ch of text){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function inventoryCount(run:RunState):number{return run.inventory.reduce((sum,e)=>sum+e.quantity,0);}
function priceFactor(rng:SeededRng):number{const [min,max]=SHOP_CONFIG.priceVariance;return min+rng.next()*(max-min);}
function dealFor(factor:number):ShopOffer['deal']{return factor<=0.95?'good':factor>=1.05?'pricey':'standard';}
function rarityWeight(item:ItemDefinition,regionIndex:number):number{
  if(item.rarity==='common')return 8;
  if(item.rarity==='uncommon')return 4+regionIndex;
  return 0.35+regionIndex*0.45;
}
function pickUniqueItem(pool:ItemDefinition[],predicate:(item:ItemDefinition)=>boolean,rng:SeededRng,regionIndex:number):ItemDefinition|undefined{
  const choices=pool.filter(predicate).map(item=>({item,weight:rarityWeight(item,regionIndex)}));
  if(!choices.length)return undefined;
  const selected=rng.weightedPick(choices).item;
  pool.splice(pool.findIndex(item=>item.id===selected.id),1);
  return selected;
}
function itemOffer(item:ItemDefinition,nodeId:string,index:number,discounted:number,rng:SeededRng):ShopOffer{
  const variance=priceFactor(rng);const factor=discounted*variance;
  return {id:`${nodeId}-item-${index}-${item.id}`,kind:'item',contentId:item.id,name:item.name,description:item.description,price:Math.max(1,Math.round(item.price*factor)),rarity:item.rarity,deal:dealFor(variance)};
}

export function generateShopOffers(run:RunState,nodeId:string):ShopOffer[]{
  const rng=new SeededRng((run.seed^hashText(`${run.regionIndex}:${nodeId}`))>>>0);
  const count=BALANCE.shopBaseOffers+(run.party.some(p=>p.characterId==='leandre')?1:0);
  const discounted=run.relicIds.includes('shop-chit')?0.88:1;
  const itemPool=[...ITEMS];
  const relicPool=RELICS.filter(r=>!run.relicIds.includes(r.id));
  const offers:ShopOffer[]=[];
  const pushItem=(predicate:(item:ItemDefinition)=>boolean)=>{
    const item=pickUniqueItem(itemPool,predicate,rng,run.regionIndex)??pickUniqueItem(itemPool,()=>true,rng,run.regionIndex);
    if(item)offers.push(itemOffer(item,nodeId,offers.length,discounted,rng));
  };

  pushItem(item=>item.category==='recovery');
  pushItem(item=>item.category==='resource'||item.id==='cleanser');
  pushItem(item=>item.category==='tactical'||item.category==='utility');

  const regionRelicChance=Math.min(0.34,SHOP_CONFIG.relicChance+run.regionIndex*0.05);
  if(offers.length<count&&relicPool.length&&rng.chance(regionRelicChance)){
    const relic=relicPool.splice(rng.int(0,relicPool.length-1),1)[0];const variance=priceFactor(rng);
    offers.push({id:`${nodeId}-relic-${relic.id}`,kind:'relic',contentId:relic.id,name:relic.name,description:relic.description,price:Math.round(50*discounted*variance),rarity:relic.rarity,deal:dealFor(variance)});
  } else if(offers.length<count) pushItem(()=>true);

  while(offers.length<count)pushItem(()=>true);
  return offers.slice(0,count);
}

export function purchaseShopOffer(input:RunState,offerId:string,offers:ShopOffer[]):PurchaseResult{
  const run=clone(input);const offer=offers.find(o=>o.id===offerId);
  if(!offer)return{ok:false,reason:'That offer is no longer available.',run};
  if(run.coins<offer.price)return{ok:false,reason:`Need ${offer.price-run.coins} more coins.`,run};
  if(offer.kind==='relic'&&run.relicIds.includes(offer.contentId))return{ok:false,reason:'You already carry this relic.',run};
  if(offer.kind==='item'&&inventoryCount(run)>=BALANCE.inventoryCapacity)return{ok:false,reason:'Inventory is full (6 slots).',run};
  run.coins-=offer.price;
  if(offer.kind==='relic')run.relicIds.push(offer.contentId);
  else {const entry=run.inventory.find(e=>e.itemId===offer.contentId);if(entry)entry.quantity+=1;else run.inventory.push({itemId:offer.contentId,quantity:1});}
  return{ok:true,run};
}
