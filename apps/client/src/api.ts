import axios, { type AxiosError } from "axios";
import {
  CombatActionResponse,
  type AuthRequest,
  type AuthResponse,
  type ClaimQuestResponse,
  type CombatActionRequest,
  type CombatStartRequest,
  type CombatStateResponse,
  type DailyQuestsResponse,
  type EnterLocationResponse,
  type FriendSearchResponse,
  type FriendsOverviewResponse,
  type ItemDto,
  type ItemResponse,
  type ItemsResponse,
  type LocationActionRequest,
  type LocationActionResponse,
  type LocationsResponse,
  type LocationStateResponse,
  type MeResponse,
  type MobDto,
  type MobResponse,
  type MobsResponse,
  type QuestResponse,
  type QuestsDto,
  type QuestsResponse
} from "@mmobot/shared";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { "content-type": "application/json" }
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string }>) => {
    const message = error.response?.data?.error ?? error.message;
    return Promise.reject(new Error(message));
  }
);

export async function auth(initData: string): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>("/auth", { initData } satisfies AuthRequest);
  return response.data;
}

export async function getMe(token: string): Promise<MeResponse> {
  const response = await api.get<MeResponse>("/me", { headers: authHeader(token) });
  return response.data;
}

export async function getLocations(token: string): Promise<LocationsResponse> {
  const response = await api.get<LocationsResponse>("/locations", { headers: authHeader(token) })
  return response.data
}

export async function enterLocation(token: string, locationId: string): Promise<EnterLocationResponse> {
  const response = await api.post<EnterLocationResponse>(`/locations/${locationId}/enter`, undefined, {
    headers: authHeader(token)
  })
  return response.data;
}

export async function getLocationState(token: string, locationId: string): Promise<LocationStateResponse> {
  const response = await api.get<LocationStateResponse>(`/locations/${locationId}/state`, { headers: authHeader(token) });
  return response.data;
}

export async function performLocationAction(token: string, locationId: string, actionId: LocationActionRequest["actionId"]): Promise<LocationActionResponse> {
  const response = await api.post<LocationActionResponse>(
    `/locations/${locationId}/action`,
    { actionId } satisfies LocationActionRequest,
    { headers: authHeader(token) })
  return response.data;
}

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

function authHeader(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

// Битва с мобами
export async function startCombat(token: string, mobId: number) {
  const response = await api.post<CombatStateResponse>("/combat/start", { mobId }, { headers: authHeader(token) })
  return response.data
}

export async function combatAction(token: string, action: CombatActionRequest["action"], itemType?: number) {
  const response = await api.post<CombatActionResponse>("/combat/action", { action, itemType }, { headers: authHeader(token) })
  return response.data
}

export async function getCombatState(token:string) {
    const response = await api.get<CombatStateResponse>("/combat/state",{headers: authHeader(token)})
    return response.data
}


// для инвенторя
export async function getInventory(token:string) {
  
}
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

//Api для crud Предметов
export async function createItem(token: string, item: ItemDto): Promise<ItemResponse> {
  const response = await api.post<ItemResponse>(`/items`, item, { headers: authHeader(token) })
  return response.data
}
export async function updateItem(token: string, id: number, item: ItemDto): Promise<ItemResponse> {
  const response = await api.put<ItemResponse>(`/items/${id}`, item, { headers: authHeader(token) })
  return response.data
}
export async function deleteItem(token: string, id: number) {
  await api.delete(`/items/${id}`, { headers: authHeader(token) })
}

export async function getItems(token: string): Promise<ItemsResponse> {
  const responce = await api.get<ItemsResponse>("/items", { headers: authHeader(token) })
  return responce.data
}
export async function getItem(token: string,id: number): Promise<ItemResponse> {
  const responce = await api.get<ItemResponse>(`/items/${id}`,{ headers: authHeader(token) })
  return responce.data
}

export async function getCatalog(token: string) {
  const r = await api.get<ItemsResponse>("/inventory", { headers: authHeader(token) })
  return r.data
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

// === Друзья ===

// Список друзей и заявок текущего игрока
export async function getFriends(token: string): Promise<FriendsOverviewResponse> {
  const response = await api.get<FriendsOverviewResponse>("/friends", { headers: authHeader(token) })
  return response.data
}

// Поиск игроков по коду друга или имени
export async function searchFriends(token: string, q: string): Promise<FriendSearchResponse> {
  const response = await api.get<FriendSearchResponse>(
    `/friends/search?q=${encodeURIComponent(q)}`,
    { headers: authHeader(token) }
  )
  return response.data
}

// Отправить заявку в друзья по коду (friendId)
export async function sendFriendRequest(token: string, friendId: number) {
  const response = await api.post("/friends/request", { friendId }, { headers: authHeader(token) })
  return response.data
}

// Принять (accept=true) или отклонить (accept=false) входящую заявку
export async function respondFriendRequest(token: string, id: number, accept: boolean) {
  const response = await api.post(
    `/friends/${id}/${accept ? "accept" : "decline"}`,
    undefined,
    { headers: authHeader(token) }
  )
  return response.data
}

// Удалить друга или отозвать свою заявку
export async function removeFriend(token: string, id: number) {
  const response = await api.delete(`/friends/${id}`, { headers: authHeader(token) })
  return response.data
}

// Предложить обмен другому игроку (POST /trades)
export async function createTrade(token: string, toPlayerId: number) {
  const response = await api.post("/trades", { toPlayerId }, { headers: authHeader(token) })
  return response.data
}