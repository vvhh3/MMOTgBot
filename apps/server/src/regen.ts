import { eq } from "drizzle-orm"
import { db } from "./db.js"
import { players } from "./db/schema.js"


export const RegenHealth = (playerId:number) => {

    const player = db.select().from(players).where(eq(players.id,playerId)).get()
    if(!player)return 0

    const howTimeLastRegen = Date.now() - Date.parse(player.lastRegenTime)
    
    if(howTimeLastRegen < 10000) return player.health
    let health = Math.floor(howTimeLastRegen / 10000 )

    const newHealth = Math.min(player.maxHealth, player.health + health)
    db.update(players).set({health: newHealth, lastRegenTime: new Date().toISOString()}).run()
    return newHealth
}