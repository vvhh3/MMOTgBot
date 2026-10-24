import { type MeResponse } from "@mmobot/shared";

import { api,authHeader } from "../../shared/api/http";




//Использование предметов в инвенторе
//Зелья
export async function inventoryUsePotion(token: string,idItem:number): Promise<MeResponse> {
  const res = await api.post("/inventory/use", { itemType: idItem }, { headers: authHeader(token) })
  return res.data
}

//экипировка броня/оружие
export async function inventoryEquipedItem(token: string,idItem:number): Promise<MeResponse> {
  const res = await api.post("/inventory/equip", { inventoryItemId: idItem }, { headers: authHeader(token) })
  return res.data
}


//снять броня/оружие
export async function inventoryUnEquipedItem(token: string,idItem:number): Promise<MeResponse> {
  const res = await api.post("/inventory/unequip", { inventoryItemId: idItem }, { headers: authHeader(token) })
  return res.data
}
