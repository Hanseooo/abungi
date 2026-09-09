import type { EncounterTier, RewardSpoilsChoice, RewardState, RunState } from '../types.js';
import { SeededRng } from '../rng/seededRng.js';
import { ITEMS } from '../../content/items.js';
import { getAbility, getCharacter } from '../../content/characters.js';
import { getEncounter, getEnemy } from '../../content/enemies.js';
import { BALANCE } from '../../balance/constants.js';
import { inventoryCapacity, inventoryCount } from './inventory.js';
import { drawRelicIds } from './relicDrafts.js';
import { previewItemPp } from './itemRecovery.js';

const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const fallbackCoinRanges:Record<EncounterTier,[number,number]>={normal:[10,18],elite:[28,40],boss:[42,58]};

function distinctPicks<T>(pool:readonly T[],count:number,rng:SeededRng):T[]{const copy=[...pool];const out:T[]=[];while(copy.length&&out.length<count){out.push(copy.splice(rng.int(0,copy.length-1),1)[0]);}return out;}

export function encounterCoinRange(encounterId:string|undefined,tier:EncounterTier):[number,number]{
  if(!encounterId)return fallbackCoinRanges[tier];
  const encounter=getEncounter(encounterId);
  const ranges=encounter.enemies.map(id=>getEnemy(id).rewardCoins);
  const min=ranges.reduce((sum,[low])=>sum+low,0);
  const max=ranges.reduce((sum,[,high])=>sum+high,0);
  const regionlessTierBonus=tier==='elite'?4:tier==='boss'?8:0;
  return [min+regionlessTierBonus,max+regionlessTierBonus];
}

function normalDrop(rng:SeededRng):string|undefined{
  if(!rng.chance(0.12))return undefined;
  const pool=ITEMS.filter(item=>item.rarity!=='rare').map(item=>({item,weight:item.rarity==='common'?6:2}));
  return rng.weightedPick(pool).item.id;
}

// One option is always immediate value and one is always recovery, so the pick stays a
// greed-versus-sustain decision rather than two flavours of the same answer.
function normalSpoils(run:RunState,rng:SeededRng):RewardSpoilsChoice[]{
  const greed:RewardSpoilsChoice[]=[{id:'cash',label:'Take the Cash',description:'Pocket 5 additional coins.',coinBonus:5}];
  const sustain:RewardSpoilsChoice[]=[
    {id:'patch',label:'Patch Up',description:'Restore 5% Max HP to each living party member.',healPercent:0.05},
    {id:'ppcache',label:'PP Cache',description:'Restore 2 PP to each ally’s most-drained move.',ppAmount:2},
  ];
  const hasSpace=inventoryCount(run)<inventoryCapacity(run);
  if(hasSpace&&rng.chance(0.35)){
    const common=ITEMS.filter(item=>item.rarity==='common');
    greed.push({id:'scavenge',label:'Scavenge',description:'Take one common item instead of extra cash or recovery.',itemId:rng.pick(common).id});
  }
  return [...distinctPicks(greed,1,rng),...distinctPicks(sustain,1,rng)];
}

export function generateReward(run:RunState,tier:EncounterTier,rng:SeededRng,encounterId?:string):RewardState{
  const [min,max]=encounterCoinRange(encounterId,tier);
  const relicChoices=tier==='normal'?[]:drawRelicIds(run,tier==='elite'?'elite':'boss',3,rng);
  const upgrades=run.party.flatMap(member=>getCharacter(member.characterId).abilities
    .filter(id=>!member.upgradedAbilities.includes(id))
    .map(abilityId=>({characterId:member.characterId,abilityId})));
  const upgradeChoices=tier==='normal'?[]:distinctPicks(upgrades,Math.min(3,upgrades.length),rng);
  const hasInventorySpace=inventoryCount(run)<inventoryCapacity(run);
  return {
    tier,
    coins:rng.int(min,max),
    itemId:tier==='normal'&&hasInventorySpace?normalDrop(rng):undefined,
    relicChoices,
    upgradeChoices,
    bossRecovery:tier==='boss',
    spoilsChoices:tier==='normal'?normalSpoils(run,rng):[],
  };
}

export function claimReward(input:RunState,reward:RewardState,choice:{relicId?:string;upgrade?:{characterId:string;abilityId:string};spoilsId?:RewardSpoilsChoice['id']}={}):RunState{
  const run=clone(input);run.coins+=reward.coins;run.score+=reward.tier==='normal'?20:reward.tier==='elite'?60:120;
  if(reward.itemId&&inventoryCount(run)<inventoryCapacity(run)){const entry=run.inventory.find(e=>e.itemId===reward.itemId);if(entry)entry.quantity+=1;else run.inventory.push({itemId:reward.itemId,quantity:1});}
  if(choice.relicId&&reward.relicChoices.includes(choice.relicId)&&!run.relicIds.includes(choice.relicId))run.relicIds.push(choice.relicId);
  if(choice.upgrade&&reward.upgradeChoices.some(x=>x.characterId===choice.upgrade!.characterId&&x.abilityId===choice.upgrade!.abilityId)){
    const member=run.party.find(p=>p.characterId===choice.upgrade!.characterId);if(member&&!member.upgradedAbilities.includes(choice.upgrade.abilityId)){
      member.upgradedAbilities.push(choice.upgrade.abilityId);const ability=getAbility(choice.upgrade.abilityId);if(ability.upgrade.maxPPDelta)member.abilityPP[ability.id]+=ability.upgrade.maxPPDelta;
    }
  }

  if(reward.spoilsChoices.length){
    const selected=reward.spoilsChoices.find(option=>option.id===(choice.spoilsId??reward.spoilsChoices[0].id));
    if(selected?.coinBonus)run.coins+=selected.coinBonus;
    if(selected?.healPercent){for(const member of run.party){if(member.hp<=0)continue;const c=getCharacter(member.characterId);member.hp=Math.min(c.stats.maxHp,member.hp+Math.round(c.stats.maxHp*selected.healPercent));}}
    if(selected?.itemId&&inventoryCount(run)<inventoryCapacity(run)){const entry=run.inventory.find(item=>item.itemId===selected.itemId);if(entry)entry.quantity+=1;else run.inventory.push({itemId:selected.itemId,quantity:1});}
    if(selected?.ppAmount){for(const member of run.party){const restored=previewItemPp(member,selected.ppAmount,run.relicIds);if(restored)member.abilityPP[restored.abilityId]=restored.after;}}
  }

  // Every win funds part of its own attrition, so a bad lane no longer compounds into a dead run.
  for(const member of run.party){
    if(member.hp<=0)continue;
    const c=getCharacter(member.characterId);
    member.hp=Math.min(c.stats.maxHp,member.hp+Math.round(c.stats.maxHp*BALANCE.postVictoryHpPercent));
  }

  // Post-victory HP is already covered twice over; the scarce resource between fights is PP.
  if(run.relicIds.includes('thermos')){
    for(const member of run.party){const restored=previewItemPp(member,2,run.relicIds);if(restored)member.abilityPP[restored.abilityId]=restored.after;}
  }
  if(reward.tier==='elite'&&run.relicIds.includes('elite-bandage')){
    for(const member of run.party){const c=getCharacter(member.characterId);if(member.hp>0)member.hp=Math.min(c.stats.maxHp,member.hp+Math.round(c.stats.maxHp*0.10));}
  }
  if(reward.bossRecovery){
    for(const member of run.party){
      const c=getCharacter(member.characterId);
      // Revived allies come back low; only allies who survived the boss take the recovery heal.
      if(member.hp<=0)member.hp=Math.max(1,Math.round(c.stats.maxHp*BALANCE.regionReviveHpPercent));
      else member.hp=Math.min(c.stats.maxHp,member.hp+Math.round(c.stats.maxHp*BALANCE.bossRecoveryHpPercent));
      const ppGain=Math.round(BALANCE.bossRecoveryPpPerAbility*(run.relicIds.includes('blue-tonic-cap')?1.25:1));
      for(const id of c.abilities){
        const a=getAbility(id);const max=a.maxPP+(member.upgradedAbilities.includes(id)?a.upgrade.maxPPDelta??0:0);
        member.abilityPP[id]=Math.min(max,member.abilityPP[id]+ppGain);
      }
    }
  }
  run.pendingReward=null;return run;
}
