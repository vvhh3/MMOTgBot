import { PlayerDto } from "@mmobot/shared";

import { api,authHeader } from "../../shared/api/http";


export async function updateAdminPlayer(
  token: string,
  changes: { playerId?: number; money?: number; xp?: number; name?: string; avatar?: string }
): Promise<{ player: PlayerDto }> {
  const response = await api.patch<{ player: PlayerDto }>("/admin/player", changes, { headers: authHeader(token) });
  return response.data;
}


export async function getAdminPlayers(token: string, query = ""): Promise<{ players: PlayerDto[] }> {
  const response = await api.get<{ players: PlayerDto[] }>("/admin/players", {
    params: { q: query },
    headers: authHeader(token),
  });
  return response.data;
}
