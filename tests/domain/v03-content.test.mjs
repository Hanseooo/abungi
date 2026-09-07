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

test('Brick in a Sock damages one enemy at neutral affinity, so anyone can throw it', () => {
  const item = getItem('brick-in-a-sock');
  assert.deepEqual(item.effects, [{ kind: 'damage', power: 65 }]);
  assert.equal(item.target, 'enemy-one');
  assert.equal(item.battleOnly, true);

  const battle = startBattle();
  const actorId = battle.allies[0];
  battle.turnOrder = [actorId, ...battle.turnOrder.filter(id => id !== actorId)];
  battle.turnIndex = 0;
  const targetId = battle.enemies[0];
  const before = battle.units[targetId].hp;

  const { nextState, events } = resolveBattleCommand(
    battle, { kind: 'item', actorId, itemId: 'brick-in-a-sock', targetIds: [targetId] }, new SeededRng(9),
  );

  assert.ok(nextState.units[targetId].hp < before, 'the thrown item dealt no damage');
  const damage = events.find(event => event.type === 'damage' && event.targetId === targetId);
  assert.ok(damage, 'no damage event was emitted');
  assert.equal(damage.affinity, 'normal', 'a thrown object must never take an affinity multiplier');
});
