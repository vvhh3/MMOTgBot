import { BattleError } from '../combat/battle/state.js';
import type { Express, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { groupEventRuns, eventPartyMembers } from '../../database/schema.js';
import { requireAuth, type AuthedRequest } from '../auth/auth.js';
import { GroupEventError, positiveInt } from './availability.js';
import { createParty, mutateParty } from './parties.js';
import { actInGroupRun, expireGroupEvents, leaveGroupRun, startGroupRun } from './runs.js';
import { groupOverview, groupRunDto } from './state.js';
import { publishGroup } from './updates.js';

export function groupHandler(handler: (req: Request, res: Response, playerId: number) => unknown) {
  return (req: Request, res: Response) => {
    try {
      for (const id of expireGroupEvents()) publishGroup(id);
      return handler(req, res, (req as AuthedRequest).player.id);
    } catch (error) {
      if (error instanceof GroupEventError) return res.status(error.status).json({ error: error.message, code: error.code });
      if (error instanceof BattleError) return res.status(error.status).json({ error: error.message });
      throw error;
    }
  };
}
export function createGroupEventRoutes(app: Express) {
  app.use('/group-events', requireAuth); app.use('/event-parties', requireAuth); app.use('/group-event-runs', requireAuth);
  app.get('/group-events/me', groupHandler((_req, res, playerId) => res.json(groupOverview(playerId))));
  app.post('/group-events/:id/parties', groupHandler((req, res, playerId) => {
    const partyId = createParty(playerId, positiveInt(Number(req.params.id)), positiveInt(req.body?.targetId), req.body?.requestId, req.body?.slot);
    publishGroup(partyId); return res.status(201).json(groupOverview(playerId));
  }));
  for (const action of ['invite','respond','ready','leave','remove'] as const) {
    app.post(`/event-parties/:id/${action}`, groupHandler((req, res, playerId) => {
      const partyId = mutateParty(playerId, positiveInt(Number(req.params.id)), action, req.body ?? {});
      publishGroup(partyId);
      if (action === 'respond') {
        for (const otherId of new Set(db.select().from(eventPartyMembers).where(eq(eventPartyMembers.playerId, playerId)).all().map(m => m.partyId))) if (otherId !== partyId) publishGroup(otherId);
      }
      return res.json(groupOverview(playerId));
    }));
  }
  app.post('/event-parties/:id/start', groupHandler((req, res, playerId) => {
    const run = startGroupRun(playerId, positiveInt(Number(req.params.id)));
    publishGroup(run.partyId); return res.json(groupOverview(playerId));
  }));
  app.get('/group-event-runs/:id', groupHandler((req, res, playerId) => {
    const run = db.select().from(groupEventRuns).where(eq(groupEventRuns.id, positiveInt(Number(req.params.id)))).get();
    if (!run) throw new GroupEventError('Прохождение не найдено', 'RUN_NOT_FOUND', 404);
    return res.json(groupRunDto(run, playerId));
  }));
  app.post('/group-event-runs/:id/actions', groupHandler((req, res, playerId) => {
    const run = actInGroupRun(playerId, positiveInt(Number(req.params.id)), req.body ?? {});
    publishGroup(run.partyId); return res.json(groupOverview(playerId));
  }));
  app.post('/group-event-runs/:id/leave', groupHandler((req, res, playerId) => {
    const run = leaveGroupRun(playerId, positiveInt(Number(req.params.id)));
    publishGroup(run.partyId); return res.json(groupOverview(playerId));
  }));
}
