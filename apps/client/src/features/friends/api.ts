import { type FriendSearchResponse,type FriendsOverviewResponse } from "@mmobot/shared";

import { api,authHeader } from "../../shared/api/http";


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
