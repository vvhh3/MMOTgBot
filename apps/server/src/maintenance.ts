import { and, eq, lt, or } from "drizzle-orm";
import { db } from "./db.js";
import { events, trades } from "./db/schema.js";
import { nowGameTimeMs } from "./time.js";
import { expireStaleCombatSessions } from "./combat.js";
import { expireStalePvpSessions } from "./pvp.js";

// Сколько дней хранить журнал событий. buildLocationState читает events
// при каждом запросе, поэтому таблица не должна расти бесконечно.
const EVENTS_RETENTION_DAYS = 7;

// Сколько минут может висеть незавершённый обмен (приглашение или открытое окно).
// Если игрок закрыл приложение и не ответил — трейд отменяется автоматически.
const TRADE_STALE_MINUTES = 30;

// Как часто запускать обслуживание
const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000; // 1 час

export function cleanupOldEvents(): void {
  const cutoff = new Date(nowGameTimeMs() - EVENTS_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const result = db.delete(events).where(lt(events.createdAt, cutoff)).run();
  if (result.changes > 0) {
    console.log(`[maintenance] deleted ${result.changes} old event(s)`);
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
  cleanupOldEvents();
  cleanupStaleTrades();
  expireStaleCombatSessions();
  expireStalePvpSessions();

  setInterval(() => {
    try {
      cleanupOldEvents();
      cleanupStaleTrades();
      expireStaleCombatSessions();
      expireStalePvpSessions();
    } catch (error) {
      console.error("[maintenance] failed", error);
    }
  }, MAINTENANCE_INTERVAL_MS);
}
