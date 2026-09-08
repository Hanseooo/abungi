import type { ItemRarity } from '../content/items.js';

export type Affinity = 'might' | 'tech' | 'trick' | 'mystic' | 'neutral';
export type StatusId = 'strength' | 'weaken' | 'haste' | 'slow' | 'blind' | 'fortified' | 'exposed';
export type Side = 'ally' | 'enemy';
export type TargetMode = 'enemy-one' | 'enemy-all' | 'ally-one' | 'ally-all' | 'self' | 'random-enemy';
export type NodeType = 'battle' | 'elite' | 'rest' | 'shop' | 'event' | 'boss';
export type EncounterTier = 'normal' | 'elite' | 'boss';

export interface Stats {
  maxHp: number;
  power: number;
  guard: number;
  speed: number;
}

export interface StatusInstance {
  id: StatusId;
  remaining: number;
}

export type BattleEffectId = 'protect' | 'ink-mark' | 'script' | 'taxed';

/**
 * A source-linked battle effect. Unlike StatusInstance it records who applied it,
 * who carries it, and which unit's turns count down its lifetime.
 * `source-turn-start` expires before the source's input becomes available.
 * `target-turn-end`   expires after the target completes a turn.
 */
export interface BattleEffectInstance {
  uid: string;
  id: BattleEffectId;
  sourceUnitId: string;
  targetUnitId: string;
  expiry: 'source-turn-start' | 'target-turn-end';
  remaining: number;
}

export interface PassiveDefinition {
  id: string;
  name: string;
  description: string;
}

export interface UpgradeDefinition {
  description: string;
  powerDelta?: number;
  maxPPDelta?: number;
  durationDelta?: number;
  healScale?: number;
  coinCostDelta?: number;
  summonPowerScale?: number;
}

export type EffectDefinition =
  | { kind: 'damage'; power: number; target: TargetMode; hits?: number; accuracy?: number; mechanicId?: string }
  | { kind: 'heal'; target: TargetMode; percentMaxHp: number; mechanicId?: string }
  | { kind: 'status'; target: TargetMode; statusId: StatusId; duration: number; accuracy?: number; mechanicId?: string }
  | { kind: 'cleanse'; target: TargetMode; count: number }
  | { kind: 'summon'; summonId: 'sentry' | 'repair-drone'; duration: number }
  | { kind: 'spendCoins'; amount: number }
  | { kind: 'grantCoins'; amount: number; trigger: 'ko' | 'always' }
  | { kind: 'sacrificeHp'; amount: number; basis: 'max' | 'current'; floorAtOne: boolean }
  | { kind: 'restorePP'; target: TargetMode; amount: number }
  | { kind: 'applyEffect'; effectId: BattleEffectId; target: TargetMode; accuracy?: number; mechanicId?: string }
  | { kind: 'removeEffect'; target: TargetMode; mechanicId?: string };


export type ChoreographyId = 'melee' | 'ranged' | 'multi-hit' | 'explosive' | 'smoke' | 'mystic' | 'drain' | 'buff' | 'defense' | 'summon' | 'heavy' | 'utility';

export interface AbilityDefinition {
  id: string;
  name: string;
  affinity: Affinity;
  maxPP: number;
  target: TargetMode;
  description: string;
  accuracy?: number;
  effects: EffectDefinition[];
  mechanicId?: string;
  choreography?: ChoreographyId;
  upgrade: UpgradeDefinition;
}

export interface CharacterDefinition {
  id: string;
  displayName: string;
  affinity: Affinity;
  role: string;
  stats: Stats;
  passive: PassiveDefinition;
  abilities: string[];
  assetId: string;
}

export interface EnemyMoveDefinition {
  id: string;
  name: string;
  affinity: Affinity;
  target: TargetMode;
  effects: EffectDefinition[];
  weight: number;
  cooldown?: number;
  once?: boolean;
  condition?: 'ally-injured' | 'self-below-half' | 'self-below-35' | 'has-other-enemy' | 'always';
  signature?: boolean;
  choreography?: ChoreographyId;
}

export interface EnemyDefinition {
  id: string;
  displayName: string;
  affinity: Affinity;
  tier: EncounterTier;
  stats: Stats;
  moves: EnemyMoveDefinition[];
  assetId: string;
  aiProfile: 'aggressive' | 'support' | 'controller' | 'boss-jonlow' | 'boss-klyde' | 'boss-warden';
  rewardCoins: [number, number];
}

export interface BattleUnit extends Stats {
  id: string;
  sourceId: string;
  displayName: string;
  side: Side;
  affinity: Affinity;
  hp: number;
  statuses: StatusInstance[];
  alive: boolean;
  guardActive: boolean;
  abilityPP?: Record<string, number>;
  upgradedAbilities?: string[];
  flags: Record<string, number | boolean | string>;
}

export interface DeployableState {
  id: string;
  ownerId: string;
  type: 'sentry' | 'repair-drone';
  remainingTurns: number;
  enhanced: boolean;
  sourceAbilityId?: string;
}

export interface BattleState {
  id: string;
  encounterId: string;
  tier: EncounterTier;
  units: Record<string, BattleUnit>;
  allies: string[];
  enemies: string[];
  round: number;
  turnOrder: string[];
  turnIndex: number;
  phase: 'input' | 'resolving' | 'victory' | 'defeat';
  deployables: DeployableState[];
  effects: BattleEffectInstance[];
  recentEnemyMoves: Record<string, string[]>;
  flags: Record<string, number | boolean | string>;
  coinsDelta: number;
  availableCoins: number;
  relicIds: string[];
  escaped?: boolean;
}

export type CombatEvent =
  | { type: 'actionStart'; actorId: string; label: string; actionId?: string; choreography?: ChoreographyId; side?: Side; signature?: boolean }
  | { type: 'lunge'; actorId: string }
  | { type: 'projectile'; actorId: string; targetId: string }
  | { type: 'hit'; targetId: string; heavy?: boolean }
  | { type: 'damage'; targetId: string; amount: number; critical: boolean; affinity: 'advantage' | 'resisted' | 'normal' }
  | { type: 'heal'; targetId: string; amount: number }
  | { type: 'statusApplied'; targetId: string; statusId: StatusId; duration: number }
  | { type: 'statusRemoved'; targetId: string; statusId: StatusId }
  | { type: 'summon'; ownerId: string; summonId: string }
  | { type: 'deployableTrigger'; ownerId: string; deployableId: string; deployableType: 'sentry' | 'repair-drone'; targetId: string; effect: 'damage' | 'heal'; amount: number; enhanced: boolean }
  | { type: 'revive'; targetId: string; amount: number }
  | { type: 'bossPhase'; actorId: string; phaseId: string; label: string }
  | { type: 'knockout'; targetId: string }
  | { type: 'guard'; actorId: string }
  | { type: 'coin'; amount: number }
  | { type: 'miss'; actorId: string; targetId: string }
  | { type: 'message'; text: string }
  | { type: 'effectApplied'; effectId: BattleEffectId; sourceId: string; targetId: string; remaining: number }
  | { type: 'effectRemoved'; effectId: BattleEffectId; targetId: string; reason: 'expired' | 'consumed' | 'cleared' }
  | { type: 'prevented'; kind: 'script' | 'class-monitor'; targetId: string; amount: number }
  | { type: 'transfer'; fromId: string; toId: string; amount: number }
  | { type: 'ready'; actorId: string; active: boolean }
  | { type: 'victory' }
  | { type: 'defeat' };

export type BattleCommand =
  | { kind: 'skill'; actorId: string; abilityId: string; targetIds: string[] }
  | { kind: 'guard'; actorId: string }
  | { kind: 'item'; actorId: string; itemId: string; targetIds: string[] };

export interface BattleResolution {
  nextState: BattleState;
  events: CombatEvent[];
}

export interface PartyMemberRunState {
  characterId: string;
  hp: number;
  abilityPP: Record<string, number>;
  upgradedAbilities: string[];
}

export interface InventoryEntry { itemId: string; quantity: number }

export interface RouteNode {
  id: string;
  stage: number;
  type: NodeType;
  encounterId?: string;
  eventId?: string;
  outgoing: string[];
}

export interface RegionRoute {
  regionIndex: number;
  nodes: RouteNode[];
  startNodeIds: string[];
  bossNodeId: string;
}

export interface RunState {
  id: string;
  seed: number;
  rngState: number;
  regionIndex: number;
  route: RegionRoute;
  currentNodeId: string | null;
  completedNodeIds: string[];
  party: PartyMemberRunState[];
  coins: number;
  inventory: InventoryEntry[];
  relicIds: string[];
  activeBattle: BattleState | null;
  pendingReward: RewardState | null;
  score: number;
  status: 'active' | 'victory' | 'defeat';
  fieldUsesSpent: number | null;
  shopVisit: ShopVisit | null;
}

export interface RewardSpoilsChoice { id:'cash'|'patch'|'scavenge'|'ppcache'; label:string; description:string; coinBonus?:number; healPercent?:number; itemId?:string; ppPercent?:number }

export interface RewardState {
  tier: EncounterTier;
  coins: number;
  itemId?: string;
  relicChoices: string[];
  upgradeChoices: Array<{ characterId: string; abilityId: string }>;
  bossRecovery?: boolean;
  spoilsChoices: RewardSpoilsChoice[];
}

export interface ProfileState {
  runsStarted: number;
  wins: number;
  bestScore: number;
  bossesDefeated: number;
  discoveredRelics: string[];
  discoveredEnemies: string[];
  characterUsage: Record<string, number>;
}

export interface SettingsState {
  masterMuted: boolean;
  musicVolume: number;
  sfxVolume: number;
  animationSpeed: 1 | 2 | 3;
  reducedMotion: boolean;
}

export interface ShopOffer {
  id: string;
  kind: 'item' | 'relic';
  contentId: string;
  name: string;
  description: string;
  price: number;
  rarity: ItemRarity;
  deal: 'good' | 'standard' | 'pricey';
}

export interface ShopVisit {
  nodeId: string;
  offers: ShopOffer[];
  purchasedOfferIds: string[];
}
