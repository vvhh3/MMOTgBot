import type { BattleMove } from './combat.js';
import type { MobCombatProfile, MobDto, MobRank } from './contracts/mobs.js';
import type { ItemRarity } from './weapons.js';

export type MobStats = Pick<MobDto, 'level' | 'maxHealth' | 'strength' | 'defense' | 'pointsReward' | 'coinReward'>;

export const MOB_EQUIPMENT_DROP_BUDGET: Record<MobRank, Record<ItemRarity, number>> = {
  normal: { common: 12, uncommon: 3, rare: .4, epic: 0, legendary: 0 },
  strong: { common: 20, uncommon: 6, rare: 1, epic: 0, legendary: 0 },
  elite: { common: 25, uncommon: 10, rare: 3, epic: .5, legendary: 0 },
  boss: { common: 30, uncommon: 15, rare: 8, epic: 2, legendary: .4 },
};

export function createMobCombatProfile(rank: MobRank = 'normal'): MobCombatProfile {
  return { rank, scaleToPlayer: true,
    encounterWeight: { normal: 24, strong: 7, elite: 3, boss: 1 }[rank],
    attack: { name: 'Обычная атака', accuracy: 95 },
    strongAttack: { name: 'Сильная атака', accuracy: rank === 'boss' ? 80 : 78, power: rank === 'boss' ? 1.55 : 1.4, cooldownRounds: 2 },
    guard: ['elite', 'boss'].includes(rank) ? { name: 'Круговая оборона', cooldownRounds: 2, fullBlockChance: 20,
      partialBlockChance: 60, partialMultiplier: .5, reflectChance: rank === 'boss' ? 10 : 0 } : null,
  };
}

export function legacyMobCombatProfile(): MobCombatProfile {
  return { ...createMobCombatProfile(), scaleToPlayer: false, encounterWeight: 1,
    attack: { name: 'Атака', accuracy: 100 }, strongAttack: null, guard: null };
}

// Shared by actual encounters and the admin preview; gear never participates in scaling.
export function calculateMobStats(base: MobStats, playerLevel: number, profile: Pick<MobCombatProfile, 'rank' | 'scaleToPlayer'>): MobStats {
  if (!profile.scaleToPlayer) return { level: base.level, maxHealth: base.maxHealth, strength: base.strength,
    defense: base.defense, pointsReward: base.pointsReward, coinReward: base.coinReward };
  const level = Math.max(1, Math.floor(playerLevel));
  const baseLevel = Math.max(1, Math.floor(base.level));
  const growth = profile.rank === 'boss' ? .14 : profile.rank === 'elite' ? .12 : .1;
  const strengthGrowth = profile.rank === 'boss' ? .9 : .8;
  const ratio = (growth: number) => (1 + growth * (level - 1)) / (1 + growth * (baseLevel - 1));
  return { level,
    maxHealth: Math.max(1, Math.round(base.maxHealth * ratio(growth))),
    strength: Math.max(0, base.strength + Math.ceil(strengthGrowth * (level - 1)) - Math.ceil(strengthGrowth * (baseLevel - 1))),
    defense: Math.max(0, base.defense + Math.floor(.45 * (level - 1)) - Math.floor(.45 * (baseLevel - 1))),
    pointsReward: Math.max(0, Math.round(base.pointsReward * ratio(.45))),
    coinReward: Math.max(0, Math.round(base.coinReward * ratio(.35))),
  };
}

export function recommendedMobStats(rank: MobRank, level = 1): MobStats {
  const base = {
    normal: { maxHealth: 33, strength: 6, defense: 1, pointsReward: 8, coinReward: 5 },
    strong: { maxHealth: 62, strength: 9, defense: 3, pointsReward: 15, coinReward: 10 },
    elite: { maxHealth: 85, strength: 11, defense: 4, pointsReward: 25, coinReward: 20 },
    boss: { maxHealth: 120, strength: 13, defense: 4, pointsReward: 55, coinReward: 45 },
  }[rank];
  return calculateMobStats({ ...base, level: 1 }, level, { rank, scaleToPlayer: true });
}

export function createMobMoves(profile: MobCombatProfile): BattleMove[] {
  const moves: BattleMove[] = [{ id: 'mob_attack', name: profile.attack.name, accuracy: profile.attack.accuracy,
    kind: 'attack', priority: 0, power: 1, cooldownRounds: 0 }];
  if (profile.strongAttack) moves.push({ ...profile.strongAttack, id: 'mob_strong', kind: 'attack', priority: 0 });
  if (profile.guard) {
    const { name, cooldownRounds, ...defense } = profile.guard;
    moves.push({ id: 'mob_guard', name, cooldownRounds, defense, kind: 'defend', priority: 1, accuracy: 100, power: 0 });
  }
  return moves;
}

export function recommendedMobLootChance(rank: MobRank, item: { type: string; rarity: ItemRarity }, equipmentOfRarity = 1): number {
  if (['weapon', 'armor'].includes(item.type)) return MOB_EQUIPMENT_DROP_BUDGET[rank][item.rarity] / Math.max(1, equipmentOfRarity);
  if (item.type === 'potion') return ({ common: 16, uncommon: 8, rare: 3, epic: 1, legendary: .2 }[item.rarity] * (rank === 'boss' ? 2 : 1));
  return 18;
}
