import { executeAction } from './action.js';
import type { BattleFighter,BattleMove,BattleSide,BattleState } from '@mmobot/shared';
import { BattleError } from './state.js';
import { event } from './events.js';
import { battleStat, chance, expireEffects, finishRoundEffects, opponent, takeDamage, type BattleContext } from './effects.js';
import { afterDirectDamage, attackModifiers, onMiss } from './passives.js';
export { event } from './events.js';

export const basicAttack = (armed: boolean): BattleMove => ({
  id: armed ? 'weapon_attack' : 'unarmed_strike', name: armed ? 'Атака оружием' : 'Удар рукой',
  kind: 'attack', priority: 0, accuracy: 95, power: 1, cooldownRounds: 0,
});
export function createBattle(fighters: [BattleFighter, BattleFighter]): BattleState {
  return { fighters, choices: [null, null], cooldowns: [{}, {}], effects: [], statuses: [], passiveProgress: [{}, {}],
    exitRequested: [false, false], events: [], processedRequests: [], healingLimit: 1 };
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
  state.passiveProgress ??= [{}, {}];
  const ctx: BattleContext<BattleState, [number, number]> = { state, hp, round, at, random };
  const moves = ([0, 1] as const).map(side => availableMove(state, side, state.choices[side]!, round));
  const priority = (move: BattleMove) => move.kind === 'defend' ? Math.max(1, move.priority) : move.priority;
  const order: BattleSide[] = priority(moves[0]) === priority(moves[1])
    ? (random() < .5 ? [0, 1] : [1, 0]) : priority(moves[0]) > priority(moves[1]) ? [0, 1] : [1, 0];
  const consumedItems: { side: BattleSide; itemType: number }[] = [];
  const guards: [BattleMove['defense'], BattleMove['defense']] = [undefined, undefined];
  for (const side of order) {
    const target = opponent(side);
    if (hp[side] <= 0 || hp[target] <= 0) break;
    const move = moves[side];
    executeAction(ctx, side, target, move, guards, consumedItems);
  }
  return completeRound(ctx, consumedItems);
}

function completeRound(ctx: BattleContext<BattleState, [number, number]>, consumedItems: { side: BattleSide; itemType: number }[] = []) {
  const { state, hp, round, at } = ctx;
  finishRoundEffects(ctx);
  expireEffects(ctx);
  state.choices = [null, null];
  for (const fighter of state.fighters) fighter.moves = fighter.moves.filter(m => m.itemType === undefined);
  const finished = hp[0] <= 0 || hp[1] <= 0;
  if (finished) {
    state.statuses = []; state.effects = [];
    state.finishReason = 'knockout';
    event(state, round, 'finish', hp, at, 'Бой завершён');
  }
  return { state, hp, finished, consumedItems, winner: hp[0] <= 0 ? (hp[1] <= 0 ? null : 1 as const) : hp[1] <= 0 ? 0 as const : null };
}

/** Existing flat escape counter, with status modifiers, armor/shields and round-end effects. */
export function resolveFailedEscape(input: BattleState, initialHp: [number, number], round: number, at: string, random = Math.random) {
  const state = structuredClone(input), hp: [number, number] = [...initialHp];
  state.passiveProgress ??= [{}, {}];
  const ctx: BattleContext<BattleState, [number, number]> = { state, hp, round, at, random };
  const counter: BattleMove = { id: 'escape_counter', name: 'Контрудар', kind: 'attack', priority: 0, accuracy: 100, power: 1, cooldownRounds: 0 };
  const modifiers = attackModifiers(ctx, 1, counter);
  if (!chance(ctx, modifiers.accuracy)) {
    event(state, round, 'flee', hp, at, 'Побег не удался', 0);
    onMiss(ctx, 1, counter);
  } else {
    const incoming = Math.max(1, Math.floor(battleStat(ctx, 1, 'strength') * modifiers.multiplier - battleStat(ctx, 0, 'defense')));
    const damage = takeDamage(ctx, 0, incoming, state.fighters[1].damageType, true);
    event(state, round, 'flee', hp, at, `Побег не удался, моб наносит удар — ${damage} урона`, 1);
    if (damage > 0) afterDirectDamage(ctx, 0);
  }
  return completeRound(ctx);
}
