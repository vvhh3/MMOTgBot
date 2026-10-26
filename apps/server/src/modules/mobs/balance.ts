import type { BattleMove, BattleState, ItemRarity, MobRank } from '@mmobot/shared';
import { getItemMinLevel } from '@mmobot/shared';
import type { ItemRow, MobRow } from '../../database/schema.js';
import { squareMob } from './catalogs/square.js';

const equipmentChance: Record<MobRank, Record<ItemRarity, number>> = {
  normal: { common: 12, uncommon: 3, rare: .4, epic: 0, legendary: 0 },
  strong: { common: 20, uncommon: 6, rare: 1, epic: 0, legendary: 0 },
  elite: { common: 25, uncommon: 10, rare: 3, epic: .5, legendary: 0 },
  boss: { common: 30, uncommon: 15, rare: 8, epic: 2, legendary: .4 },
};

export function templateLoot(rank: MobRank, keys: readonly string[], catalog: readonly ItemRow[]) {
  const pool = catalog.filter(item => item.catalogKey && keys.includes(item.catalogKey));
  return pool.map(item => {
    const sameRarity = pool.filter(other => ['weapon', 'armor'].includes(other.type) && other.rarity === item.rarity).length;
    const chancePercent = ['weapon', 'armor'].includes(item.type)
      ? equipmentChance[rank][item.rarity] / Math.max(1, sameRarity)
      : item.type === 'potion'
        ? ({ common: 16, uncommon: 8, rare: 3, epic: 1, legendary: .2 }[item.rarity] * (rank === 'boss' ? 2 : 1))
        : 18;
    return { itemType: item.id, chancePercent };
  }).filter(entry => entry.chancePercent > 0);
}

export function scaleMob(template: MobRow, playerLevel: number, catalog: readonly ItemRow[]): { mob: MobRow; rank: MobRank } {
  const profile = squareMob(template.catalogKey);
  if (!profile) return { mob: template, rank: 'normal' };
  const level = Math.max(1, Math.floor(playerLevel));
  const delta = level - template.level;
  const healthGrowth = profile.rank === 'boss' ? .14 : profile.rank === 'elite' ? .12 : .1;
  const eligible = new Set(catalog.filter(item => getItemMinLevel(item) <= level).map(item => item.id));
  return { rank: profile.rank, mob: { ...template, level,
    maxHealth: Math.max(1, Math.round(template.maxHealth * Math.max(.1, 1 + healthGrowth * delta))),
    strength: Math.max(0, template.strength + Math.ceil((profile.rank === 'boss' ? .9 : .8) * delta)),
    defense: Math.max(0, template.defense + Math.floor(.45 * delta)),
    pointsReward: Math.max(0, Math.round(template.pointsReward * Math.max(0, 1 + .45 * delta))),
    coinReward: Math.max(0, Math.round(template.coinReward * Math.max(0, 1 + .35 * delta))),
    loot: template.loot.filter(entry => eligible.has(entry.itemType)),
  } };
}

export function mobMoves(mob: MobRow): BattleMove[] {
  const profile = squareMob(mob.catalogKey);
  const moves: BattleMove[] = [{ id: 'mob_attack', name: profile?.attack ?? 'Атака', kind: 'attack',
    priority: 0, accuracy: profile ? 95 : 100, power: 1, cooldownRounds: 0 }];
  if (!profile) return moves;
  moves.push({ id: 'mob_strong', name: profile.strong, kind: 'attack', priority: 0,
    accuracy: profile.rank === 'boss' ? 80 : 78, power: profile.rank === 'boss' ? 1.55 : 1.4, cooldownRounds: 2 });
  if (['elite', 'boss'].includes(profile.rank)) moves.push({ id: 'mob_guard', name: 'Круговая оборона', kind: 'defend', priority: 1,
    accuracy: 100, power: 0, cooldownRounds: 2,
    defense: { fullBlockChance: 20, partialBlockChance: 60, partialMultiplier: .5, reflectChance: profile.rank === 'boss' ? 10 : 0 } });
  return moves;
}

// Runs before the player submits an action; does not inspect their hidden choice.
export function chooseMobMove(state: BattleState, round: number, random: () => number = Math.random): string {
  const available = state.fighters[1].moves.filter(move => (state.cooldowns[1][move.id] ?? 1) <= round);
  if (available.length === 1) return available[0].id;
  const guard = available.find(move => move.kind === 'defend');
  const strong = available.find(move => move.id === 'mob_strong');
  const roll = random();
  if (guard && roll < .12) return guard.id;
  if (strong && roll < (guard ? .57 : .4)) return strong.id;
  return available.find(move => move.kind === 'attack' && move.cooldownRounds === 0)!.id;
}

export function chooseEncounter(mobs: readonly MobRow[], random: () => number = Math.random): MobRow | undefined {
  const pool = mobs.filter(mob => mob.isActive && mob.locationId === 'square' && mob.id !== -1);
  const weight = (mob: MobRow) => squareMob(mob.catalogKey)?.weight ?? 1;
  let roll = random() * pool.reduce((sum, mob) => sum + weight(mob), 0);
  for (const mob of pool) { roll -= weight(mob); if (roll < 0) return mob; }
  return pool.at(-1);
}
