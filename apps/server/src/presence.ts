import type { PlayerDto } from "@mmobot/shared";
import { db, toPlayerDto, type PlayerRow } from "./db.js";

const locationPlayers = new Map<string, Map<number, PlayerDto>>();

export function hydratePresenceFromDatabase(): void {
  locationPlayers.clear();
  const rows = db.prepare("SELECT * FROM players WHERE current_location_id IS NOT NULL").all() as PlayerRow[];
  for (const row of rows) {
    addPlayerToPresence(toPlayerDto(row), row.current_location_id);
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
