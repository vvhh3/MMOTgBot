




export type MobLootEntry = {
  itemType: number;
  chancePercent: number; // 0..100, независимый шанс получить одну штуку
};


export type MobRank = 'normal' | 'strong' | 'elite' | 'boss';

export const MOB_RANK_LABELS: Record<MobRank, string> = {
  normal: 'Обычный', strong: 'Сильный', elite: 'Элита', boss: 'Босс',
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
  catalogKey?: string | null
  rank?: MobRank
}


export type MobsResponse = {
  mobs: MobDto[]
}

export type MobResponse = {
  mob: MobDto
}
