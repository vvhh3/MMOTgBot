
import { AuthedRequest } from "./auth.js"
import type { Express, Request, Response } from "express"
import { db, toInventoryItemDto } from "./db.js"
import { inventoryItems, items } from "./db/schema.js"
import { eq, and } from "drizzle-orm"

export const InventoryRoutes = (app: Express) => {

    app.post("/inventory/equip", (req: Request, res: Response) => {
        const player = (req as AuthedRequest).player
        const body = req.body

        const inventoryItem = db.select().from(inventoryItems)
        .where(and(
            eq(inventoryItems.playerId, player.id),
            eq(inventoryItems.itemType, body.itemType)))
            .get()
            
            //Есть ли предмет в инвенторе
        if(!inventoryItem || inventoryItem.quantity < 1){
            res.status(400).json({error: "item not found is your inventory"})
            return
        }

        // получить сам предмет
        const item = db.select().from(items)
        .where(eq(items.id, inventoryItem.itemType))
        .get()

        if(!item || (item.type !== "weapon" && item.type !== "armor")){
            res.status(400).json({error: "not found item"})
            return
        }
        
        const equiped = db.select().from(inventoryItems)
        .where(and(
            eq(inventoryItems.playerId,player.id),
            eq(inventoryItems.equiped, true)
        )).all()

        for(const row of equiped){
            const equipedItem = db.select().from(items).where(eq(items.id, row.itemType)).get()
            if(equipedItem && equipedItem.type === item.type){
                db.update(inventoryItems).set({equiped: false})
                .where(and(
                    eq(inventoryItems.playerId,player.id),
                    eq(inventoryItems.itemType,row.itemType)
                )).run()
            }
        }

        //надеть предмет
        db.update(inventoryItems)
        .set({equiped: true})
        .where(and(
            eq(inventoryItems.playerId,player.id),
            eq(inventoryItems.itemType, inventoryItem.itemType)
        )).run()

        const update = db.select().from(inventoryItems).where(eq(inventoryItems.playerId,player.id)).all()
        res.json({inventory: update.map(toInventoryItemDto)})
    })


}