import type { CombatStateResponse, CombatLogEntry, MobDto, PlayerDto } from "@mmobot/shared";
import { db, toMobDto } from "./db.js";
import { combatSessions, mobs, players, inventoryItems, PlayerRow, MobRow } from "./db/schema.js";
import { movePlayer } from "./presence.js";

const COMBAT_TIMEOUT_SECONDS = 60; // если игрок не совершает действий в бою в течение этого времени, бой завершается

const mobRespawnUntil = new Map<number, number>()
const combatSessionsLogs = new Map<number, CombatLogEntry[]>() // логи боя, храниться в памяти 

function randomInt(min: number, max: number): number { // рандомный урон( +1 нужен для того что бы можно было выбить макс урон) 
    return Math.floor(Math.random() * (max - min) + 1) + min
}

const startCombatSessions = async (player: PlayerRow, mob: MobRow) => {
    try {
        const now = new Date().toISOString() // зачем именно iso? 

        db.insert(combatSessions).values({
            playerId: player.id,
            mobId: mob.id,
            playerHealth: player.health,
            mobHealth: mob.maxHealth,
            status: "active",
            startedAt: now,
            lastActionAt: now
        }).run()

        const log: CombatLogEntry[] = [{ text: `Вы начали бой с ${mob.name}`, at: now }]
        return buildCombatState(mob,player,mob.health,"active",log)
    } catch (e) {
        return e
    }
}


const buildCombatState = async (mob: MobRow,player: PlayerRow,mobHp: number,status: CombatStateResponse["status"],log: CombatLogEntry[]) => {
    try{
        
    }catch(e){

    }
}

const endCombatSession = async () => {

}