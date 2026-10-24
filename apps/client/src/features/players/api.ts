import { PlayerDto } from "@mmobot/shared";

import { api,authHeader } from "../../shared/api/http";


// PVP между игроков 
// получить онлайн игроков
export async function getOnlinePlayer(token: string): Promise<{ players: PlayerDto[] }> {
  const response = await api.get("/players/online", { headers: authHeader(token) })
  return response.data
}

export async function theLastAction(token: string,id: number) {
  const response = await api.post(`/theLastAction`,{id}, { headers: authHeader(token) })
  return response.data
}
