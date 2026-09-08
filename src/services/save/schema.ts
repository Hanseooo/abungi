import { z } from 'zod';
import type { SaveEnvelopeV3 } from '../../game/core/save/saveFormat';

const affinity=z.enum(['might','tech','trick','mystic','neutral']);
const statusId=z.enum(['strength','weaken','haste','slow','blind','fortified','exposed']);
const side=z.enum(['ally','enemy']);
const tier=z.enum(['normal','elite','boss']);
const nodeType=z.enum(['battle','elite','rest','shop','event','boss']);
const itemRarity=z.enum(['common','uncommon','rare']);

const status=z.object({id:statusId,remaining:z.number().int()});
const unit=z.object({
  id:z.string(),sourceId:z.string(),displayName:z.string(),side,affinity,
  maxHp:z.number(),hp:z.number(),power:z.number(),guard:z.number(),speed:z.number(),
  statuses:z.array(status),alive:z.boolean(),guardActive:z.boolean(),
  abilityPP:z.record(z.string(),z.number()).optional(),upgradedAbilities:z.array(z.string()).optional(),
  flags:z.record(z.string(),z.union([z.number(),z.boolean(),z.string()])),
});
const deployable=z.object({id:z.string(),ownerId:z.string(),type:z.enum(['sentry','repair-drone']),remainingTurns:z.number().int(),enhanced:z.boolean(),sourceAbilityId:z.string().optional()});
const battleEffect=z.object({
  uid:z.string(),
  id:z.enum(['protect','ink-mark','script','taxed']),
  sourceUnitId:z.string(),
  targetUnitId:z.string(),
  expiry:z.enum(['source-turn-start','target-turn-end']),
  remaining:z.number().int().nonnegative(),
});
const battle=z.object({
  id:z.string(),encounterId:z.string(),tier,units:z.record(z.string(),unit),allies:z.array(z.string()),enemies:z.array(z.string()),
  round:z.number().int(),turnOrder:z.array(z.string()),turnIndex:z.number().int(),phase:z.enum(['input','resolving','victory','defeat']),
  deployables:z.array(deployable),effects:z.array(battleEffect).default([]),recentEnemyMoves:z.record(z.string(),z.array(z.string())),
  flags:z.record(z.string(),z.union([z.number(),z.boolean(),z.string()])),coinsDelta:z.number(),availableCoins:z.number(),relicIds:z.array(z.string()),escaped:z.boolean().optional(),
});
const partyMember=z.object({characterId:z.string(),hp:z.number(),abilityPP:z.record(z.string(),z.number()),upgradedAbilities:z.array(z.string())});
const routeNode=z.object({id:z.string(),stage:z.number().int(),type:nodeType,encounterId:z.string().optional(),eventId:z.string().optional(),outgoing:z.array(z.string())});
const route=z.object({regionIndex:z.number().int(),nodes:z.array(routeNode),startNodeIds:z.array(z.string()),bossNodeId:z.string()});
const reward=z.object({tier,coins:z.number(),itemId:z.string().optional(),relicChoices:z.array(z.string()),upgradeChoices:z.array(z.object({characterId:z.string(),abilityId:z.string()})),bossRecovery:z.boolean().optional(),spoilsChoices:z.array(z.object({id:z.string(),label:z.string(),description:z.string(),coinBonus:z.number().optional(),healPercent:z.number().optional(),itemId:z.string().optional(),ppPercent:z.number().optional()})).default([])});

const shopOffer=z.object({
  id:z.string(),kind:z.enum(['item','relic']),contentId:z.string(),name:z.string(),description:z.string(),
  price:z.number().int().positive(),rarity:itemRarity,deal:z.enum(['good','standard','pricey']),
});
const shopVisit=z.object({
  nodeId:z.string(),
  offers:z.array(shopOffer),
  purchasedOfferIds:z.array(z.string()),
}).nullable().refine(v=>{
  if(!v)return true;
  const offerIds=new Set(v.offers.map(o=>o.id));
  return v.purchasedOfferIds.every(id=>offerIds.has(id));
},{message:'purchasedOfferIds contains IDs not present in offers'});

const run=z.object({
  id:z.string(),seed:z.number(),rngState:z.number(),regionIndex:z.number().int(),route,currentNodeId:z.string().nullable(),completedNodeIds:z.array(z.string()),
  party:z.array(partyMember).length(3),coins:z.number(),inventory:z.array(z.object({itemId:z.string(),quantity:z.number().int().nonnegative()})),relicIds:z.array(z.string()),
  activeBattle:battle.nullable(),pendingReward:reward.nullable(),score:z.number(),status:z.enum(['active','victory','defeat']),
  fieldUsesSpent:z.number().int().nonnegative().nullable(),
  shopVisit,
});
const profile=z.object({runsStarted:z.number().int().nonnegative(),wins:z.number().int().nonnegative(),bestScore:z.number().nonnegative(),bossesDefeated:z.number().int().nonnegative(),discoveredRelics:z.array(z.string()),discoveredEnemies:z.array(z.string()),characterUsage:z.record(z.string(),z.number().int().nonnegative())});
const settings=z.object({masterMuted:z.boolean(),musicVolume:z.number().min(0).max(1),sfxVolume:z.number().min(0).max(1),animationSpeed:z.union([z.literal(1),z.literal(2),z.literal(3)]),reducedMotion:z.boolean()});

export const SaveEnvelopeSchema=z.object({schemaVersion:z.literal(3),timestamp:z.string(),revision:z.number().int().nonnegative(),payload:z.object({activeRun:run.nullable(),profile,settings})});
export function parseSaveEnvelope(value:unknown):SaveEnvelopeV3{return SaveEnvelopeSchema.parse(value) as SaveEnvelopeV3;}
