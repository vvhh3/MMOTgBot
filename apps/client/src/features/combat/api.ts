import type { BattleRequest } from '@mmobot/shared';
import { CombatActionResponse,type CombatActionRequest,type CombatStateResponse,type PvpOverviewResponse,type PvpStateDto } from "@mmobot/shared";

import { api,authHeader } from "../../shared/api/http";


// Битва с мобами
export async function startCombat(token: string, mobId: number) {
  const response = await api.post<CombatStateResponse>("/combat/start", { mobId }, { headers: authHeader(token) })
  return response.data
}


export async function combatAction(token: string, action: CombatActionRequest["action"], request: BattleRequest) {
  const response = await api.post<CombatActionResponse>("/combat/action", { action, ...request }, { headers: authHeader(token) })
  return response.data
}


export async function getCombatState(token: string, sessionId?: number) {
  const response = await api.get<CombatStateResponse>("/combat/state", { params: { sessionId }, headers: authHeader(token) })
  return response.data
}

export async function createPvp(token: string, toPlayerId: number) {
  const response = await api.post("/pvp", { toPlayerId }, { headers: authHeader(token) })
  return response.data
}

export async function getPvpOverview(token: string): Promise<PvpOverviewResponse> {
  const response = await api.get<PvpOverviewResponse>("/pvp", { headers: authHeader(token) })
  return response.data
}

export async function acceptPvp(token: string, id: number) {
  await api.post(`/pvp/${id}/accept`, undefined, { headers: authHeader(token) })
}

export async function cancelPvp(token: string, id: number) {
  const response = await api.delete<{ ok: boolean; state: PvpStateDto }>(`/pvp/${id}`, { headers: authHeader(token), timeout: 15000 })
  return response.data
}


export async function getPvpState(token: string, id: number): Promise<PvpStateDto> {
  const response = await api.get<PvpStateDto>(`/pvp/${id}`, { headers: authHeader(token), timeout: 15000 })
  return response.data
}


// Сделать ход в активной дуэли: attack | flee | use(зелье)
export async function pvpAction(token: string, id: number, action: "attack" | "use", request: BattleRequest) {
  const response = await api.post<{ ok: boolean; state: PvpStateDto }>(`/pvp/${id}/action`, { action, ...request }, { headers: authHeader(token), timeout: 15000 })
  return response.data
}


export async function requestPvpExit(token: string, id: number, request: BattleRequest, requested: boolean) {
  const response = await api.post<{ ok: boolean; state: PvpStateDto }>(`/pvp/${id}/exit-request`, { ...request, requested }, { headers: authHeader(token), timeout: 15000 });
  return response.data;
}
