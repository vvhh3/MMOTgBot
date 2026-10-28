import type { BattleEvent, BattleFighter, BattleState } from './combat.js';
import type { BattleStatus, BattleStatusView } from './combat-effects.js';
export type MultiBattleStatus = Omit<BattleStatus, 'source' | 'target'> & { source: number; target: number };
export type MultiBattleEvent = Omit<BattleEvent, 'side' | 'target' | 'hp' | 'statuses'> & {
  side?: number; target?: number; hp: number[]; statuses?: BattleStatusView[][];
};
export type MultiBattleState = Omit<BattleState, 'fighters' | 'choices' | 'cooldowns' | 'effects' | 'exitRequested' | 'events' | 'statuses' | 'passiveProgress'> & {
  fighters: BattleFighter[]; choices: (string | null)[]; cooldowns: Record<string, number>[];
  effects: { target: number; stat: 'strength' | 'defense'; multiplier: number; untilRound: number }[];
  exitRequested: boolean[]; events: MultiBattleEvent[]; statuses?: MultiBattleStatus[];
  passiveProgress?: Record<string, number | string | boolean>[];
};
