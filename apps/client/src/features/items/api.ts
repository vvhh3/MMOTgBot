import { type ItemDto,type ItemResponse,type ItemsResponse } from "@mmobot/shared";

import { api,authHeader } from "../../shared/api/http";


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

export async function getItem(token: string, id: number): Promise<ItemResponse> {
  const responce = await api.get<ItemResponse>(`/items/${id}`, { headers: authHeader(token) })
  return responce.data
}


export async function getCatalog(token: string) {
  const r = await api.get<ItemsResponse>("/inventory", { headers: authHeader(token) })
  return r.data
}
