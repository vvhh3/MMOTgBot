import type { CombatStateResponse, CombatLogEntry, MobDto, PlayerDto } from "@mmobot/shared";
import { db, toMobDto } from "./db.js";
import { combatSessions, mobs, players, inventoryItems, PlayerRow, MobRow, CombatSessionRow } from "./db/schema.js";
import { movePlayer } from "./presence.js";
import { eq } from "drizzle-orm";

const COMBAT_TIMEOUT_SECONDS = 60; // если игрок не совершает действий в бою в течение этого времени, бой завершается

const mobRespawnUntil = new Map<number, number>()
const combatSessionsLogs = new Map<number, CombatLogEntry[]>() // логи боя, храниться в памяти 

function randomInt(min: number, max: number): number { // рандомный урон( +1 нужен для того что бы можно было выбить макс урон) 
    return Math.floor(Math.random() * (max - min) + 1) + min
}

export const startCombatSessions = async (player: PlayerRow, mob: MobRow) => {
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
        return buildCombatState(mob, player, mob.health, "active", log)
    } catch (e) {
        return e
    }
}


const buildCombatState = async (
    mob: MobRow,
    player: PlayerRow,
    mobHp: number,
    status: CombatStateResponse["status"],
    log: CombatLogEntry[]) => {
    return {
        mob: toMobDto(mob),
        playerHp: player.health,
        playerMaxHp: player.maxHealth,
        mobHp,
        mobMaxHp: mob.maxHealth,
        status,
        log
    }
}

export const moveCombatAction = async (
    player: PlayerRow,
    mob: MobRow,
    session: CombatSessionRow,
    action: "attack" | "flee") => {
    try {
        const now = new Date().toISOString()
        const log = combatSessionsLogs.get(session.id) ?? []

        let playerHp = session.playerHealth
        let mobHp = session.mobHealth
        let status = session.status

        if (action === 'attack') {
            const dmgToMob = Math.max(1, player.strength + randomInt(0, player.strength) - mob.defense)
            mobHp = Math.max(0, mobHp - dmgToMob)
            log.push({ text: `Вы нанесли ${dmgToMob} урона ${mob.name}`, at: now })

            if (mobHp > 0) {
                const dmgToPlayer = Math.max(1, mob.strength + randomInt(0, mob.strength) - player.defense)
                playerHp = Math.max(0, playerHp - dmgToPlayer)
                log.push({ text: `${mob.name}нанёс вам ${dmgToPlayer} урона`, at: now })
                if (playerHp <= 0) {
                    status = "defeat"
                }
            } else {
                status = 'victory'
            }
        } else if (action === "flee") {
            status = "fled"
            log.push({ text: `Вы убежали с поля боя`, at: now })
        }

        db.update(combatSessions)
            .set({ playerHealth: playerHp, mobHealth: mobHp, status: status, lastActionAt: now })
            .where(eq(combatSessions.id, session.id))
            .run()

        db.update(players)
            .set({ health: playerHp })
            .where(eq(players.id, player.id))
            .run()

        if(status === "victory"){

        }else if(status === "defeat"){

        }

        return buildCombatState(mob, player, mobHp, status, log)
    } catch (e) {
        return e
    }
}

const endCombatSession = async () => {

}