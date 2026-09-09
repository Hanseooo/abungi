import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRng, hashText } from '../../.domain-build/core/rng/seededRng.js';
import { EVENTS, getEvent } from '../../.domain-build/content/events.js';
import { RELICS, getRelic } from '../../.domain-build/content/relics.js';
import { createRun, advanceRegion } from '../../.domain-build/core/progression/run.js';
import { generateRegionRoute, minimumCombatNodesToBoss, validateRoute } from '../../.domain-build/core/progression/route.js';
import { applyEventChoice, canChooseEvent, deriveEventOffers, previewEventChoice, previewRecruitment } from '../../.domain-build/core/progression/events.js';
import { eligibleRelics } from '../../.domain-build/core/progression/relicDrafts.js';

test('event routes replay from the run seed and avoid ordinary repeats before exhaustion', () => {
  const baseline = [0, 1, 2].map(region => generateRegionRoute(region, new SeededRng(913)));
  const changed = new SeededRng(913);
  for (let i = 0; i < 200; i += 1) changed.next();
  const replay = [0, 1, 2].map(region => generateRegionRoute(region, changed));
  assert.deepEqual(replay, baseline);

  const ids = baseline.flatMap(route => route.nodes
    .filter(node => node.type === 'event')
    .map(node => node.eventId));
  const pool = EVENTS.filter(event => event.weight > 0).map(event => event.id);
  assert.equal(new Set(ids.slice(0, pool.length)).size, Math.min(ids.length, pool.length));
  for (const route of baseline) {
    assert.equal(validateRoute(route).valid, true);
    assert.ok(minimumCombatNodesToBoss(route) >= 2);
    assert.deepEqual(route.nodes.filter(node => node.stage === 2).map(node => node.type), ['rest', 'shop']);
  }

  let run = createRun(['earl', 'hans', 'marcus'], 913);
  run = advanceRegion(run);
  run = advanceRegion(run);
  assert.deepEqual(run.route, baseline[2]);
});

// The guaranteed pre-boss Rest lane removed one event-eligible slot per region, so a run can now
// generate at most 13 event nodes against a 14-event pool. Exhaustion is therefore unreachable by
// generation and no run can repeat an ordinary event; makeNode keeps its empty-pool fallback as a
// guard for a future content cut. This test pins the property that makes the fallback unreachable.
test('no run can exhaust the event pool, so ordinary events never repeat', () => {
  const pool = EVENTS.filter(event => event.weight > 0 && event.id !== 'fourth-chair');
  let mostSeen = 0;
  for (let seed = 1; seed <= 20000; seed += 1) {
    let run = createRun(['earl', 'hans', 'marcus'], seed);
    const ids = [];
    for (let region = 0; region < 3; region += 1) {
      ids.push(...run.route.nodes.filter(node => node.type === 'event').map(node => node.eventId));
      if (region < 2) run = advanceRegion(run);
    }
    for (const id of ids) assert.ok(id === 'fourth-chair' || pool.some(event => event.id === id), `seed ${seed}: ${id} is not eligible content`);
    const ordinary = ids.filter(id => id !== 'fourth-chair');
    assert.equal(new Set(ordinary).size, ordinary.length, `seed ${seed} repeated an ordinary event`);
    assert.ok(ids.length < pool.length, `seed ${seed} generated ${ids.length} event nodes against a ${pool.length}-event pool`);
    mostSeen = Math.max(mostSeen, ids.length);
  }
  assert.ok(mostSeen >= 10, `sweep only ever reached ${mostSeen} event nodes; it is no longer exercising a busy route`);
});

test('event preview applies living-only HP rounding without changing the source run', () => {
  const run = createRun(['earl', 'hans', 'marcus'], 77);
  run.party[0].hp = 109;
  run.party[1].hp = 0;
  const before = structuredClone(run);
  assert.deepEqual(previewEventChoice(run, 'rain-stall', 'wait'), { hpDelta: 1, ppDelta: 0 });
  assert.deepEqual(run, before);
});

test('event offers require a generated event node and leave the run RNG unchanged', () => {
  let run = createRun(['earl', 'hans', 'marcus'], 77);
  for (let region = 0; region < 3; region += 1) {
    const node = run.route.nodes.find(candidate => candidate.type === 'event');
    if (node) {
      const before = structuredClone(run);
      const offers = deriveEventOffers(run, node.id);
      assert.ok(Array.isArray(offers.itemIds) && Array.isArray(offers.upgrades) && Array.isArray(offers.recruitIds));
      assert.deepEqual(run, before, 'deriving offers must not advance the run or its RNG');
      const battle = run.route.nodes.find(candidate => candidate.type === 'battle');
      assert.throws(() => deriveEventOffers(run, battle.id), /route event node/);
      assert.deepEqual(run, before);
      return;
    }
    if (region < 2) run = advanceRegion(run);
  }
  assert.fail('Expected a generated event node.');
});

test('fourth-chair is the first event in only its seed-selected region', () => {
  let absentEventRegion = false;
  for (let seed = 1; seed <= 20000; seed += 1) {
    const region = 1 + (hashText(String(seed)) % 2);
    const route = generateRegionRoute(region, new SeededRng(seed));
    const events = route.nodes.filter(node => node.type === 'event');
    const anchors = events.filter(node => node.eventId === 'fourth-chair');
    assert.ok(anchors.length <= 1);
    if (events.length) {
      assert.equal(anchors.length, 1);
      assert.equal(anchors[0].id, events[0].id);
    } else {
      absentEventRegion = true;
      assert.equal(anchors.length, 0);
    }
  }
  assert.equal(absentEventRegion, true);
});

function recruitmentForEarl() {
  for (let seed = 1; seed <= 20000; seed += 1) {
    const run = runAtEvent('fourth-chair', ['hans', 'jiro', 'marcus'], seed);
    if (deriveEventOffers(run, run.currentNodeId).recruitIds.includes('earl')) return run;
  }
  assert.fail('Expected a real Earl recruitment offer.');
}

test('event recruitment inherits the outgoing slot and aggregate PP ratio', () => {
  const run = recruitmentForEarl();
  const hans = run.party[0];
  hans.hp = 46;
  hans.abilityPP = { sidearm: 7, 'sentry-unit': 0, 'repair-drone': 0, overclock: 0 };
  const selection = { kind: 'recruit', candidateId: 'earl', outgoingCharacterId: 'hans', upgradeIds: [] };
  const preview = previewRecruitment(run, selection);
  assert.equal(preview.member.hp, 55);
  assert.deepEqual(preview.member.abilityPP, { 'knuckle-up': 4, yosi: 2, 'patch-up': 1, adrenaline: 1 });
  const result = applyEventChoice(run, 'fourth-chair', 'recruit', new SeededRng(5), selection);
  assert.deepEqual(result.run.party[0], preview.member);
  assert.deepEqual(result.run.party.slice(1), run.party.slice(1));
  hans.hp = 0;
  assert.equal(previewRecruitment(run, selection).member.hp, 17);
});

test('event recruitment rejects duplicate inherited upgrades without changing input or RNG', () => {
  const run = recruitmentForEarl();
  run.party[0].upgradedAbilities = ['sidearm', 'sentry-unit'];
  const before = structuredClone(run);
  const rng = new SeededRng(5);
  const rngBefore = rng.serialize();
  assert.throws(() => applyEventChoice(run, 'fourth-chair', 'recruit', rng,
    { kind: 'recruit', candidateId: 'earl', outgoingCharacterId: 'hans', upgradeIds: ['knuckle-up', 'knuckle-up'] }), /distinct/i);
  assert.deepEqual(run, before);
  assert.deepEqual(rng.serialize(), rngBefore);
});

test('a present required character can take their event variant', () => {
  const run = createRun(['hans', 'earl', 'marcus'], 818);
  run.party[0].abilityPP.sidearm = 0;
  const result = applyEventChoice(run, 'repair-bench', 'hans-tune', new SeededRng(3));
  assert.ok(result.run.party[0].abilityPP.sidearm > 0);
});

test('an absent required character rejects an event choice without changing state or RNG', () => {
  const run = createRun(['earl', 'jiro', 'marcus'], 819);
  const before = structuredClone(run);
  const rng = new SeededRng(5);
  const rngBefore = rng.serialize();
  assert.throws(() => applyEventChoice(run, 'repair-bench', 'hans-tune', rng), /required character/i);
  assert.deepEqual(run, before);
  assert.deepEqual(rng.serialize(), rngBefore);
});

function runAtEvent(eventId, partyIds = ['earl', 'hans', 'marcus'], seed = 20260908) {
  const run = createRun(partyIds, seed);
  const node = run.route.nodes.find(candidate => candidate.type === 'event');
  node.eventId = eventId;
  run.currentNodeId = node.id;
  return run;
}

test('event trade accepts two units from a full stacked pack', () => {
  const run = runAtEvent('swap-meet');
  run.inventory = [{ itemId: 'patch-kit', quantity: 6 }];
  const before = structuredClone(run);
  const offeredItemId = deriveEventOffers(run, run.currentNodeId).itemIds[0];
  const rng = new SeededRng(run.seed, run.rngState);
  const rngBefore = rng.serialize();
  const result = applyEventChoice(run, 'swap-meet', 'trade', rng,
    { kind: 'tradeItems', itemIds: ['patch-kit', 'patch-kit'], offeredItemId });
  assert.equal(result.run.inventory.reduce((sum, item) => sum + item.quantity, 0), 5);
  assert.equal(result.run.coins, before.coins);
  assert.deepEqual(run, before);
  assert.deepEqual(rng.serialize(), rngBefore);
});

test('event trade rejects a duplicated input without enough owned units', () => {
  const run = runAtEvent('swap-meet');
  const before = structuredClone(run);
  const offeredItemId = deriveEventOffers(run, run.currentNodeId).itemIds[0];
  const rng = new SeededRng(run.seed, run.rngState);
  const rngBefore = rng.serialize();
  assert.equal(canChooseEvent(run, 'swap-meet', 'trade',
    { kind: 'tradeItems', itemIds: ['patch-kit', 'patch-kit'], offeredItemId }).allowed, false);
  assert.throws(() => applyEventChoice(run, 'swap-meet', 'trade', rng,
    { kind: 'tradeItems', itemIds: ['patch-kit', 'patch-kit'], offeredItemId }), /own|quantity/i);
  assert.deepEqual(run, before);
  assert.deepEqual(rng.serialize(), rngBefore);
});

test('event pawn pays half the real item price without consuming RNG', () => {
  const run = runAtEvent('swap-meet');
  const result = applyEventChoice(run, 'swap-meet', 'pawn', new SeededRng(run.seed, run.rngState), { kind: 'pawnItem', itemId: 'pp-tonic' });
  assert.equal(result.run.coins, run.coins + 9);
  assert.equal(result.run.inventory.find(item => item.itemId === 'pp-tonic'), undefined);
});

test('event training charges coins and living HP only after an offered upgrade is selected', () => {
  const run = runAtEvent('sparring-yard');
  run.coins = 22;
  const offer = deriveEventOffers(run, run.currentNodeId).upgrades[0];
  const result = applyEventChoice(run, 'sparring-yard', 'train', new SeededRng(run.seed, run.rngState), { kind: 'upgradeAbility', ...offer });
  assert.equal(result.run.coins, 0);
  assert.deepEqual(result.run.party.map(member => member.hp), [101, 85, 112]);
  assert.ok(result.run.party.find(member => member.characterId === offer.characterId).upgradedAbilities.includes(offer.abilityId));
});


test('event safe press replaces one Common with a different unowned Common', () => {
  const run = runAtEvent('the-press');
  run.relicIds = ['cardboard-plate'];
  const before = structuredClone(run);
  const result = applyEventChoice(run, 'the-press', 'safe', new SeededRng(5),
    { kind: 'pressRelic', relicId: 'cardboard-plate' });
  assert.equal(result.run.relicIds.length, 1);
  assert.notEqual(result.run.relicIds[0], 'cardboard-plate');
  assert.equal(getRelic(result.run.relicIds[0]).rarity, 'common');
  assert.deepEqual(run, before);
});

test('event risk press resolves Uncommon, Common, and destruction branches', () => {
  const branches = [
    { seed: 7, rarity: 'uncommon' },
    { seed: 10, rarity: 'common' },
    { seed: 4, rarity: undefined },
  ];
  for (const branch of branches) {
    const run = runAtEvent('the-press');
    run.relicIds = ['cardboard-plate'];
    const before = structuredClone(run);
    const result = applyEventChoice(run, 'the-press', 'risk', new SeededRng(branch.seed),
      { kind: 'pressRelic', relicId: 'cardboard-plate' });
    if (branch.rarity) {
      assert.equal(result.run.relicIds.length, 1);
      assert.notEqual(result.run.relicIds[0], 'cardboard-plate');
      assert.equal(getRelic(result.run.relicIds[0]).rarity, branch.rarity);
    } else {
      assert.equal(result.run.relicIds.length, 0);
      assert.deepEqual(result.run.inventory, before.inventory);
      assert.equal(result.run.coins, before.coins);
      assert.equal(result.run.score, before.score);
    }
  }
});

test('event press rejects Rare input and exhausted Common stock before consuming RNG', () => {
  const run = runAtEvent('the-press');
  run.relicIds = ['blue-tonic-cap'];
  const before = structuredClone(run);
  const rng = new SeededRng(5);
  const rngBefore = rng.serialize();
  assert.equal(canChooseEvent(run, 'the-press', 'risk',
    { kind: 'pressRelic', relicId: 'blue-tonic-cap' }).allowed, false);
  assert.throws(() => applyEventChoice(run, 'the-press', 'risk', rng,
    { kind: 'pressRelic', relicId: 'blue-tonic-cap' }), /Common/i);
  assert.deepEqual(run, before);
  assert.deepEqual(rng.serialize(), rngBefore);

  const exhausted = runAtEvent('the-press');
  exhausted.relicIds = RELICS.filter(relic => relic.rarity === 'common').map(relic => relic.id);
  const exhaustedRng = new SeededRng(5);
  assert.equal(canChooseEvent(exhausted, 'the-press', 'safe',
    { kind: 'pressRelic', relicId: 'cardboard-plate' }).allowed, false);
  assert.equal(canChooseEvent(exhausted, 'the-press', 'risk',
    { kind: 'pressRelic', relicId: 'cardboard-plate' }).allowed, false);
  assert.throws(() => applyEventChoice(exhausted, 'the-press', 'risk', exhaustedRng,
    { kind: 'pressRelic', relicId: 'cardboard-plate' }), /unowned Common/i);
  assert.equal(exhausted.relicIds.includes('blue-tonic-cap'), false);
});

function firstUpgradeSelection(run, node) {
  const offer = deriveEventOffers(run, node.id).upgrades[0];
  return { kind: 'upgradeAbility', ...offer };
}

test('saq-coach costs six fewer coins than Train and takes the same injury', () => {
  const train = getEvent('sparring-yard').choices.find(c => c.id === 'train');
  const coach = getEvent('sparring-yard').choices.find(c => c.id === 'saq-coach');
  assert.equal(coach.requiresCharacterId, 'saq');
  assert.deepEqual(coach.effects, [
    { kind: 'coins', amount: -16 },
    { kind: 'partyHpPercent', amount: -0.08 },
    { kind: 'upgradeAbility' },
  ]);
  assert.equal(train.effects[0].amount, -22, 'the base choice is unchanged');
  assert.equal(coach.effects[1].amount, train.effects[1].amount, 'same injury');
});

test('saq-coach is unavailable without Saq in the party', () => {
  const run = runAtEvent('sparring-yard', ['earl', 'hans', 'marcus']);
  run.coins = 40;
  const node = run.route.nodes.find(n => n.eventId === 'sparring-yard');
  const selection = firstUpgradeSelection(run, node);
  const verdict = canChooseEvent(run, 'sparring-yard', 'saq-coach', selection);
  assert.equal(verdict.allowed, false);
  assert.match(verdict.reason, /required character/i);
});

test('saq-coach remains available when Saq is KO, matching every other character variant', () => {
  const run = runAtEvent('sparring-yard', ['saq', 'hans', 'marcus']);
  run.coins = 40;
  run.party.find(m => m.characterId === 'saq').hp = 0;
  const node = run.route.nodes.find(n => n.eventId === 'sparring-yard');
  run.currentNodeId = node.id;
  assert.equal(canChooseEvent(run, 'sparring-yard', 'saq-coach', firstUpgradeSelection(run, node)).allowed, true);
});

test('saq-organize grants six more coins than helping pack, and no items', () => {
  const run = runAtEvent('bulk-deal', ['saq', 'hans', 'marcus']);
  run.coins = 0;
  const organize = getEvent('bulk-deal').choices.find(c => c.id === 'saq-organize');
  assert.equal(organize.requiresCharacterId, 'saq');
  assert.deepEqual(organize.effects, [{ kind: 'coins', amount: 20 }]);
  const before = structuredClone(run);
  const result = applyEventChoice(run, 'bulk-deal', 'saq-organize', new SeededRng(5));
  assert.equal(result.run.coins, before.coins + 20);
  assert.deepEqual(result.run.inventory, run.inventory, 'the coin-only helper adds no items');
});

test('bulk-deal still offers its existing free-of-Saq choices', () => {
  const ids = getEvent('bulk-deal').choices.map(c => c.id);
  assert.deepEqual(ids.filter(id => id !== 'saq-organize'), ['leandre-crate', 'buy', 'help']);
});

test('Ken event variants apply their exact discounts and preserve existing outcomes', () => {
  const shrine = getEvent('paper-shrine');
  const base = shrine.choices.find(c => c.id === 'take');
  const ken = shrine.choices.find(c => c.id === 'ken-read-work');
  assert.equal(ken.requiresCharacterId, 'ken');
  assert.deepEqual(ken.effects, [{ kind: 'coins', amount: -10 }, { kind: 'randomRelic' }]);
  assert.equal(base.effects[0].amount, -16);
  const run = runAtEvent('paper-shrine', ['ken', 'hans', 'marcus']);
  run.coins = 40;
  const kenResult = applyEventChoice(run, 'paper-shrine', 'ken-read-work', new SeededRng(9));
  const baseResult = applyEventChoice(run, 'paper-shrine', 'take', new SeededRng(9));
  assert.deepEqual(kenResult.run.relicIds, baseResult.run.relicIds);
  assert.equal(kenResult.run.coins, baseResult.run.coins + 6);

  const locker = getEvent('old-locker');
  const trace = locker.choices.find(c => c.id === 'ken-trace-latch');
  assert.equal(trace.requiresCharacterId, 'ken');
  assert.deepEqual(trace.effects, [{ kind: 'partyHpPercent', amount: -0.03 }, { kind: 'item', itemId: 'field-ration' }]);
  assert.equal(locker.choices.find(c => c.id === 'force').effects[0].amount, -0.05);
});

test('Ken event variants preserve relic exhaustion, pack capacity and Greg coexistence', () => {
  const shrine = runAtEvent('paper-shrine', ['ken', 'hans', 'marcus']);
  shrine.coins = 40;
  shrine.relicIds = eligibleRelics(shrine, 'folded-tokens').map(relic => relic.id);
  assert.match(canChooseEvent(shrine, 'paper-shrine', 'ken-read-work').reason, /already own every relic/i);

  const locker = runAtEvent('old-locker', ['ken', 'greg', 'marcus']);
  locker.inventory = [{ itemId: 'patch-kit', quantity: 6 }];
  assert.match(canChooseEvent(locker, 'old-locker', 'ken-trace-latch').reason, /pack is too full/i);
  locker.inventory = [];
  const eligible = getEvent('old-locker').choices.filter(c => canChooseEvent(locker, 'old-locker', c.id).allowed).map(c => c.id);
  assert.deepEqual(eligible, ['greg-force', 'ken-trace-latch', 'force', 'leave']);
  const result = applyEventChoice(locker, 'old-locker', 'ken-trace-latch', new SeededRng(3));
  assert.equal(result.run.coins, locker.coins);
  assert.equal(result.run.inventory.find(entry => entry.itemId === 'field-ration').quantity, 1);
});
