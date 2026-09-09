import type { StatusId, TargetMode } from '../core/types.js';

export type ItemRarity='common'|'uncommon'|'rare';
export type ItemCategory='recovery'|'resource'|'tactical'|'utility'|'revive';

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  target: TargetMode;
  price: number;
  rarity: ItemRarity;
  category: ItemCategory;
  battleOnly?: boolean;
  fieldCompatible?: boolean;
  escape?: boolean;
  targetKo?: boolean;
  effects: Array<
    | {kind:'healPercent'; percent:number}
    | {kind:'healPartyPercent'; percent:number}
    | {kind:'restorePP'; amount:number}
    | {kind:'status'; statusId:StatusId; duration:number}
    | {kind:'cleanse'; count:number}
    | {kind:'revive'; percentMaxHp:number}
    | {kind:'damage'; power:number}
  >;
}

export const ITEMS: ItemDefinition[] = [
  {id:'patch-kit',name:'Patch Kit',description:'Restore 35% Max HP to one ally.',target:'ally-one',price:16,rarity:'common',category:'recovery',fieldCompatible:true,effects:[{kind:'healPercent',percent:0.35}]},
  {id:'pp-tonic',name:'PP Tonic',description:'Restore 4 PP to the lowest-PP move of one ally.',target:'ally-one',price:18,rarity:'common',category:'resource',fieldCompatible:true,effects:[{kind:'restorePP',amount:4}]},
  {id:'field-ration',name:'Field Ration',description:'Restore 14% Max HP to the whole party.',target:'ally-all',price:24,rarity:'uncommon',category:'recovery',fieldCompatible:true,effects:[{kind:'healPartyPercent',percent:0.14}]},
  {id:'energy-drink',name:'Energy Drink',description:'Grant Haste for 2 turns. Reapplying Haste refreshes duration; it does not stack speed.',target:'ally-one',price:16,rarity:'uncommon',category:'tactical',battleOnly:true,effects:[{kind:'status',statusId:'haste',duration:2}]},
  {id:'power-snack',name:'Power Snack',description:'Grant Strength for 2 turns. Strength does not stack with itself.',target:'ally-one',price:20,rarity:'uncommon',category:'tactical',battleOnly:true,effects:[{kind:'status',statusId:'strength',duration:2}]},
  {id:'guard-patch',name:'Guard Patch',description:'Grant Fortified for 2 turns. Fortified does not stack with itself.',target:'ally-one',price:21,rarity:'uncommon',category:'tactical',battleOnly:true,effects:[{kind:'status',statusId:'fortified',duration:2}]},
  {id:'smoke-bomb',name:'Smoke Bomb',description:'Escape a normal battle. Cannot escape elites or bosses.',target:'self',price:20,rarity:'uncommon',category:'utility',battleOnly:true,escape:true,effects:[]},
  {id:'cleanser',name:'Cleanser',description:'Remove up to two negative statuses from one ally.',target:'ally-one',price:15,rarity:'common',category:'utility',battleOnly:true,effects:[{kind:'cleanse',count:2}]},
  {id:'circuit-brew',name:'Circuit Brew',description:'Restore 3 PP to the lowest-PP move of every living ally.',target:'ally-all',price:30,rarity:'uncommon',category:'resource',fieldCompatible:true,effects:[{kind:'restorePP',amount:3}]},
  {id:'brick-in-a-sock',name:'Brick in a Sock',description:'Throw for 65 power at one enemy. No affinity, no PP, anyone can use it.',target:'enemy-one',price:22,rarity:'common',category:'tactical',battleOnly:true,effects:[{kind:'damage',power:65}]},
  {id:'revive-kit',name:'Revive Kit',description:'Revive one KO ally at 30% Max HP. Cannot rescue the party after total defeat.',target:'ally-one',price:56,rarity:'rare',category:'revive',fieldCompatible:true,targetKo:true,effects:[{kind:'revive',percentMaxHp:0.30}]},
  {id:'purge-pack',name:'Purge Pack',description:'Remove all negative statuses from every living ally. Battle only.',target:'ally-all',price:32,rarity:'rare',category:'utility',battleOnly:true,fieldCompatible:false,effects:[{kind:'cleanse',count:4}]},
  {id:'emergency-wrap',name:'Emergency Wrap',description:'Restore 20% Max HP to one living ally and grant Fortified for two turns.',target:'ally-one',price:22,rarity:'uncommon',category:'recovery',battleOnly:true,fieldCompatible:false,effects:[{kind:'healPercent',percent:0.20},{kind:'status',statusId:'fortified',duration:2}]},
];

const map = new Map(ITEMS.map(item => [item.id,item]));
export function getItem(id:string): ItemDefinition { const value=map.get(id); if(!value) throw new Error(`Unknown item id: ${id}`); return value; }
