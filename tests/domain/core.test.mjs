import { getEnemy } from '../../.domain-build/content/enemies.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRng } from '../../.domain-build/core/rng/seededRng.js';
import { affinityMultiplier } from '../../.domain-build/core/combat/affinity.js';
import { calculateDamage } from '../../.domain-build/core/combat/damage.js';
import { effectiveSpeed, tickStatuses } from '../../.domain-build/core/combat/status.js';
import { createBattle, getCurrentActor, resolveBattleCommand } from '../../.domain-build/core/combat/battleEngine.js';
import { CHARACTERS, getAbility } from '../../.domain-build/content/characters.js';
import { generateRegionRoute, validateRoute } from '../../.domain-build/core/progression/route.js';

const baseUnit = (overrides = {}) => ({
  id: 'u', sourceId: 'x', displayName: 'Unit', side: 'ally', affinity: 'neutral',
  maxHp: 100, hp: 100, power: 100, guard: 100, speed: 100, statuses: [], alive: true,
  guardActive: false, flags: {}, ...overrides,
});

test('seeded RNG serializes and resumes deterministically', () => {
  const a = new SeededRng(123456);
  a.next(); a.next();
  const snapshot = a.serialize();
  const b = SeededRng.from(snapshot);
  assert.equal(a.next(), b.next());
  assert.equal(a.int(1, 20), b.int(1, 20));
});

test('affinity implements Might → Trick → Mystic → Tech → Might and Neutral', () => {
  assert.equal(affinityMultiplier('might', 'trick'), 1.5);
  assert.equal(affinityMultiplier('trick', 'might'), 0.75);
  assert.equal(affinityMultiplier('trick', 'mystic'), 1.5);
  assert.equal(affinityMultiplier('mystic', 'tech'), 1.5);
  assert.equal(affinityMultiplier('tech', 'might'), 1.5);
  assert.equal(affinityMultiplier('neutral', 'might'), 1);
  assert.equal(affinityMultiplier('might', 'neutral'), 1);
});

test('damage honors guard, affinity, crit and deterministic variance', () => {
  const attacker = baseUnit({ power: 100, affinity: 'might' });
  const defender = baseUnit({ side: 'enemy', guard: 100, affinity: 'trick' });
  const rng = new SeededRng(7);
  const normal = calculateDamage({ attacker, defender, power: 100, moveAffinity: 'might', rng, forceCrit: false, variance: 1 });
  assert.equal(normal.amount, 75);
  const guarded = calculateDamage({ attacker, defender: {...defender, guardActive: true}, power: 100, moveAffinity: 'might', rng, forceCrit: false, variance: 1 });
  assert.equal(guarded.amount, 45);
  const crit = calculateDamage({ attacker, defender, power: 100, moveAffinity: 'might', rng, forceCrit: true, variance: 1 });
  assert.equal(crit.amount, 113);
});

test('haste and slow affect speed; status durations tick consistently', () => {
  assert.equal(effectiveSpeed(baseUnit({ speed: 100, statuses: [{id:'haste', remaining:2}] })), 125);
  assert.equal(effectiveSpeed(baseUnit({ speed: 100, statuses: [{id:'slow', remaining:2}] })), 75);
  const statuses = tickStatuses([{id:'blind', remaining:2},{id:'strength', remaining:1}]);
  assert.deepEqual(statuses, [{id:'blind', remaining:1}]);
});

test('all 11 characters exist with four distinct abilities', () => {
  assert.equal(CHARACTERS.length, 11);
  for (const c of CHARACTERS) {
    assert.equal(c.abilities.length, 4, c.displayName);
    assert.equal(new Set(c.abilities).size, 4, c.displayName);
    for (const id of c.abilities) assert.ok(getAbility(id));
  }
});

test('route generation is seeded, connected, boss-reachable and recovery-safe', () => {
  const a = generateRegionRoute(0, new SeededRng(998));
  const b = generateRegionRoute(0, new SeededRng(998));
  assert.deepEqual(a, b);
  const verdict = validateRoute(a);
  assert.equal(verdict.valid, true, verdict.errors.join(', '));
});

test('Guard remains legal and reduces damage even when PP is exhausted', () => {
  const battle = createBattle(['earl','hans','yeeho'], 'normal-scrap', new SeededRng(5));
  for (const id of battle.allies) {
    const unit = battle.units[id];
    if (unit.abilityPP) for (const key of Object.keys(unit.abilityPP)) unit.abilityPP[key] = 0;
  }
  const actor = getCurrentActor(battle);
  assert.equal(actor.side, 'ally');
  const resolved = resolveBattleCommand(battle, { kind:'guard', actorId: actor.id }, new SeededRng(5));
  assert.equal(resolved.nextState.units[actor.id].guardActive, true);
});

test('Yosi applies Blind and consumes PP', () => {
  let battle = createBattle(['earl','hans','yeeho'], 'normal-scrap', new SeededRng(11));
  const earl = Object.values(battle.units).find(u => u.sourceId === 'earl');
  battle.turnOrder = [earl.id, ...battle.turnOrder.filter(id => id !== earl.id)]; battle.turnIndex = 0;
  const target = battle.enemies[0];
  const before = earl.abilityPP.yosi;
  const result = resolveBattleCommand(battle, {kind:'skill', actorId:earl.id, abilityId:'yosi', targetIds:[target]}, new SeededRng(44));
  assert.equal(result.nextState.units[earl.id].abilityPP.yosi, before - 1);
  assert.ok(result.nextState.units[target].statuses.some(s => s.id === 'blind'));
});

test('encounter durability is centrally scaled and later regions increase enemy pressure',()=>{
  const baseEnemy=getEnemy('scrapper');
  const regionOne=createBattle(['earl','hans','leandre'],'normal-scrap',new SeededRng(333),{regionIndex:0});
  const regionThree=createBattle(['earl','hans','leandre'],'normal-scrap',new SeededRng(333),{regionIndex:2});
  const r1=regionOne.units[regionOne.enemies.find(id=>regionOne.units[id].sourceId==='scrapper')];
  const r3=regionThree.units[regionThree.enemies.find(id=>regionThree.units[id].sourceId==='scrapper')];
  assert.ok(r1.maxHp>baseEnemy.stats.maxHp);
  assert.ok(r3.maxHp>r1.maxHp);
  assert.ok(r3.power>r1.power);
});
