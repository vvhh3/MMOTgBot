import type { MultiBattleState } from './battle-core.js';
import type { BattleSide, BattleState } from './combat.js';
import type { DamageType } from './weapons.js';

export const BATTLE_STATUS_INFO = {
  poison: { name: 'Отравление', icon: '☠', positive: false },
  burn: { name: 'Ожог', icon: '♨', positive: false },
  wet: { name: 'Намокание', icon: '💧', positive: false },
  fear: { name: 'Страх', icon: '!', positive: false },
  confusion: { name: 'Замешательство', icon: '?', positive: false },
  debt: { name: 'Долг', icon: '₽', positive: false },
  silence: { name: 'Пассивка заблокирована', icon: '⊘', positive: false },
  regeneration: { name: 'Восстановление', icon: '✚', positive: true },
  shield: { name: 'Щит', icon: '⬡', positive: true },
  attack_boost: { name: 'Усиление атаки', icon: '↑', positive: true },
  armor_piercing: { name: 'Пробивание', icon: '↗', positive: true },
  aim: { name: 'Верный прицел', icon: '◎', positive: true },
  psychic_charge: { name: 'CAPS LOCK', icon: '↑', positive: true },
  strength_down: { name: 'Атака ослаблена', icon: '↓', positive: false },
  defense_down: { name: 'Защита ослаблена', icon: '↓', positive: false },
} as const;
export type BattleStatusKind = keyof typeof BATTLE_STATUS_INFO;
export type BattleStatus = {
  kind: BattleStatusKind; target: BattleSide; source: BattleSide;
  value: number; untilRound?: number; secondaryValue?: number; stacks?: number;
  damageType?: DamageType; healingReductionPercent?: number;
};
export type BattleStatusApplication = {
  kind: BattleStatusKind; value: number; durationRounds?: number; chancePercent?: number;
  secondaryValue?: number; damageType?: DamageType; healingReductionPercent?: number;
  stacks?: number;
};
export type BattleStatusView = {
  kind: BattleStatusKind; name: string; icon: string; positive: boolean;
  remainingRounds: number | null; value: number; stacks?: number; description: string;
};

export function describeBattleStatus(kind: BattleStatusKind, value: number, secondaryValue = 0): string {
  switch (kind) {
    case 'poison': case 'burn': return `Периодический урон: ${value} до вычитания защиты.`;
    case 'wet': return 'Усиливает разряд способности «Короткое замыкание».';
    case 'fear': return `Мощность следующей атаки ниже на ${value}%. Расходуется и при промахе.`;
    case 'confusion': return `Точность следующей атаки ниже на ${value} п.п. Расходуется и при промахе.`;
    case 'debt': return 'До двух меток. Сильная атака источника расходует их для усиления.';
    case 'silence': return 'Способность оружия временно не срабатывает. Атаки доступны.';
    case 'regeneration': return `Восстанавливает ${value} HP в конце раунда.`;
    case 'shield': return `Поглощает ещё ${value} урона.`;
    case 'attack_boost': return `Следующая атака сильнее на ${value}%.`;
    case 'armor_piercing': return `Следующая атака игнорирует ${value}% защиты.`;
    case 'aim': return `Следующая атака: +${value} п.п. точности, +${secondaryValue}% мощности.`;
    case 'psychic_charge': return `Психические атаки сильнее на ${value}%, пока способность оружия активна. Промах сбрасывает накопление.`;
    case 'strength_down': return `Атака ниже на ${value}%.`;
    case 'defense_down': return `Защита ниже на ${value}%.`;
  }
}

/** Public, absolute sides (0/1), shared by HTTP, sockets and message playback. */
export function battleStatusViews(state: BattleState, round: number): [BattleStatusView[], BattleStatusView[]];
export function battleStatusViews(state: MultiBattleState, round: number): BattleStatusView[][];
export function battleStatusViews(state: MultiBattleState, round: number): BattleStatusView[][] {
  const views: BattleStatusView[][] = state.fighters.map(() => []);
  for (const status of state.statuses ?? []) {
    if ((status.untilRound ?? Infinity) < round) continue;
    views[status.target].push({ kind: status.kind, ...BATTLE_STATUS_INFO[status.kind], value: status.value,
      remainingRounds: status.untilRound === undefined ? null : status.untilRound - round + 1, ...(status.stacks ? { stacks: status.stacks } : {}),
      description: describeBattleStatus(status.kind, status.value, status.secondaryValue)
        + (status.healingReductionPercent ? ` Получаемое лечение ниже на ${status.healingReductionPercent}%.` : '') });
  }
  for (const effect of state.effects) {
    if (effect.untilRound < round) continue;
    const kind = effect.stat === 'strength' ? 'strength_down' : 'defense_down';
    const value = Math.round((1 - effect.multiplier) * 100);
    views[effect.target].push({ kind, ...BATTLE_STATUS_INFO[kind], value,
      remainingRounds: effect.untilRound - round + 1, description: describeBattleStatus(kind, value) });
  }
  return views;
}
