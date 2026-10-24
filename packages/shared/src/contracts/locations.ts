

import type { InventoryItemDto } from "./items.js";
import type { MobDto } from "./mobs.js";
import type { PlayerDto } from "./players.js";



export type LocationDto = {
  id: string;
  name: string;
  description: string;
  x: number;
  y: number;
  homeImg:string;
  fightImg:string;
  actions: string[];
  minLevel: number;
  isOpen: boolean;
}


export type LocationAccess = "available" | "coming_soon" | "level_required";


// Одинаковый порядок проверок для карты и сервера: разработка важнее уровня.
export function getLocationAccess(
  location: Pick<LocationDto, "isOpen" | "minLevel">,
  playerLevel: number,
  canBypassRestrictions = false,
): LocationAccess {
  if (canBypassRestrictions) return "available";
  if (!location.isOpen) return "coming_soon";
  if (playerLevel < location.minLevel) return "level_required";
  return "available";
}


export type ActionDto = {
  id: string;
  label: string;
  description: string;
};


export type EventDto = {
  id: number;
  playerId: number;
  playerName: string;
  locationId: string;
  type: string;
  createdAt: string;
};


export type LocationsResponse = {
  locations: LocationDto[];
  canBypassRestrictions: boolean;
}


export type LocationStateResponse = {
  location: LocationDto;
  players: PlayerDto[];
  actions: ActionDto[];
  mobs: MobDto[];
  recentEvents: EventDto[];
  serverTime: string;
}


export type EnterLocationResponse = {
  player: PlayerDto;
  state: LocationStateResponse;
}


export type LocationActionRequest = {
  actionId: "fight" | "walk"; // сражаться | прогуляться
}


export type LocationActionResponse = {
  message: string;
  player: PlayerDto;
  inventory: InventoryItemDto[];
  event: EventDto;
}
