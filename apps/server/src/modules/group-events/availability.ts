import { DEFAULT_GROUP_EVENT_CONFIG, type GroupEventConfig, type GroupEventWindowDto } from '@mmobot/shared';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { groupEventWindows, type GroupEventWindowRow } from '../../database/schema.js';
import { nowGameTime, nowGameTimeMs } from '../../shared/time.js';
import { SQUARE_MOBS } from '../mobs/catalogs/square.js';

export class GroupEventError extends Error {
  constructor(message: string, public code = 'GROUP_EVENT_ERROR', public status = 409) { super(message); }
}
// Existing database time is shifted UTC+4. Public event timestamps are actual UTC.
const OFFSET = 4 * 60 * 60 * 1000;
export const eventUtc = (value: string) => new Date(Date.parse(value) - OFFSET).toISOString();
export const eventGameTime = (value: string) => new Date(Date.parse(value) + OFFSET).toISOString();
export const afterGameTime = (ms: number) => new Date(nowGameTimeMs() + ms).toISOString();
export function windowDto(row: GroupEventWindowRow): GroupEventWindowDto {
  const now = nowGameTime();
  return { ...row, startsAt: eventUtc(row.startsAt), endsAt: eventUtc(row.endsAt),
    available: row.enabled && row.startsAt <= now && now < row.endsAt, serverTime: eventUtc(now) };
}
export function currentGroupEvent(): GroupEventWindowDto | null {
  const rows = db.select().from(groupEventWindows).where(eq(groupEventWindows.locationId, 'square')).orderBy(desc(groupEventWindows.startsAt)).all();
  const current = rows.find(r => windowDto(r).available)
    ?? rows.filter(r => r.enabled && r.startsAt > nowGameTime()).at(-1) ?? rows[0];
  return current ? windowDto(current) : null;
}
export function requireWindow(id: number) {
  const row = db.select().from(groupEventWindows).where(eq(groupEventWindows.id, id)).get();
  if (!row || !windowDto(row).available) throw new GroupEventError('Событие сейчас недоступно', 'EVENT_CLOSED');
  return row;
}
export function positiveInt(value: unknown, label = 'ID'): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new GroupEventError(`Некорректный ${label}`, 'INVALID_REQUEST', 400);
  return value;
}
export function requestKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[\w-]{1,100}$/.test(value)) throw new GroupEventError('Обновите состояние и повторите действие', 'INVALID_REQUEST', 400);
  return value;
}
export function validateConfig(input: unknown): GroupEventConfig {
  const c = structuredClone(input ?? DEFAULT_GROUP_EVENT_CONFIG) as GroupEventConfig;
  const fail = () => { throw new GroupEventError('Некорректная конфигурация события', 'INVALID_CONFIG', 400); };
  if (!c || !Array.isArray(c.waves) || c.waves.length < 2 || c.waves.length > 10) fail();
  for (const [i, w] of c.waves.entries()) {
    if (!w || !Array.isArray(w.mobKeys) || w.mobKeys.length !== (i === c.waves.length - 1 ? 1 : 3)) fail();
    for (const key of w.mobKeys) {
      const mob = SQUARE_MOBS.find(m => m.key === key);
      if (!mob || (i === c.waves.length - 1 && mob.rank !== 'boss')) fail();
    }
    for (const n of [w.hpMultiplier, w.damageMultiplier]) if (!Number.isFinite(n) || n < .25 || n > 20) fail();
  }
  if (!Number.isInteger(c.roundSeconds) || c.roundSeconds < 15 || c.roundSeconds > 300 || !Number.isInteger(c.durationMinutes) || c.durationMinutes < 5 || c.durationMinutes > 120) fail();
  if (!c.reward || !Array.isArray(c.reward.loot)) fail();
  for (const n of [c.reward.xp, c.reward.points, c.reward.coins]) if (!Number.isSafeInteger(n) || n < 0 || n > 100000) fail();
  if (c.reward.loot.length > 30) fail();
  for (const item of c.reward.loot) if (!item || !Number.isSafeInteger(item.itemType) || item.itemType < 1 || !Number.isFinite(item.chancePercent) || item.chancePercent < 0 || item.chancePercent > 100) fail();
  return c;
}
