import { describe, expect, it, test } from 'vitest';
import { validateContent } from '../../src/game/content/contentRegistry';
import { CHARACTERS, getCharacter } from '../../src/game/content/characters';
import { ENEMIES } from '../../src/game/content/enemies';
import { EVENTS } from '../../src/game/content/events';
import { RELICS } from '../../src/game/content/relics';
import { ITEMS } from '../../src/game/content/items';
import { resolveScene, ALL_SCENE_VARIANTS } from '../../src/game/content/scenes';

describe('release content registry', () => {
  test('contains the full v0.3 content set with no broken references', () => {
    expect(validateContent()).toEqual({ valid: true, errors: [] });
    expect(CHARACTERS).toHaveLength(13);
    expect(CHARACTERS.flatMap(character => character.abilities)).toHaveLength(52);
    expect(ENEMIES.length).toBeGreaterThanOrEqual(16);
    expect(EVENTS.length).toBeGreaterThanOrEqual(11);
    expect(RELICS.length).toBeGreaterThanOrEqual(16);
    expect(ITEMS.length).toBeGreaterThanOrEqual(11);
  });

  test('every v0.3 addition uses a fresh id and every event offers a real choice', () => {
    for (const id of ['circuit-brew', 'brick-in-a-sock']) expect(ITEMS.filter(item => item.id === id)).toHaveLength(1);
    for (const id of ['jumper-cable', 'chalk-outline']) expect(RELICS.filter(relic => relic.id === id)).toHaveLength(1);
    for (const id of ['bulk-deal', 'live-wire']) expect(EVENTS.filter(event => event.id === id)).toHaveLength(1);
    for (const event of EVENTS) {
      expect(event.choices.length).toBeGreaterThanOrEqual(2);
      expect(event.choices.some(choice => choice.effects.length > 0)).toBe(true);
    }
  });
});

it('Saq has a 50-80 word biography', () => {
  const words = getCharacter('saq').bio.trim().split(/\s+/).length;
  expect(words).toBeGreaterThanOrEqual(50);
  expect(words).toBeLessThanOrEqual(80);
});

it('Saq has a departure, a region transition and one boss reaction', () => {
  const withSaq = { seed: 1, regionIndex: 0, partyIds: ['saq', 'hans', 'marcus'] };
  const withoutSaq = { seed: 1, regionIndex: 0, partyIds: ['earl', 'hans', 'marcus'] };
  expect(resolveScene('party-departure', withSaq).id).not.toEqual(resolveScene('party-departure', withoutSaq).id);
  expect(resolveScene('region-2-intro', { ...withSaq, regionIndex: 1 }).id).not.toEqual(resolveScene('region-2-intro', { ...withoutSaq, regionIndex: 1 }).id);
  expect(resolveScene('boss-warden-intro', withSaq).lines.some(l => l.speaker === 'Saq')).toBe(true);
});

it('every scene variant is at most two lines per speaker', () => {
  for (const scene of ALL_SCENE_VARIANTS) {
    const perSpeaker = new Map<string, number>();
    for (const line of scene.lines) perSpeaker.set(line.speaker, (perSpeaker.get(line.speaker) ?? 0) + 1);
    for (const [, count] of perSpeaker) expect(count).toBeLessThanOrEqual(2);
  }
});

it('existing relationship scenes keep their priority over the new character variants', () => {
  const both = { seed: 1, regionIndex: 2, partyIds: ['saq', 'earl', 'marcus'] };
  expect(resolveScene('boss-klyde-intro', both).relationshipId).toBe('siblings-klyde-earl');
});
