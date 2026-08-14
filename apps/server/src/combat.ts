import type {CombatStateResponse,CombatLogEntry,MobDto,PlayerDto} from "@mmobot/shared";
import { db,toMobDto } from "./db.js";
import { combatSessions, mobs, players,inventoryItems } from "./db/schema.js";
import { movePlayer } from "./presence.js";

const COMBAT_TIMEOUT_SECONDS = 60; // если игрок не совершает действий в бою в течение этого времени, бой завершается

const mobRespawnUntil = new Map<number,number>()
const combatSessionsLogs = new Map<number,CombatLogEntry[]>() // логи боя, храниться в памяти 

function randomInt(min: number,max: number): number { // рандомный урон( +1 нужен для того что бы можно было выбить макс урон) 
    return Math.floor(Math.random() * (max - min) + 1) + min
}

const startCombatSessions = async () => {

}


const endCombatSession = async () => {

}