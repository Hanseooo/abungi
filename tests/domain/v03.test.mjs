import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../../.domain-build/core/progression/run.js';
import { claimReward } from '../../.domain-build/core/progression/rewards.js';
import { BALANCE } from '../../.domain-build/balance/constants.js';

const bossReward = { tier:'boss', coins:0, relicChoices:[], upgradeChoices:[], bossRecovery:true, spoilsChoices:[] };

test('region clear revives KO allies to 25% Max HP without giving them the survivor heal', () => {
  assert.equal(BALANCE.regionReviveHpPercent, 0.25);
  const run = createRun(['earl','hans','leandre'], 4242);
  run.party[0].hp = 0;    // Earl,    maxHp 110 -> revived to round(110*.25) = 28
  run.party[1].hp = 40;   // Hans,    maxHp  92 -> 40 + round(92*.30) = 68
  run.party[2].hp = 100;  // Leandre, maxHp 100 -> already full, stays 100

  const next = claimReward(run, bossReward);

  assert.equal(next.party[0].hp, 28, 'KO ally revived to 25% Max HP, not 25% + 30%');
  assert.equal(next.party[1].hp, 68, 'living ally keeps the existing 30% survivor heal');
  assert.equal(next.party[2].hp, 100, 'full-HP ally is still capped at Max HP');
});

test('a revived ally also receives the boss PP restoration', () => {
  const run = createRun(['earl','hans','leandre'], 4242);
  run.party[0].hp = 0;
  run.party[0].abilityPP['knuckle-up'] = 2; // max 18, missing 16, +round(16*.25) = +4

  const next = claimReward(run, bossReward);

  assert.equal(next.party[0].abilityPP['knuckle-up'], 6);
});

test('a non-boss reward never revives anyone', () => {
  const run = createRun(['earl','hans','leandre'], 4242);
  run.party[0].hp = 0;
  const next = claimReward(run, { tier:'normal', coins:0, relicChoices:[], upgradeChoices:[], spoilsChoices:[] });
  assert.equal(next.party[0].hp, 0);
});
