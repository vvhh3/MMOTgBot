

import type { CombatStateResponse,PvpStateDto } from "./combat-api.js";
import type { FriendsOverviewResponse } from "./friends.js";
import type { InventoryItemDto } from "./items.js";
import type { LocationStateResponse } from "./locations.js";
import type { PlayerDto } from "./players.js";
import type { TradeStateDto } from "./trades.js";



// === Типизированные socket.io события ===
// ServerToClientEvents — что сервер отправляет клиенту
// ClientToServerEvents — что клиент отправляет серверу

export type ServerToClientEvents = {
  locationState: (state: LocationStateResponse) => void;
  combatState: (state: CombatStateResponse) => void;
  player: (player: PlayerDto) => void
  inventory: (inventory: InventoryItemDto[]) => void
  tradeUpdate: (state: TradeStateDto | null) => void
  pvpState: (state: PvpStateDto| null) => void
  friendsUpdate: (state: FriendsOverviewResponse) => void
};


export type ClientToServerEvents = {
  // пока пусто — комнатами локаций управляет сервер
}
