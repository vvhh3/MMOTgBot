import type { BattlePublicState,BattleRequest } from '../combat.js';

import type { InventoryItemDto,ItemDto } from "./items.js";
import type { MobDto } from "./mobs.js";
import type { PlayerDto } from "./players.js";




export type CombatLogEntry = { // типо логирование
  text: string;
  at: string;
}


export type CombatStateResponse = BattlePublicState & {
  id: number; // описание боя
  mob: MobDto;
  droppedItems: ItemDto[]; // только фактически выданные предметы; пусто до победы
  playerHp: number;
  playerMaxHp: number;
  mobHp: number;
  mobMaxHp: number;
  status: "active" | "victory" | "defeat" | "fled" | "aborted";
  log: CombatLogEntry[];
}


export type CombatStartRequest = {
  mobId: string;
}


export type CombatActionRequest = BattleRequest & {
  action: "attack" | "flee" | "use";
  itemType?: number;
}



export type CombatActionResponse = {
  state: CombatStateResponse;
  player: PlayerDto;
  inventory: InventoryItemDto[];
}




export type PvpStateDto = BattlePublicState & {
  exitRequested: boolean;
  partnerExitRequested: boolean;
  partnerAvatar?: string | null
  id: number
  status: "pending" | "active" | "finished"
  direction: "incoming" | "outgoing"
  myName: string
  partnerName: string
  myHp: number
  myMaxHp: number
  partnerHp: number
  partnerMaxHp: number
  myTurn: boolean // совместимость: можно выбрать действие текущего раунда
  finished: boolean
  isWon : boolean | null // null = ничья/побег
}


export type PvpListItemDto = {
  id: number
  partnerName: string
  direction: "incoming" | "outgoing"
}


export type PvpOverviewResponse = {
  invites: PvpListItemDto[]
  active: PvpStateDto | null
}
