import type { BattleFighter,BattleMove,BattleSide,BattleState } from '@mmobot/shared';
import { BattleError } from './state.js';

export const basicAttack = (armed: boolean): BattleMove => ({
  id: armed ? 'weapon_attack' : 'unarmed_strike', name: armed ? 'Атака оружием' : 'Удар рукой',
  kind: 'attack', priority: 0, accuracy: 100, power: 1, cooldownRounds: 0,
});
export function createBattle(fighters: [BattleFighter, BattleFighter]): BattleState {
  return { fighters, choices: [null, null], cooldowns: [{}, {}], effects: [], exitRequested: [false, false], events: [], processedRequests: [] };
}
export function event(state: BattleState, round: number, type: BattleState['events'][number]['type'], hp: [number, number], at: string, text: string, side?: BattleSide) {
  state.events.push({ sequence: state.events.length + 1, round, type, hp: [...hp], at, text, ...(side === undefined ? {} : { side }) });
}
export function availableMove(state: BattleState, side: BattleSide, moveId: string, round: number) {
  const move = state.fighters[side].moves.find(m => m.id === moveId);
  if (!move || (state.cooldowns[side][moveId] ?? 1) > round) throw new BattleError('Приём недоступен');
  return move;
}
/** Pure round resolver. Chances and move parameters come from definitions, not item names. */
export function resolveRound(input: BattleState, initialHp: [number, number], round: number, at: string, random: () => number = Math.random) {
  const state = structuredClone(input);
  const hp: [number, number] = [...initialHp];
  const moves = ([0, 1] as const).map(side => availableMove(state, side, state.choices[side]!, round));
  const priority = (move: BattleMove) => move.kind === 'defend' ? Math.max(1, move.priority) : move.priority;
  const order: BattleSide[] = priority(moves[0]) === priority(moves[1])
    ? (random() < .5 ? [0, 1] : [1, 0]) : priority(moves[0]) > priority(moves[1]) ? [0, 1] : [1, 0];
  const consumedItems: { side: BattleSide; itemType: number }[] = [];
  const guards: [BattleMove['defense'], BattleMove['defense']] = [undefined, undefined];
  const stat = (side: BattleSide, name: 'strength' | 'defense') => state.effects
    .filter(e => e.target === side && e.stat === name && e.untilRound >= round)
    .reduce((n, e) => n * e.multiplier, state.fighters[side][name]);
  for (const side of order) {
    const target: BattleSide = side === 0 ? 1 : 0;
    if (hp[side] <= 0 || hp[target] <= 0) break;
    const move = moves[side];
    if (move.kind === 'heal') {
      const healed = Math.min(move.healAmount ?? 0, state.fighters[side].maxHp - hp[side]);
      hp[side] += healed;
      if (move.itemType !== undefined) consumedItems.push({ side, itemType: move.itemType });
      event(state, round, 'heal', hp, at, `${state.fighters[side].name}: ${move.name} — восстановлено ${healed} HP`, side);
      continue;
    }
    state.cooldowns[side][move.id] = round + move.cooldownRounds + 1;
    if (move.kind === 'defend') {
      guards[side] = move.defense;
      event(state, round, 'defend', hp, at, `${state.fighters[side].name}: ${move.name}`, side);
      continue;
    }
    if (move.accuracy < 100 && random() * 100 >= move.accuracy) {
      event(state, round, 'miss', hp, at, `${state.fighters[side].name}: ${move.name} — промах`, side);
      continue;
    }
    if (move.kind === 'attack') {
      const attack = Math.max(0, Math.floor(stat(side, 'strength')));
      const incoming = Math.max(1, Math.floor((attack + Math.floor(random() * (attack + 1))) * move.power - stat(target, 'defense')));
      let damage = incoming;
      const guard = guards[target];
      if (guard) {
        const roll = random() * 100;
        damage = roll < guard.fullBlockChance ? 0 : roll < guard.fullBlockChance + guard.partialBlockChance ? Math.floor(incoming * guard.partialMultiplier) : incoming;
      }
      hp[target] = Math.max(0, hp[target] - damage);
      event(state, round, damage < incoming ? 'block' : 'attack', hp, at,
        `${state.fighters[side].name}: ${move.name} — ${damage} урона${damage < incoming ? ' (защита)' : ''}`, side);
      // Reflection is non-recursive and based on the incoming hit before the active block.
      if (guard && damage < incoming && guard.reflectChance > 0 && random() * 100 < guard.reflectChance) {
        const reflected = Math.floor(incoming * .5);
        hp[side] = Math.max(0, hp[side] - reflected);
        event(state, round, 'reflect', hp, at, `${state.fighters[target].name}: отражено ${reflected} урона`, target);
      }
    }
    if (move.effect && hp[target] > 0 && hp[side] > 0) {
      state.effects = state.effects.filter(e => !(e.target === target && e.stat === move.effect!.stat));
      state.effects.push({ target, ...move.effect, untilRound: round + move.effect.durationRounds });
      event(state, round, 'effect', hp, at, `${state.fighters[side].name}: ${move.name} — ослабление`, side);
    }
  }
  state.effects = state.effects.filter(e => e.untilRound > round);
  state.choices = [null, null];
  for (const fighter of state.fighters) fighter.moves = fighter.moves.filter(m => m.itemType === undefined);
  const finished = hp[0] <= 0 || hp[1] <= 0;
  if (finished) {
    state.finishReason = 'knockout';
    event(state, round, 'finish', hp, at, 'Бой завершён');
  }
  return { state, hp, finished, consumedItems, winner: hp[0] <= 0 ? (hp[1] <= 0 ? null : 1 as const) : hp[1] <= 0 ? 0 as const : null };
}
