import { assertOutsideParty, currentPartyMember } from '../group-events/participation.js';
import { GroupEventError } from '../group-events/availability.js';
import type { CombatStateResponse,EnterLocationResponse,LocationActionRequest,LocationActionResponse,LocationsResponse } from "@mmobot/shared";
import { and,asc,desc,eq,sql } from "drizzle-orm";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../../database/connection.js";
import { toEventDto,toInventoryItemDto,toLocationDto,toPlayerDto } from "../../database/mappers.js";
import { events,inventoryItems,locations,mobs,players } from "../../database/schema.js";
import { broadcastLocation,emitToPlayer,moveSocketToLocation } from "../../infrastructure/realtime/socket-server.js";
import { nowGameTime,nowGameTimeMs } from "../../shared/time.js";
import { requireAuth,type AuthedRequest } from "../auth/auth.js";
import { assertOutsideCombat } from "../inventory/store.js";
import { expireStaleCombatSessions,startCombat } from '../combat/pve.js';
import { BattleError } from '../combat/battle/state.js';
import { chooseEncounter } from '../mobs/balance.js';
import { addXpForPlayer } from "../players/level.js";
import { progressQuests } from "../quests/routes.js";
import { canBypassLocationRestrictions,checkLocationAccess } from "./access.js";
import { movePlayer } from "./presence.js";
import { buildLocationState } from "./state.js";

export function createLocationRoutes(app: express.Express): void {
  app.get("/locations", requireAuth, (req, res) => {
    const locationRows = db.select().from(locations).orderBy(asc(locations.name)).all();
    const response: LocationsResponse = {
      locations: locationRows.map(toLocationDto),
      canBypassRestrictions: canBypassLocationRestrictions((req as AuthedRequest).player),
    };
    res.json(response);
  })

  app.use("/location-images",
    express.static(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../data/location"))
  )

  app.get("/locations/:id/state", requireAuth, (req, res) => {
    const state = buildLocationState(req.params.id);
    if (!state) {
      res.status(404).json({ error: "Location not found" });
      return;
    }
    if (!checkLocationAccess((req as AuthedRequest).player, state.location, res)) return;

    res.json(state);
  });

  app.post("/locations/:id/enter", requireAuth, (req, res) => {
    const player = (req as AuthedRequest).player;
    const location = db.select().from(locations).where(eq(locations.id, req.params.id)).get();
    if (!location) {
      res.status(404).json({ error: "Location not found" });
      return;
    }
    if (!checkLocationAccess(player, location, res)) return;
    if (location.id !== 'square' && currentPartyMember(db, player.id)) return res.status(409).json({ error: 'Сначала выйдите из группы', code: 'PARTY_EXIT_REQUIRED' });

    db.update(players)
      .set({ currentLocationId: location.id, lastSeenAt: nowGameTime() })
      .where(eq(players.id, player.id))
      .run();
    const updatedPlayer = db.select().from(players).where(eq(players.id, player.id)).get()!;
    movePlayer(toPlayerDto(updatedPlayer), location.id);

    moveSocketToLocation(player.id, location.id)
    if (player.currentLocationId && player.currentLocationId !== location.id) {
      broadcastLocation(player.currentLocationId)
    }
    broadcastLocation(location.id)

    progressQuests(player.id, "visit", location.id)

    const response: EnterLocationResponse = {
      player: toPlayerDto(updatedPlayer),
      state: buildLocationState(location.id)!
    };
    res.json(response);
  })

  // Описание действий на локации + награды за действия
  const locationActions: Record<string, {
    xp: number;
    points: number;
    eventType: string;
    message: (locationName: string) => string;
  }> = {
    walk: {
      xp: 2,
      points: 1,
      eventType: "walk",
      message: (name) => `Вы прогулялись по локации: ${name}.`
    }
  }

  // Антифарм: минимальная пауза между действиями одного игрока.
  // Проверяем сохранённое событие: перезапуск не сбрасывает паузу.
  const ACTION_COOLDOWN_MS = 2000;

  app.post("/locations/:id/action", requireAuth, (req, res) => {
    const player = (req as AuthedRequest).player;
    const body = req.body as LocationActionRequest;

    const action = body?.actionId === 'walk' ? locationActions.walk : undefined;
    if (!action) {
      res.status(400).json({ error: "Unknown action" });
      return;
    }

    if (player.currentLocationId !== req.params.id) {
      res.status(409).json({ error: "Enter this location before acting" });
      return;
    }

    const location = db.select().from(locations).where(eq(locations.id, req.params.id)).get();
    if (!location) {
      res.status(404).json({ error: "Location not found" });
      return;
    }
    if (!checkLocationAccess(player, location, res)) return;
    if (!location.actions.includes('walk')) return res.status(409).json({ error: 'Прогулка в этой локации недоступна' });

    const now = nowGameTime();
    let combat: CombatStateResponse | undefined;
    expireStaleCombatSessions();
    try { db.transaction((tx) => {
      const fresh = tx.select().from(players).where(eq(players.id, player.id)).get()!;
      assertOutsideParty(tx, player.id);
      assertOutsideCombat(tx, player.id);
      if (fresh.idTheLastAction) throw new BattleError('Сначала завершите текущее действие');
      if (fresh.health <= 0) throw new BattleError('Восстановите здоровье перед прогулкой');
      const lastWalk = tx.select().from(events).where(and(eq(events.playerId, player.id), eq(events.type, 'walk')))
        .orderBy(desc(events.createdAt), desc(events.id)).limit(1).get();
      if (lastWalk && nowGameTimeMs() - Date.parse(lastWalk.createdAt) < ACTION_COOLDOWN_MS)
        throw new BattleError('Слишком часто, подождите немного', 429);
      const opponent = location.id === 'square' ? chooseEncounter(tx.select().from(mobs).where(eq(mobs.locationId, 'square')).all()) : undefined;
      if (location.id === 'square' && !opponent) throw new BattleError('На Площади пока нет доступных противников');
      progressQuests(player.id, "walk", location.id)

      tx.update(players)
        .set({ points: sql`${players.points} + ${action.points}`, lastSeenAt: now })
        .where(eq(players.id, player.id))
        .run()

      addXpForPlayer(player.id, action.xp) // начислить опыт за выполненно действие

      tx.insert(events).values({ playerId: player.id, locationId: location.id, type: action.eventType, createdAt: now }).run();
      if (opponent) combat = startCombat(tx.select().from(players).where(eq(players.id, player.id)).get()!, opponent);
    }); } catch (error) {
      return res.status(error instanceof BattleError ? error.status : 409).json({ error: error instanceof Error ? error.message : 'Не удалось прогуляться', code: error instanceof GroupEventError ? error.code : undefined });
    }

    const updatedPlayer = db.select().from(players).where(eq(players.id, player.id)).get()!;
    movePlayer(toPlayerDto(updatedPlayer), location.id);

    const inventory = db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.playerId, player.id))
      .orderBy(desc(inventoryItems.acquiredAt))
      .all();
    const event = db
      .select({
        id: events.id,
        playerId: events.playerId,
        playerName: players.name,
        locationId: events.locationId,
        type: events.type,
        createdAt: events.createdAt
      })
      .from(events)
      .innerJoin(players, eq(events.playerId, players.id))
      .where(and(eq(events.playerId, player.id), eq(events.locationId, location.id)))
      .orderBy(desc(events.createdAt), desc(events.id))
      .limit(1)
      .get()!;

    const response: LocationActionResponse = {
      combat,
      message: action.message(location.name),
      player: toPlayerDto(updatedPlayer),
      inventory: inventory.map(toInventoryItemDto),
      event: toEventDto(event)
    };

    broadcastLocation(location.id)
    emitToPlayer(player.id, 'player', response.player);
    emitToPlayer(player.id, 'inventory', response.inventory);
    if (combat) emitToPlayer(player.id, 'combatState', combat);

    res.json(response);
  })
  
  // Получить онлайн игроков для выбора противника в ПвП.
  // Онлайн определяется наличием активных сокетов у игрока (isPlayerOnline),
  // самого себя из списка исключаем.
}
