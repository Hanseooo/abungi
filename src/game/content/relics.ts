import type { ItemRarity } from './items.js';

export interface RelicDefinition {
  id: string;
  name: string;
  description: string;
  mechanicId: string;
  value: number;
  rarity: ItemRarity;
}

export const RELICS: RelicDefinition[] = [
  {id:'cardboard-plate',name:'Cardboard Plate',description:'First damage received each battle is reduced by 35%.',mechanicId:'first-hit-reduction',value:0.35,rarity:'common'},
  {id:'red-stitch',name:'Red Stitch',description:'Might and Trick damage +12%.',mechanicId:'affinity-damage-red',value:0.12,rarity:'common'},
  {id:'copper-trace',name:'Copper Trace',description:'Tech and Mystic damage +12%.',mechanicId:'affinity-damage-blue',value:0.12,rarity:'common'},
  {id:'second-wind',name:'Second Wind',description:'The first ally to fall below 30% Max HP each battle heals 15% Max HP.',mechanicId:'low-hp-heal',value:0.15,rarity:'common'},
  {id:'old-bandana',name:'Old Bandana',description:'Every ally starts each battle Fortified for 1 turn.',mechanicId:'battle-start-fortified',value:1,rarity:'common'},
  {id:'duct-tape',name:'Duct Tape',description:'Positive statuses your allies apply last one additional turn.',mechanicId:'positive-duration',value:1,rarity:'common'},
  {id:'worn-grip',name:'Worn Grip',description:"Each ally's first attack in a battle deals 20% more damage.",mechanicId:'first-attack-damage',value:0.20,rarity:'common'},
  {id:'scuffed-knuckles',name:'Scuffed Knuckles',description:'Allies deal 20% more damage while below 40% Max HP.',mechanicId:'wounded-damage',value:0.20,rarity:'common'},
  {id:'bike-bearing',name:'Bike Bearing',description:'Party Speed +10%.',mechanicId:'party-speed',value:0.10,rarity:'uncommon'},
  {id:'shop-chit',name:'Shop Chit',description:'Shop prices are 12% lower.',mechanicId:'shop-discount',value:0.12,rarity:'uncommon'},
  {id:'elite-bandage',name:'Elite Bandage',description:'After an elite victory, heal the party for 10% Max HP.',mechanicId:'elite-heal',value:0.10,rarity:'uncommon'},
  {id:'spare-battery',name:'Spare Battery',description:"Hans's deployables last one additional turn.",mechanicId:'hans-duration',value:1,rarity:'uncommon'},
  {id:'thermos',name:'Thermos',description:"After every battle victory, restore 2 PP to each ally's most-drained move.",mechanicId:'victory-pp',value:2,rarity:'uncommon'},
  {id:'pressed-flower',name:'Pressed Flower',description:'Healing received is 8% stronger.',mechanicId:'healing-received',value:0.08,rarity:'uncommon'},
  {id:'chalk-outline',name:'Chalk Outline',description:'The first ally knocked out each battle leaves 15 coins behind.',mechanicId:'ko-coins',value:15,rarity:'uncommon'},
  {id:'blue-tonic-cap',name:'Blue Tonic Cap',description:'PP restoration effects are 25% stronger.',mechanicId:'pp-restore',value:0.25,rarity:'rare'},
  {id:'jumper-cable',name:'Jumper Cable',description:'Each ally starts every battle with 2 extra PP on their lowest-PP move.',mechanicId:'battle-start-pp',value:2,rarity:'rare'},
  {id:'field-pack',name:'Field Pack',description:'Use up to three field items after each completed node.',mechanicId:'field-use-limit',value:3,rarity:'uncommon'},
  {id:'deep-pockets',name:'Deep Pockets',description:'Carry seven individual consumables instead of six.',mechanicId:'inventory-capacity',value:7,rarity:'uncommon'},
];

const map = new Map(RELICS.map(item => [item.id,item]));
export function getRelic(id:string): RelicDefinition { const value=map.get(id); if(!value) throw new Error(`Unknown relic id: ${id}`); return value; }
