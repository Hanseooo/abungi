import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRng } from '../../.domain-build/core/rng/seededRng.js';
import { createBattle, resolveBattleCommand } from '../../.domain-build/core/combat/battleEngine.js';
import { getItem } from '../../.domain-build/content/items.js';
import { createRun } from '../../.domain-build/core/progression/run.js';
import { generateReward, claimReward } from '../../.domain-build/core/progression/rewards.js';

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

test('PP Cache restores a slice of missing party PP when claimed', () => {
  const run = createRun(party, 31337);
  run.party[0].abilityPP['knuckle-up'] = 2;

  const reward = {
    tier: 'normal', coins: 0, relicChoices: [], upgradeChoices: [],
    spoilsChoices: [{ id: 'ppcache', label: 'PP Cache', description: 'Restore 10% of missing PP across the party.', ppPercent: 0.10 }],
  };
  const next = claimReward(run, reward, { spoilsId: 'ppcache' });
  assert.equal(next.party[0].abilityPP['knuckle-up'], 4);
});

test('PP Cache is part of the normal spoils pool', () => {
  const run = createRun(party, 31337);
  const ids = new Set();
  for (let seed = 1; seed <= 200; seed += 1) {
    for (const choice of generateReward(run, 'normal', new SeededRng(seed), 'normal-fastlane').spoilsChoices) ids.add(choice.id);
  }
  assert.ok(ids.has('ppcache'), 'PP Cache never appeared in 200 seeded normal rewards');
  assert.ok(ids.has('cash') && ids.has('patch'), 'PP Cache must sit alongside the existing options, not replace them');
});
