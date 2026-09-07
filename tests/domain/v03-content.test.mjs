import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRng } from '../../.domain-build/core/rng/seededRng.js';
import { createBattle, resolveBattleCommand } from '../../.domain-build/core/combat/battleEngine.js';
import { getItem } from '../../.domain-build/content/items.js';

const party = ['earl', 'hans', 'leandre'];
const startBattle = (options = {}) => createBattle(party, 'normal-fastlane', new SeededRng(777), { coins: 30, ...options });

test('Circuit Brew restores PP to the lowest-PP move of every living ally', () => {
  const item = getItem('circuit-brew');
  assert.equal(item.target, 'ally-all');
  assert.equal(item.category, 'resource');

  const battle = startBattle();
  for (const id of battle.allies) {
    const unit = battle.units[id];
    for (const abilityId of Object.keys(unit.abilityPP)) unit.abilityPP[abilityId] -= 5;
  }
  const before = battle.allies.map(id => Object.values(battle.units[id].abilityPP).reduce((a, b) => a + b, 0));

  const actor = battle.units[battle.turnOrder[battle.turnIndex]];
  const next = resolveBattleCommand(battle, { kind: 'item', actorId: actor.id, itemId: 'circuit-brew', targetIds: [] }, new SeededRng(1)).nextState;

  const after = battle.allies.map(id => Object.values(next.units[id].abilityPP).reduce((a, b) => a + b, 0));
  after.forEach((total, index) => assert.ok(total > before[index], `ally ${index} gained no PP`));
});
