import type { BattleMove, BattleState, MobCombatProfile, MobRank } from '@mmobot/shared';
import { calculateMobStats,createMobCombatProfile,createMobMoves,getItemMinLevel,legacyMobCombatProfile,recommendedMobLootChance,TUTORIAL_MOB_ID } from '@mmobot/shared';
import type { ItemRow, MobRow } from '../../database/schema.js';
import { squareMob,type SquareMob } from './catalogs/square.js';

export function squareMobProfile(template: SquareMob): MobCombatProfile {
  const profile = createMobCombatProfile(template.rank);
  return { ...profile, encounterWeight: template.weight,
    attack: { ...profile.attack, name: template.attack }, strongAttack: { ...profile.strongAttack!, name: template.strong } };
}

export function mobProfile(mob: Pick<MobRow, 'combatProfile' | 'catalogKey'>): MobCombatProfile {
  if (mob.combatProfile) return mob.combatProfile;
  const template = squareMob(mob.catalogKey);
  return template ? squareMobProfile(template) : legacyMobCombatProfile();
}

export function templateLoot(rank: MobRank, keys: readonly string[], catalog: readonly ItemRow[]) {
  const pool = catalog.filter(item => item.catalogKey && keys.includes(item.catalogKey));
  return pool.map(item => {
    const sameRarity = pool.filter(other => ['weapon', 'armor'].includes(other.type) && other.rarity === item.rarity).length;
    const chancePercent = recommendedMobLootChance(rank, item, sameRarity);
    return { itemType: item.id, chancePercent };
  }).filter(entry => entry.chancePercent > 0);
}

export function scaleMob(template: MobRow, playerLevel: number, catalog: readonly ItemRow[]): { mob: MobRow; rank: MobRank } {
  if (!template.combatProfile && !squareMob(template.catalogKey)) return { mob: template, rank: 'normal' };
  const profile = mobProfile(template);
  const stats = calculateMobStats(template, playerLevel, profile);
  const eligible = new Set(catalog.filter(item => getItemMinLevel(item) <= stats.level).map(item => item.id));
  return { rank: profile.rank, mob: { ...template, ...stats,
    loot: template.loot.filter(entry => eligible.has(entry.itemType)),
  } };
}

export function mobMoves(mob: MobRow): BattleMove[] {
  return createMobMoves(mobProfile(mob));
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
  const weight = (mob: MobRow) => mobProfile(mob).encounterWeight;
  const pool = mobs.filter(mob => mob.isActive && mob.locationId === 'square' && mob.id !== TUTORIAL_MOB_ID && weight(mob) > 0);
  let roll = random() * pool.reduce((sum, mob) => sum + weight(mob), 0);
  for (const mob of pool) { roll -= weight(mob); if (roll < 0) return mob; }
  return pool.at(-1);
}
