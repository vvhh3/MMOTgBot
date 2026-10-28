import { expireGroupEvents } from '../modules/group-events/runs.js';
import { publishGroup } from '../modules/group-events/updates.js';
import { broadcastLocation } from '../infrastructure/realtime/socket-server.js';
import { and,eq,inArray,isNull,lt,lte,or,sql } from "drizzle-orm";
import { db } from "../database/connection.js";
import { combatSessions,events,players,pvpSessions,trades } from "../database/schema.js";
import { expireStaleCombatSessions } from "../modules/combat/pve.js";
import { expireStalePvpSessions } from "../modules/combat/pvp.js";
import { nowGameTimeMs } from "../shared/time.js";

// Сколько дней хранить журнал событий. buildLocationState читает events
// при каждом запросе, поэтому таблица не должна расти бесконечно.
export const EVENTS_RETENTION_DAYS = 7;

// Результат, журнал и processedRequests нужны для дочитывания и повторов команд.
// lastActionAt у завершённого боя — время завершения, а не начала боя.
export const FINISHED_BATTLE_RETENTION_MS = 24 * 60 * 60 * 1000;
export const CLEANUP_BATCH_SIZE = 500;
export const CLEANUP_INTERVAL_MS = 60 * 1000;

// Сколько минут может висеть незавершённый обмен (приглашение или открытое окно).
// Если игрок закрыл приложение и не ответил — трейд отменяется автоматически.
// Константа используется и проверкой hasActiveTrade в trades.ts: приглашение
// старше этого порога не считается "активным" и не блокирует новые обмены.
export const TRADE_STALE_MINUTES = 10;

// Как часто запускать обслуживание
const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000; // 1 час
// Тайм-ауты боёв проверяем отдельно от удаления сохранённых результатов.
export const PVP_MAINTENANCE_INTERVAL_MS = 10 * 1000;

export function cleanupOldEvents(): void {
  const cutoff = new Date(nowGameTimeMs() - EVENTS_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const oldIds = db.select({ id: events.id }).from(events)
    .where(lt(events.createdAt, cutoff)).orderBy(events.createdAt, events.id).limit(CLEANUP_BATCH_SIZE);
  const result = db.delete(events).where(inArray(events.id, oldIds)).run();
  if (result.changes > 0) {
    console.log(`[maintenance] deleted ${result.changes} old event(s)`);
  }
}

export function cleanupFinishedBattleSessions(): void {
  const cutoff = new Date(nowGameTimeMs() - FINISHED_BATTLE_RETENTION_MS).toISOString();
  const deleted = db.transaction((tx) => {
    const oldCombatIds = tx.select({ id: combatSessions.id }).from(combatSessions)
      .where(and(inArray(combatSessions.status, ["victory", "defeat", "fled", "aborted"]), lte(combatSessions.lastActionAt, cutoff)))
      .orderBy(combatSessions.lastActionAt, combatSessions.id).limit(CLEANUP_BATCH_SIZE);
    const combat = tx.delete(combatSessions).where(inArray(combatSessions.id, oldCombatIds))
      .returning({ id: combatSessions.id, playerId: combatSessions.playerId }).all();

    const oldPvpIds = tx.select({ id: pvpSessions.id }).from(pvpSessions)
      .where(and(eq(pvpSessions.status, "finished"), or(
        lte(pvpSessions.lastActionAt, cutoff),
        // Старые завершённые приглашения могли не иметь lastActionAt.
        and(isNull(pvpSessions.lastActionAt), lte(pvpSessions.creadetAt, cutoff))
      )))
      .orderBy(pvpSessions.lastActionAt, pvpSessions.id).limit(CLEANUP_BATCH_SIZE);
    const pvp = tx.delete(pvpSessions).where(inArray(pvpSessions.id, oldPvpIds))
      .returning({ id: pvpSessions.id, player1Id: pvpSessions.player1Id, player2Id: pvpSessions.player2Id }).all();

    // Удаление и очистка ссылок атомарны. Не сбрасываем другое занятие игрока,
    // даже если у него совпал числовой ID из другой таблицы.
    const clearAction = (playerIds: number[], type: "TakeAWalk" | "Fight", sessionId: number) => {
      tx.update(players).set({ idTheLastAction: null }).where(and(
        inArray(players.id, playerIds),
        sql`json_extract(${players.idTheLastAction}, '$.type') = ${type}`,
        sql`json_extract(${players.idTheLastAction}, '$.id') = ${sessionId}`
      )).run();
    };
    for (const session of combat) clearAction([session.playerId], "TakeAWalk", session.id);
    for (const session of pvp) clearAction([session.player1Id, session.player2Id], "Fight", session.id);
    return { combat: combat.length, pvp: pvp.length };
  });
  if (deleted.combat || deleted.pvp) {
    console.log(`[maintenance] deleted ${deleted.combat} finished PvE and ${deleted.pvp} finished PvP session(s)`);
  }
}

// Отменяем приглашения/трейды, висящие дольше TRADE_STALE_MINUTES.
// Предметы при этом НЕ возвращаем: при таком флоу они ещё не списаны —
// списание происходит только в момент исполнения обмена (POST /trades/:id/ready).
export function cleanupStaleTrades(): void {
  const cutoff = new Date(nowGameTimeMs() - TRADE_STALE_MINUTES * 60 * 1000).toISOString();
  const result = db.update(trades)
    .set({ status: "cancelled" })
    .where(and(
      lt(trades.createdAt, cutoff),
      or(eq(trades.status, "pending"), eq(trades.status, "open"))
    ))
    .run();
  if (result.changes > 0) {
    console.log(`[maintenance] cancelled ${result.changes} stale trade(s)`);
  }
}

// Запускается один раз при старте сервера: чистит старые события,
// завершает зависшие бои и вешает периодический таймер обслуживания.
export function startMaintenance(): void {
  for (const id of expireGroupEvents()) publishGroup(id);
  cleanupStaleTrades();
  expireStaleCombatSessions();
  expireStalePvpSessions();
  cleanupOldEvents();
  cleanupFinishedBattleSessions();

  setInterval(() => {
    try {
      for (const id of expireGroupEvents()) publishGroup(id);
      broadcastLocation('square');
      expireStaleCombatSessions();
      expireStalePvpSessions();
    } catch (error) {
      console.error("[maintenance] battle expiry failed", error);
    }
  }, PVP_MAINTENANCE_INTERVAL_MS);

  setInterval(() => {
    try {
      cleanupOldEvents();
      cleanupFinishedBattleSessions();
    } catch (error) {
      console.error("[maintenance] cleanup failed", error);
    }
  }, CLEANUP_INTERVAL_MS);

  setInterval(() => {
    try {
      cleanupStaleTrades();
    } catch (error) {
      console.error("[maintenance] trade cleanup failed", error);
    }
  }, MAINTENANCE_INTERVAL_MS);
}
