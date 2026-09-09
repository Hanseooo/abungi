import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRng } from '../../.domain-build/core/rng/seededRng.js';
import { createBattle, resolveBattleCommand } from '../../.domain-build/core/combat/battleEngine.js';
import { ITEMS, getItem } from '../../.domain-build/content/items.js';
import { RELICS, getRelic } from '../../.domain-build/content/relics.js';
import { createRun } from '../../.domain-build/core/progression/run.js';
import { generateReward, claimReward } from '../../.domain-build/core/progression/rewards.js';
import { applyEventChoice, canChooseEvent } from '../../.domain-build/core/progression/events.js';

const party = ['earl', 'hans', 'leandre'];
const startBattle = (options = {}) => createBattle(party, 'normal-fastlane', new SeededRng(777), { coins: 30, ...options });

test('recovery expansion adds exactly two items and three relics', () => {
  assert.equal(ITEMS.length, 13);
  assert.equal(RELICS.length, 19);
  assert.deepEqual(getItem('emergency-wrap').effects, [
    { kind: 'healPercent', percent: 0.20 },
    { kind: 'status', statusId: 'fortified', duration: 2 },
  ]);
  assert.equal(getItem('purge-pack').effects[0].kind, 'cleanse');
  assert.equal(getRelic('second-wind').value, 0.15);
});

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

test('PP Cache restores flat PP to each ally’s most-drained move when claimed', () => {
  const run = createRun(party, 31337);
  run.party[0].abilityPP['knuckle-up'] = 2;

  const reward = {
    tier: 'normal', coins: 0, relicChoices: [], upgradeChoices: [],
    spoilsChoices: [{ id: 'ppcache', label: 'PP Cache', description: 'Restore 2 PP to the most-drained move.', ppAmount: 2 }],
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

test('every normal spoils pair keeps a greed option against a sustain option', () => {
  const run = createRun(party, 31337);
  const greed = new Set(['cash', 'scavenge']);
  for (let seed = 1; seed <= 500; seed += 1) {
    const ids = generateReward(run, 'normal', new SeededRng(seed), 'normal-fastlane').spoilsChoices.map(c => c.id);
    assert.ok(ids.some(id => greed.has(id)), `seed ${seed} offered only sustain: ${ids.join(' + ')}`);
    assert.ok(ids.some(id => !greed.has(id)), `seed ${seed} offered only greed: ${ids.join(' + ')}`);
  }
});

test('Jumper Cable tops up each ally at battle start without exceeding max PP', () => {
  assert.equal(getRelic('jumper-cable').mechanicId, 'battle-start-pp');

  const persisted = createRun(party, 55).party.map(member => ({ ...member, abilityPP: { ...member.abilityPP } }));
  for (const member of persisted) for (const id of Object.keys(member.abilityPP)) member.abilityPP[id] -= 5;

  const plain = createBattle(party, 'normal-fastlane', new SeededRng(55), { coins: 0, party: persisted });
  const withRelic = createBattle(party, 'normal-fastlane', new SeededRng(55), { coins: 0, party: persisted, relicIds: ['jumper-cable'] });

  const total = battle => battle.allies.reduce((sum, id) => sum + Object.values(battle.units[id].abilityPP).reduce((a, b) => a + b, 0), 0);
  assert.equal(total(withRelic) - total(plain), 3 * getRelic('jumper-cable').value);

  const atMax = createBattle(party, 'normal-fastlane', new SeededRng(55), { coins: 0 });
  const atMaxWithRelic = createBattle(party, 'normal-fastlane', new SeededRng(55), { coins: 0, relicIds: ['jumper-cable'] });
  assert.equal(total(atMaxWithRelic), total(atMax));
});

test('Chalk Outline pays out once for the first ally knocked out', () => {
  assert.equal(getRelic('chalk-outline').mechanicId, 'ko-coins');

  const state = createBattle(party, 'normal-fastlane', new SeededRng(88), { coins: 0, relicIds: ['chalk-outline'] });
  for (const id of state.allies) {
    state.units[id].hp = 1;
    state.units[id].alive = true;
  }

  let current = state;
  let events = [];
  for (let turn = 0; turn < 12 && current.phase !== 'defeat' && !events.some(event => event.type === 'knockout'); turn += 1) {
    const actor = current.units[current.turnOrder[current.turnIndex]];
    assert.equal(actor.side, 'ally');
    const result = resolveBattleCommand(current, { kind: 'guard', actorId: actor.id }, new SeededRng(turn + 1));
    current = result.nextState;
    events = [...events, ...result.events];
  }
  const coinEvents = events.filter(event => event.type === 'coin');

  assert.ok(events.some(event => event.type === 'knockout' && current.allies.includes(event.targetId)), 'an ally was not knocked out');
  assert.equal(coinEvents.reduce((sum, event) => sum + event.amount, 0), getRelic('chalk-outline').value);
  assert.equal(coinEvents.length, 1);
  assert.equal(current.flags.chalkOutlineUsed, true);
});

test('Bulk Deal requires room for both consumables before charging the party', () => {
  const run = createRun(party, 8181);
  run.coins = 30;
  run.inventory = [
    { itemId: 'field-ration', quantity: 1 },
    { itemId: 'pp-tonic', quantity: 1 },
    { itemId: 'energy-drink', quantity: 1 },
    { itemId: 'patch-kit', quantity: 1 },
    { itemId: 'smoke-bomb', quantity: 1 },
  ];

  assert.equal(canChooseEvent(run, 'bulk-deal', 'buy').allowed, false);

  run.inventory.pop();
  const result = applyEventChoice(run, 'bulk-deal', 'buy', new SeededRng(8181));
  assert.equal(result.run.coins, 10);
  assert.equal(result.run.inventory.reduce((sum, entry) => sum + entry.quantity, 0), 6);
  assert.equal(result.run.inventory.find(entry => entry.itemId === 'field-ration')?.quantity, 2);
  assert.equal(result.run.inventory.find(entry => entry.itemId === 'pp-tonic')?.quantity, 2);
});

test('enemies that outspeed the party report their opening turn instead of applying it silently', () => {
  const openingEvents = [];
  const battle = createBattle(party, 'normal-fastlane', new SeededRng(777), { coins: 0, openingEvents });

  assert.ok(openingEvents.some(event => event.type === 'actionStart'), 'expected an opening enemy action');
  const dealt = openingEvents.filter(event => event.type === 'damage').reduce((sum, event) => sum + event.amount, 0);
  const lost = battle.allies.reduce((sum, id) => sum + (battle.units[id].maxHp - battle.units[id].hp), 0);
  assert.ok(lost > 0, 'expected the party to start the fight already damaged');
  assert.equal(dealt, lost);
});
