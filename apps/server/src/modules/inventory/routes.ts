import { invalidatePartyReady } from '../group-events/parties.js';
import { publishGroup } from '../group-events/updates.js';
import { assertOutsideCombat,resolveInventoryItem } from "./store.js";

import { getItemMinLevel,ItemsResponse } from "@mmobot/shared";
import { and,asc,eq } from "drizzle-orm";
import type { Express,Request,Response } from "express";
import { db } from "../../database/connection.js";
import { toInventoryItemDto,toItemDto,toPlayerDtoEquipped } from "../../database/mappers.js";
import { inventoryItems,items,players } from "../../database/schema.js";
import { AuthedRequest } from "../auth/auth.js";

export const InventoryRoutes = (app: Express) => {

    // body.itemType приходит из JSON без гарантий типа — приводим и проверяем,
    // иначе строка/NaN тихо не найдёт ничего в integer-колонке
    const parseItemType = (body: unknown): number | null => {
        const value = Number((body as { itemType?: unknown })?.itemType);
        return Number.isInteger(value) ? value : null;
    }

    app.get("/inventory", (req, res) => {
        const state = db.select().from(items).orderBy(asc(items.id)).all()
        const response: ItemsResponse = { items: state.map(toItemDto) }
        res.json(response)
    })

    app.post("/inventory/equip", (req: Request, res: Response) => {
        const player = (req as AuthedRequest).player

        let inventoryItem;
        try {
            assertOutsideCombat(db, player.id);
            inventoryItem = resolveInventoryItem(db, player.id, req.body ?? {});
        } catch (error) {
            res.status(400).json({ error: (error as Error).message });
            return;
        }

        //Есть ли предмет в инвенторе
        if (!inventoryItem || inventoryItem.quantity < 1) {
            res.status(400).json({ error: "item not found is your inventory" })
            return
        }

        // получить сам предмет
        const item = db.select().from(items)
            .where(eq(items.id, inventoryItem.itemType))
            .get()

        if (!item || (item.type !== "weapon" && item.type !== "armor")) {
            res.status(400).json({ error: "not found item" })
            return
        }

        if (player.level < getItemMinLevel(item)) {
            return res.status(400).json({ error: `Требуется уровень ${getItemMinLevel(item)}` });
        }

        const equiped = db
            .select({
                inventoryItem: inventoryItems,
                item: items
            })
            .from(inventoryItems)
            .innerJoin(items, eq(items.id, inventoryItems.itemType))
            .where(and(
                eq(inventoryItems.playerId, player.id),
                eq(inventoryItems.equiped, true)
            ))
            .all()

        let partyId: number | null = null;
        db.transaction(() => {
        partyId = invalidatePartyReady(player.id);
        for (const row of equiped) {
            if (row.item.type === item.type) {
                db.update(inventoryItems)
                    .set({ equiped: false })
                    .where(eq(inventoryItems.id, row.inventoryItem.id))
                    .run()
            }
        }

        // Надеваем новый предмет
        db.update(inventoryItems)
            .set({ equiped: true })
            .where(eq(inventoryItems.id, inventoryItem.id))
            .run()

        if (item.type === "weapon") {
            db.update(players).set({ tutorialStep: "complete" })
                .where(and(eq(players.id, player.id), eq(players.tutorialStep, "equip"))).run();
        }

        });

        if (partyId !== null) publishGroup(partyId);
        const update = db.select().from(inventoryItems).where(eq(inventoryItems.playerId, player.id)).all()
        const updatedPlayer = db.select().from(players).where(eq(players.id, player.id)).get()!
        res.json({ player: toPlayerDtoEquipped(updatedPlayer), inventory: update.map(toInventoryItemDto) })
    })


    //Использование предмета(Использование зелек типо) хз робит или нет честно
    app.post("/inventory/use", (req: Request, res: Response) => {
        const player = (req as AuthedRequest).player
        try { assertOutsideCombat(db, player.id); }
        catch { return res.status(409).json({ error: 'Предметы в бою пока недоступны' }); }

        const itemType = parseItemType(req.body);
        if (itemType === null) {
            res.status(400).json({ error: "itemType must be an integer" })
            return
        }

        const inventoryItem = db.select().from(inventoryItems)
            .where(and(
                eq(inventoryItems.playerId, player.id),
                eq(inventoryItems.itemType, itemType)))
            .get()

        if (!inventoryItem || inventoryItem.quantity < 1) {
            res.status(400).json({ error: "item not found is your inventory" })
            return
        }

        const item = db.select().from(items)
            .where(eq(items.id, inventoryItem.itemType))
            .get()

        if (!item || item.type !== "potion") {
            res.status(400).json({ error: "this item cannot be used" })
            return
        }

        if (item.healAmount <= 0) {
            res.status(400).json({ error: "Эффект этого расходника пока недоступен" })
            return
        }

        if (player.level < getItemMinLevel(item)) {
            return res.status(400).json({ error: `Требуется уровень ${getItemMinLevel(item)}` });
        }

        if (player.health >= player.maxHealth) {
            res.status(400).json({ error: "health is already full" })
            return
        }

        // лечим, но не больше максимума
        const newHealth = Math.min(player.maxHealth, player.health + item.healAmount)
        db.update(players).set({ health: newHealth }).where(eq(players.id, player.id)).run()

        // расходуем одну штуку
        if (inventoryItem.quantity - 1 <= 0) {
            db.delete(inventoryItems).where(eq(inventoryItems.id, inventoryItem.id)).run()
        } else {
            db.update(inventoryItems)
                .set({ quantity: inventoryItem.quantity - 1 })
                .where(eq(inventoryItems.id, inventoryItem.id))
                .run()
        }

        const updatedPlayer = db.select().from(players).where(eq(players.id, player.id)).get()!
        const updatedInventory = db.select().from(inventoryItems).where(eq(inventoryItems.playerId, player.id)).all()
        res.json({ player: toPlayerDtoEquipped(updatedPlayer), inventory: updatedInventory.map(toInventoryItemDto) })
    })

    //Снять предмет
    app.post("/inventory/unequip", (req: Request, res: Response) => {
        const player = (req as AuthedRequest).player

        let inventoryItem;
        try {
            assertOutsideCombat(db, player.id);
            inventoryItem = resolveInventoryItem(db, player.id, req.body ?? {});
        } catch (error) {
            res.status(400).json({ error: (error as Error).message });
            return;
        }

        if (!inventoryItem || !inventoryItem.equiped) {
            res.status(400).json({ error: "item is not equipped" })
            return
        }

        const partyId = db.transaction(() => {
            db.update(inventoryItems).set({ equiped: false }).where(eq(inventoryItems.id, inventoryItem.id)).run();
            return invalidatePartyReady(player.id);
        });
        if (partyId !== null) publishGroup(partyId);

        const update = db.select().from(inventoryItems).where(eq(inventoryItems.playerId, player.id)).all()
        const updatedPlayer = db.select().from(players).where(eq(players.id, player.id)).get()!
        res.json({ player: toPlayerDtoEquipped(updatedPlayer), inventory: update.map(toInventoryItemDto) })
    })
}
