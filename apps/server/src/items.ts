
import type { Express, Request, Response } from "express";
import { asc, eq } from "drizzle-orm";
import { ItemResponse, ItemsResponse } from "@mmobot/shared";
import { db, toItemDto } from "./db.js";
import { items } from "./db/schema.js";
import { stat } from "node:fs";
import { error } from "node:console";

export const createItemRoutes = async (app: Express) => {

    // получить все предметы
    app.get("/items", (req: Request, res: Response) => {
        const state = db.select().from(items).orderBy(asc(items.id)).all()
        const response: ItemsResponse = { items: state.map(toItemDto) }
        res.json(response)
    })

    app.get("/items/:id", (req: Request, res: Response) => {
        const state = db.select().from(items).where(eq(items.id, Number(req.params.id))).get()
        if (!state) {
            res.status(400).json({ error: "not found item" })
            return
        }
        const response: ItemResponse = { item: toItemDto(state) }
        res.json(response)
    })

    //создать item
    app.post("/items", (req: Request, res: Response) => {
        const state = req.body

        if (!state.name ||
            !state.description ||
            !state.type ||
            !state.damage ||
            !state.defense ||
            !state.healAmount ||
            !state.price
        ) {
            res.status(400).json({ error: "Data is failid" })
            return
        }

        const create = db.insert(items).values({
            name: state.name,
            description: state.description,
            type: state.type,
            damage: state.damage,
            defense: state.defense,
            healAmount: state.healAmount,
            price: state.price,
        }).returning().get()

        const response: ItemResponse = { item: toItemDto(create) }
        res.status(200).json(response)
    })

    app.put("/items/:id", (req: Request, res: Response) => {
        const item = db.select().from(items).where(eq(items.id, Number(req.params.id))).get()
        if (!item) {
            res.status(400).json({ error: "item not found" })
            return
        }

        const state = req.body

        const update = db.update(items).set({
            name: state.name ?? item.name,
            description: state.description ?? item.description,
            type: state.type ?? item.type,
            damage: state.damage ?? item.damage,
            defense: state.defense ?? item.defense,
            healAmount: state.healAmount ?? item.healAmount,
            price: state.price ?? item.price,
        }).where(eq(items.id, item.id))
            .returning()
            .get()

        const response: ItemResponse = { item: toItemDto(update) }
        res.status(200).json(response)
    })

    //удалить предмет
    app.delete("/items/:id", (req: Request, res: Response) => {
        const mob = db.select().from(items).where(eq(items.id, Number(req.params.id))).get()
        if (!mob) {
            res.status(400).json({ error: "Mob not found" })
            return
        }

        db.delete(items).where(eq(items.id, mob.id)).run()
        res.status(200).end()
    })
}
