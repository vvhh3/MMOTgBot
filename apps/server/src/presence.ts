import type { PlayerDto } from "@mmobot/shared";
import { isNotNull } from "drizzle-orm";
import { db, toPlayerDto, type PlayerRow } from "./db.js";
import { players } from "./db/schema.js";

// in-memory реестр игроков по локациям: локация -> (id игрока -> игрок)
const locationPlayers = new Map<string, Map<number, PlayerDto>>();

// при старте сервера выгружает всех игроков с локацией из БД в память
export function hydratePresenceFromDatabase(): void {
  locationPlayers.clear();
  const rows = db
    .select()
    .from(players)
    .where(isNotNull(players.currentLocationId))
    .all() as PlayerRow[];
  for (const row of rows) {
    addPlayerToPresence(toPlayerDto(row), row.currentLocationId);
  }
}

// переводит игрока в новую локацию: убирает из всех старых, кладёт в новую
export function movePlayer(player: PlayerDto, locationId: string): void {
  for (const players of locationPlayers.values()) {
    players.delete(player.id);
  }

  addPlayerToPresence({ ...player, currentLocationId: locationId }, locationId);
}

// возвращает массив игроков в указанной локации
export function getPlayersInLocation(locationId: string): PlayerDto[] {
  const players = locationPlayers.get(locationId);
  return players ? [...players.values()] : [];
}

// кладёт игрока в карту его локации (null локация игнорируется)
function addPlayerToPresence(player: PlayerDto, locationId: string | null): void {
  if (!locationId) {
    return;
  }

  const players = locationPlayers.get(locationId) ?? new Map<number, PlayerDto>();
  players.set(player.id, player);
  locationPlayers.set(locationId, players);
}
