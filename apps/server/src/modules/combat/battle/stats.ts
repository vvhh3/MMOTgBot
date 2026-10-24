import { and,eq } from 'drizzle-orm';
import { db } from "../../../database/connection.js";
import type { MobRow,PlayerRow } from '../../../database/schema.js';
import { inventoryItems,items } from '../../../database/schema.js';
import { basicAttack } from './engine.js';
export function playerFighter(player: PlayerRow) {
  const equipment = db.select({ item: items }).from(inventoryItems).innerJoin(items, eq(inventoryItems.itemType, items.id))
    .where(and(eq(inventoryItems.playerId, player.id), eq(inventoryItems.equiped, true))).all().map(r => r.item);
  return { name: player.name, maxHp: player.maxHealth,
    strength: player.strength + equipment.reduce((n, i) => n + i.damage, 0),
    defense: player.defense + equipment.reduce((n, i) => n + i.defense, 0),
    moves: [basicAttack(equipment.some(i => i.type === 'weapon'))] };
}
export function mobFighter(mob: MobRow) {
  return { name: mob.name, maxHp: mob.maxHealth, strength: mob.strength, defense: mob.defense,
    moves: [{ ...basicAttack(true), id: 'mob_attack', name: 'Атака' }] };
}
