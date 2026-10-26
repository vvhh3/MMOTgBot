import type { BattleSide,BattleState } from '@mmobot/shared';
import { getItemMinLevel } from '@mmobot/shared';
import { and,eq } from 'drizzle-orm';
import { db } from "../../../database/connection.js";
import { inventoryItems,items,players } from '../../../database/schema.js';
import { BattleError } from './state.js';

/** Called inside the action transaction. Stock is spent only when the action executes. */
export function preparePotion(state: BattleState, side: BattleSide, playerId: number, itemType: number | undefined, hp: number) {
  if (!Number.isSafeInteger(itemType) || itemType! < 1) throw new BattleError('Выберите лечебный предмет', 400);
  const owned = db.select().from(inventoryItems).where(and(eq(inventoryItems.playerId, playerId), eq(inventoryItems.itemType, itemType!))).get();
  const item = db.select().from(items).where(eq(items.id, itemType!)).get();
  if (!owned || owned.quantity < 1 || !item || item.type !== 'potion') throw new BattleError('Лечебного предмета нет в инвентаре', 400);
  const player = db.select().from(players).where(eq(players.id, playerId)).get();
  if (!player || player.level < getItemMinLevel(item)) throw new BattleError(`Требуется уровень ${getItemMinLevel(item)}`, 400);
  if (state.healingLimit !== undefined && state.events.filter(e => e.type === 'heal' && e.side === side).length >= state.healingLimit)
    throw new BattleError('Лечение в этом бою уже использовано', 400);
  if (item.healAmount <= 0) throw new BattleError('Предметы с этим эффектом пока недоступны', 400);
  if (hp >= state.fighters[side].maxHp) throw new BattleError('Здоровье полное', 400);
  const id = `potion_${item.id}`;
  state.fighters[side].moves = state.fighters[side].moves.filter(m => m.itemType === undefined);
  state.fighters[side].moves.push({ id, name: item.name, kind: 'heal', priority: 1,
    accuracy: 100, power: 0, cooldownRounds: 0, itemType: item.id, healAmount: item.healAmount });
  return id;
}
export function consumePotion(playerId: number, itemType: number) {
  const row = db.select().from(inventoryItems).where(and(eq(inventoryItems.playerId, playerId), eq(inventoryItems.itemType, itemType))).get();
  if (!row || row.quantity < 1) throw new BattleError('Лечебный предмет больше недоступен');
  if (row.quantity === 1) db.delete(inventoryItems).where(eq(inventoryItems.id, row.id)).run();
  else db.update(inventoryItems).set({ quantity: row.quantity - 1 }).where(eq(inventoryItems.id, row.id)).run();
}
