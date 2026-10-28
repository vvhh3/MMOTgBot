import type { BattleMove, DamageType } from '@mmobot/shared';
import { applyStatus, battleStat, chance, cleanse, heal, opponent, passiveOf, removeStatus, statusOf, type BattleContext } from './effects.js';
import { event } from './events.js';

export function onDefend(ctx: BattleContext, side: number) {
  const armor = passiveOf(ctx, side, 'armor');
  if (armor?.id === 'soaking') applyStatus(ctx, side, opponent(side, ctx), {
    kind: 'wet', value: 0, durationRounds: armor.params.durationRounds, chancePercent: armor.params.chancePercent,
  });
  const weapon = passiveOf(ctx, side, 'weapon');
  if (weapon?.id === 'family_justice') applyStatus(ctx, side, side, {
    kind: 'attack_boost', value: weapon.params.damageBonusPercent,
  });
  for (const source of ctx.attackers?.(side) ?? [opponent(side, ctx)]) {
    const other = passiveOf(ctx, source, 'weapon');
    const progress = ctx.state.passiveProgress![source];
    if (other?.id === 'fine_print' && !progress.debtUsed) {
      progress.debtUsed = true;
      applyStatus(ctx, source, side, { kind: 'debt', value: other.params.damageBonusPerMarkPercent, durationRounds: 1 });
    }
  }
}

/** Attempt bonuses are consumed before accuracy, including on a miss. */
export function attackModifiers(ctx: BattleContext, side: number, move: BattleMove) {
  const target = opponent(side, ctx), weapon = passiveOf(ctx, side, 'weapon');
  const progress = ctx.state.passiveProgress![side];
  let bonus = 0, armorIgnore = 0, accuracy = move.accuracy, criticalChance = move.criticalChancePercent ?? 0;
  for (const kind of ['fear', 'confusion', 'attack_boost', 'armor_piercing', 'aim'] as const) {
    const effect = statusOf(ctx, side, kind);
    if (!effect) continue;
    if (kind === 'fear') bonus -= effect.value;
    if (kind === 'confusion') accuracy -= effect.value;
    if (kind === 'attack_boost') bonus += effect.value;
    if (kind === 'armor_piercing') armorIgnore += effect.value;
    if (kind === 'aim') { accuracy += effect.value; bonus += effect.secondaryValue ?? 0; }
    removeStatus(ctx, effect);
  }
  if (weapon) {
    const p = weapon.params;
    switch (weapon.id) {
      case 'returning': if (progress.lastMove && progress.lastMove !== move.id) bonus += p.damageBonusPercent; break;
      case 'precision': criticalChance += p.criticalChancePercent; break;
      case 'last_percent':
        if (!progress.lastPercentUsed && ctx.hp[side] / ctx.state.fighters[side].maxHp * 100 < p.healthThresholdPercent) {
          progress.lastPercentUsed = true; bonus += p.damageBonusPercent;
          event(ctx.state, ctx.round, 'effect', ctx.hp, ctx.at, `${ctx.state.fighters[side].name}: «Последний процент» усиливает атаку`, side);
        }
        break;
      case 'weighty_argument':
        if (ctx.state.fighters[target].moves.find(m => m.id === ctx.state.choices[target])?.kind === 'defend') bonus += p.damageBonusPercent;
        break;
      case 'stale_crust': if (chance(ctx, p.chancePercent)) armorIgnore += p.armorIgnorePercent; break;
      case 'caps_lock':
        if ((move.damageType ?? ctx.state.fighters[side].damageType) === 'psychic') bonus += statusOf(ctx, side, 'psychic_charge')?.value ?? 0;
        break;
      case 'fine_print': {
        const debt = ctx.state.statuses?.find(s => s.kind === 'debt' && s.target === target && s.source === side && (s.untilRound ?? Infinity) >= ctx.round);
        if (move.id === 'weapon_strong' && debt?.source === side) {
          bonus += (debt.stacks ?? 1) * p.damageBonusPerMarkPercent;
          removeStatus(ctx, debt);
          event(ctx.state, ctx.round, 'effect', ctx.hp, ctx.at, `${ctx.state.fighters[side].name}: долг взыскан — сильная атака усилена`, side);
        }
        break;
      }
    }
  }
  progress.lastMove = move.id;
  return { multiplier: Math.max(0, 1 + bonus / 100), armorIgnore: Math.min(50, armorIgnore),
    accuracy: Math.max(0, Math.min(100, accuracy)), criticalChance: Math.max(0, Math.min(50, criticalChance)) };
}

export function onMiss(ctx: BattleContext, side: number, move: BattleMove) {
  ctx.state.passiveProgress![side].capsStacks = 0;
  const charge = statusOf(ctx, side, 'psychic_charge');
  if (charge) removeStatus(ctx, charge);
  event(ctx.state, ctx.round, 'miss', ctx.hp, ctx.at, `${ctx.state.fighters[side].name}: ${move.name} — промах`, side);
  const weapon = passiveOf(ctx, side, 'weapon');
  if (weapon?.id === 'admin_aim') applyStatus(ctx, side, side, {
    kind: 'aim', value: weapon.params.accuracyBonusPercent, secondaryValue: weapon.params.damageBonusPercent,
  });
}

export function onGuardReduced(ctx: BattleContext, side: number) {
  const weapon = passiveOf(ctx, side, 'weapon');
  if (weapon?.id === 'long_handle') applyStatus(ctx, side, side, {
    kind: 'armor_piercing', value: weapon.params.armorIgnorePercent,
  });
}

export function afterDirectDamage(ctx: BattleContext, side: number) {
  const armor = passiveOf(ctx, side, 'armor');
  if (armor?.id !== 'veteran_resident' || ctx.hp[side] <= 0) return;
  const progress = ctx.state.passiveProgress![side], maxHp = ctx.state.fighters[side].maxHp;
  if (!progress.veteranUsed && ctx.hp[side] / maxHp * 100 < armor.params.healthThresholdPercent) {
    progress.veteranUsed = true;
    applyStatus(ctx, side, side, { kind: 'shield', value: Math.max(1, Math.floor(maxHp * armor.params.shieldPercent / 100)), durationRounds: 2 });
  }
}

export function onDirectHit(ctx: BattleContext, side: number, damage: number, rawPower: number,
  extraHit: (power: number, type: DamageType | undefined, label: string) => void) {
  const target = opponent(side, ctx), weapon = passiveOf(ctx, side, 'weapon');
  if (!weapon || damage <= 0 || ctx.hp[side] <= 0) return;
  const p = weapon.params, attack = Math.max(0, Math.floor(battleStat(ctx, side, 'strength')));
  const progress = ctx.state.passiveProgress![side];
  if (weapon.id === 'lifesteal') {
    if (chance(ctx, p.chancePercent)) {
      const restored = heal(ctx, side, damage * p.healingPercent / 100);
      event(ctx.state, ctx.round, 'heal', ctx.hp, ctx.at, `${ctx.state.fighters[side].name}: «Обратная тяга» — восстановлено ${restored} HP`, side, { source: 'passive' });
    }
    return;
  }
  if (ctx.hp[target] <= 0) return;
  switch (weapon.id) {
    case 'burning': case 'independent_life': case 'questionable_freshness':
      applyStatus(ctx, side, target, { kind: weapon.id === 'burning' ? 'burn' : 'poison',
        value: Math.max(1, Math.floor(attack * p.damageCoefficientPercent / 100)), durationRounds: p.durationRounds,
        chancePercent: p.chancePercent, damageType: weapon.id === 'burning' ? 'heat' : 'poison',
        healingReductionPercent: weapon.id === 'questionable_freshness' ? p.healingReductionPercent : 0 });
      break;
    case 'suction': applyStatus(ctx, side, target, { kind: 'fear', value: p.damageReductionPercent, durationRounds: 2, chancePercent: p.chancePercent }); break;
    case 'lost_in_folders': applyStatus(ctx, side, target, { kind: 'confusion', value: p.accuracyReductionPercent, durationRounds: 2, chancePercent: p.chancePercent }); break;
    case 'soaking': applyStatus(ctx, side, target, { kind: 'wet', value: 0, durationRounds: p.durationRounds, chancePercent: p.chancePercent }); break;
    case 'short_circuit':
      if (chance(ctx, p.chancePercent)) extraHit(attack * p.damageCoefficientPercent / 100 * (statusOf(ctx, target, 'wet') ? 1 + p.wetBonusPercent / 100 : 1), 'electric', 'Короткое замыкание');
      break;
    case 'double_click':
      if (chance(ctx, p.chancePercent)) extraHit(rawPower * p.damageCoefficientPercent / 100, ctx.state.fighters[side].damageType, 'Двойной клик');
      break;
    case 'caps_lock': {
      const stacks = Math.min(p.maxStacks, (statusOf(ctx, side, 'psychic_charge')?.stacks ?? 0) + 1);
      progress.capsStacks = stacks;
      applyStatus(ctx, side, side, { kind: 'psychic_charge', value: stacks * p.damageBonusPerHitPercent, stacks });
      break;
    }
    case 'mute_button': if (chance(ctx, p.chancePercent)) cleanse(ctx, target, true); break;
    case 'final_revision':
      progress.finalHits = Number(progress.finalHits ?? 0) + 1;
      if (Number(progress.finalHits) >= p.hitsRequired) {
        progress.finalHits = 0;
        extraHit(attack * p.damageCoefficientPercent / 100, 'psychic', 'Последняя правка');
      }
      break;
    case 'chat_ban': applyStatus(ctx, side, target, { kind: 'silence', value: 0, durationRounds: p.durationRounds, chancePercent: p.chancePercent }); break;
  }
}

export function potionHealing(ctx: BattleContext, side: number, move: BattleMove) {
  return move.passive?.id === 'primordial_dumpling'
    ? ctx.state.fighters[side].maxHp * move.passive.params.healingPercent / 100 : move.healAmount ?? 0;
}
export function onPotion(ctx: BattleContext, side: number, move: BattleMove) {
  const passive = move.passive;
  if (passive?.id === 'mothers_care') applyStatus(ctx, side, side, {
    kind: 'regeneration', value: Math.max(1, Math.floor(ctx.state.fighters[side].maxHp * passive.params.healingPercent / 100)), durationRounds: passive.params.durationRounds,
  });
  if (passive?.id === 'primordial_dumpling') cleanse(ctx, side, false);
  if (passive?.id === 'soaking') applyStatus(ctx, side, opponent(side, ctx), {
    kind: 'wet', value: 0, durationRounds: passive.params.durationRounds, chancePercent: passive.params.chancePercent,
  });
}
