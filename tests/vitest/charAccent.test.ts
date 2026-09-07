import { describe, expect, test } from 'vitest';
import { charAccentStyle } from '../../src/ui/charAccent';
import { CHARACTERS, getCharacter } from '../../src/game/content/characters';

describe('character accent colours', () => {
  test('only Earl and Hans override the affinity default', () => {
    expect(getCharacter('earl').accentColor).toBe('#C77B94');
    expect(getCharacter('hans').accentColor).toBe('#7A2E2E');
    const overriding = CHARACTERS.filter(character => character.accentColor).map(character => character.id);
    expect(overriding.sort()).toEqual(['earl', 'hans']);
  });

  test('the style helper falls back to the affinity token so the other nine render unchanged', () => {
    expect(charAccentStyle(getCharacter('earl'))).toEqual({ '--char-accent': '#C77B94' });
    expect(charAccentStyle(getCharacter('hans'))).toEqual({ '--char-accent': '#7A2E2E' });
    expect(charAccentStyle(getCharacter('greg'))).toEqual({ '--char-accent': 'var(--affinity-might)' });
    expect(charAccentStyle({ affinity: 'neutral' })).toEqual({ '--char-accent': 'var(--affinity-neutral)' });
  });
});
