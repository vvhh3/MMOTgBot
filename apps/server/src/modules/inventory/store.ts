import { isInGroupBattle } from '../group-events/participation.js';
import { and,eq,isNull,or } from "drizzle-orm";
import type { db } from "../../database/connection.js";
import type { InventoryItemRow } from "../../database/schema.js";
import { combatSessions,inventoryItems,items,pvpSessions } from "../../database/schema.js";
import { nowGameTime } from "../../shared/time.js";

export type InventoryDatabase = Pick<typeof db, "select" | "insert" | "update" | "delete">;

// Все источники добычи используют один способ выдачи. Вызывается в транзакции.
export function grantItems(tx: InventoryDatabase, playerId: number, itemType: number, quantity = 1, acquiredAt = nowGameTime()): void {
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error("Некорректное количество предметов");
  const item = tx.select().from(items).where(eq(items.id, itemType)).get();
  if (!item) throw new Error("Предмет не найден в каталоге");
  if (item.type === "weapon") {
    for (let i = 0; i < quantity; i++) {
      tx.insert(inventoryItems).values({ playerId, itemType, quantity: 1, acquiredAt, weaponLevel: 1 }).run();
    }
    return;
  }
  const owned = tx.select().from(inventoryItems).where(and(
    eq(inventoryItems.playerId, playerId), eq(inventoryItems.itemType, itemType), isNull(inventoryItems.weaponLevel),
  )).get();
  if (owned) {
    const total = owned.quantity + quantity;
    if (!Number.isSafeInteger(total)) throw new Error("Слишком много предметов");
    tx.update(inventoryItems).set({ quantity: total, acquiredAt }).where(eq(inventoryItems.id, owned.id)).run();
  } else {
    tx.insert(inventoryItems).values({ playerId, itemType, quantity, acquiredAt }).run();
  }
}

export function positiveId(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

// Старый itemType допустим только для стека. Оружие всегда выбирается по экземпляру.
export function resolveInventoryItem(tx: InventoryDatabase, playerId: number, input: { inventoryItemId?: unknown; itemType?: unknown }): InventoryItemRow {
  if (input.inventoryItemId !== undefined) {
    const id = positiveId(input.inventoryItemId);
    if (id === null) throw new Error("Некорректный экземпляр предмета");
    const row = tx.select().from(inventoryItems).where(and(eq(inventoryItems.id, id), eq(inventoryItems.playerId, playerId))).get();
    if (!row || (input.itemType !== undefined && input.itemType !== row.itemType)) throw new Error("Предмет не найден в вашем инвентаре");
    return row;
  }
  const itemType = positiveId(input.itemType);
  if (itemType === null) throw new Error("Выберите предмет в инвентаре");
  const row = tx.select().from(inventoryItems).where(and(
    eq(inventoryItems.playerId, playerId), eq(inventoryItems.itemType, itemType), isNull(inventoryItems.weaponLevel),
  )).get();
  if (!row) throw new Error("Выберите конкретный экземпляр оружия");
  return row;
}

export function assertOutsideCombat(tx: InventoryDatabase, playerId: number): void {
  const pve = tx.select({ id: combatSessions.id }).from(combatSessions).where(and(
    eq(combatSessions.playerId, playerId), eq(combatSessions.status, "active"),
  )).get();
  const pvp = tx.select({ id: pvpSessions.id }).from(pvpSessions).where(and(
    or(eq(pvpSessions.player1Id, playerId), eq(pvpSessions.player2Id, playerId)), eq(pvpSessions.status, "active"),
  )).get();
  if (pve || pvp || isInGroupBattle(tx, playerId)) throw new Error("Дождитесь окончания боя");
}
