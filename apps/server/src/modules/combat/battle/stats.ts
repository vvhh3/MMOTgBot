import { and,eq } from 'drizzle-orm';
import { db } from "../../../database/connection.js";
import type { MobRow,PlayerRow } from '../../../database/schema.js';
import { inventoryItems,items } from '../../../database/schema.js';
import { mobMoves } from '../../mobs/balance.js';
import { getItemMinLevel } from '@mmobot/shared';
import { equipmentMoves } from './moves.js';
export function getEquippedItems(player: PlayerRow) {
  return db.select({ item: items }).from(inventoryItems).innerJoin(items, eq(inventoryItems.itemType, items.id))
    .where(and(eq(inventoryItems.playerId, player.id), eq(inventoryItems.equiped, true))).all().map(r => r.item)
    .filter(item => ['weapon', 'armor'].includes(item.type) && player.level >= getItemMinLevel(item));
}
export function playerFighter(player: PlayerRow) {
  const equipment = getEquippedItems(player);
  return { name: player.name, maxHp: player.maxHealth,
    strength: player.strength + equipment.reduce((n, i) => n + i.damage, 0),
    defense: player.defense + equipment.reduce((n, i) => n + i.defense, 0),
    moves: equipmentMoves(equipment.find(i => i.type === 'weapon'), equipment.find(i => i.type === 'armor')) };
}
export function mobFighter(mob: MobRow) {
  return { name: mob.name, maxHp: mob.maxHealth, strength: mob.strength, defense: mob.defense,
    moves: mobMoves(mob) };
}
