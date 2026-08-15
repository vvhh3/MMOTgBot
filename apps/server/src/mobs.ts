
import type { Express, Request, Response } from "express";
import { db, toMobDto } from "./db.js";
import { locations, mobs } from "./db/schema.js";
import { asc, eq } from "drizzle-orm";
import { MobResponse, MobsResponse, MobUpdateRequest } from "@mmobot/shared";

export const createMobRoutes = async (app: Express) => {

    // получить всех мобов
    app.get("/mobs", (req: Request, res: Response) => {
        const state = db.select().from(mobs).orderBy(asc(mobs.level)).all() // что за asc - оператор для сортировки по возрастанию
        const response: MobsResponse = { mobs: state.map(toMobDto) } // почему именно так - для того что бы клиент получал готовый dto формат, а не сырые данные которые отдаёт drizle
        res.json(response)
    })

    //получить моба по id
    app.get("/mobs/:id", (req: Request, res: Response) => {
        const mob = db.select().from(mobs).where(eq(mobs.id, Number(req.params.id))).get()
        if (!mob) {
            res.status(400).json({ error: "Mob not found" })
            return
        }
        const response: MobResponse = { mob: toMobDto(mob) }
        res.json(response)
    })


    //создание моба
    app.post("/mobs", (req: Request, res: Response) => {
        const state = req.body

        if (!state.name || 
            !state.description || 
            !state.level || 
            !state.maxHealth ||  
            !state.strength|| 
            !state.defense ||
            !state.loot || 
            !state.pointsReward||
            !state.locationId|| 
            !state.respawnSeconds) {
            res.status(400).json({ error: "Data is failid" })
            return
        }

        const location = db.select().from(locations).where(eq(locations.id, state.locationId)).get()
        if (!location) {
            res.status(400).json({ error: "not found location(cheeck your location Id)" })
            return
        }

        const create = db.insert(mobs).values({
            name: state.name,
            description: state.description,
            level: state.level,
            maxHealth: state.maxHealth,
            strength: state.strength,
            defense: state.defense,
            loot: state.loot ?? [],
            pointsReward: state.pointsReward,
            locationId: state.locationId,
            respawnSeconds: state.respawnSeconds,
        }).returning().get() // что за returning? и зачем здесь get

        const response: MobResponse = { mob: toMobDto(create) }
        res.status(200).json(response)
    })

    //обновить моба
    app.put("/mobs/:id", (req: Request, res: Response) => {
        const mob = db.select().from(mobs).where(eq(mobs.id, Number(req.params.id))).get()
        if (!mob) {
            res.status(400).json({ error: "mob not found" })
            return
        }
        const state = req.body as MobUpdateRequest

        if (state.locationId) {
            const location = db.select().from(locations).where(eq(locations.id, state.locationId)).get()
            if (!location) {
                res.status(400).json({ error: "location not found" })
                return
            }
        }
        
        const update = db.update(mobs).set({
            name: state.name ?? mob.name,
            description: state.description ?? mob.description,
            level: state.level ?? mob.level,
            maxHealth: state.maxHealth ?? mob.maxHealth,
            strength: state.strength ?? mob.strength,
            defense: state.defense ?? mob.defense,
            loot: state.loot ?? mob.loot,
            pointsReward: state.pointsReward ?? mob.pointsReward,
            locationId: state.locationId ?? mob.locationId,
            respawnSeconds: state.respawnSeconds ?? mob.respawnSeconds,
        }).where(eq(mobs.id,mob.id))
        .returning()
        .get()

        const response: MobResponse = {mob: toMobDto(update)} 
        res.status(200).json(response)
    })

    //удалить моба
    app.delete("/mobs/:id",(req: Request,res: Response ) => {
        const mob = db.select().from(mobs).where(eq(mobs.id,Number(req.params.id))).get()
        if(!mob) {
            res.status(400).json({error: "Mob not found"})
            return
        }

        db.delete(mobs).where(eq(mobs.id,mob.id)).run()
        res.status(200).end() //почему End - отправляет пустой ответ без тела
    })
}

