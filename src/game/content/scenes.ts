import { SeededRng, hashText } from '../core/rng/seededRng.js';
import { getEvent } from './events.js';

export type SceneId =
  | 'party-departure'
  | 'region-1-intro' | 'region-2-intro' | 'region-3-intro'
  | 'elite-intro'
  | 'boss-jonlow-intro' | 'boss-klyde-intro' | 'boss-warden-intro'
  | 'shop-arrival' | 'shop-exit' | 'event-arrival'
  | 'region-complete' | 'run-victory';

export interface SceneLine { speaker: string; text: string }
export interface SceneVariant { id:string; lines:SceneLine[]; relationshipId?:string }
export interface SceneDefinition {
  id: SceneId;
  title: string;
  kicker: string;
  variants: SceneVariant[];
  focusAssetId?: string;
  relationshipVariants?: Array<{ relationshipId:string; requiresPartyId:string; companionAssetId?:string; variants:SceneVariant[] }>;
}
export interface SceneContext { seed:number; regionIndex:number; partyIds:string[]; encounterId?:string; eventId?:string }
export interface ResolvedScene extends SceneVariant { sceneId:SceneId; title:string; kicker:string; focusAssetId?:string; companionAssetId?:string; theme?:string }

const SCENES:SceneDefinition[]=[
  {id:'party-departure',title:'Three Cutouts, One Road',kicker:'RUN START',variants:[
    {id:'depart-a',lines:[{speaker:'Narrator',text:'Three figures step onto the painted road. Everything they spend from here matters.'}]},
    {id:'depart-b',lines:[{speaker:'Narrator',text:'The table quiets. Three cutouts lean forward, and the first route unfolds.'}]},
  ],relationshipVariants:[{relationshipId:'saq-departure',requiresPartyId:'saq',companionAssetId:'character-saq',variants:[
    {id:'depart-saq',relationshipId:'saq-departure',lines:[{speaker:'Saq',text:'Keep close. You can argue when we are somewhere safer.'}]},
  ]}]},
  {id:'region-1-intro',title:'The First Fold',kicker:'REGION I',variants:[
    {id:'r1-a',lines:[{speaker:'Narrator',text:'Cardboard alleys rise from the table. Somewhere ahead, something hungry is waiting.'}]},
    {id:'r1-b',lines:[{speaker:'Narrator',text:'The first district is all tape, rain, and bad shortcuts. Keep some PP in reserve.'}]},
  ]},
  {id:'region-2-intro',title:'Wrong Turns',kicker:'REGION II',variants:[
    {id:'r2-a',lines:[{speaker:'Narrator',text:'The road narrows into crooked signs and laughter that comes from the wrong direction.'}]},
    {id:'r2-b',lines:[{speaker:'Narrator',text:'Fresh paper scenery slides into place. The enemies here hit faster and lie better.'}]},
  ],relationshipVariants:[{relationshipId:'saq-region',requiresPartyId:'saq',companionAssetId:'character-saq',variants:[
    {id:'r2-saq',relationshipId:'saq-region',lines:[{speaker:'Saq',text:'New district, same bad habits. Stay where I can reach you.'}]},
  ]}]},
  {id:'region-3-intro',title:'Behind the Gate',kicker:'REGION III',variants:[
    {id:'r3-a',lines:[{speaker:'Narrator',text:'Metal braces clamp onto the stage. The final route has fewer places to hide.'}]},
    {id:'r3-b',lines:[{speaker:'Narrator',text:'The last backdrop locks upright. Every saved item suddenly feels heavier.'}]},
  ]},
  {id:'elite-intro',title:'Heavy Footsteps',kicker:'ELITE',variants:[
    {id:'elite-a',lines:[{speaker:'Narrator',text:'The table shakes once. This one is worth more because it can take more from you.'}]},
    {id:'elite-b',lines:[{speaker:'Narrator',text:'A reinforced cutout blocks the lane. Turning back is no longer an option.'}]},
  ]},
  {id:'boss-jonlow-intro',title:'Jonlow, the Glutton',kicker:'BOSS',focusAssetId:'boss-jonlow',variants:[
    {id:'jonlow-a',lines:[{speaker:'Jonlow',text:'Cook for me.'}]},
    {id:'jonlow-b',lines:[{speaker:'Jonlow',text:'Bring something worth eating, or become it.'}]},
  ],relationshipVariants:[{relationshipId:'siblings-jonlow-jiro',requiresPartyId:'jiro',companionAssetId:'character-jiro',variants:[
    {id:'jonlow-jiro-a',relationshipId:'siblings-jonlow-jiro',lines:[{speaker:'Jonlow',text:"I can't live without my brother."},{speaker:'Jiro',text:'Then stop making me clean up after you.'}]},
    {id:'jonlow-jiro-b',relationshipId:'siblings-jonlow-jiro',lines:[{speaker:'Jonlow',text:'Bring my brother home.'},{speaker:'Jiro',text:'I came here on purpose, Jonlow.'}]},
    {id:'jonlow-jiro-c',relationshipId:'siblings-jonlow-jiro',lines:[{speaker:'Jonlow',text:'Cook for me, brother.'},{speaker:'Jiro',text:'Not until you learn some manners.'}]},
  ]}]},
  {id:'boss-klyde-intro',title:'Klyde, the Psycho',kicker:'BOSS',focusAssetId:'boss-klyde',variants:[
    {id:'klyde-a',lines:[{speaker:'Klyde',text:'Pick a direction. I will be there first.'}]},
    {id:'klyde-b',lines:[{speaker:'Klyde',text:'You look way too calm.'}]},
  ],relationshipVariants:[{relationshipId:'siblings-klyde-earl',requiresPartyId:'earl',companionAssetId:'character-earl',variants:[
    {id:'klyde-earl-a',relationshipId:'siblings-klyde-earl',lines:[{speaker:'Klyde',text:'There you are, brother.'},{speaker:'Earl',text:'I was hoping you would miss me.'}]},
    {id:'klyde-earl-b',relationshipId:'siblings-klyde-earl',lines:[{speaker:'Klyde',text:'Still patching everybody up, Earl?'},{speaker:'Earl',text:'Somebody has to.'}]},
  ]}]},
  {id:'boss-warden-intro',title:'The Warden',kicker:'FINAL BOSS',focusAssetId:'boss-warden',variants:[
    {id:'warden-a',lines:[{speaker:'Warden',text:'Unauthorized movement ends here.'}]},
    {id:'warden-b',lines:[{speaker:'Warden',text:'Route privilege revoked.'}]},
  ],relationshipVariants:[{relationshipId:'saq-warden',requiresPartyId:'saq',companionAssetId:'character-saq',variants:[
    {id:'warden-saq',relationshipId:'saq-warden',lines:[{speaker:'Warden',text:'Order is maintained.'},{speaker:'Saq',text:'Order should protect people.'}]},
  ]}]},
  {id:'event-arrival',title:'Roadside Event',kicker:'EVENT',variants:[
    {id:'event-generic-a',lines:[{speaker:'Narrator',text:'Something on the roadside asks for a decision before the route continues.'}]},
  ]},
  {id:'shop-arrival',title:"Lara's Shop",kicker:'SHOP',variants:[
    {id:'shop-a',lines:[{speaker:'Lara',text:'Look first. Regret after.'}]},
    {id:'shop-b',lines:[{speaker:'Lara',text:'Coins on the counter. No dramatic speeches.'}]},
    {id:'shop-c',lines:[{speaker:'Lara',text:'I restocked. Whether that helps you is another question.'}]},
  ]},
  {id:'shop-exit',title:'Back to the Route',kicker:'SHOP',variants:[
    {id:'shop-exit-a',lines:[{speaker:'Lara',text:'Try not to bring the merchandise back broken.'}]},
    {id:'shop-exit-b',lines:[{speaker:'Lara',text:'If you survive, tell people I was reasonably priced.'}]},
  ]},
  {id:'region-complete',title:'Backdrop Change',kicker:'REGION CLEARED',variants:[
    {id:'region-done-a',lines:[{speaker:'Narrator',text:'The defeated backdrop folds flat. A harsher one rises behind it.'}]},
    {id:'region-done-b',lines:[{speaker:'Narrator',text:'Tape peels, scenery shifts, and the road continues before anyone can celebrate.'}]},
  ]},
  {id:'run-victory',title:'Table Cleared',kicker:'VICTORY',variants:[
    {id:'win-a',lines:[{speaker:'Narrator',text:'The last enemy drops. For a moment, the whole cardboard world stays perfectly still.'}]},
    {id:'win-b',lines:[{speaker:'Narrator',text:'The final cutout falls backward. The route has nowhere left to go.'}]},
  ]},
];


const ELITE_SCENE_OVERRIDES:Record<string,{title:string;focusAssetId:string;variants:SceneVariant[]}>= {
  'elite-broker': {title:'The Broker',focusAssetId:'elite-broker',variants:[
    {id:'broker-a',lines:[{speaker:'The Broker',text:'Everything has a price. You just brought yours.'}]},
    {id:'broker-b',lines:[{speaker:'The Broker',text:'Bad deal for you. Excellent margin for me.'}]},
  ]},
  'elite-ironclad': {title:'Ironclad',focusAssetId:'elite-ironclad',variants:[
    {id:'ironclad-a',lines:[{speaker:'Ironclad',text:'Route closed. Try moving me.'}]},
    {id:'ironclad-b',lines:[{speaker:'Narrator',text:'Ironclad plants both feet. The cardboard floor buckles underneath.'}]},
  ]},
  'elite-night-maw': {title:'Night Maw',focusAssetId:'elite-night-maw',variants:[
    {id:'maw-a',lines:[{speaker:'Night Maw',text:'You carried plenty of life all this way.'}]},
    {id:'maw-b',lines:[{speaker:'Narrator',text:'A dark cutout unfolds twice before it finally stands upright.'}]},
  ]},
};

const EVENT_ARRIVAL_LINES:Record<string,SceneVariant[]> = {
  'rain-stall': [
    {id:'rain-a',lines:[{speaker:'Vendor',text:'Hold the tarp or keep walking. Either way, decide before it tears loose.'}]},
    {id:'rain-b',lines:[{speaker:'Narrator',text:'Rain starts drumming on a patched tarp before anyone reaches the stall.'}]},
  ],
  'loose-crate': [
    {id:'crate-a',lines:[{speaker:'Narrator',text:'One loose crate. One working hinge. Nothing nearby claims it.'}]},
    {id:'crate-b',lines:[{speaker:'Narrator',text:'The latch looks either generous or suspicious. Nobody volunteers to test it first.'}]},
  ],
  'paper-shrine': [
    {id:'shrine-a',lines:[{speaker:'Narrator',text:'Folded tokens sway even though the alley has gone still.'}]},
    {id:'shrine-b',lines:[{speaker:'Whisper',text:'Leave something. Take something. Do not pretend those are the same choice.'}]},
  ],
  'night-cart': [
    {id:'food-a',lines:[{speaker:'Vendor',text:'Hot food. Eight coins. No speeches while it gets cold.'}]},
    {id:'food-b',lines:[{speaker:'Narrator',text:'Steam rolls across the road from a cart that was not there a minute ago.'}]},
  ],
  'shortcut': [
    {id:'shortcut-a',lines:[{speaker:'Narrator',text:'A hand-painted arrow promises fewer steps. The alley behind it promises nothing.'}]},
    {id:'shortcut-b',lines:[{speaker:'Sign',text:'SHORTCUT. Probably.'}]},
  ],
  'old-locker': [
    {id:'locker-a',lines:[{speaker:'Narrator',text:'The locker is rusted shut, except for the part that looks worth forcing.'}]},
    {id:'locker-b',lines:[{speaker:'Narrator',text:'That hinge looks ready to charge somebody in blood.'}]},
  ],
  'street-game': [
    {id:'wheel-a',lines:[{speaker:'Stranger',text:'Pick a stake. The odds are written on the cardboard.'}]},
    {id:'wheel-b',lines:[{speaker:'Stranger',text:'The wheel turns once. Decide what you can afford to lose.'}]},
  ],
  'repair-bench': [
    {id:'repair-a',lines:[{speaker:'Narrator',text:'The bench still hums. There is enough charge for one useful decision.'}]},
    {id:'repair-b',lines:[{speaker:'Narrator',text:'The machine looks tired, but not too tired to be useful.'}]},
  ],
  'quiet-corner': [
    {id:'quiet-a',lines:[{speaker:'Narrator',text:'No ambush. No vendor. No trick. Just a quiet corner and a minute to spend.'}]},
    {id:'quiet-b',lines:[{speaker:'Narrator',text:'The route leaves a little empty space between bad ideas.'}]},
  ],
  'swap-meet': [
    {id:'swap-a',lines:[{speaker:'Trader',text:'Two things for one. Pick what you can spare.'}]},
    {id:'swap-b',lines:[{speaker:'Narrator',text:'The trader turns your pack upside down with a glance.'}]},
  ],
  'the-press': [
    {id:'press-a',lines:[{speaker:'Narrator',text:'One relic enters. Read the odds before you pull the lever.'}]},
    {id:'press-b',lines:[{speaker:'Narrator',text:'The rollers do not promise to give anything back.'}]},
  ],
  'sparring-yard': [
    {id:'training-a',lines:[{speaker:'Trainer',text:'The lesson costs twenty-two coins. The bruises are included.'}]},
    {id:'training-b',lines:[{speaker:'Narrator',text:'A chalk circle waits for someone with a move to improve.'}]},
    {id:'training-saq',lines:[{speaker:'Saq',text:'Watch the footwork, not the fist. One repetition, done properly.'}]},
  ],
  'fourth-chair': [
    {id:'recruitment-a',lines:[{speaker:'Narrator',text:'A fourth chair waits beside the road. Only three can travel on.'}]},
    {id:'recruitment-b',lines:[{speaker:'Narrator',text:'Two strangers offer to take someone\'s place, not erase the journey.'}]},
  ],
};

const sceneMap=new Map(SCENES.map(scene=>[scene.id,scene]));
export function resolveScene(sceneId:SceneId,context:SceneContext):ResolvedScene{
  const scene=sceneMap.get(sceneId);if(!scene)throw new Error(`Unknown scene id: ${sceneId}`);
  const relationship=scene.relationshipVariants?.find(entry=>context.partyIds.includes(entry.requiresPartyId));
  const eliteOverride=sceneId==='elite-intro'&&context.encounterId?ELITE_SCENE_OVERRIDES[context.encounterId]:undefined;
  const event=context.eventId&&sceneId==='event-arrival'?getEvent(context.eventId):undefined;
  const eventPool=event?EVENT_ARRIVAL_LINES[event.id]:undefined;
  const pool=relationship?.variants??eliteOverride?.variants??eventPool??scene.variants;
  const rng=new SeededRng((context.seed^hashText(`${sceneId}:${context.regionIndex}:${context.encounterId??''}:${context.eventId??''}`))>>>0);
  const selected=rng.pick(pool);
  return {
    ...selected,
    relationshipId:selected.relationshipId??relationship?.relationshipId,
    sceneId,
    title:eliteOverride?.title??event?.title??scene.title,
    kicker:scene.kicker,
    focusAssetId:eliteOverride?.focusAssetId??scene.focusAssetId,
    companionAssetId:relationship?.companionAssetId,
    theme:event?.theme,
  };
}

export function regionSceneId(regionIndex:number):SceneId{return regionIndex<=0?'region-1-intro':regionIndex===1?'region-2-intro':'region-3-intro';}

export const ALL_SCENE_VARIANTS:SceneVariant[]=[
  ...SCENES.flatMap(scene=>[...scene.variants,...(scene.relationshipVariants??[]).flatMap(entry=>entry.variants)]),
  ...Object.values(ELITE_SCENE_OVERRIDES).flatMap(entry=>entry.variants),
  ...Object.values(EVENT_ARRIVAL_LINES).flat(),
];
