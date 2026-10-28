import type { Express } from 'express';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { groupEventWindows, items } from '../../database/schema.js';
import { requireAdmin, requireAuth } from '../auth/auth.js';
import { nowGameTime } from '../../shared/time.js';
import { eventGameTime, GroupEventError, positiveInt, validateConfig, windowDto } from '../group-events/availability.js';
import { groupHandler } from '../group-events/routes.js';
import { broadcastLocation } from '../../infrastructure/realtime/socket-server.js';
import { expireGroupEvents } from '../group-events/runs.js';
import { publishGroup } from '../group-events/updates.js';

export function createGroupEventAdminRoutes(app: Express) {
  app.use('/admin/group-events', requireAuth, requireAdmin);
  app.get('/admin/group-events', groupHandler((_req, res) => res.json({ windows: db.select().from(groupEventWindows).all().map(windowDto) })));
  for (const method of ['post','patch'] as const) app[method](method === 'post' ? '/admin/group-events' : '/admin/group-events/:id', groupHandler((req, res) => {
    const b = req.body ?? {}, id = method === 'patch' ? positiveInt(Number(req.params.id)) : null;
    if (typeof b.enabled !== 'boolean' || typeof b.startsAt !== 'string' || typeof b.endsAt !== 'string' || !Number.isFinite(Date.parse(b.startsAt)) || !Number.isFinite(Date.parse(b.endsAt))) throw new GroupEventError('Укажите начало и конец события', 'INVALID_REQUEST', 400);
    const startsAt = eventGameTime(b.startsAt), endsAt = eventGameTime(b.endsAt), minLevel = positiveInt(b.minLevel, 'уровень');
    if (startsAt >= endsAt || minLevel > 8) throw new GroupEventError('Проверьте время события и уровень входа', 'INVALID_REQUEST', 400);
    const config = validateConfig(b.config);
    for (const entry of config.reward.loot) if (!db.select().from(items).where(eq(items.id, entry.itemType)).get()) throw new GroupEventError('Предмет награды не существует', 'INVALID_CONFIG', 400);
    db.transaction(() => {
      if (b.enabled && db.select().from(groupEventWindows).where(and(eq(groupEventWindows.enabled, true), id === null ? undefined : ne(groupEventWindows.id, id))).all().some(w => w.startsAt < endsAt && w.endsAt > startsAt)) throw new GroupEventError('В это время уже запланировано событие');
      const values = { locationId: 'square', enabled: b.enabled, startsAt, endsAt, minLevel, config, updatedAt: nowGameTime() };
      if (id === null) db.insert(groupEventWindows).values({ ...values, createdAt: nowGameTime() }).run();
      else {
        if (!db.select().from(groupEventWindows).where(eq(groupEventWindows.id, id)).get()) throw new GroupEventError('Событие не найдено', 'NOT_FOUND', 404);
        db.update(groupEventWindows).set(values).where(eq(groupEventWindows.id, id)).run();
      }
    });
    for (const partyId of expireGroupEvents()) publishGroup(partyId);
    broadcastLocation('square');
    return res.json({ windows: db.select().from(groupEventWindows).all().map(windowDto) });
  }));
}
