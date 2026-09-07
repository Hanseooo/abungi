import { describe, expect, test } from 'vitest';
import { validateContent } from '../../src/game/content/contentRegistry';
import { CHARACTERS } from '../../src/game/content/characters';
import { ENEMIES } from '../../src/game/content/enemies';
import { EVENTS } from '../../src/game/content/events';
import { RELICS } from '../../src/game/content/relics';

describe('release content registry', () => {
  test('contains the full v0.1 content set with no broken references', () => {
    expect(validateContent()).toEqual({ valid: true, errors: [] });
    expect(CHARACTERS).toHaveLength(11);
    expect(CHARACTERS.flatMap(character => character.abilities)).toHaveLength(44);
    expect(ENEMIES.length).toBeGreaterThanOrEqual(16);
    expect(EVENTS.length).toBeGreaterThanOrEqual(8);
    expect(RELICS.length).toBeGreaterThanOrEqual(12);
  });
});
