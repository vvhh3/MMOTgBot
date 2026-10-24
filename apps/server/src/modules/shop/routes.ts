import type { InventoryItemDto,ItemDto,PlayerDto } from "@mmobot/shared";
import { and,asc,eq,sql } from "drizzle-orm";
import type { Express,Request,Response } from "express";
import { db } from "../../database/connection.js";
import { toInventoryItemDto,toItemDto,toPlayerDtoEquipped } from "../../database/mappers.js";
import { inventoryItems,items,players } from "../../database/schema.js";
import { emitToPlayer } from "../../infrastructure/realtime/socket-server.js";
import type { AuthedRequest } from "../auth/auth.js";
import { assertOutsideCombat,grantItems,resolveInventoryItem } from "../inventory/store.js";

type ShopState = { items: ItemDto[] };
type ShopTransactionResponse = { player: PlayerDto; inventory: InventoryItemDto[]; total: number };

class ShopError extends Error {
  constructor(message: string, readonly status: number = 400) {
    super(message);
  }
}

function parsePositiveInteger(value: unknown, label: string, max = Number.MAX_SAFE_INTEGER): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
    throw new ShopError(`${label}: требуется целое число от 1 до ${max}`);
  }
  return parsed;
}

export function createShopRoutes(app: Express): void {
  app.get("/shop", (req: Request, res: Response) => {
    const state: ShopState = {
      items: db.select().from(items)
        .where(and(eq(items.shopAvailable, true), sql`${items.price} > 0`))
        .orderBy(asc(items.id)).all().map(toItemDto)
    };
    res.json(state);
  });

  app.post("/shop/buy", (req: Request, res: Response) => {
    const playerId = (req as AuthedRequest).player.id;
    try {
      const itemId = parsePositiveInteger(req.body?.itemType, "itemType");
      const quantity = parsePositiveInteger(req.body?.quantity, "quantity", 99);
      let total = 0;

      db.transaction((tx) => {
        const item = tx.select().from(items).where(eq(items.id, itemId)).get();
        if (!item || !item.shopAvailable || item.price <= 0) throw new ShopError("Этот предмет нельзя купить", 404);
        total = item.price * quantity;
        if (!Number.isSafeInteger(total)) throw new ShopError("Слишком большая сумма");

        const player = tx.select().from(players).where(eq(players.id, playerId)).get();
        if (!player) throw new ShopError("Игрок не найден", 404);
        if (player.money < total) throw new ShopError("Недостаточно монет");

        tx.update(players).set({ money: player.money - total }).where(eq(players.id, playerId)).run();
        grantItems(tx, playerId, itemId, quantity);
      });

      res.json(buildResponse(playerId, total));
    } catch (error) {
      const shopError = error instanceof ShopError ? error : new ShopError("Не удалось купить предмет", 500);
      res.status(shopError.status).json({ error: shopError.message });
    }
  });

  app.post("/shop/sell", (req: Request, res: Response) => {
    const playerId = (req as AuthedRequest).player.id;
    try {
      const itemId = parsePositiveInteger(req.body?.itemType, "itemType");
      const quantity = parsePositiveInteger(req.body?.quantity, "quantity", 99);
      let total = 0;

      db.transaction((tx) => {
        const item = tx.select().from(items).where(eq(items.id, itemId)).get();
        if (!item || !item.shopAvailable || item.price <= 0) throw new ShopError("Этот предмет нельзя продать", 400);
        assertOutsideCombat(tx, playerId);
        const owned = resolveInventoryItem(tx, playerId, req.body ?? {});
        if (!owned || owned.quantity < quantity) throw new ShopError("Недостаточно предметов");
        if (owned.equiped) throw new ShopError("Сначала снимите экипированный предмет");

        total = Math.max(1, Math.floor(item.price / 2)) * quantity;
        if (total < 1) throw new ShopError("За этот предмет нельзя получить монеты");

        tx.update(players).set({ money: sql`${players.money} + ${total}` })
          .where(eq(players.id, playerId)).run();
        if (owned.quantity === quantity) {
          tx.delete(inventoryItems).where(eq(inventoryItems.id, owned.id)).run();
        } else {
          tx.update(inventoryItems).set({ quantity: owned.quantity - quantity })
            .where(eq(inventoryItems.id, owned.id)).run();
        }
      });

      res.json(buildResponse(playerId, total));
    } catch (error) {
      const shopError = error instanceof ShopError ? error : new ShopError(error instanceof Error ? error.message : "Не удалось продать предмет");
      res.status(shopError.status).json({ error: shopError.message });
    }
  });
}

function buildResponse(playerId: number, total: number): ShopTransactionResponse {
  const playerRow = db.select().from(players).where(eq(players.id, playerId)).get();
  if (!playerRow) throw new ShopError("Игрок не найден", 404);
  const inventoryRows = db.select().from(inventoryItems)
    .where(eq(inventoryItems.playerId, playerId)).all();
  const player = toPlayerDtoEquipped(playerRow);
  const inventory = inventoryRows.map(toInventoryItemDto);
  emitToPlayer(playerId, "player", player);
  emitToPlayer(playerId, "inventory", inventory);
  return { player, inventory, total };
}
