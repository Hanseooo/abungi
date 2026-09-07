export interface RelicDefinition {
  id: string;
  name: string;
  description: string;
  mechanicId: string;
  value: number;
}

export const RELICS: RelicDefinition[] = [
  {id:'cardboard-plate',name:'Cardboard Plate',description:'First damage received each battle is reduced by 35%.',mechanicId:'first-hit-reduction',value:0.35},
  {id:'red-stitch',name:'Red Stitch',description:'Might damage +10%.',mechanicId:'affinity-damage-might',value:0.10},
  {id:'copper-trace',name:'Copper Trace',description:'Tech damage +10%.',mechanicId:'affinity-damage-tech',value:0.10},
  {id:'violet-thread',name:'Violet Thread',description:'Mystic damage +10%.',mechanicId:'affinity-damage-mystic',value:0.10},
  {id:'marked-card',name:'Marked Card',description:'Trick damage +10%.',mechanicId:'affinity-damage-trick',value:0.10},
  {id:'sticky-label',name:'Sticky Label',description:'The first Trick status applied each battle lasts +1 turn.',mechanicId:'first-trick-duration',value:1},
  {id:'first-aid-tape',name:'First-Aid Tape',description:'The first heal each battle is 20% stronger.',mechanicId:'first-heal-relic',value:0.20},
  {id:'bike-bearing',name:'Bike Bearing',description:'Party Speed +10%.',mechanicId:'party-speed',value:0.10},
  {id:'shop-chit',name:'Shop Chit',description:'Shop prices are 12% lower.',mechanicId:'shop-discount',value:0.12},
  {id:'elite-bandage',name:'Elite Bandage',description:'After an elite victory, heal the party for 10% Max HP.',mechanicId:'elite-heal',value:0.10},
  {id:'spare-battery',name:'Spare Battery',description:"Hans's deployables last one additional turn.",mechanicId:'hans-duration',value:1},
  {id:'lucky-centavo',name:'Lucky Token',description:'The first critical hit each battle grants 5 coins.',mechanicId:'first-crit-coins',value:5},
  {id:'blue-tonic-cap',name:'Blue Tonic Cap',description:'PP restoration effects are 25% stronger.',mechanicId:'pp-restore',value:0.25},
  {id:'pressed-flower',name:'Pressed Flower',description:'Healing received is 8% stronger.',mechanicId:'healing-received',value:0.08},
];

const map = new Map(RELICS.map(item => [item.id,item]));
export function getRelic(id:string): RelicDefinition { const value=map.get(id); if(!value) throw new Error(`Unknown relic id: ${id}`); return value; }
