export type EventEffect =
  | {kind:'coins'; amount:number}
  | {kind:'partyHpPercent'; amount:number}
  | {kind:'restoreMissingPpPercent'; amount:number}
  | {kind:'item'; itemId:string}
  | {kind:'randomRelic'}
  | {kind:'battle'; encounterId:string}
  | {kind:'wagerCoins'; cost:number; winChance:number; payout:number}
  | {kind:'tradeItems'}
  | {kind:'pawnItem'}
  | {kind:'upgradeAbility'}
  | {kind:'pressRelic';mode:'safe'|'risk'}
  | {kind:'recruit'};

export type EventSelection =
  | {kind:'tradeItems';itemIds:[string,string];offeredItemId:string}
  | {kind:'pawnItem';itemId:string}
  | {kind:'upgradeAbility';characterId:string;abilityId:string}
  | {kind:'pressRelic';relicId:string}
  | {kind:'recruit';candidateId:string;outgoingCharacterId:string;upgradeIds:string[]};

export interface EventChoice { id:string; label:string; hint:string; resultText:string; requiresCharacterId?:string; effects:EventEffect[] }
export type EventCategory = 'recovery'|'trade'|'gamble'|'transmutation'|'recruitment'|'sacrifice'|'combat'|'lore';
export interface EventDefinition { id:string; title:string; text:string; theme:'rain'|'crate'|'shrine'|'food'|'alley'|'locker'|'game'|'repair'|'quiet'|'market'|'danger'|'swap'|'training'|'press'|'recruitment'; category:EventCategory; weight:number; choices:EventChoice[] }

export const EVENTS: EventDefinition[] = [
  {id:'swap-meet',title:'Swap Meet',theme:'swap',category:'transmutation',weight:1,text:'The trader accepts things you can carry, not promises.',choices:[
    {id:'trade',label:'Trade two',hint:'Trade two items for one offered non-Rare item.',resultText:'The trader makes the exchange.',effects:[{kind:'tradeItems'}]},
    {id:'pawn',label:'Pawn one',hint:'Sell one item for half its listed price.',resultText:'The trader counts out the coins.',effects:[{kind:'pawnItem'}]},
    {id:'leave',label:'Leave',hint:'No cost.',resultText:'You keep walking.',effects:[]}
  ]},
  {id:'the-press',title:'The Press',theme:'press',category:'transmutation',weight:0.5,text:'The rollers flatten old promises into something else.',choices:[
    {id:'safe',label:'Safe exchange',hint:'Sacrifice one owned Common relic for a different unowned Common relic.',resultText:'The press makes a clean exchange.',effects:[{kind:'pressRelic',mode:'safe'}]},
    {id:'risk',label:'Risk the press',hint:'Sacrifice one owned Common relic. 45% Uncommon, 35% Common, 20% destruction.',resultText:'The rollers turn once.',effects:[{kind:'pressRelic',mode:'risk'}]},
    {id:'leave',label:'Leave',hint:'No cost.',resultText:'You leave the rollers alone.',effects:[]}
  ]},
  {id:'sparring-yard',title:'Sparring Yard',theme:'training',category:'trade',weight:0.5,text:'One lesson. Paid in coins and bruises.',choices:[
    {id:'saq-coach',label:'Let Saq coach the session',hint:'Spend 16 coins and 8% Max HP from living allies to upgrade one ability.',resultText:'Saq runs the drill properly, and the bruises are on purpose.',requiresCharacterId:'saq',effects:[{kind:'coins',amount:-16},{kind:'partyHpPercent',amount:-0.08},{kind:'upgradeAbility'}]},
    {id:'train',label:'Train',hint:'Spend 22 coins and 8% Max HP from living allies to upgrade one ability.',resultText:'The lesson leaves a mark.',effects:[{kind:'coins',amount:-22},{kind:'partyHpPercent',amount:-0.08},{kind:'upgradeAbility'}]},
    {id:'leave',label:'Leave',hint:'No cost.',resultText:'You save the lesson for another day.',effects:[]}
  ]},
  {id:'fourth-chair',title:'The Fourth Chair',theme:'recruitment',category:'recruitment',weight:0,text:'A fourth chair waits beside the road. Only three can travel on.',choices:[
    {id:'recruit',label:'Consider a recruit',hint:'Replace one party member with a stranger, carrying forward part of the journey.',resultText:'The fourth chair is filled.',effects:[{kind:'recruit'}]},
    {id:'keep',label:'Keep Current Party',hint:'No cost. Keep the party as it is.',resultText:'The party keeps walking together.',effects:[]}
  ]},
  {id:'rain-stall',title:'Rain on the Stall',theme:'rain',category:'recovery',weight:1,text:'A tarp snaps in the wind while a vendor waves you under.',choices:[
    {id:'help',label:'Help tie it down',hint:'Gain 1 Patch Kit if your pack has room.',resultText:'The vendor pays in supplies.',effects:[{kind:'item',itemId:'patch-kit'}]},
    {id:'wait',label:'Wait out the rain',hint:'Restore 8% Max HP to each living party member.',resultText:'The party catches its breath.',effects:[{kind:'partyHpPercent',amount:0.08}]}
  ]},
  {id:'loose-crate',title:'Loose Crate',theme:'crate',category:'trade',weight:1,text:'A battered crate sits half-open beside a service road.',choices:[
    {id:'open',label:'Open it',hint:'Gain 1 PP Tonic if your pack has room.',resultText:'A usable tonic rolls out.',effects:[{kind:'item',itemId:'pp-tonic'}]},
    {id:'sell',label:'Tip off a collector',hint:'Gain 12 coins.',resultText:'A passing trader pays for the tip.',effects:[{kind:'coins',amount:12}]}
  ]},
  {id:'paper-shrine',title:'Folded Tokens',theme:'shrine',category:'trade',weight:1,text:'Tiny folded paper pieces hang from a quiet frame.',choices:[
    {id:'rest',label:'Leave one and rest',hint:'Restore 22% of missing PP across the party.',resultText:'The pause clears your head.',effects:[{kind:'restoreMissingPpPercent',amount:0.22}]},
    {id:'take',label:'Offer 16 coins for a token',hint:'Spend 16 coins · gain a random unowned relic.',resultText:'The token settles into your pack with surprising weight.',effects:[{kind:'coins',amount:-16},{kind:'randomRelic'}]}
  ]},
  {id:'night-cart',title:'Night Cart',theme:'food',category:'recovery',weight:1,text:'A cart of steaming food appears where the road narrows.',choices:[
    {id:'jiro-cooks',label:'Let Jiro cook',hint:'Restore 16% Max HP to living allies.',resultText:'Jiro turns the cart into a proper meal.',requiresCharacterId:'jiro',effects:[{kind:'partyHpPercent',amount:0.16}]},
    {id:'eat',label:'Pay 8 coins and eat',hint:'Spend 8 coins · restore 16% Max HP to living allies.',resultText:'A hot meal steadies the party.',effects:[{kind:'coins',amount:-8},{kind:'partyHpPercent',amount:0.16}]},
    {id:'pass',label:'Keep moving',hint:'No cost · no recovery.',resultText:'You keep your coins.',effects:[]}
  ]},
  {id:'shortcut',title:'Shortcut?',theme:'alley',category:'combat',weight:1,text:'A hand-painted arrow points toward a darker alley.',choices:[
    {id:'risk',label:'Take the shortcut',hint:'Fight a Fast Lane encounter and earn its full battle rewards.',resultText:'It is not a shortcut. At least the trouble is worth something.',effects:[{kind:'battle',encounterId:'normal-fastlane'}]},
    {id:'safe',label:'Stay on the main route',hint:'Avoid combat · gain nothing.',resultText:'The detour costs time, not blood.',effects:[]}
  ]},
  {id:'old-locker',title:'Old Locker',theme:'locker',category:'sacrifice',weight:1,text:'A dented locker still has one working latch.',choices:[
    {id:'greg-force',label:'Let Greg force it',hint:'Lose 8% Max HP from each living ally; gain 1 Field Ration and 8 coins.',resultText:'Greg forces the latch and finds a ration with loose change.',requiresCharacterId:'greg',effects:[{kind:'partyHpPercent',amount:-0.08},{kind:'item',itemId:'field-ration'},{kind:'coins',amount:8}]},
    {id:'force',label:'Force it open',hint:'Lose 5% Max HP from each living ally · gain 1 Field Ration if space permits.',resultText:'Inside is a field ration. The rust takes its own payment.',effects:[{kind:'partyHpPercent',amount:-0.05},{kind:'item',itemId:'field-ration'}]},
    {id:'leave',label:'Leave it alone',hint:'No cost · no reward.',resultText:'Nothing happens. Sometimes that is fine.',effects:[]}
  ]},
  {id:'street-game',title:'Cardboard Wheel',theme:'game',category:'gamble',weight:1,text:'A quick-handed stranger offers a wager. The odds are written right on the cardboard.',choices:[
    {id:'play',label:'Small stake',hint:'Cost 6; 55% win 14 (net +8); 45% lose 6.',resultText:'The wheel stops.',effects:[{kind:'wagerCoins',cost:6,winChance:0.55,payout:14}]},
    {id:'medium',label:'Medium stake',hint:'Cost 15; 45% win 36 (net +21); 55% lose 15.',resultText:'The wheel stops.',effects:[{kind:'wagerCoins',cost:15,winChance:0.45,payout:36}]},
    {id:'large',label:'Large stake',hint:'Cost 30; 35% win 90 (net +60); 65% lose 30.',resultText:'The wheel stops.',effects:[{kind:'wagerCoins',cost:30,winChance:0.35,payout:90}]},
    {id:'yeeho-stake',label:'Yeeho stake',hint:'Cost 60; 25% win 260 (net +200); 75% lose 60.',resultText:'The wheel stops.',requiresCharacterId:'yeeho',effects:[{kind:'wagerCoins',cost:60,winChance:0.25,payout:260}]},
    {id:'skip',label:'Decline',hint:'Keep your coins.',resultText:'The stranger shrugs and moves on.',effects:[]}
  ]},
  {id:'repair-bench',title:'Repair Bench',theme:'repair',category:'recovery',weight:1,text:'A public workbench still has a little charge left.',choices:[
    {id:'hans-tune',label:'Let Hans tune it',hint:'Restore 40% of missing PP across the party.',resultText:'Hans gets more out of the bench.',requiresCharacterId:'hans',effects:[{kind:'restoreMissingPpPercent',amount:0.40}]},
    {id:'charge',label:'Tune the gear',hint:'Restore 25% of missing PP across the party.',resultText:'The remaining charge is enough for a tune-up.',effects:[{kind:'restoreMissingPpPercent',amount:0.25}]},
    {id:'salvage',label:'Salvage a part',hint:'Gain 1 Energy Drink if your pack has room.',resultText:'You find something worth carrying.',effects:[{kind:'item',itemId:'energy-drink'}]}
  ]},
  {id:'quiet-corner',title:'Quiet Corner',theme:'quiet',category:'recovery',weight:1,text:'For once, nobody is asking anything from you.',choices:[
    {id:'breathe',label:'Take five',hint:'Restore 8% Max HP and 8% of missing PP.',resultText:'The party recovers a little.',effects:[{kind:'partyHpPercent',amount:0.08},{kind:'restoreMissingPpPercent',amount:0.08}]},
    {id:'move',label:'Keep momentum',hint:'Gain 9 coins.',resultText:'You find a few dropped coins on the way out.',effects:[{kind:'coins',amount:9}]}
  ]},
  {id:'bulk-deal',title:'Bulk Deal',theme:'market',category:'trade',weight:1,text:'A stallholder is packing up early and wants the shelf empty before dark.',choices:[
    {id:'leandre-crate',label:'Let Leandre negotiate',hint:'Spend 14 coins; gain 1 Field Ration and 1 PP Tonic.',resultText:'Leandre closes a better deal.',requiresCharacterId:'leandre',effects:[{kind:'coins',amount:-14},{kind:'item',itemId:'field-ration'},{kind:'item',itemId:'pp-tonic'}]},
    {id:'buy',label:'Pay 20 coins for the crate',hint:'Spend 20 coins · gain 1 Field Ration and 1 PP Tonic if your pack has room.',resultText:'Two useful things and one hurried handshake.',effects:[{kind:'coins',amount:-20},{kind:'item',itemId:'field-ration'},{kind:'item',itemId:'pp-tonic'}]},
    {id:'saq-organize',label:'Let Saq organize the pickup',hint:'Gain 20 coins · no items.',resultText:'Saq sorts the shelf into three stacks, and the stallholder pays for the hour.',requiresCharacterId:'saq',effects:[{kind:'coins',amount:20}]},
    {id:'help',label:'Help him pack instead',hint:'Gain 14 coins · no items.',resultText:'He pays you for the hour rather than the crate.',effects:[{kind:'coins',amount:14}]}
  ]},
  {id:'live-wire',title:'Live Wire',theme:'danger',category:'sacrifice',weight:1,text:'A cable hangs low across the path, still humming.',choices:[
    {id:'earl-reroute',label:'Let Earl reroute it',hint:'Lose 4% Max HP from each living ally; restore 30% of missing PP across the party.',resultText:'Earl makes the current safer, not painless.',requiresCharacterId:'earl',effects:[{kind:'partyHpPercent',amount:-0.04},{kind:'restoreMissingPpPercent',amount:0.30}]},
    {id:'reroute',label:'Reroute it by hand',hint:'Lose 9% Max HP from each living ally · restore 30% of missing PP across the party.',resultText:'Everything charges. So do your hands.',effects:[{kind:'partyHpPercent',amount:-0.09},{kind:'restoreMissingPpPercent',amount:0.30}]},
    {id:'around',label:'Go the long way',hint:'Gain 7 coins · no risk.',resultText:'The detour passes a dropped purse.',effects:[{kind:'coins',amount:7}]}
  ]},
];

const map = new Map(EVENTS.map(item => [item.id,item]));
export function getEvent(id:string): EventDefinition { const value=map.get(id); if(!value) throw new Error(`Unknown event id: ${id}`); return value; }
