




export type MobLootEntry = {
  itemType: number;
  chancePercent: number; // 0..100, независимый шанс получить одну штуку
};


export type MobRank = 'normal' | 'strong' | 'elite' | 'boss';

export const MOB_RANK_LABELS: Record<MobRank, string> = {
  normal: 'Обычный', strong: 'Сильный', elite: 'Элита', boss: 'Босс',
};

export type MobCombatProfile = {
  rank: MobRank;
  scaleToPlayer: boolean;
  encounterWeight: number;
  attack: { name: string; accuracy: number };
  strongAttack: { name: string; accuracy: number; power: number; cooldownRounds: number } | null;
  guard: { name: string; cooldownRounds: number; fullBlockChance: number; partialBlockChance: number;
    partialMultiplier: number; reflectChance: number } | null;
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
  combatProfile?: MobCombatProfile | null
}


export type MobsResponse = {
  mobs: MobDto[]
}

export type MobResponse = {
  mob: MobDto
}
