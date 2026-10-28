import type { BattleMove } from '@mmobot/shared';
import { event } from './events.js';
import { applyStatus, battleStat, chance, heal, takeDamage, type BattleContext } from './effects.js';
import { afterDirectDamage, attackModifiers, onDefend, onDirectHit, onGuardReduced, onMiss, onPotion, potionHealing } from './passives.js';

export function executeAction(ctx: BattleContext, side: number, target: number, move: BattleMove,
  guards: (BattleMove['defense'])[], consumedItems: { side: number; itemType: number }[]) {
  const { state, hp, round, at, random } = ctx;
  ctx.target = target;
  if (move.kind === 'heal') {
    const healed = heal(ctx, side, potionHealing(ctx, side, move));
    if (move.itemType !== undefined) consumedItems.push({ side, itemType: move.itemType });
    event(state, round, 'heal', hp, at, `${state.fighters[side].name}: ${move.name} — восстановлено ${healed} HP`, side, { source: 'item', target: side });
    onPotion(ctx, side, move);
    return;
  }
  state.cooldowns[side][move.id] = round + move.cooldownRounds + 1;
  if (move.kind === 'defend') {
    guards[side] = move.defense;
    event(state, round, 'defend', hp, at, `${state.fighters[side].name}: ${move.name}`, side);
    onDefend(ctx, side);
    return;
  }
  const modifiers = move.kind === 'attack' ? attackModifiers(ctx, side, move) : { accuracy: move.accuracy, multiplier: 1, armorIgnore: 0, criticalChance: 0 };
  if (modifiers.accuracy < 100 && random() * 100 >= modifiers.accuracy) {
    if (move.kind === 'attack') onMiss(ctx, side, move);
    else event(state, round, 'miss', hp, at, `${state.fighters[side].name}: ${move.name} — промах`, side);
    return;
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
      event(state, round, 'reflect', hp, at, `${state.fighters[target].name}: отражено ${reflected} урона`, target, { target: side });
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
