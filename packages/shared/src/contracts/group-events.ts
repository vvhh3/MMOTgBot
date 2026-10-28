import type { MultiBattleState, MultiBattleEvent } from '../battle-core.js';
import type { BattleFighter, BattleMove } from '../combat.js';
import type { BattleStatusView } from '../combat-effects.js';
import type { MobLootEntry } from './mobs.js';

export type GroupEventConfig = {
  waves: { mobKeys: string[]; hpMultiplier: number; damageMultiplier: number }[];
  roundSeconds: number; durationMinutes: number;
  reward: { xp: number; points: number; coins: number; loot: MobLootEntry[] };
};
export const DEFAULT_GROUP_EVENT_CONFIG: GroupEventConfig = {
  waves: [
    { mobKeys: ['square_pigeon', 'square_bag', 'square_seeds'], hpMultiplier: 1, damageMultiplier: .75 },
    { mobKeys: ['square_fountain', 'square_bench', 'square_poster'], hpMultiplier: 1, damageMultiplier: .75 },
    { mobKeys: ['square_golem', 'square_speaker', 'square_bench'], hpMultiplier: 1, damageMultiplier: .75 },
    { mobKeys: ['square_ilyich'], hpMultiplier: 2.5, damageMultiplier: 1.25 },
  ],
  roundSeconds: 60, durationMinutes: 45,
  reward: { xp: 150, points: 50, coins: 100, loot: [] },
};
export type GroupEventWindowDto = {
  id: number; enabled: boolean; locationId: string; startsAt: string; endsAt: string;
  minLevel: number; config: GroupEventConfig; available: boolean; serverTime: string;
};
export type PartyMemberStatus = 'invited' | 'joined' | 'active' | 'left' | 'declined' | 'cancelled' | 'expired' | 'finished';
export type EventPartyDto = {
  id: number; eventWindowId: number; leaderPlayerId: number; version: number;
  status: 'forming' | 'active' | 'finished' | 'disbanded' | 'expired'; runId: number | null;
  members: { id: number; playerId: number; name: string; avatar: string | null; hp: number; maxHp: number;
    slot: number; status: PartyMemberStatus; ready: boolean; online: boolean }[];
};
export type EventPartyInviteDto = { id: number; partyId: number; fromName: string; expiresAt: string };
export type GroupEventOverview = { revision: number; event: GroupEventWindowDto | null; party: EventPartyDto | null; invites: EventPartyInviteDto[]; run: GroupEventStateDto | null };
export type GroupFighter = BattleFighter & { id: string; playerId?: number; avatar?: string | null; team: 0 | 1; wave: number; left?: boolean };
export type GroupBattleState = Omit<MultiBattleState, 'fighters'> & {
  fighters: GroupFighter[]; hp: number[]; targets: (number | null)[]; healingUsed: number[];
  idleRounds: number; waves: GroupFighter[][];
};
export type GroupEventStateDto = {
  id: number; partyId: number; status: 'active' | 'victory' | 'defeat' | 'aborted';
  wave: number; totalWaves: number; round: number; stateVersion: number;
  deadline: string; serverTime: string; myFighterId: string;
  fighters: { id: string; index: number; playerId?: number; name: string; avatar?: string | null; team: 0 | 1;
    hp: number; maxHp: number; left: boolean; submitted: boolean; statuses: BattleStatusView[] }[];
  moves: (BattleMove & { availableFromRound: number })[];
  actionSubmitted: boolean; healingAvailable: boolean; events: MultiBattleEvent[];
  reward: { xp: number; points: number; coins: number; items: { name: string; quantity: number }[] } | null;
};
export type GroupEventActionRequest = {
  requestId: string; wave: number; round: number; expectedVersion: number;
  moveId?: string; targetId?: string; itemType?: number;
};
