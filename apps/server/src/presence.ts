import type { PlayerDto } from "@mmobot/shared";
import { isNotNull } from "drizzle-orm";
import { db, toPlayerDto, type PlayerRow } from "./db.js";
import { players } from "./db/schema.js";

const locationPlayers = new Map<string, Map<number, PlayerDto>>();

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

export function movePlayer(player: PlayerDto, locationId: string): void {
  for (const players of locationPlayers.values()) {
    players.delete(player.id);
  }

  addPlayerToPresence({ ...player, currentLocationId: locationId }, locationId);
}

export function getPlayersInLocation(locationId: string): PlayerDto[] {
  const players = locationPlayers.get(locationId);
  return players ? [...players.values()] : [];
}

function addPlayerToPresence(player: PlayerDto, locationId: string | null): void {
  if (!locationId) {
    return;
  }

  const players = locationPlayers.get(locationId) ?? new Map<number, PlayerDto>();
  players.set(player.id, player);
  locationPlayers.set(locationId, players);
}
