import type { CombatLogEntry, CombatStateResponse } from "@mmobot/shared";
import { db, toMobDto, toPlayerDto } from "./db.js";
import { combatSessions, events, inventoryItems, players } from "./db/schema.js";
import type { CombatSessionRow, MobRow, PlayerRow } from "./db/schema.js";
import { movePlayer } from "./presence.js";
import { eq, sql } from "drizzle-orm";

// когда моб "мёртв" до респауна: mobId -> время (мс), когда он снова появится
const mobRespawnUntil = new Map<number, number>();

// лог боя по сессиям (хранится в памяти, в БД его нет)
const combatSessionsLogs = new Map<number, CombatLogEntry[]>();

// рандомный урон
function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function startCombat(player: PlayerRow, mob: MobRow): CombatStateResponse {
    const now = new Date().toISOString();

    const result = db.insert(combatSessions).values({
        playerId: player.id,
        mobId: mob.id,
        playerHealth: player.health,
        mobHealth: mob.maxHealth,
        status: "active",
        startedAt: now,
        lastActionAt: now
    }).run();

    const log: CombatLogEntry[] = [{ text: `Вы начали бой с ${mob.name}`, at: now }];
    combatSessionsLogs.set(Number(result.lastInsertRowid), log);

    return buildCombatState(mob, player, mob.maxHealth, "active", log);
}

export function moveCombatAction(
    player: PlayerRow,
    mob: MobRow,
    session: CombatSessionRow,
    action: "attack" | "flee"
): CombatStateResponse {
    const now = new Date().toISOString();
    const log = combatSessionsLogs.get(session.id) ?? [];

    let playerHp = session.playerHealth;
    let mobHp = session.mobHealth;
    let status = session.status;

    if (action === "attack") {
        const dmgToMob = Math.max(1, player.strength + randomInt(0, player.strength) - mob.defense);
        mobHp = Math.max(0, mobHp - dmgToMob);
        log.push({ text: `Вы нанесли ${dmgToMob} урона ${mob.name}`, at: now });

        if (mobHp > 0) {
            const dmgToPlayer = Math.max(1, mob.strength + randomInt(0, mob.strength) - player.defense);
            playerHp = Math.max(0, playerHp - dmgToPlayer);
            log.push({ text: `${mob.name} нанёс вам ${dmgToPlayer} урона`, at: now });
            if (playerHp <= 0) {
                status = "defeat";
            }
        } else {
            status = "victory";
        }
    } else if (action === "flee") {
        if (Math.random() < 0.5) {
            status = "fled";
            log.push({ text: "Вы убежали с поля боя", at: now });
        } else {
            const dmgToPlayer = Math.max(1, mob.strength - player.defense);
            playerHp = Math.max(0, playerHp - dmgToPlayer);
            log.push({ text: `Побег не удался, ${mob.name} наносит ${dmgToPlayer} урона`, at: now });
            if (playerHp <= 0) {
                status = "defeat";
            }
        }
    }

    db.update(combatSessions)
        .set({ playerHealth: playerHp, mobHealth: mobHp, status, lastActionAt: now })
        .where(eq(combatSessions.id, session.id))
        .run();

    db.update(players)
        .set({ health: playerHp })
        .where(eq(players.id, player.id))
        .run();

    if (status === "victory" || status === "defeat") {
        endCombatSession(status, player, mob, session.id);
    }

    return buildCombatState(mob, player, mobHp, status, log);
}

function endCombatSession(status: "victory" | "defeat", player: PlayerRow, mob: MobRow, sessionId: number): void {
    const now = new Date().toISOString();

    if (status === "victory") {
        // кладём каждый предмет из лута моба в инвентарь (quantity растёт, дубли не создаются)
        for (const item of mob.loot) {
            db.insert(inventoryItems)
                .values({ playerId: player.id, itemType: item, quantity: 1, acquiredAt: now })
                .onConflictDoUpdate({ // Если уже существует строка с таким же playerId + itemType, не создавать новую строку, а обновить существующую
                    target: [inventoryItems.playerId, inventoryItems.itemType],
                    set: { quantity: sql`${inventoryItems.quantity} + 1`, acquiredAt: now }
                })
                .run();
        }

        db.update(players)
            .set({ points: sql`${players.points} + ${mob.pointsReward}` })
            .where(eq(players.id, player.id))
            .run();

        db.insert(events)
            .values({ playerId: player.id, locationId: mob.locationId, type: "kill", createdAt: now })
            .run();

        markMobDead(mob);
    } else {

        db.update(players)
            .set({
                health: 0,
                currentLocationId: "square",
                lastSeenAt: now
            })
            .where(eq(players.id, player.id))
            .run();

        db.insert(events)
            .values({ playerId: player.id, locationId: mob.locationId, type: "death", createdAt: now })
            .run();

        db.delete(combatSessions).where(eq(combatSessions.id, sessionId)) // удалить запись по окончанию битвы
        // телепортируем игрока на стартовую локацию ("square" из сида)
        movePlayer(toPlayerDto({ ...player, currentLocationId: "square" }), "square");
    }
}

// Отдаёт текущее состояние активного боя для опроса клиентом
// (клиент периодически дёргает GET /combat/state, чтобы видеть актуальные HP).
export function getCombatState(player: PlayerRow, session: CombatSessionRow, mob: MobRow): CombatStateResponse {
    return buildCombatState(mob, player, session.mobHealth, "active", combatSessionsLogs.get(session.id) ?? []);
}

export function isMobAlive(mob: MobRow): boolean {
    const check = mobRespawnUntil.get(mob.id)
    return !check || Date.now() >= check // !check - если моб = undefined то true, Date.now() >= check - возродился ли моб или нет ещё
}

function markMobDead(mob: MobRow): void {
    mobRespawnUntil.set(mob.id, Date.now() + mob.respawnSeconds * 1000);
}

function buildCombatState(
    mob: MobRow,
    player: PlayerRow,
    mobHp: number,
    status: CombatStateResponse["status"],
    log: CombatLogEntry[]
): CombatStateResponse {
    return {
        mob: toMobDto(mob),
        playerHp: player.health,
        playerMaxHp: player.maxHealth,
        mobHp,
        mobMaxHp: mob.maxHealth,
        status,
        log
    };
}


