import type { WeaponProperties } from "../weapons.js";




export type ItemDto = WeaponProperties & {
  id: number
  name: string
  description: string
  type: "weapon" | "armor" | "potion" | "material" | "other"
  damage: number
  defense: number
  healAmount: number
  price: number
  shopAvailable: boolean
  icon: string
}


export type ItemsResponse = {
  items: ItemDto[]
}


export type ItemResponse = {
  item: ItemDto
}



export type InventoryItemDto = {
  id: number
  itemType: number
  quantity: number
  acquiredAt: string
  equiped: boolean
  weaponLevel: number | null
}
