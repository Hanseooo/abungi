import type { BattleState, BattleUnit, EnemyMoveDefinition } from '../types.js';
import type { SeededRng } from '../rng/seededRng.js';
import { getEnemy } from '../../content/enemies.js';

function livingForSide(state: BattleState, side: 'ally'|'enemy'): BattleUnit[] {
  const ids = side === 'ally' ? state.allies : state.enemies;
  return ids.map(id=>state.units[id]).filter(Boolean).filter(unit=>unit.alive && unit.hp>0);
}

function moveConditionAllowed(move: EnemyMoveDefinition, actor: BattleUnit, state: BattleState): boolean {
  switch (move.condition ?? 'always') {
    case 'always': return true;
    case 'self-below-half': return actor.hp / actor.maxHp < 0.5;
    case 'self-below-35': return actor.hp / actor.maxHp < 0.35;
    case 'ally-injured': return livingForSide(state, actor.side).some(unit=>unit.hp/unit.maxHp < 0.72);
    case 'has-other-enemy': return livingForSide(state, actor.side).length > 1;
  }
}

export function legalEnemyMoves(state: BattleState, actor: BattleUnit): EnemyMoveDefinition[] {
  const definition = getEnemy(actor.sourceId);
  const recent = state.recentEnemyMoves[actor.id] ?? [];
  const usedOnce = new Set<string>(String(actor.flags.usedOnceMoves ?? '').split(',').filter(Boolean));
  return definition.moves.filter(move => {
    if (!moveConditionAllowed(move, actor, state)) return false;
    if (move.once && usedOnce.has(move.id)) return false;
    if (move.cooldown && recent.slice(-move.cooldown).includes(move.id)) return false;
    if (move.signature && recent.at(-1) === move.id) return false;
    return true;
  });
}

export function chooseEnemyMove(state: BattleState, actor: BattleUnit, rng: SeededRng): EnemyMoveDefinition {
  const definition = getEnemy(actor.sourceId);
  let legal = legalEnemyMoves(state, actor);
  if (legal.length === 0) legal = definition.moves.filter(move => !move.once || !String(actor.flags.usedOnceMoves ?? '').split(',').includes(move.id));
  if (legal.length === 0) legal = definition.moves;
  const adjusted = legal.map(move => {
    let weight = move.weight;
    if (definition.aiProfile === 'boss-jonlow') {
      if (actor.hp/actor.maxHp < 0.45 && move.id === 'table-flip') weight *= 2.3;
      if (actor.hp/actor.maxHp < 0.3 && move.id === 'stuff-face') weight *= 0.55;
    }
    if (definition.aiProfile === 'boss-klyde' && move.signature && (state.recentEnemyMoves[actor.id] ?? []).includes(move.id)) weight *= 0.35;
    if (definition.aiProfile === 'boss-warden' && actor.hp/actor.maxHp < 0.35 && move.id === 'enforcement-burst') weight *= 2.5;
    return {...move, weight};
  });
  return rng.weightedPick(adjusted);
}

export function chooseEnemyTargets(state: BattleState, actor: BattleUnit, move: EnemyMoveDefinition, rng: SeededRng): string[] {
  const foes = livingForSide(state, actor.side === 'enemy' ? 'ally' : 'enemy');
  const friends = livingForSide(state, actor.side);
  const mode = move.target;
  if (mode === 'enemy-all') return foes.map(unit=>unit.id);
  if (mode === 'ally-all') return friends.map(unit=>unit.id);
  if (mode === 'self') return [actor.id];
  if (mode === 'ally-one') {
    if (move.condition === 'ally-injured') {
      const sorted = [...friends].sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp);
      return [sorted[0]?.id ?? actor.id];
    }
    return [rng.pick(friends).id];
  }
  if (mode === 'random-enemy') return [rng.pick(foes).id];
  // Enemy-one defaults to a learnable weighted pressure pattern: usually lowest HP, occasionally another target.
  if (rng.chance(0.65)) return [[...foes].sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0].id];
  return [rng.pick(foes).id];
}
