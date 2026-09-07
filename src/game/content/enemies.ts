import type { Affinity, ChoreographyId, EnemyDefinition, EnemyMoveDefinition, EncounterTier } from '../core/types.js';

function inferChoreography(value:EnemyMoveDefinition):ChoreographyId {
  if(value.effects.some(effect=>effect.kind==='heal')) return 'buff';
  if(value.effects.some(effect=>effect.kind==='status')&&!value.effects.some(effect=>effect.kind==='damage')) return value.name.toLowerCase().includes('smoke')?'smoke':'buff';
  const damage=value.effects.find(effect=>effect.kind==='damage');
  if(damage?.hits&&damage.hits>1) return 'multi-hit';
  if(value.name.toLowerCase().match(/burst|shot|bolt|flare|gun/)) return 'ranged';
  if(value.name.toLowerCase().match(/screen|ash/)) return 'smoke';
  if(value.affinity==='mystic') return value.name.toLowerCase().includes('drain')?'drain':'mystic';
  if(value.signature||((damage?.power??0)>=100)) return 'heavy';
  return 'melee';
}
const move = (value: EnemyMoveDefinition): EnemyMoveDefinition => ({...value,choreography:value.choreography??inferChoreography(value)});
const enemy = (value: EnemyDefinition): EnemyDefinition => value;

export const ENEMIES: EnemyDefinition[] = [
  enemy({ id:'scrapper', displayName:'Scrapper', affinity:'might', tier:'normal', stats:{maxHp:86,power:93,guard:72,speed:75}, assetId:'enemy-scrapper', aiProfile:'aggressive', rewardCoins:[6,10], moves:[
    move({id:'scrap-jab',name:'Scrap Jab',affinity:'might',target:'enemy-one',effects:[{kind:'damage',power:62,target:'enemy-one'}],weight:5,condition:'always'}),
    move({id:'shoulder-check',name:'Shoulder Check',affinity:'might',target:'enemy-one',effects:[{kind:'damage',power:78,target:'enemy-one'}],weight:2,condition:'self-below-half'})
  ]}),
  enemy({ id:'road-dog', displayName:'Road Dog', affinity:'might', tier:'normal', stats:{maxHp:72,power:98,guard:60,speed:118}, assetId:'enemy-road-dog', aiProfile:'aggressive', rewardCoins:[6,10], moves:[
    move({id:'chain-snap',name:'Chain Snap',affinity:'might',target:'enemy-one',effects:[{kind:'damage',power:58,target:'enemy-one'}],weight:5,condition:'always'}),
    move({id:'rush-down',name:'Rush Down',affinity:'might',target:'enemy-one',effects:[{kind:'damage',power:72,target:'enemy-one'}],weight:3,condition:'always'})
  ]}),
  enemy({ id:'cutpurse', displayName:'Cutpurse', affinity:'trick', tier:'normal', stats:{maxHp:70,power:88,guard:62,speed:106}, assetId:'enemy-cutpurse', aiProfile:'controller', rewardCoins:[7,11], moves:[
    move({id:'shiv',name:'Shiv',affinity:'trick',target:'enemy-one',effects:[{kind:'damage',power:55,target:'enemy-one'}],weight:4,condition:'always'}),
    move({id:'cheap-shot',name:'Cheap Shot',affinity:'trick',target:'enemy-one',effects:[{kind:'damage',power:42,target:'enemy-one'},{kind:'status',target:'enemy-one',statusId:'weaken',duration:2}],weight:3,condition:'always'})
  ]}),
  enemy({ id:'smokehead', displayName:'Smokehead', affinity:'trick', tier:'normal', stats:{maxHp:78,power:82,guard:68,speed:92}, assetId:'enemy-smokehead', aiProfile:'controller', rewardCoins:[7,11], moves:[
    move({id:'ash-tap',name:'Ash Tap',affinity:'trick',target:'enemy-one',effects:[{kind:'damage',power:50,target:'enemy-one'}],weight:4,condition:'always'}),
    move({id:'smoke-screen',name:'Smoke Screen',affinity:'trick',target:'enemy-one',effects:[{kind:'status',target:'enemy-one',statusId:'blind',duration:2}],weight:3,condition:'always'})
  ]}),
  enemy({ id:'hexling', displayName:'Hexling', affinity:'mystic', tier:'normal', stats:{maxHp:76,power:98,guard:64,speed:90}, assetId:'enemy-hexling', aiProfile:'controller', rewardCoins:[8,12], moves:[
    move({id:'hex-bolt',name:'Hex Bolt',affinity:'mystic',target:'enemy-one',effects:[{kind:'damage',power:58,target:'enemy-one'}],weight:4,condition:'always'}),
    move({id:'sour-mark',name:'Sour Mark',affinity:'mystic',target:'enemy-one',effects:[{kind:'damage',power:38,target:'enemy-one'},{kind:'status',target:'enemy-one',statusId:'weaken',duration:2}],weight:3,condition:'always'})
  ]}),
  enemy({ id:'wisp', displayName:'Wisp', affinity:'mystic', tier:'normal', stats:{maxHp:58,power:110,guard:52,speed:112}, assetId:'enemy-wisp', aiProfile:'aggressive', rewardCoins:[7,11], moves:[
    move({id:'flicker',name:'Flicker',affinity:'mystic',target:'enemy-one',effects:[{kind:'damage',power:62,target:'enemy-one'}],weight:5,condition:'always'}),
    move({id:'cold-flare',name:'Cold Flare',affinity:'mystic',target:'enemy-all',effects:[{kind:'damage',power:34,target:'enemy-all'}],weight:2,condition:'always'})
  ]}),
  enemy({ id:'dronelet', displayName:'Dronelet', affinity:'tech', tier:'normal', stats:{maxHp:62,power:95,guard:58,speed:122}, assetId:'enemy-dronelet', aiProfile:'aggressive', rewardCoins:[7,11], moves:[
    move({id:'needle-burst',name:'Needle Burst',affinity:'tech',target:'enemy-one',effects:[{kind:'damage',power:58,target:'enemy-one'}],weight:5,condition:'always'}),
    move({id:'pulse-shot',name:'Pulse Shot',affinity:'tech',target:'enemy-one',effects:[{kind:'damage',power:68,target:'enemy-one'}],weight:2,condition:'always'})
  ]}),
  enemy({ id:'bulwark-bot', displayName:'Bulwark Bot', affinity:'tech', tier:'normal', stats:{maxHp:104,power:76,guard:118,speed:55}, assetId:'enemy-bulwark-bot', aiProfile:'support', rewardCoins:[9,13], moves:[
    move({id:'ram-plate',name:'Ram Plate',affinity:'tech',target:'enemy-one',effects:[{kind:'damage',power:52,target:'enemy-one'}],weight:4,condition:'always'}),
    move({id:'shield-field',name:'Shield Field',affinity:'neutral',target:'ally-one',effects:[{kind:'status',target:'ally-one',statusId:'fortified',duration:2}],weight:4,condition:'has-other-enemy'})
  ]}),
  enemy({ id:'backstreet-medic', displayName:'Backstreet Medic', affinity:'neutral', tier:'normal', stats:{maxHp:74,power:72,guard:70,speed:82}, assetId:'enemy-backstreet-medic', aiProfile:'support', rewardCoins:[8,12], moves:[
    move({id:'clamp-hit',name:'Clamp Hit',affinity:'might',target:'enemy-one',effects:[{kind:'damage',power:48,target:'enemy-one'}],weight:3,condition:'always'}),
    move({id:'field-stitch',name:'Field Stitch',affinity:'neutral',target:'ally-one',effects:[{kind:'heal',target:'ally-one',percentMaxHp:0.22}],weight:6,condition:'ally-injured'})
  ]}),
  enemy({ id:'tin-brute', displayName:'Tin Brute', affinity:'neutral', tier:'normal', stats:{maxHp:124,power:88,guard:104,speed:48}, assetId:'enemy-tin-brute', aiProfile:'aggressive', rewardCoins:[9,14], moves:[
    move({id:'tin-fist',name:'Tin Fist',affinity:'might',target:'enemy-one',effects:[{kind:'damage',power:66,target:'enemy-one'}],weight:5,condition:'always'}),
    move({id:'body-drop',name:'Body Drop',affinity:'neutral',target:'enemy-one',effects:[{kind:'damage',power:80,target:'enemy-one'}],weight:2,condition:'self-below-half'})
  ]}),

  enemy({ id:'the-broker', displayName:'The Broker', affinity:'trick', tier:'elite', stats:{maxHp:220,power:102,guard:86,speed:102}, assetId:'elite-broker', aiProfile:'controller', rewardCoins:[22,30], moves:[
    move({id:'bad-terms',name:'Bad Terms',affinity:'trick',target:'enemy-all',effects:[{kind:'status',target:'enemy-all',statusId:'weaken',duration:2}],weight:3,condition:'always'}),
    move({id:'collection',name:'Collection',affinity:'trick',target:'enemy-one',effects:[{kind:'damage',power:86,target:'enemy-one'}],weight:5,condition:'always'}),
    move({id:'market-crash',name:'Market Crash',affinity:'trick',target:'enemy-all',effects:[{kind:'damage',power:52,target:'enemy-all'}],weight:2,cooldown:2,condition:'self-below-half',signature:true})
  ]}),
  enemy({ id:'ironclad', displayName:'Ironclad', affinity:'tech', tier:'elite', stats:{maxHp:260,power:108,guard:142,speed:54}, assetId:'elite-ironclad', aiProfile:'aggressive', rewardCoins:[24,32], moves:[
    move({id:'armor-punch',name:'Armor Punch',affinity:'tech',target:'enemy-one',effects:[{kind:'damage',power:82,target:'enemy-one'}],weight:5,condition:'always'}),
    move({id:'lock-plates',name:'Lock Plates',affinity:'neutral',target:'self',effects:[{kind:'status',target:'self',statusId:'fortified',duration:2}],weight:2,condition:'always'}),
    move({id:'rail-hammer',name:'Rail Hammer',affinity:'tech',target:'enemy-one',effects:[{kind:'damage',power:116,target:'enemy-one'}],weight:2,cooldown:2,condition:'self-below-half',signature:true})
  ]}),
  enemy({ id:'night-maw', displayName:'Night Maw', affinity:'mystic', tier:'elite', stats:{maxHp:250,power:116,guard:82,speed:90}, assetId:'elite-night-maw', aiProfile:'aggressive', rewardCoins:[23,31], moves:[
    move({id:'maw-bite',name:'Maw Bite',affinity:'mystic',target:'enemy-one',effects:[{kind:'damage',power:82,target:'enemy-one'}],weight:5,condition:'always'}),
    move({id:'hollow-drain',name:'Hollow Drain',affinity:'mystic',target:'enemy-one',effects:[{kind:'damage',power:70,target:'enemy-one',mechanicId:'enemy-life-drain'}],weight:4,condition:'self-below-half'}),
    move({id:'night-swell',name:'Night Swell',affinity:'mystic',target:'enemy-all',effects:[{kind:'damage',power:45,target:'enemy-all'}],weight:2,cooldown:2,condition:'always',signature:true})
  ]}),

  enemy({ id:'jonlow', displayName:'Jonlow, the Glutton', affinity:'might', tier:'boss', stats:{maxHp:430,power:108,guard:96,speed:72}, assetId:'boss-jonlow', aiProfile:'boss-jonlow', rewardCoins:[38,48], moves:[
    move({id:'greedy-swipe',name:'Greedy Swipe',affinity:'might',target:'enemy-one',effects:[{kind:'damage',power:76,target:'enemy-one'}],weight:5,condition:'always'}),
    move({id:'stuff-face',name:'Stuff Face',affinity:'neutral',target:'self',effects:[{kind:'heal',target:'self',percentMaxHp:0.09},{kind:'status',target:'self',statusId:'strength',duration:2}],weight:3,cooldown:2,condition:'always'}),
    move({id:'table-flip',name:'Table Flip',affinity:'might',target:'enemy-all',effects:[{kind:'damage',power:52,target:'enemy-all'}],weight:2,cooldown:2,condition:'self-below-half',signature:true})
  ]}),
  enemy({ id:'klyde', displayName:'Klyde, the Psycho', affinity:'trick', tier:'boss', stats:{maxHp:400,power:116,guard:82,speed:108}, assetId:'boss-klyde', aiProfile:'boss-klyde', rewardCoins:[40,50], moves:[
    move({id:'wild-cut',name:'Wild Cut',affinity:'trick',target:'enemy-one',effects:[{kind:'damage',power:72,target:'enemy-one'}],weight:5,condition:'always'}),
    move({id:'laughing-fit',name:'Laughing Fit',affinity:'neutral',target:'self',effects:[{kind:'status',target:'self',statusId:'strength',duration:2},{kind:'status',target:'self',statusId:'haste',duration:1}],weight:2,condition:'always'}),
    move({id:'psycho-rush',name:'Psycho Rush',affinity:'trick',target:'enemy-one',effects:[{kind:'damage',power:32,hits:3,target:'enemy-one'}],weight:3,cooldown:1,condition:'always',signature:true}),
    move({id:'wrong-foot',name:'Wrong Foot',affinity:'trick',target:'enemy-one',effects:[{kind:'damage',power:48,target:'enemy-one'},{kind:'status',target:'enemy-one',statusId:'slow',duration:2}],weight:3,condition:'always'})
  ]}),
  enemy({ id:'warden', displayName:'The Warden', affinity:'tech', tier:'boss', stats:{maxHp:370,power:100,guard:126,speed:76}, assetId:'boss-warden', aiProfile:'boss-warden', rewardCoins:[50,60], moves:[
    move({id:'discipline-shot',name:'Discipline Shot',affinity:'tech',target:'enemy-one',effects:[{kind:'damage',power:78,target:'enemy-one'}],weight:5,condition:'always'}),
    move({id:'containment',name:'Containment',affinity:'tech',target:'enemy-all',effects:[{kind:'status',target:'enemy-all',statusId:'slow',duration:2}],weight:3,condition:'always'}),
    move({id:'barrier-protocol',name:'Barrier Protocol',affinity:'neutral',target:'self',effects:[{kind:'status',target:'self',statusId:'fortified',duration:2}],weight:3,condition:'always'}),
    move({id:'enforcement-burst',name:'Enforcement Burst',affinity:'tech',target:'enemy-all',effects:[{kind:'damage',power:54,target:'enemy-all'}],weight:3,cooldown:2,condition:'self-below-35',signature:true})
  ]}),
];


export const BOSS_AFFINITY_POOLS:Record<string,readonly Affinity[]> = {
  jonlow:['might','trick'],
  klyde:['trick','mystic'],
  warden:['tech','might'],
} as const;

export interface EncounterDefinition {
  id: string;
  displayName: string;
  tier: EncounterTier;
  enemies: string[];
}

export const ENCOUNTERS: EncounterDefinition[] = [
  {id:'normal-scrap',displayName:'Scrap Line',tier:'normal',enemies:['scrapper','cutpurse']},
  {id:'normal-fastlane',displayName:'Fast Lane',tier:'normal',enemies:['road-dog','wisp']},
  {id:'normal-smokes',displayName:'Smoke Break',tier:'normal',enemies:['smokehead','cutpurse','backstreet-medic']},
  {id:'normal-machines',displayName:'Loose Hardware',tier:'normal',enemies:['dronelet','bulwark-bot']},
  {id:'normal-oddities',displayName:'Odd Hours',tier:'normal',enemies:['hexling','wisp','tin-brute']},
  {id:'normal-support',displayName:'Back Alley Clinic',tier:'normal',enemies:['scrapper','backstreet-medic']},
  {id:'elite-broker',displayName:'The Broker',tier:'elite',enemies:['the-broker','cutpurse']},
  {id:'elite-ironclad',displayName:'Ironclad',tier:'elite',enemies:['ironclad']},
  {id:'elite-night-maw',displayName:'Night Maw',tier:'elite',enemies:['night-maw']},
  {id:'boss-jonlow',displayName:'Jonlow, the Glutton',tier:'boss',enemies:['jonlow']},
  {id:'boss-klyde',displayName:'Klyde, the Psycho',tier:'boss',enemies:['klyde']},
  {id:'boss-warden',displayName:'The Warden',tier:'boss',enemies:['warden']},
];

const enemyMap = new Map(ENEMIES.map(item => [item.id,item]));
const encounterMap = new Map(ENCOUNTERS.map(item => [item.id,item]));
export function getEnemy(id:string): EnemyDefinition { const value=enemyMap.get(id); if(!value) throw new Error(`Unknown enemy id: ${id}`); return value; }
export function getEncounter(id:string): EncounterDefinition { const value=encounterMap.get(id); if(!value) throw new Error(`Unknown encounter id: ${id}`); return value; }
