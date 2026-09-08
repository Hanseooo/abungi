import { describe, expect, it } from 'vitest';
import type { CombatEvent } from '../../src/game/core/types';
import * as combatDirector from '../../src/features/battle/combatDirector';

describe('combat HP presentation', () => {
  it('reveals resolved damage one impact at a time instead of showing final HP upfront', () => {
    const events: CombatEvent[] = [
      { type: 'actionStart', actorId: 'ally', label: 'Double Tap' },
      { type: 'hit', targetId: 'enemy' },
      { type: 'damage', targetId: 'enemy', amount: 10, critical: false, affinity: 'normal' },
      { type: 'hit', targetId: 'enemy' },
      { type: 'damage', targetId: 'enemy', amount: 15, critical: false, affinity: 'normal' },
    ];
    const beats = combatDirector.buildCombatBeats(events);
    const presentedHpAtBeat = (combatDirector as typeof combatDirector & {
      presentedHpAtBeat?: (finalHp: Record<string, number>, beats: typeof beats, index: number) => Record<string, number>;
    }).presentedHpAtBeat;

    expect(presentedHpAtBeat).toBeTypeOf('function');
    expect(presentedHpAtBeat?.({ enemy: 75 }, beats, 0)).toEqual({ enemy: 100 });
    expect(presentedHpAtBeat?.({ enemy: 75 }, beats, 1)).toEqual({ enemy: 90 });
    expect(presentedHpAtBeat?.({ enemy: 75 }, beats, 2)).toEqual({ enemy: 75 });
  });

  it('holds a committed enemy move long enough to identify its target before impact', () => {
    const events: CombatEvent[] = [
      { type: 'actionStart', actorId: 'ally', label: 'Knuckle Up', side: 'ally' },
      { type: 'hit', targetId: 'enemy' },
      { type: 'damage', targetId: 'enemy', amount: 12, critical: false, affinity: 'normal' },
      { type: 'actionStart', actorId: 'enemy', label: 'Cheap Shot', side: 'enemy' },
      { type: 'hit', targetId: 'earl' },
      { type: 'damage', targetId: 'earl', amount: 9, critical: false, affinity: 'normal' },
    ];
    const beats = combatDirector.buildCombatBeats(events) as Array<combatDirector.CombatBeat & { targetIds?: string[] }>;
    const enemyAnnouncement = beats.find(beat => beat.phase === 'announce' && beat.action?.side === 'enemy');

    expect(enemyAnnouncement?.targetIds).toEqual(['earl']);
    expect(combatDirector.combatBeatDuration(enemyAnnouncement!, { animationSpeed: 1, reducedMotion: false })).toBeGreaterThanOrEqual(600);
  });

  it('slows standard combat at 1x while preserving proportional speed settings', () => {
    const meleeAnnouncement: combatDirector.CombatBeat = {
      phase: 'announce',
      events: [],
      action: { type: 'actionStart', actorId: 'ally', label: 'Knuckle Up', side: 'ally', choreography: 'melee' },
      targetIds: ['enemy'],
    };
    const heavyImpact: combatDirector.CombatBeat = {
      phase: 'resolve',
      events: [{ type: 'damage', targetId: 'enemy', amount: 12, critical: false, affinity: 'normal' }],
      action: { type: 'actionStart', actorId: 'ally', label: 'Haymaker', side: 'ally', choreography: 'heavy' },
      targetIds: ['enemy'],
    };

    expect(combatDirector.combatBeatDuration(meleeAnnouncement, { animationSpeed: 1, reducedMotion: false })).toBe(325);
    expect(combatDirector.combatBeatDuration(meleeAnnouncement, { animationSpeed: 2, reducedMotion: false })).toBe(163);
    expect(combatDirector.combatBeatDuration(heavyImpact, { animationSpeed: 1, reducedMotion: false })).toBe(653);
  });

  it('moves the protector HP bar for a transfer event', () => {
    const events: CombatEvent[] = [
      { type: 'actionStart', actorId: 'enemy-0-wisp', label: 'Flicker', side: 'enemy' },
      { type: 'hit', targetId: 'ally-1-hans' },
      { type: 'damage', targetId: 'ally-1-hans', amount: 20, critical: false, affinity: 'normal' },
      { type: 'transfer', fromId: 'ally-1-hans', toId: 'ally-0-saq', amount: 5 },
    ];
    const beats = combatDirector.buildCombatBeats(events);
    const finalHp = { 'ally-0-saq': 111, 'ally-1-hans': 72 };
    const atStart = combatDirector.presentedHpAtBeat(finalHp, beats, 0);
    expect(atStart).toEqual({ 'ally-0-saq': 116, 'ally-1-hans': 92 });
    const atEnd = combatDirector.presentedHpAtBeat(finalHp, beats, beats.length - 1);
    expect(atEnd).toEqual(finalHp);
  });
});
