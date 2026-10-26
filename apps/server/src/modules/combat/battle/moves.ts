import { ITEM_ATTACK_NAMES,ITEM_BALANCE,ITEM_GUARD_NAMES } from '@mmobot/shared';
import type { BattleMove } from '@mmobot/shared';
import type { ItemRow } from '../../../database/schema.js';
import { basicAttack } from './engine.js';


export function equipmentMoves(weapon?: ItemRow, armor?: ItemRow): BattleMove[] {
  const moves = [basicAttack(Boolean(weapon))];
  if (weapon) {
    const tier = ITEM_BALANCE[weapon.rarity];
    const names = ITEM_ATTACK_NAMES[weapon.catalogKey ?? ''];
    moves[0].name = names?.[0] ?? 'Обычная атака';
    moves.push({ id: 'weapon_strong', name: names?.[1] ?? 'Сильная атака', kind: 'attack',
      priority: 0, accuracy: tier.strongAccuracy, power: tier.strongPower, cooldownRounds: 2 });
  }
  if (armor) {
    const tier = ITEM_BALANCE[armor.rarity];
    moves.push({ id: 'armor_guard', name: ITEM_GUARD_NAMES[armor.catalogKey ?? ''] ?? 'Защитная стойка', kind: 'defend',
      priority: 1, accuracy: 100, power: 0, cooldownRounds: 1,
      defense: { fullBlockChance: tier.fullBlockChance, partialBlockChance: tier.partialBlockChance,
        partialMultiplier: .5, reflectChance: tier.reflectChance } });
  }
  return moves;
}
