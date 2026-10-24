import { type ItemsResponse,type MeResponse } from "@mmobot/shared";

import { api,authHeader } from "../../shared/api/http";


export async function getShop(token: string): Promise<ItemsResponse> {
  const response = await api.get<ItemsResponse>("/shop", { headers: authHeader(token) })
  return response.data
}


export async function buyShopItem(token: string, itemType: number, quantity: number) {
  const response = await api.post<MeResponse & { total: number }>(
    "/shop/buy", { itemType, quantity }, { headers: authHeader(token) }
  )
  return response.data
}


export async function sellShopItem(token: string, itemType: number, quantity: number, inventoryItemId?: number) {
  const response = await api.post<MeResponse & { total: number }>(
    "/shop/sell", { itemType, quantity, inventoryItemId }, { headers: authHeader(token) }
  )
  return response.data
}
