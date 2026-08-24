
import { AuthedRequest } from "./auth.js"
import type { Express, Request, Response } from "express"
import { db, toInventoryItemDto, toItemDto, toPlayerDto } from "./db.js"
import { inventoryItems, items, players } from "./db/schema.js"
import { eq, and,asc } from "drizzle-orm"
import { ItemsResponse } from "@mmobot/shared"

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

        const update = db.select().from(inventoryItems).where(eq(inventoryItems.playerId, player.id)).all()
        res.json({ inventory: update.map(toInventoryItemDto) })
    })


    //Использование предмета(Использование зелек типо) хз робит или нет честно
    app.post("/inventory/use", (req: Request, res: Response) => {
        const player = (req as AuthedRequest).player

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
        res.json({ player: toPlayerDto(updatedPlayer), inventory: updatedInventory.map(toInventoryItemDto) })
    })

    //Снять предмет
    app.post("/inventory/unequip", (req: Request, res: Response) => {
        const player = (req as AuthedRequest).player

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

        if (!inventoryItem || !inventoryItem.equiped) {
            res.status(400).json({ error: "item is not equipped" })
            return
        }

        db.update(inventoryItems)
            .set({ equiped: false })
            .where(eq(inventoryItems.id, inventoryItem.id))
            .run()

        const update = db.select().from(inventoryItems).where(eq(inventoryItems.playerId, player.id)).all()
        res.json({ inventory: update.map(toInventoryItemDto) })
    })
}