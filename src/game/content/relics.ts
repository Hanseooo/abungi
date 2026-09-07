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
  {id:'red-stitch',name:'Red Stitch',description:'Might damage +10%.',mechanicId:'affinity-damage-might',value:0.10,rarity:'common'},
  {id:'copper-trace',name:'Copper Trace',description:'Tech damage +10%.',mechanicId:'affinity-damage-tech',value:0.10,rarity:'common'},
  {id:'violet-thread',name:'Violet Thread',description:'Mystic damage +10%.',mechanicId:'affinity-damage-mystic',value:0.10,rarity:'common'},
  {id:'marked-card',name:'Marked Card',description:'Trick damage +10%.',mechanicId:'affinity-damage-trick',value:0.10,rarity:'common'},
  {id:'sticky-label',name:'Sticky Label',description:'The first Trick status applied each battle lasts +1 turn.',mechanicId:'first-trick-duration',value:1,rarity:'common'},
  {id:'first-aid-tape',name:'First-Aid Tape',description:'The first heal each battle is 20% stronger.',mechanicId:'first-heal-relic',value:0.20,rarity:'common'},
  {id:'bike-bearing',name:'Bike Bearing',description:'Party Speed +10%.',mechanicId:'party-speed',value:0.10,rarity:'uncommon'},
  {id:'shop-chit',name:'Shop Chit',description:'Shop prices are 12% lower.',mechanicId:'shop-discount',value:0.12,rarity:'uncommon'},
  {id:'elite-bandage',name:'Elite Bandage',description:'After an elite victory, heal the party for 10% Max HP.',mechanicId:'elite-heal',value:0.10,rarity:'uncommon'},
  {id:'spare-battery',name:'Spare Battery',description:"Hans's deployables last one additional turn.",mechanicId:'hans-duration',value:1,rarity:'uncommon'},
  {id:'lucky-centavo',name:'Lucky Token',description:'The first critical hit each battle grants 5 coins.',mechanicId:'first-crit-coins',value:5,rarity:'uncommon'},
  {id:'pressed-flower',name:'Pressed Flower',description:'Healing received is 8% stronger.',mechanicId:'healing-received',value:0.08,rarity:'uncommon'},
  {id:'chalk-outline',name:'Chalk Outline',description:'The first ally knocked out each battle leaves 15 coins behind.',mechanicId:'ko-coins',value:15,rarity:'uncommon'},
  {id:'blue-tonic-cap',name:'Blue Tonic Cap',description:'PP restoration effects are 25% stronger.',mechanicId:'pp-restore',value:0.25,rarity:'rare'},
  {id:'jumper-cable',name:'Jumper Cable',description:'Each ally starts every battle with 2 extra PP on their lowest-PP move.',mechanicId:'battle-start-pp',value:2,rarity:'rare'},
];

const map = new Map(RELICS.map(item => [item.id,item]));
export function getRelic(id:string): RelicDefinition { const value=map.get(id); if(!value) throw new Error(`Unknown relic id: ${id}`); return value; }
