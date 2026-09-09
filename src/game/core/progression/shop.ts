import type { RunState, ShopOffer } from '../types.js';
import { ITEMS, type ItemDefinition } from '../../content/items.js';
import { getRelic } from '../../content/relics.js';
import { BALANCE } from '../../balance/constants.js';
import { SHOP_CONFIG } from '../../content/shops.js';
import { SeededRng, hashText } from '../rng/seededRng.js';
import { inventoryCapacity, inventoryCount } from './inventory.js';
import { drawRelicIds } from './relicDrafts.js';

export type { ShopOffer };
export interface PurchaseResult {ok:boolean;reason?:string;run:RunState}
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;

// Shop Chit is one fact stated in relics.ts; every price the shop quotes reads it from there.
function shopDiscount(run:RunState):number{return run.relicIds.includes('shop-chit')?1-getRelic('shop-chit').value:1;}
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

export function generateShopOffers(run:RunState,nodeId:string,rerollCount=0):ShopOffer[]{
  const key=rerollCount?`${run.regionIndex}:${nodeId}:r${rerollCount}`:`${run.regionIndex}:${nodeId}`;
  const rng=new SeededRng((run.seed^hashText(key))>>>0);
  const baseCount=BALANCE.shopBaseOffers;
  const count=baseCount+(run.party.some(p=>p.characterId==='leandre')?1:0);
  const discounted=shopDiscount(run);
  const itemPool=[...ITEMS];
  const offers:ShopOffer[]=[];
  const pushItem=(predicate:(item:ItemDefinition)=>boolean)=>{
    const item=pickUniqueItem(itemPool,predicate,rng,run.regionIndex)??pickUniqueItem(itemPool,()=>true,rng,run.regionIndex);
    if(item)offers.push(itemOffer(item,nodeId,offers.length,discounted,rng));
  };

  pushItem(item=>item.category==='recovery');
  pushItem(item=>item.category==='resource'||item.id==='cleanser');
  pushItem(item=>item.category==='tactical'||item.category==='utility');

  const regionRelicChance=Math.min(0.34,SHOP_CONFIG.relicChance+run.regionIndex*0.05);
  if(rng.chance(regionRelicChance)){
    const relicId=drawRelicIds(run,'shop',1,rng)[0];
    if(relicId){const relic=getRelic(relicId);const variance=priceFactor(rng);
      offers.push({id:`${nodeId}-relic-${relic.id}`,kind:'relic',contentId:relic.id,name:relic.name,description:relic.description,price:Math.round(BALANCE.relicBasePrices[relic.rarity]*discounted*variance),rarity:relic.rarity,deal:dealFor(variance)});
    } else pushItem(()=>true);
  } else pushItem(()=>true);

  while(offers.length<baseCount&&itemPool.length)pushItem(()=>true);
  if(count>baseCount&&itemPool.length)pushItem(()=>true);
  return offers.slice(0,count);
}

// Each reroll costs more so digging for a specific relic drains the coins it would have bought.
export function shopRerollCost(run:RunState):number{
  const base=BALANCE.shopRerollBaseCost+(run.shopVisit?.rerollCount??0)*BALANCE.shopRerollCostStep;
  return Math.max(1,Math.round(base*shopDiscount(run)));
}

export function shopRerollAvailability(run:RunState):{legal:boolean;reason?:string}{
  if(run.status!=='active'||run.activeBattle||run.pendingReward)return{legal:false,reason:'Finish the current encounter first.'};
  const node=run.currentNodeId?run.route.nodes.find(candidate=>candidate.id===run.currentNodeId):undefined;
  if(!node||node.type!=='shop'||run.completedNodeIds.includes(node.id))return{legal:false,reason:'This shop is no longer available.'};
  if(!run.shopVisit||run.shopVisit.nodeId!==node.id)return{legal:false,reason:'This shop shelf is unavailable.'};
  const cost=shopRerollCost(run);
  if(run.coins<cost)return{legal:false,reason:`NEED ${cost-run.coins} MORE`};
  return{legal:true};
}

// The old shelf is gone, so nothing carries over as sold out; the reroll fee is what was paid for it.
export function rerollShopOffers(input:RunState):PurchaseResult{
  const availability=shopRerollAvailability(input);
  if(!availability.legal)return{ok:false,reason:availability.reason,run:input};
  const run=clone(input);
  run.coins-=shopRerollCost(run);
  const visit=run.shopVisit!;
  visit.rerollCount+=1;
  visit.offers=generateShopOffers(run,visit.nodeId,visit.rerollCount);
  visit.purchasedOfferIds=[];
  return{ok:true,run};
}

export function shopOfferAvailability(run:RunState,offerId:string):{legal:boolean;reason?:string}{
  if(run.status!=='active')return{legal:false,reason:'This run is no longer active.'};
  if(!run.party.some(member=>member.hp>0))return{legal:false,reason:'Your party cannot shop while everyone is down.'};
  if(run.activeBattle||run.pendingReward)return{legal:false,reason:'Finish the current encounter first.'};
  const node=run.currentNodeId?run.route.nodes.find(candidate=>candidate.id===run.currentNodeId):undefined;
  if(!node||node.type!=='shop'||run.completedNodeIds.includes(node.id))return{legal:false,reason:'This shop is no longer available.'};
  if(!run.shopVisit||run.shopVisit.nodeId!==node.id)return{legal:false,reason:'This shop shelf is unavailable.'};
  const offer=run.shopVisit.offers.find(candidate=>candidate.id===offerId);
  if(!offer)return{legal:false,reason:'That offer is not on this shelf.'};
  if(run.shopVisit.purchasedOfferIds.includes(offer.id))return{legal:false,reason:'SOLD OUT'};
  if(run.coins<offer.price)return{legal:false,reason:`NEED ${offer.price-run.coins} MORE`};
  if(offer.kind==='relic'&&run.relicIds.includes(offer.contentId))return{legal:false,reason:'ALREADY OWNED'};
  if(offer.kind==='item'&&inventoryCount(run)>=inventoryCapacity(run))return{legal:false,reason:'PACK FULL'};
  return{legal:true};
}

export function purchaseShopOffer(input:RunState,offerId:string):PurchaseResult{
  const availability=shopOfferAvailability(input,offerId);
  if(!availability.legal)return{ok:false,reason:availability.reason,run:input};
  const run=clone(input);const offer=run.shopVisit!.offers.find(candidate=>candidate.id===offerId)!;
  run.coins-=offer.price;
  if(offer.kind==='relic')run.relicIds.push(offer.contentId);
  else {const entry=run.inventory.find(e=>e.itemId===offer.contentId);if(entry)entry.quantity+=1;else run.inventory.push({itemId:offer.contentId,quantity:1});}
  run.shopVisit!.purchasedOfferIds.push(offer.id);
  return{ok:true,run};
}
