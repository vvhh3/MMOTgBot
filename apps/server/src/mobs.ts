
import type { Express, Request, Response } from "express";
import { db, toMobDto } from "./db.js";
import { locations, mobs } from "./db/schema.js";
import { asc, eq } from "drizzle-orm";
import { MobDto, MobResponse, MobsResponse } from "@mmobot/shared";

export const createMobRoutes = (app: Express) => {

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
        const state = req.body as Partial<MobDto>

        const name = typeof state.name === "string" ? state.name.trim() : ""
        const description = typeof state.description === "string" ? state.description.trim() : ""
        const locationId = typeof state.locationId === "string" ? state.locationId.trim() : ""
        const level = Number(state.level)
        const maxHealth = Number(state.maxHealth)
        const strength = Number(state.strength)
        const defense = Number(state.defense)
        const pointsReward = Number(state.pointsReward)
        const respawnSeconds = Number(state.respawnSeconds)
        const loot = Array.isArray(state.loot) ? state.loot.map(Number).filter((n) => Number.isFinite(n)) : []

        if (!name ||
            !description ||
            !locationId ||
            !Number.isInteger(level) || level < 1 ||
            !Number.isInteger(maxHealth) || maxHealth < 1 ||
            !Number.isInteger(strength) || strength < 1 ||
            !Number.isInteger(defense) || defense < 0 ||
            !Number.isInteger(pointsReward) || pointsReward < 0 ||
            !Number.isInteger(respawnSeconds) || respawnSeconds < 1) {
            res.status(400).json({ error: "Invalid data: check that name, description and locationId are filled, level/maxHealth/strength >= 1, defense/pointsReward >= 0, respawnSeconds >= 1" })
            return
        }

        const location = db.select().from(locations).where(eq(locations.id, locationId)).get()
        if (!location) {
            res.status(400).json({ error: "Location not found (check your locationId)" })
            return
        }

        const create = db.insert(mobs).values({
            name: name,
            description: description,
            level: level,
            maxHealth: maxHealth,
            strength: strength,
            defense: defense,
            loot: loot,
            pointsReward: pointsReward,
            locationId: locationId,
            respawnSeconds: respawnSeconds,
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
        const state = req.body as MobDto

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

