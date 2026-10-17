import { rollLoot } from "./loot.js";
import { grantItems } from "./inventoryStore.js";
import type { CombatLogEntry, CombatStateResponse, ItemDto } from "@mmobot/shared";
import { db, toMobDto, toPlayerDto, toItemDto } from "./db.js";
import { combatSessions, events, inventoryItems, items, players } from "./db/schema.js";
import type { CombatSessionRow, MobRow, PlayerRow } from "./db/schema.js";
import { movePlayer } from "./presence.js";
import { progressQuests } from "./quests.js";
import { nowGameTime, nowGameTimeMs } from "./time.js";
import { eq, sql, and, inArray, lt } from "drizzle-orm";
import { addXpForPlayer } from "./level.js";

// когда моб "мёртв" до респауна: mobId -> время (мс), когда он снова появится
const mobRespawnUntil = new Map<number, number>();

// бой считается заброшенным, если игрок не делал ход дольше этого времени
export const STALE_SESSION_MS = 5 * 60 * 1000;

// Завершает зависшие бои (например, после падения сервера или если игрок
// закрыл приложение посреди боя). Без этого uniqueIndex на playerId навсегда
// блокирует игроку начало нового боя. Вызывается при старте и по таймеру.
export function expireStaleCombatSessions(): void {
  const cutoff = new Date(nowGameTimeMs() - STALE_SESSION_MS).toISOString();
  const stale = db
    .select({ id: combatSessions.id })
    .from(combatSessions)
    .where(and(eq(combatSessions.status, "active"), lt(combatSessions.lastActionAt, cutoff)))
    .all();

  for (const session of stale) {
    db.delete(combatSessions).where(eq(combatSessions.id, session.id)).run();
    combatSessionsLogs.delete(session.id);
  }

  if (stale.length > 0) {
    console.log(`[combat] expired ${stale.length} stale session(s)`);
  }
}

// лог боя по сессиям (хранится в памяти, в БД его нет)
const combatSessionsLogs = new Map<number, CombatLogEntry[]>();

// рандомный урон
function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function startCombat(player: PlayerRow, mob: MobRow): CombatStateResponse {
    const now = nowGameTime();

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

    return buildCombatState(mob, player, player.health, mob.maxHealth, "active", log);
}

export function moveCombatAction(
    player: PlayerRow,
    mob: MobRow,
    session: CombatSessionRow,
    action: "attack" | "flee"
): CombatStateResponse {
    const state = db.transaction(() => {
        const active = db.select().from(combatSessions).where(and(
            eq(combatSessions.id, session.id), eq(combatSessions.playerId, player.id),
            eq(combatSessions.mobId, mob.id), eq(combatSessions.status, "active"),
        )).get();
        if (!active) throw new Error("Бой уже завершён");
        return resolveCombatAction(player, mob, active, action);
    });
    // Публикуем изменения в памяти только после успешной записи хода и награды.
    if (state.status === "active") {
        combatSessionsLogs.set(session.id, state.log);
    } else {
        combatSessionsLogs.delete(session.id);
        if (state.status === "victory") markMobDead(mob);
        if (state.status === "defeat") movePlayer(toPlayerDto({ ...player, currentLocationId: "square" }), "square");
    }
    return state;
}

function resolveCombatAction(
    player: PlayerRow,
    mob: MobRow,
    session: CombatSessionRow,
    action: "attack" | "flee"
): CombatStateResponse {
    const now = nowGameTime();
    const log = [...(combatSessionsLogs.get(session.id) ?? [])];

    let playerHp = session.playerHealth;
    let mobHp = session.mobHealth;
    let status = session.status;

    const statPlayer = getPlayerStats(player)

    if (action === "attack") {
        const dmgToMob = Math.max(1, statPlayer.strength + randomInt(0, statPlayer.strength) - mob.defense);
        mobHp = Math.max(0, mobHp - dmgToMob);
        log.push({ text: `Вы нанесли ${dmgToMob} урона ${mob.name}`, at: now });

        if (mobHp > 0) {
            const dmgToPlayer = Math.max(1, mob.strength + randomInt(0, mob.strength) - statPlayer.defense);
            playerHp = Math.max(0, playerHp - dmgToPlayer);
            log.push({ text: `${mob.name} нанёс вам ${dmgToPlayer} урона`, at: now });
            if (playerHp <= 0) {
                status = "defeat";
                db.update(players).set({idTheLastAction:null}).where(eq(players.id,player.id)).run()
            }
        } else {
            status = "victory";
            db.update(players).set({idTheLastAction:null}).where(eq(players.id,player.id)).run()
        }
    } else if (action === "flee") {
        if (Math.random() < 0.5) {
            status = "fled";
            log.push({ text: "Вы убежали с поля боя", at: now });
            db.update(players).set({idTheLastAction:null}).where(eq(players.id,player.id)).run()
        } else {
            const dmgToPlayer = Math.max(1, mob.strength - statPlayer.defense);
            playerHp = Math.max(0, playerHp - dmgToPlayer);
            log.push({ text: `Побег не удался, ${mob.name} наносит ${dmgToPlayer} урона`, at: now });
            if (playerHp <= 0) {
                status = "defeat";
                db.update(players).set({idTheLastAction:null}).where(eq(players.id,player.id)).run()
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

    const droppedItems = status === "active" ? [] : endCombatSession(status, player, mob, session.id);
    if (status === "victory") {
        log.push({ text: droppedItems.length
            ? `Добыча: ${droppedItems.map((item) => item.name).join(", ")}`
            : "Предметы не выпали", at: now });
    }
    return buildCombatState(mob, player, playerHp, mobHp, status, log, droppedItems);
}

export function usePotion(player: PlayerRow, itemType: number, session: CombatSessionRow, mob: MobRow): CombatStateResponse | null {

    const inventoryPlayer = db.select().from(inventoryItems) // конкретная запись (стек) предмета игрока; undefined, если такого предмета нет 
        .where(and(
            eq(inventoryItems.playerId, player.id),
            eq(inventoryItems.itemType, itemType)
        )).get()

    if (!inventoryPlayer || inventoryPlayer.quantity < 1) {
        return null
    }
    const potion = db.select().from(items)
        .where(eq(items.id, itemType))
        .get()

    if (!potion || potion.type !== "potion" || potion.healAmount <= 0) {
        return null
    }

    const newHealth = Math.min(player.maxHealth, session.playerHealth + potion.healAmount)

    db.update(combatSessions)
        .set({ playerHealth: newHealth, lastActionAt: nowGameTime() })
        .where(eq(combatSessions.id, session.id))
        .run()

    db.update(players)
        .set({ health: newHealth })
        .where(eq(players.id, player.id))
        .run()

    if (inventoryPlayer.quantity - 1 <= 0) {
        db.delete(inventoryItems).where(eq(inventoryItems.id, inventoryPlayer.id)).run()
    } else {
        db.update(inventoryItems)
            .set({ quantity: inventoryPlayer.quantity - 1 })
            .where(eq(inventoryItems.id, inventoryPlayer.id))
            .run()
    }

    const log = combatSessionsLogs.get(session.id) ?? []
    log.push({ text: `Вы выпили ${potion.name} и восстановили ${potion.healAmount} HP`, at: nowGameTime() })
    combatSessionsLogs.set(session.id, log)

    return buildCombatState(mob, player, newHealth, session.mobHealth, "active", log)
}

function endCombatSession(status: "victory" | "defeat" | "fled", player: PlayerRow, mob: MobRow, sessionId: number): ItemDto[] {
    const now = nowGameTime();
    const droppedItems: ItemDto[] = [];

    if (status === "victory") {
        // Один розыгрыш при победе. Выдача, квесты и завершение боя — в транзакции хода.
        for (const item of rollLoot(mob.loot)) {
            grantItems(db, player.id, item, 1, now);
            droppedItems.push(toItemDto(db.select().from(items).where(eq(items.id, item)).get()!));
            progressQuests(player.id, "collect", item);
            progressQuests(player.id, "loot", item);
        }

        addXpForPlayer(player.id, mob.pointsReward) // добавить опыт
        db.update(players)
            .set({
                points: sql`${players.points} + ${mob.pointsReward}`,
                money: sql`${players.money} + ${mob.coinReward}`
            })
            .where(eq(players.id, player.id))
            .run();

        progressQuests(player.id, "kill", mob.id)

        db.insert(events)
            .values({ playerId: player.id, locationId: mob.locationId, type: "kill", createdAt: now })
            .run();

    } else if (status === "defeat") {

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

    }

    // В любом завершившемся бою (победа/поражение/побег) удаляем сессию,
    // чтобы игрок мог начать новый бой (uniqueIndex на playerId не даст дубль)
    db.delete(combatSessions).where(eq(combatSessions.id, sessionId)).run()
    return droppedItems;
}


// Отдаёт текущее состояние активного боя. Используется для разового запроса
// (открытие экрана боя / реконнект) — живые обновления идут через socket "combatState".
export function getCombatState(player: PlayerRow, session: CombatSessionRow, mob: MobRow): CombatStateResponse {
    return buildCombatState(mob, player, session.playerHealth, session.mobHealth, "active", combatSessionsLogs.get(session.id) ?? []);
}

export function isMobAlive(mob: MobRow): boolean {
    const check = mobRespawnUntil.get(mob.id)
    return !check || nowGameTimeMs() >= check // !check - если моб = undefined то true, Date.now() >= check - возродился ли моб или нет ещё
}

function markMobDead(mob: MobRow): void {
    mobRespawnUntil.set(mob.id, nowGameTimeMs() + mob.respawnSeconds * 1000);
}

function buildCombatState(
    mob: MobRow,
    player: PlayerRow,
    playerHp: number,
    mobHp: number,
    status: CombatStateResponse["status"],
    log: CombatLogEntry[],
    droppedItems: ItemDto[] = []
): CombatStateResponse {
    return {
        mob: toMobDto(mob),
        droppedItems,
        playerHp: playerHp,
        playerMaxHp: player.maxHealth,
        mobHp,
        mobMaxHp: mob.maxHealth,
        status,
        log
    }
}


export const getPlayerStats = (player: PlayerRow) => {

    const equiped = db.select().from(inventoryItems)
        .where(and(
            eq(inventoryItems.playerId, player.id),
            eq(inventoryItems.equiped, true)
        )).all()

    const catalog = equiped.length
        ? db.select().from(items).where(inArray(items.id, equiped.map((e) => e.itemType))).all()
        : []

    return {
        strength: player.strength + catalog.reduce((acc, item) => acc + item.damage, 0),
        defense: player.defense + catalog.reduce((acc, item) => acc + item.defense, 0)
    }
}
