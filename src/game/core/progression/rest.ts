import type { RunState } from '../types.js';
import { BALANCE } from '../../balance/constants.js';
import { getAbility, getCharacter } from '../../content/characters.js';
import type { RecoveryChange } from './fieldItems.js';

const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
export type RestChoice='recover'|'refresh';

function calcRestChanges(run: RunState, choice: RestChoice): RecoveryChange[] {
  const changes: RecoveryChange[] = [];
  for (const member of run.party) {
    const character = getCharacter(member.characterId);
    const hpBefore = member.hp;
    let hpAfter = hpBefore;
    const pp: Array<{abilityId: string; before: number; after: number}> = [];
    if (choice === 'recover') {
      hpAfter = member.hp <= 0
        ? Math.max(1, Math.round(character.stats.maxHp * BALANCE.restReviveHpPercent))
        : Math.min(character.stats.maxHp, member.hp + Math.round(character.stats.maxHp * BALANCE.restRecoverPercent));
    } else {
      for (const id of character.abilities) {
        const ability = getAbility(id);
        const max = ability.maxPP + (member.upgradedAbilities.includes(id) ? ability.upgrade.maxPPDelta ?? 0 : 0);
        const before = member.abilityPP[id];
        const after = Math.min(max, before + Math.round(Math.max(0, max - before) * BALANCE.restRefreshMissingPercent * (run.relicIds.includes('blue-tonic-cap') ? 1.25 : 1)));
        if (after !== before) pp.push({abilityId: id, before, after});
      }
    }
    if (hpAfter !== hpBefore || pp.length > 0) changes.push({characterId: member.characterId, hpBefore, hpAfter, pp});
  }
  return changes;
}

export function previewRestChoice(run: RunState, choice: RestChoice): {legal: boolean; reason?: string; changes: RecoveryChange[]} {
  if (run.status !== 'active') return {legal: false, reason: 'No active run.', changes: []};
  if (!run.party.some(m => m.hp > 0)) return {legal: false, reason: 'All members are KO.', changes: []};
  const changes = calcRestChanges(run, choice);
  if (changes.length === 0) return {legal: false, reason: 'No recovery effect.', changes: []};
  return {legal: true, changes};
}

export function applyRestChoice(input:RunState,choice:RestChoice):RunState {
  const run=clone(input);
  for (const change of calcRestChanges(run, choice)) {
    const member = run.party.find(m => m.characterId === change.characterId);
    if (!member) continue;
    member.hp = change.hpAfter;
    for (const ppChange of change.pp) member.abilityPP[ppChange.abilityId] = ppChange.after;
  }
  return run;
}
