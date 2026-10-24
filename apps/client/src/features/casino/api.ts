import { type CasinoGameType,type CasinoSessionResponse } from "@mmobot/shared";

import { api,authHeader } from "../../shared/api/http";


export async function getCasinoSession(token: string): Promise<CasinoSessionResponse> {
  const res = await api.get<CasinoSessionResponse>("/casino/session", { headers: authHeader(token) })
  return res.data
}


export async function startCasinoGame(
  token: string,
  game: CasinoGameType,
  bet: number,
  options?: { mineCount?: number; ladderBombCount?: 1 | 2 },
): Promise<CasinoSessionResponse> {
  const res = await api.post<CasinoSessionResponse>("/casino/start", { game, bet, ...options }, { headers: authHeader(token) })
  return res.data
}


export async function revealMineCell(token: string, cell: number): Promise<CasinoSessionResponse> {
  const res = await api.post<CasinoSessionResponse>("/casino/mines/reveal", { cell }, { headers: authHeader(token) })
  return res.data
}


export async function cashoutMines(token: string): Promise<CasinoSessionResponse> {
  const res = await api.post<CasinoSessionResponse>("/casino/mines/cashout", undefined, { headers: authHeader(token) })
  return res.data
}


export async function blackjackAction(token: string, action: "hit" | "stand"): Promise<CasinoSessionResponse> {
  const res = await api.post<CasinoSessionResponse>("/casino/blackjack/action", { action }, { headers: authHeader(token) })
  return res.data
}


export async function chooseLadderCell(token: string, cell: number): Promise<CasinoSessionResponse> {
  const res = await api.post<CasinoSessionResponse>("/casino/ladder/choose", { cell }, { headers: authHeader(token) })
  return res.data
}


export async function cashoutLadder(token: string): Promise<CasinoSessionResponse> {
  const res = await api.post<CasinoSessionResponse>("/casino/ladder/cashout", undefined, { headers: authHeader(token) })
  return res.data
}
