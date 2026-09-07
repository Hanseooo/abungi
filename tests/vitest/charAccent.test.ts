import { describe, expect, test } from 'vitest';
import { charAccentStyle } from '../../src/ui/charAccent';
import { CHARACTERS, getCharacter } from '../../src/game/content/characters';

describe('character accent colours', () => {
  test('every character borders in its own affinity token', () => {
    expect(charAccentStyle(getCharacter('earl'))).toEqual({ '--char-accent': 'var(--affinity-trick)' });
    expect(charAccentStyle(getCharacter('hans'))).toEqual({ '--char-accent': 'var(--affinity-tech)' });
    expect(charAccentStyle(getCharacter('greg'))).toEqual({ '--char-accent': 'var(--affinity-might)' });
    expect(charAccentStyle({ affinity: 'neutral' })).toEqual({ '--char-accent': 'var(--affinity-neutral)' });
  });

  test('no character carries a hard-coded accent that could break the type read', () => {
    for (const character of CHARACTERS) {
      expect(charAccentStyle(character)).toEqual({ '--char-accent': `var(--affinity-${character.affinity})` });
    }
  });
});
