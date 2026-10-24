import { type MobDto,type MobResponse,type MobsResponse } from "@mmobot/shared";

import { api,authHeader } from "../../shared/api/http";



//Api для crud Мобов
export async function createMob(token: string, mob: MobDto): Promise<MobResponse> {
  const response = await api.post<MobResponse>(`/mobs`, mob, { headers: authHeader(token) })
  return response.data
}

export async function updateMob(token: string, id: number, mob: MobDto): Promise<MobResponse> {
  const response = await api.put<MobResponse>(`/mobs/${id}`, mob, { headers: authHeader(token) })
  return response.data
}


export async function deleteMob(token: string, id: number) {
  await api.delete(`/mobs/${id}`, { headers: authHeader(token) })
}

export async function getMobs(token: string): Promise<MobsResponse> {
  const responce = await api.get<MobsResponse>("/mobs", { headers: authHeader(token) })
  return responce.data
}
