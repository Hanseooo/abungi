import { BALANCE } from '../../balance/constants.js';
import { RELICS, type RelicDefinition } from '../../content/relics.js';
import type { ItemRarity } from '../../content/items.js';
import type { RunState } from '../types.js';
import { SeededRng } from '../rng/seededRng.js';

export type RelicSource = 'shop' | 'elite' | 'boss' | 'folded-tokens';

const rarities: ItemRarity[] = ['common', 'uncommon', 'rare'];

export function eligibleRelics(run: RunState, source: RelicSource): RelicDefinition[] {
  const hasHans = run.party.some(member => member.characterId === 'hans');
  const weights = BALANCE.relicTierWeights[source][run.regionIndex];
  return RELICS.filter(relic => {
    const rarityIndex = rarities.indexOf(relic.rarity);
    const permitted = weights[rarityIndex] > 0 || (source === 'boss' && relic.rarity === 'common');
    return permitted && !run.relicIds.includes(relic.id) && (relic.id !== 'spare-battery' || hasHans);
  });
}

function weightedRarities(remaining: readonly RelicDefinition[], source: RelicSource, regionIndex: number, slot: number): Array<{ rarity: ItemRarity; weight: number }> {
  const weights = BALANCE.relicTierWeights[source][regionIndex];
  const available = rarities.filter(rarity => remaining.some(relic => relic.rarity === rarity));
  let entries: Array<{ rarity: ItemRarity; weight: number }> = available.map((rarity, index) => ({ rarity, weight: weights[index] }));
  if (source === 'boss' && slot === 0) {
    entries = entries.map(entry => entry.rarity === 'common' ? { ...entry, weight: 0 } : entry);
    if (!entries.some(entry => entry.weight > 0)) entries = entries.map(entry => entry.rarity === 'common' ? { ...entry, weight: 1 } : entry);
  } else if (source === 'boss' && regionIndex === 2 && !entries.some(entry => entry.weight > 0)) {
    entries = entries.map(entry => entry.rarity === 'common' ? { ...entry, weight: 1 } : entry);
  }
  return entries.filter(entry => entry.weight > 0);
}

export function drawRelicIds(run: RunState, source: RelicSource, count: number, rng: SeededRng): string[] {
  if (count <= 0) return [];
  const remaining = [...eligibleRelics(run, source)];
  const ids: string[] = [];
  for (let slot = 0; slot < count; slot += 1) {
    const tiers = weightedRarities(remaining, source, run.regionIndex, slot);
    if (!tiers.length) break;
    const rarity = rng.weightedPick(tiers).rarity;
    const chosen = rng.pick(remaining.filter(relic => relic.rarity === rarity));
    ids.push(chosen.id);
    remaining.splice(remaining.findIndex(relic => relic.id === chosen.id), 1);
  }
  return ids;
}
