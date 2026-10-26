import type { BattleFighter,BattleMove,BattleSide,BattleState } from '@mmobot/shared';
import { BattleError } from './state.js';
import { event } from './events.js';
import { applyStatus, battleStat, chance, expireEffects, finishRoundEffects, heal, opponent, takeDamage, type BattleContext } from './effects.js';
import { afterDirectDamage, attackModifiers, onDefend, onDirectHit, onGuardReduced, onMiss, onPotion, potionHealing } from './passives.js';
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
  const ctx: BattleContext = { state, hp, round, at, random };
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
    if (move.kind === 'heal') {
      const healed = heal(ctx, side, potionHealing(ctx, side, move));
      if (move.itemType !== undefined) consumedItems.push({ side, itemType: move.itemType });
      event(state, round, 'heal', hp, at, `${state.fighters[side].name}: ${move.name} — восстановлено ${healed} HP`, side, { source: 'item' });
      onPotion(ctx, side, move);
      continue;
    }
    state.cooldowns[side][move.id] = round + move.cooldownRounds + 1;
    if (move.kind === 'defend') {
      guards[side] = move.defense;
      event(state, round, 'defend', hp, at, `${state.fighters[side].name}: ${move.name}`, side);
      onDefend(ctx, side);
      continue;
    }
    const modifiers = move.kind === 'attack' ? attackModifiers(ctx, side, move) : { accuracy: move.accuracy, multiplier: 1, armorIgnore: 0, criticalChance: 0 };
    if (modifiers.accuracy < 100 && random() * 100 >= modifiers.accuracy) {
      if (move.kind === 'attack') onMiss(ctx, side, move);
      else event(state, round, 'miss', hp, at, `${state.fighters[side].name}: ${move.name} — промах`, side);
      continue;
    }
    let directDamage: number | undefined;
    if (move.kind === 'attack') {
      const attack = Math.max(0, Math.floor(battleStat(ctx, side, 'strength')));
      const rawPower = (attack + Math.floor(random() * (attack + 1))) * move.power * modifiers.multiplier;
      const critical = chance(ctx, modifiers.criticalChance);
      const incoming = Math.max(1, Math.floor(rawPower * (critical ? 1.5 : 1) - battleStat(ctx, target, 'defense') * (1 - modifiers.armorIgnore / 100)));
      let damage = incoming;
      const guard = guards[target];
      if (guard) {
        const roll = random() * 100;
        damage = roll < guard.fullBlockChance ? 0 : roll < guard.fullBlockChance + guard.partialBlockChance ? Math.floor(incoming * guard.partialMultiplier) : incoming;
      }
      const reducedByGuard = damage < incoming;
      directDamage = takeDamage(ctx, target, damage, move.damageType ?? state.fighters[side].damageType, true);
      event(state, round, reducedByGuard ? 'block' : 'attack', hp, at,
        `${state.fighters[side].name}: ${move.name} — ${directDamage} урона${critical ? ' — критический удар!' : ''}${reducedByGuard ? ' (защита)' : ''}`, side, { critical });
      if (directDamage > 0) afterDirectDamage(ctx, target);
      if (reducedByGuard) onGuardReduced(ctx, target);
      // Reflection is non-recursive and based on the incoming hit before the active block.
      if (guard && reducedByGuard && chance(ctx, guard.reflectChance)) {
        const reflected = takeDamage(ctx, side, Math.floor(incoming * .5));
        event(state, round, 'reflect', hp, at, `${state.fighters[target].name}: отражено ${reflected} урона`, target);
        if (reflected > 0) afterDirectDamage(ctx, side);
      }
      onDirectHit(ctx, side, directDamage, rawPower, (power, type, label) => {
        if (hp[target] <= 0 || hp[side] <= 0) return;
        let extra = Math.max(1, Math.floor(power - battleStat(ctx, target, 'defense')));
        if (guard) {
          const roll = random() * 100;
          extra = roll < guard.fullBlockChance ? 0 : roll < guard.fullBlockChance + guard.partialBlockChance ? Math.floor(extra * guard.partialMultiplier) : extra;
        }
        const lost = takeDamage(ctx, target, extra, type);
        event(state, round, 'attack', hp, at, `${state.fighters[side].name}: ${label} — дополнительно ${lost} урона`, side, { source: 'passive' });
      });
    }
    if (hp[target] > 0 && hp[side] > 0 && directDamage !== 0) for (const effect of move.statusEffects ?? []) applyStatus(ctx, side, target, effect);
    if (move.effect && directDamage !== 0 && hp[target] > 0 && hp[side] > 0) {
      state.effects = state.effects.filter(e => !(e.target === target && e.stat === move.effect!.stat));
      state.effects.push({ target, ...move.effect, untilRound: round + move.effect.durationRounds });
      event(state, round, 'effect', hp, at, `${state.fighters[side].name}: ${move.name} — ослабление`, side);
    }
  }
  return completeRound(ctx, consumedItems);
}

function completeRound(ctx: BattleContext, consumedItems: { side: BattleSide; itemType: number }[] = []) {
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
  const ctx: BattleContext = { state, hp, round, at, random };
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
