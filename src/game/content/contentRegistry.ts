import { CHARACTERS, ABILITIES } from './characters.js';
import { ENEMIES, ENCOUNTERS } from './enemies.js';
import { ITEMS } from './items.js';
import { RELICS } from './relics.js';
import { EVENTS } from './events.js';

export interface ContentValidationResult { valid:boolean; errors:string[] }

export function validateContent(): ContentValidationResult {
  const errors:string[] = [];
  const unique = (name:string, ids:string[]) => {
    const seen = new Set<string>();
    for (const id of ids) { if (seen.has(id)) errors.push(`Duplicate ${name} id: ${id}`); seen.add(id); }
  };
  unique('character', CHARACTERS.map(v=>v.id)); unique('ability', ABILITIES.map(v=>v.id));
  unique('enemy', ENEMIES.map(v=>v.id)); unique('encounter', ENCOUNTERS.map(v=>v.id));
  unique('item', ITEMS.map(v=>v.id)); unique('relic', RELICS.map(v=>v.id)); unique('event', EVENTS.map(v=>v.id));
  const abilities = new Set(ABILITIES.map(v=>v.id));
  for (const c of CHARACTERS) {
    if (c.abilities.length !== 4) errors.push(`${c.id} must have exactly 4 abilities`);
    for (const id of c.abilities) if (!abilities.has(id)) errors.push(`${c.id} references unknown ability ${id}`);
  }
  const enemies = new Set(ENEMIES.map(v=>v.id));
  for (const e of ENCOUNTERS) for (const id of e.enemies) if(!enemies.has(id)) errors.push(`${e.id} references unknown enemy ${id}`);
  if (CHARACTERS.length !== 13) errors.push(`Expected 13 characters, found ${CHARACTERS.length}`);
  if (RELICS.length < 12) errors.push(`Expected >=12 relics, found ${RELICS.length}`);
  if (EVENTS.length < 8) errors.push(`Expected >=8 events, found ${EVENTS.length}`);
  return {valid:errors.length===0,errors};
}

export const CONTENT = { characters:CHARACTERS, abilities:ABILITIES, enemies:ENEMIES, encounters:ENCOUNTERS, items:ITEMS, relics:RELICS, events:EVENTS } as const;
