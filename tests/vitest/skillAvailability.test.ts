import { describe, expect, it } from 'vitest';
import { createRun } from '../../src/game/core/progression/run';
import { SeededRng } from '../../src/game/core/rng/seededRng';
import { createBattle } from '../../src/game/core/combat/battleEngine';
import { currentActorAvailability } from '../../src/app/appStore';
import type { RunState } from '../../src/game/core/types';

// Saq leads the party, so the availability probe's "first living ally" is Saq himself and
// Take Your Seat reported itself permanently illegal. The probe must try every ally.
function runWithSaqActing(): RunState {
  const run = createRun(['saq', 'hans', 'jiro'], 7);
  const battle = createBattle(['saq', 'hans', 'jiro'], 'normal-scrap', new SeededRng(7));
  const saqId = battle.allies.find(id => battle.units[id].sourceId === 'saq')!;
  battle.turnIndex = battle.turnOrder.indexOf(saqId);
  battle.phase = 'input';
  return { ...run, activeBattle: battle };
}

describe('currentActorAvailability', () => {
  it('offers Take Your Seat when some other ally can be protected', () => {
    const entry = currentActorAvailability(runWithSaqActing())!.find(e => e.ability.id === 'take-your-seat');
    expect(entry).toBeDefined();
    expect(entry!.reason ?? '').not.toMatch(/another ally/i);
    expect(entry!.legal).toBe(true);
  });
});
