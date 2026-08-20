import { eq } from "drizzle-orm"
import { db } from "./db.js"
import { players } from "./db/schema.js"
import { nowGameTime, nowGameTimeMs } from "./time.js"


export const RegenHealth = (playerId:number) => {

    const player = db.select().from(players).where(eq(players.id,playerId)).get()
    if(!player)return 0

    const howTimeLastRegen = nowGameTimeMs() - Date.parse(player.lastRegenTime)
    
    if(howTimeLastRegen < 10000) return player.health
    let health = Math.floor(howTimeLastRegen / 10000 )

    const newHealth = Math.min(player.maxHealth, player.health + health)
    db.update(players).set({health: newHealth, lastRegenTime: nowGameTime()}).run()
    return newHealth
}