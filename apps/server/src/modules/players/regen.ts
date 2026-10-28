import { isInGroupBattle } from '../group-events/participation.js';
import { and,eq,or } from "drizzle-orm";
import { db } from "../../database/connection.js";
import { combatSessions,players,pvpSessions } from "../../database/schema.js";
import { nowGameTime,nowGameTimeMs } from "../../shared/time.js";


export const RegenHealth = (playerId:number) => {

    const player = db.select().from(players).where(eq(players.id,playerId)).get()
    if(!player)return 0

    const pve = db.select().from(combatSessions).where(and(eq(combatSessions.playerId, playerId), eq(combatSessions.status, 'active'))).get();
    const pvp = db.select().from(pvpSessions).where(and(or(eq(pvpSessions.player1Id, playerId), eq(pvpSessions.player2Id, playerId)), eq(pvpSessions.status, 'active'))).get();
    if (pve || pvp || isInGroupBattle(db, playerId)) {
        db.update(players).set({ lastRegenTime: nowGameTime() }).where(eq(players.id, playerId)).run();
        return player.health;
    }
    const howTimeLastRegen = nowGameTimeMs() - Date.parse(player.lastRegenTime)
    
    if(howTimeLastRegen < 10000) return player.health
    let health = Math.floor(howTimeLastRegen / 10000 )

    const newHealth = Math.min(player.maxHealth, player.health + health)
    db.update(players).set({health: newHealth, lastRegenTime: nowGameTime()}).where(eq(players.id, playerId)).run()
    return newHealth
}