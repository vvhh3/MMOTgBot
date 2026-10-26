import type { DamageType, ItemPassiveId } from './weapons.js';
import type { BattleStatus, BattleStatusApplication, BattleStatusView } from './combat-effects.js';

export type BattleSide = 0 | 1;
export type BattlePassive = { id: ItemPassiveId; params: Record<string, number> };
export type BattleFinishReason = 'knockout' | 'timeout' | 'inactivity' | 'mutual_exit' | 'fled' | 'aborted';
export type BattleMove = {
  id: string; name: string; kind: 'attack' | 'defend' | 'weaken' | 'heal'; priority: number;
  accuracy: number; power: number; cooldownRounds: number;
  itemType?: number; healAmount?: number;
  passive?: BattlePassive;
  statusEffects?: BattleStatusApplication[];
  damageType?: DamageType;
  criticalChancePercent?: number;
  defense?: { fullBlockChance: number; partialBlockChance: number; partialMultiplier: number; reflectChance: number };
  effect?: { stat: 'strength' | 'defense'; multiplier: number; durationRounds: number };
};
export type BattleFighter = {
  name: string; maxHp: number; strength: number; defense: number; moves: BattleMove[];
  damageType?: DamageType;
  passives?: Partial<Record<'weapon' | 'armor', BattlePassive>>;
};
export type BattleEvent = {
  sequence: number; round: number; type: 'attack' | 'miss' | 'defend' | 'block' | 'reflect' | 'effect' | 'flee' | 'finish' | 'heal';
  side?: BattleSide; text: string; hp: [number, number]; at: string;
  statuses?: [BattleStatusView[], BattleStatusView[]];
  source?: 'item' | 'passive' | 'status';
  critical?: boolean;
};
export type BattleRequest = { sessionId: number; round: number; expectedVersion: number; requestId: string; itemType?: number; moveId?: string };
export type BattleState = {
  // Stats and moves already live in fighters. Only encounter metadata/rewards go here.
  encounter?: {
    level: number; rank: import('./contracts/mobs.js').MobRank; locationId: string;
    pointsReward: number; coinReward: number; loot: import('./contracts/mobs.js').MobLootEntry[];
  };
  fighters: [BattleFighter, BattleFighter];
  choices: [string | null, string | null];
  cooldowns: [Record<string, number>, Record<string, number>];
  effects: { target: BattleSide; stat: 'strength' | 'defense'; multiplier: number; untilRound: number }[];
  exitRequested: [boolean, boolean];
  events: BattleEvent[];
  processedRequests: { playerId: number; requestId: string; fingerprint: string }[];
  finishReason?: BattleFinishReason;
  droppedItems?: import('./index.js').ItemDto[];
  healingLimit?: number;
  statuses?: BattleStatus[];
  passiveProgress?: [Record<string, number | string | boolean>, Record<string, number | string | boolean>];
};
export type BattlePublicState = {
  round: number; stateVersion: number; roundStartedAt: string | null;
  events: BattleEvent[]; moves: (BattleMove & { availableFromRound: number })[];
  actionSubmitted: boolean; finishReason?: BattleFinishReason;
  healingAvailable: boolean;
  statuses: [BattleStatusView[], BattleStatusView[]];
};
