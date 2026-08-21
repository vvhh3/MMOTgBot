import { db } from "./db.js"
import { players } from "./db/schema.js"
import { eq, sql } from "drizzle-orm"

const Ex_require = [
    {
        requireXp: 0,
        maxHealth: 10,
        strength: 5,
        defense: 3
    }, {
        requireXp: 100,
        maxHealth: 20,
        strength: 7,
        defense: 5
    }, {
        requireXp: 250,
        maxHealth: 30,
        strength: 10,
        defense: 7
    }, {
        requireXp: 500,
        maxHealth: 30,
        strength: 15,
        defense: 10
    }, {
        requireXp: 1000,
        maxHealth: 40,
        strength: 20,
        defense: 13
    }, {
        requireXp: 1600,
        maxHealth: 45,
        strength: 25,
        defense: 16
    }, {
        requireXp: 2200,
        maxHealth: 50,
        strength: 30,
        defense: 18
    }, {
        requireXp: 3000,
        maxHealth: 55,
        strength: 40,
        defense: 20
    }]

export const getLevelByXp = (xp: number) => {
    let level = 0
    for (const l of Ex_require) {
        if (xp >= l.requireXp) level++
        else break
    }
    return Math.min(level, Ex_require.length)
}

export const addXpForPlayer = (playerId: number, xp: number) => {

    const player = db.select().from(players).where(eq(players.id, playerId)).get()
    if (!player) return 0

    const newXp = player.xp + xp
    const newLevel = getLevelByXp(newXp)
    const levelUps = newLevel - player.level// сколько уровней апнули

    if (levelUps > 0) {
        db.update(players)
            .set({
                maxHealth: sql`${players.maxHealth} + ${Ex_require[newLevel - 1].maxHealth}`,
                strength: sql`${players.strength} + ${Ex_require[newLevel - 1].strength}`,
                defense: sql`${players.defense} + ${Ex_require[newLevel - 1].defense}`
            }).where(eq(players.id, playerId)).run()
    }

    db.update(players).set({ xp: newXp, level: newLevel }).where(eq(players.id, playerId)).run()
    return levelUps
}