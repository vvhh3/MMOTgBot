




export type MobLootEntry = {
  itemType: number;
  chancePercent: number; // 0..100, независимый шанс получить одну штуку
};


export type MobDto = { // описание мобов
  id: number
  name: string
  description: string
  level: number
  maxHealth: number
  strength: number
  defense: number
  loot: MobLootEntry[]
  pointsReward: number
  coinReward: number
  locationId: string
  respawnSeconds: number
}


export type MobsResponse = {
  mobs: MobDto[]
}

export type MobResponse = {
  mob: MobDto
}
