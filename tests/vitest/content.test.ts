import { describe, expect, test } from 'vitest';
import { validateContent } from '../../src/game/content/contentRegistry';
import { CHARACTERS } from '../../src/game/content/characters';
import { ENEMIES } from '../../src/game/content/enemies';
import { EVENTS } from '../../src/game/content/events';
import { RELICS } from '../../src/game/content/relics';
import { ITEMS } from '../../src/game/content/items';

describe('release content registry', () => {
  test('contains the full v0.3 content set with no broken references', () => {
    expect(validateContent()).toEqual({ valid: true, errors: [] });
    expect(CHARACTERS).toHaveLength(12);
    expect(CHARACTERS.flatMap(character => character.abilities)).toHaveLength(48);
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
