import type { MultiBattleState, MultiBattleStatus } from '@mmobot/shared';
import { BATTLE_STATUS_INFO, type BattlePassive,
  type BattleStatusApplication, type BattleStatusKind, type DamageType } from '@mmobot/shared';
import { event } from './events.js';

export type BattleContext<S extends MultiBattleState = MultiBattleState, H extends number[] = number[]> = {
  state: S; hp: H; round: number; at: string; random: () => number; target?: number; isFinished?: () => boolean; attackers?: (side: number) => number[];
};
export const opponent = (side: number, ctx?: BattleContext): number => ctx?.target ?? (side === 0 ? 1 : 0);
export function statusOf(ctx: BattleContext, side: number, kind: BattleStatusKind) {
  return ctx.state.statuses?.find(s => s.target === side && s.kind === kind && (s.untilRound ?? Infinity) >= ctx.round);
}
export function passiveOf(ctx: BattleContext, side: number, slot: 'weapon' | 'armor'): BattlePassive | undefined {
  if (slot === 'weapon' && statusOf(ctx, side, 'silence')) return;
  return ctx.state.fighters[side].passives?.[slot];
}
export const chance = (ctx: BattleContext, percent: number) => percent >= 100 || (percent > 0 && ctx.random() * 100 < percent);
export function battleStat(ctx: BattleContext, side: number, stat: 'strength' | 'defense') {
  return ctx.state.effects.filter(e => e.target === side && e.stat === stat && e.untilRound >= ctx.round)
    .reduce((n, e) => n * e.multiplier, ctx.state.fighters[side][stat]);
}
export function removeStatus(ctx: BattleContext, status: MultiBattleStatus) {
  ctx.state.statuses = (ctx.state.statuses ?? []).filter(s => s !== status);
}

/** Timed states last through N following rounds; periodic effects tick N times, starting this round. */
export function applyStatus(ctx: BattleContext, source: number, target: number, effect: BattleStatusApplication,
  reflected = false) {
  if (ctx.hp[target] <= 0 || ctx.hp[source] <= 0) return;
  if (!chance(ctx, effect.chancePercent ?? 100)) return;
  const armor = passiveOf(ctx, target, 'armor');
  if (!reflected && (effect.kind === 'fear' || effect.kind === 'confusion') && armor?.id === 'foil_reflection' && chance(ctx, armor.params.chancePercent)) {
    event(ctx.state, ctx.round, 'reflect', ctx.hp, ctx.at, `${ctx.state.fighters[target].name}: «Сигнал не проходит» — эффект отражён`, target);
    return applyStatus(ctx, target, source, { ...effect, chancePercent: 100 }, true);
  }
  const periodic = ['poison', 'burn', 'regeneration'].includes(effect.kind);
  const duration = effect.durationRounds ?? (periodic ? 1 : undefined);
  const untilRound = duration === undefined ? undefined : ctx.round + duration - (periodic ? 1 : 0);
  const existing = effect.kind === 'debt'
    ? ctx.state.statuses?.find(s => s.target === target && s.kind === 'debt' && s.source === source && (s.untilRound ?? Infinity) >= ctx.round)
    : statusOf(ctx, target, effect.kind);
  if (existing) {
    // One instance per kind, with no weaker refresh and no repeated DOT stacks.
    existing.untilRound = existing.untilRound === undefined || untilRound === undefined ? undefined : Math.max(existing.untilRound, untilRound);
    if (effect.kind === 'debt') existing.stacks = Math.min(2, (existing.stacks ?? 1) + 1);
    else if (effect.stacks !== undefined) existing.stacks = effect.stacks;
    if (effect.value >= existing.value) {
      existing.value = effect.value; existing.source = source;
      existing.secondaryValue = effect.secondaryValue;
      existing.damageType = effect.damageType;
    }
    existing.healingReductionPercent = Math.max(existing.healingReductionPercent ?? 0, effect.healingReductionPercent ?? 0);
  } else {
    ctx.state.statuses ??= [];
    ctx.state.statuses.push({ kind: effect.kind, target, source, value: effect.value, untilRound,
      secondaryValue: effect.secondaryValue, damageType: effect.damageType,
      healingReductionPercent: effect.healingReductionPercent,
      ...(effect.kind === 'debt' ? { stacks: 1 } : effect.stacks === undefined ? {} : { stacks: effect.stacks }) });
  }
  event(ctx.state, ctx.round, 'effect', ctx.hp, ctx.at,
    `${ctx.state.fighters[target].name}: ${BATTLE_STATUS_INFO[effect.kind].name.toLowerCase()}${existing ? ' — эффект обновлён' : ''}`, source, { target });
}

export function heal(ctx: BattleContext, side: number, amount: number) {
  if (ctx.hp[side] <= 0) return 0;
  const reduction = statusOf(ctx, side, 'poison')?.healingReductionPercent ?? 0;
  const restored = Math.min(Math.max(0, Math.floor(amount * (1 - reduction / 100))), ctx.state.fighters[side].maxHp - ctx.hp[side]);
  ctx.hp[side] += restored;
  return restored;
}

/** Armor resistances and shields apply once; reactive passives are invoked separately for direct hits. */
export function takeDamage(ctx: BattleContext, target: number, amount: number, damageType?: DamageType, direct = false) {
  let damage = Math.max(0, Math.floor(amount));
  const armor = passiveOf(ctx, target, 'armor');
  if (damageType === 'psychic' && armor?.id === 'clear_mind') damage = Math.floor(damage * (1 - armor.params.damageReductionPercent / 100));
  if (damage > 0 && direct && armor?.id === 'saved_for_tomorrow') {
    const progress = ctx.state.passiveProgress![target];
    if (!progress.firstHitConsumed) {
      progress.firstHitConsumed = true;
      damage = Math.floor(damage * (1 - armor.params.damageReductionPercent / 100));
      event(ctx.state, ctx.round, 'effect', ctx.hp, ctx.at, `${ctx.state.fighters[target].name}: «Это на завтра» смягчает первый удар`, target);
    }
  }
  const shield = statusOf(ctx, target, 'shield');
  if (shield && damage > 0) {
    const absorbed = Math.min(shield.value, damage);
    shield.value -= absorbed; damage -= absorbed;
    if (shield.value <= 0) removeStatus(ctx, shield);
    event(ctx.state, ctx.round, 'block', ctx.hp, ctx.at, `${ctx.state.fighters[target].name}: щит поглотил ${absorbed} урона`, target);
  }
  const lost = Math.min(ctx.hp[target], damage);
  ctx.hp[target] -= lost;
  return lost;
}

export function cleanse(ctx: BattleContext, side: number, positive: boolean) {
  const statuses = (ctx.state.statuses ?? []).filter(s => s.target === side && (s.untilRound ?? Infinity) >= ctx.round && BATTLE_STATUS_INFO[s.kind].positive === positive);
  const legacy = ctx.state.effects.filter(e => e.target === side && e.untilRound >= ctx.round && (e.multiplier > 1) === positive);
  const count = statuses.length + legacy.length;
  if (!count) return;
  const index = Math.min(count - 1, Math.floor(ctx.random() * count));
  if (index < statuses.length) removeStatus(ctx, statuses[index]);
  else ctx.state.effects = ctx.state.effects.filter(e => e !== legacy[index - statuses.length]);
  event(ctx.state, ctx.round, 'effect', ctx.hp, ctx.at, `${ctx.state.fighters[side].name}: снято одно ${positive ? 'усиление' : 'ослабление'}`, side);
}

/** DOT for both sides is resolved before deciding the winner, so a double knockout is possible. */
export function finishRoundEffects(ctx: BattleContext) {
  if (ctx.isFinished ? ctx.isFinished() : ctx.hp.some(hp => hp <= 0)) return;
  const periodic = (ctx.state.statuses ?? []).filter(s => (s.untilRound ?? Infinity) >= ctx.round && ['poison', 'burn'].includes(s.kind));
  for (const status of periodic) {
    if (ctx.hp[status.target] <= 0) continue;
    const raw = Math.max(1, Math.floor(status.value - battleStat(ctx, status.target, 'defense')));
    const damage = takeDamage(ctx, status.target, raw, status.damageType);
    event(ctx.state, ctx.round, 'effect', ctx.hp, ctx.at,
      `${ctx.state.fighters[status.target].name}: ${BATTLE_STATUS_INFO[status.kind].name.toLowerCase()} — ${damage} урона`, status.source, { source: 'status', target: status.target });
  }
  // Healing cannot revive or undo an already reached end condition.
  if (ctx.isFinished ? !ctx.isFinished() : ctx.hp.every(hp => hp > 0)) for (const status of ctx.state.statuses ?? []) {
    if (status.kind !== 'regeneration' || (status.untilRound ?? Infinity) < ctx.round) continue;
    const restored = heal(ctx, status.target, status.value);
    event(ctx.state, ctx.round, 'heal', ctx.hp, ctx.at, `${ctx.state.fighters[status.target].name}: восстановление — ${restored} HP`, status.target, { source: 'status', target: status.target });
  }
}

export function expireEffects(ctx: BattleContext) {
  const expired = (ctx.state.statuses ?? []).filter(s => (s.untilRound ?? Infinity) <= ctx.round);
  ctx.state.statuses = (ctx.state.statuses ?? []).filter(s => (s.untilRound ?? Infinity) > ctx.round);
  const legacyExpired = ctx.state.effects.some(e => e.untilRound <= ctx.round);
  ctx.state.effects = ctx.state.effects.filter(e => e.untilRound > ctx.round);
  if (expired.length || legacyExpired) event(ctx.state, ctx.round, 'effect', ctx.hp, ctx.at, 'Временные эффекты завершились');
}
