import { lt } from "drizzle-orm";
import { db } from "./db.js";
import { events } from "./db/schema.js";
import { nowGameTimeMs } from "./time.js";
import { expireStaleCombatSessions } from "./combat.js";

// Сколько дней хранить журнал событий. buildLocationState читает events
// при каждом запросе, поэтому таблица не должна расти бесконечно.
const EVENTS_RETENTION_DAYS = 7;

// Как часто запускать обслуживание
const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000; // 1 час

export function cleanupOldEvents(): void {
  const cutoff = new Date(nowGameTimeMs() - EVENTS_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const result = db.delete(events).where(lt(events.createdAt, cutoff)).run();
  if (result.changes > 0) {
    console.log(`[maintenance] deleted ${result.changes} old event(s)`);
  }
}

// Запускается один раз при старте сервера: чистит старые события,
// завершает зависшие бои и вешает периодический таймер обслуживания.
export function startMaintenance(): void {
  cleanupOldEvents();
  expireStaleCombatSessions();

  setInterval(() => {
    try {
      cleanupOldEvents();
      expireStaleCombatSessions();
    } catch (error) {
      console.error("[maintenance] failed", error);
    }
  }, MAINTENANCE_INTERVAL_MS);
}
