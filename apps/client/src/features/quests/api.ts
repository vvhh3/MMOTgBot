import { type ClaimQuestResponse,type DailyQuestsResponse,type QuestResponse,type QuestsDto,type QuestsResponse } from "@mmobot/shared";

import { api,authHeader } from "../../shared/api/http";


export async function getDailyQuests(token: string): Promise<DailyQuestsResponse> {
  const response = await api.get<DailyQuestsResponse>("/quests/daily", { headers: authHeader(token) });
  return response.data;
}


export async function claimQuest(token: string, questId: number): Promise<ClaimQuestResponse> {
  const response = await api.post<ClaimQuestResponse>(`/quests/${questId}/claim`, undefined, {
    headers: authHeader(token)
  });
  return response.data;
}


//Api для crud квестов
export async function createQuest(token: string, quest: QuestsDto): Promise<QuestResponse> {
  const response = await api.post<QuestResponse>(`/quests`, quest, { headers: authHeader(token) })
  return response.data
}

export async function updateQuest(token: string, id: number, quest: QuestsDto): Promise<QuestResponse> {
  const response = await api.put<QuestResponse>(`/quests/${id}`, quest, { headers: authHeader(token) })
  return response.data
}


export async function deleteQuest(token: string, id: number) {
  await api.delete(`/quests/${id}`, { headers: authHeader(token) })
}


export async function getQuests(token: string): Promise<QuestsResponse> {
  const responce = await api.get<QuestsResponse>("/quests", { headers: authHeader(token) })
  return responce.data
}
