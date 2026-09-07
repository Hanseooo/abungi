export type EventEffect =
  | {kind:'coins'; amount:number}
  | {kind:'partyHpPercent'; amount:number}
  | {kind:'restoreMissingPpPercent'; amount:number}
  | {kind:'item'; itemId:string}
  | {kind:'randomRelic'}
  | {kind:'battle'; encounterId:string}
  | {kind:'wagerCoins'; cost:number; winChance:number; payout:number};

export interface EventChoice { id:string; label:string; hint:string; resultText:string; effects:EventEffect[] }
export interface EventDefinition { id:string; title:string; text:string; theme:'rain'|'crate'|'shrine'|'food'|'alley'|'locker'|'game'|'repair'|'quiet'|'market'|'danger'; choices:EventChoice[] }

export const EVENTS: EventDefinition[] = [
  {id:'rain-stall',title:'Rain on the Stall',theme:'rain',text:'A tarp snaps in the wind while a vendor waves you under.',choices:[
    {id:'help',label:'Help tie it down',hint:'Gain 1 Patch Kit if your pack has room.',resultText:'The vendor pays in supplies.',effects:[{kind:'item',itemId:'patch-kit'}]},
    {id:'wait',label:'Wait out the rain',hint:'Restore 8% Max HP to each living party member.',resultText:'The party catches its breath.',effects:[{kind:'partyHpPercent',amount:0.08}]}
  ]},
  {id:'loose-crate',title:'Loose Crate',theme:'crate',text:'A battered crate sits half-open beside a service road.',choices:[
    {id:'open',label:'Open it',hint:'Gain 1 PP Tonic if your pack has room.',resultText:'A usable tonic rolls out.',effects:[{kind:'item',itemId:'pp-tonic'}]},
    {id:'sell',label:'Tip off a collector',hint:'Gain 12 coins.',resultText:'A passing trader pays for the tip.',effects:[{kind:'coins',amount:12}]}
  ]},
  {id:'paper-shrine',title:'Folded Tokens',theme:'shrine',text:'Tiny folded paper pieces hang from a quiet frame.',choices:[
    {id:'rest',label:'Leave one and rest',hint:'Restore 22% of missing PP across the party.',resultText:'The pause clears your head.',effects:[{kind:'restoreMissingPpPercent',amount:0.22}]},
    {id:'take',label:'Offer 16 coins for a token',hint:'Spend 16 coins · gain a random undiscovered relic.',resultText:'The token settles into your pack with surprising weight.',effects:[{kind:'coins',amount:-16},{kind:'randomRelic'}]}
  ]},
  {id:'night-cart',title:'Night Cart',theme:'food',text:'A cart of steaming food appears where the road narrows.',choices:[
    {id:'eat',label:'Pay 8 coins and eat',hint:'Spend 8 coins · restore 16% Max HP to living allies.',resultText:'A hot meal steadies the party.',effects:[{kind:'coins',amount:-8},{kind:'partyHpPercent',amount:0.16}]},
    {id:'pass',label:'Keep moving',hint:'No cost · no recovery.',resultText:'You keep your coins.',effects:[]}
  ]},
  {id:'shortcut',title:'Shortcut?',theme:'alley',text:'A hand-painted arrow points toward a darker alley.',choices:[
    {id:'risk',label:'Take the shortcut',hint:'Fight a Fast Lane encounter and earn its full battle rewards.',resultText:'It is not a shortcut. At least the trouble is worth something.',effects:[{kind:'battle',encounterId:'normal-fastlane'}]},
    {id:'safe',label:'Stay on the main route',hint:'Avoid combat · gain nothing.',resultText:'The detour costs time, not blood.',effects:[]}
  ]},
  {id:'old-locker',title:'Old Locker',theme:'locker',text:'A dented locker still has one working latch.',choices:[
    {id:'force',label:'Force it open',hint:'Lose 5% Max HP from each living ally · gain 1 Field Ration if space permits.',resultText:'Inside is a field ration. The rust takes its own payment.',effects:[{kind:'partyHpPercent',amount:-0.05},{kind:'item',itemId:'field-ration'}]},
    {id:'leave',label:'Leave it alone',hint:'No cost · no reward.',resultText:'Nothing happens. Sometimes that is fine.',effects:[]}
  ]},
  {id:'street-game',title:'Three Cups',theme:'game',text:'A quick-handed stranger offers a wager. The odds are written right on the cardboard.',choices:[
    {id:'play',label:'Wager 5 coins',hint:'50%: win 10 coins · 50%: lose the 5-coin wager.',resultText:'The cups stop moving.',effects:[{kind:'wagerCoins',cost:5,winChance:0.50,payout:10}]},
    {id:'skip',label:'Decline',hint:'Keep your coins.',resultText:'The stranger shrugs and moves on.',effects:[]}
  ]},
  {id:'repair-bench',title:'Repair Bench',theme:'repair',text:'A public workbench still has a little charge left.',choices:[
    {id:'charge',label:'Tune the gear',hint:'Restore 25% of missing PP across the party.',resultText:'The remaining charge is enough for a tune-up.',effects:[{kind:'restoreMissingPpPercent',amount:0.25}]},
    {id:'salvage',label:'Salvage a part',hint:'Gain 1 Energy Drink if your pack has room.',resultText:'You find something worth carrying.',effects:[{kind:'item',itemId:'energy-drink'}]}
  ]},
  {id:'quiet-corner',title:'Quiet Corner',theme:'quiet',text:'For once, nobody is asking anything from you.',choices:[
    {id:'breathe',label:'Take five',hint:'Restore 8% Max HP and 8% of missing PP.',resultText:'The party recovers a little.',effects:[{kind:'partyHpPercent',amount:0.08},{kind:'restoreMissingPpPercent',amount:0.08}]},
    {id:'move',label:'Keep momentum',hint:'Gain 9 coins.',resultText:'You find a few dropped coins on the way out.',effects:[{kind:'coins',amount:9}]}
  ]},
  {id:'bulk-deal',title:'Bulk Deal',theme:'market',text:'A stallholder is packing up early and wants the shelf empty before dark.',choices:[
    {id:'buy',label:'Pay 20 coins for the crate',hint:'Spend 20 coins · gain 1 Field Ration and 1 PP Tonic if your pack has room.',resultText:'Two useful things and one hurried handshake.',effects:[{kind:'coins',amount:-20},{kind:'item',itemId:'field-ration'},{kind:'item',itemId:'pp-tonic'}]},
    {id:'help',label:'Help him pack instead',hint:'Gain 14 coins · no items.',resultText:'He pays you for the hour rather than the crate.',effects:[{kind:'coins',amount:14}]}
  ]},
  {id:'live-wire',title:'Live Wire',theme:'danger',text:'A cable hangs low across the path, still humming.',choices:[
    {id:'reroute',label:'Reroute it by hand',hint:'Lose 9% Max HP from each living ally · restore 30% of missing PP across the party.',resultText:'Everything charges. So do your hands.',effects:[{kind:'partyHpPercent',amount:-0.09},{kind:'restoreMissingPpPercent',amount:0.30}]},
    {id:'around',label:'Go the long way',hint:'Gain 7 coins · no risk.',resultText:'The detour passes a dropped purse.',effects:[{kind:'coins',amount:7}]}
  ]},
];

const map = new Map(EVENTS.map(item => [item.id,item]));
export function getEvent(id:string): EventDefinition { const value=map.get(id); if(!value) throw new Error(`Unknown event id: ${id}`); return value; }
