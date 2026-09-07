import type { RunState } from '../types.js';
import { getCharacter } from '../../content/characters.js';
import { getItem } from '../../content/items.js';
import { previewItemPp } from './itemRecovery.js';

export interface RecoveryChange {
  characterId: string;
  hpBefore: number;
  hpAfter: number;
  pp: Array<{abilityId: string; before: number; after: number}>;
}

export interface FieldItemCommand {
  itemId: string;
  targetId?: string;
  expected: {
    runId: string;
    regionIndex: number;
    currentNodeId: string | null;
    fieldUsesSpent: number | null;
    inventoryCount: number;
  };
}

export interface FieldItemPreview {
  legal: boolean;
  reason?: string;
  changes: RecoveryChange[];
}

const clone = <T>(value:T):T => JSON.parse(JSON.stringify(value)) as T;

export function fieldUseLimit(run: RunState): number {
  return 1 + (run.inventory.some(i => i.itemId === 'field-pack') ? 1 : 0);
}

function resolvedRouteCheck(run: RunState): {ok: boolean; reason?: string} {
  if (run.status !== 'active') return {ok: false, reason: 'No active run.'};
  if (!run.party.some(m => m.hp > 0)) return {ok: false, reason: 'All members are KO.'};
  if (run.activeBattle) return {ok: false, reason: 'Cannot use field items during battle.'};
  if (run.pendingReward) return {ok: false, reason: 'Claim your reward first.'};
  return {ok: true};
}

export function fieldAccess(run: RunState): {legal: boolean; reason?: string} {
  const base = resolvedRouteCheck(run);
  if (!base.ok) return {legal: false, reason: base.reason};
  const hasCompletedCurrent = run.currentNodeId !== null && run.completedNodeIds.includes(run.currentNodeId);
  const hasLaterRegionNoCurrentNode = run.regionIndex > 0 && run.currentNodeId === null;
  if (!hasCompletedCurrent && !hasLaterRegionNoCurrentNode) return {legal: false, reason: 'Complete a node first to unlock field recovery.'};
  if (run.fieldUsesSpent === null) return {legal: false, reason: 'Complete a node first to unlock field recovery.'};
  if (run.fieldUsesSpent >= fieldUseLimit(run)) return {legal: false, reason: 'No field uses remaining. Complete another node.'};
  return {legal: true};
}

function pressedFlower(run: RunState): number {
  return run.relicIds.includes('pressed-flower') ? 1.08 : 1;
}

function calcChanges(run: RunState, command: FieldItemCommand): FieldItemPreview {
  let item;
  try { item = getItem(command.itemId); } catch { return {legal: false, reason: 'Unknown item.', changes: []}; }
  if (!item.fieldCompatible) return {legal: false, reason: `${item.name} can only be used in battle.`, changes: []};

  if (item.target === 'ally-one' || item.target === 'self') {
    const member = run.party.find(m => m.characterId === command.targetId);
    if (!member) return {legal: false, reason: 'Invalid target.', changes: []};
    const character = getCharacter(member.characterId);
    const hpBefore = member.hp;
    let hpAfter = hpBefore;
    const pp: Array<{abilityId: string; before: number; after: number}> = [];
    for (const effect of item.effects) {
      if (effect.kind === 'healPercent') {
        if (member.hp <= 0) return {legal: false, reason: 'Target is KO. Use a Revive Kit instead.', changes: []};
        hpAfter = Math.min(character.stats.maxHp, hpBefore + Math.round(character.stats.maxHp * effect.percent * pressedFlower(run)));
      } else if (effect.kind === 'restorePP') {
        const r = previewItemPp(member, effect.amount, run.relicIds);
        if (r) pp.push(r);
      } else if (effect.kind === 'revive') {
        if (member.hp > 0) return {legal: false, reason: 'Target is not KO.', changes: []};
        hpAfter = Math.max(1, Math.round(character.stats.maxHp * effect.percentMaxHp));
      }
    }
    if (hpAfter === hpBefore && pp.length === 0) return {legal: false, reason: 'No recovery effect on this target.', changes: []};
    return {legal: true, changes: [{characterId: member.characterId, hpBefore, hpAfter, pp}]};
  }

  // ally-all
  const targets = run.party.filter(m => m.hp > 0);
  const changes: RecoveryChange[] = [];
  for (const member of targets) {
    const character = getCharacter(member.characterId);
    const hpBefore = member.hp;
    let hpAfter = hpBefore;
    const pp: Array<{abilityId: string; before: number; after: number}> = [];
    for (const effect of item.effects) {
      if (effect.kind === 'healPartyPercent') {
        hpAfter = Math.min(character.stats.maxHp, hpBefore + Math.round(character.stats.maxHp * effect.percent * pressedFlower(run)));
      } else if (effect.kind === 'restorePP') {
        const r = previewItemPp(member, effect.amount, run.relicIds);
        if (r) pp.push(r);
      }
    }
    if (hpAfter !== hpBefore || pp.length > 0) changes.push({characterId: member.characterId, hpBefore, hpAfter, pp});
  }
  if (changes.length === 0) return {legal: false, reason: 'No recovery effect on any target.', changes: []};
  return {legal: true, changes};
}

export function previewFieldItem(run: RunState, command: FieldItemCommand): FieldItemPreview {
  const access = fieldAccess(run);
  if (!access.legal) return {legal: false, reason: access.reason, changes: []};
  if (command.expected.runId !== run.id ||
      command.expected.regionIndex !== run.regionIndex ||
      command.expected.currentNodeId !== run.currentNodeId ||
      command.expected.fieldUsesSpent !== run.fieldUsesSpent) return {legal: false, reason: 'Stale command.', changes: []};
  const actualQty = run.inventory.find(i => i.itemId === command.itemId)?.quantity ?? 0;
  if (command.expected.inventoryCount !== actualQty || actualQty <= 0) return {legal: false, reason: actualQty <= 0 ? 'Item not in inventory.' : 'Stale command.', changes: []};
  return calcChanges(run, command);
}

export function applyFieldItem(run: RunState, command: FieldItemCommand): {ok: boolean; reason?: string; run: RunState; changes: RecoveryChange[]} {
  const preview = previewFieldItem(run, command);
  if (!preview.legal) return {ok: false, reason: preview.reason, run: clone(run), changes: []};
  const next = clone(run);
  for (const change of preview.changes) {
    const member = next.party.find(m => m.characterId === change.characterId);
    if (!member) continue;
    member.hp = change.hpAfter;
    for (const ppChange of change.pp) member.abilityPP[ppChange.abilityId] = ppChange.after;
  }
  const slot = next.inventory.find(i => i.itemId === command.itemId);
  if (slot) { slot.quantity -= 1; if (slot.quantity <= 0) next.inventory = next.inventory.filter(i => i.itemId !== command.itemId); }
  next.fieldUsesSpent = (next.fieldUsesSpent ?? 0) + 1;
  return {ok: true, run: next, changes: preview.changes};
}

export function discardFieldItem(run: RunState, itemId: string, expectedQuantity: number): {ok: boolean; reason?: string; run: RunState} {
  const base = resolvedRouteCheck(run);
  if (!base.ok) return {ok: false, reason: base.reason, run: clone(run)};
  try { getItem(itemId); } catch { return {ok: false, reason: 'Unknown item.', run: clone(run)}; }
  const actualQty = run.inventory.find(i => i.itemId === itemId)?.quantity ?? 0;
  if (actualQty !== expectedQuantity || actualQty <= 0) return {ok: false, reason: 'Stale quantity.', run: clone(run)};
  const next = clone(run);
  const slot = next.inventory.find(i => i.itemId === itemId);
  if (slot) { slot.quantity -= 1; if (slot.quantity <= 0) next.inventory = next.inventory.filter(i => i.itemId !== itemId); }
  return {ok: true, run: next};
}
