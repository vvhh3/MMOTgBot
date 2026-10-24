import { type TradesOverviewResponse } from "@mmobot/shared";

import { api,authHeader } from "../../shared/api/http";


// Предложить обмен другому игроку (POST /trades)
export async function createTrade(token: string, toPlayerId: number) {
  const response = await api.post("/trades", { toPlayerId }, { headers: authHeader(token) })
  return response.data
}

export async function getTradesOverview(token: string): Promise<TradesOverviewResponse> {
  const response = await api.get<TradesOverviewResponse>("/trades", { headers: authHeader(token) })
  return response.data
}

export async function acceptTrade(token: string, id: number) {
  const response = await api.post(`/trades/${id}/accept`, undefined, { headers: authHeader(token) })
  return response.data
}

export async function cancelTrade(token: string, id: number) {
  const response = await api.delete(`/trades/${id}`, { headers: authHeader(token) })
  return response.data
}

export async function submitOffer(token: string, id: number, items: import("@mmobot/shared").TradeItem[]) {
  const response = await api.put(`/trades/${id}/offer`, { items: items }, { headers: authHeader(token) })
  return response.data
}

export async function submitReady(token: string, id: number) { // подтвердить перевод
  const response = await api.post(`/trades/${id}/ready`, undefined, { headers: authHeader(token) })
  return response.data
}
