import type { EnterLocationResponse,LocationActionRequest,LocationActionResponse,LocationsResponse } from "@mmobot/shared";
import { and,asc,desc,eq,sql } from "drizzle-orm";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../../database/connection.js";
import { toEventDto,toInventoryItemDto,toLocationDto,toPlayerDto } from "../../database/mappers.js";
import { events,inventoryItems,locations,players } from "../../database/schema.js";
import { broadcastLocation,moveSocketToLocation } from "../../infrastructure/realtime/socket-server.js";
import { nowGameTime } from "../../shared/time.js";
import { requireAuth,type AuthedRequest } from "../auth/auth.js";
import { grantItems } from "../inventory/store.js";
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
    itemTypes: number[];
    dropChance: number;
    xp: number;
    points: number;
    eventType: string;
    message: (locationName: string) => string;
  }> = {
    fight: {
      itemTypes: [],
      dropChance: 0,
      xp: 0,
      points: 2,
      eventType: "fight",
      message: (name) => `Вы сразились с мобами: ${name}.`
    },
    walk: {
      itemTypes: [1, 2, 3],
      dropChance: 0.1,
      xp: 2,
      points: 1,
      eventType: "walk",
      message: (name) => `Вы прогулялись по локации: ${name}.`
    }
  }

  // Антифарм: минимальная пауза между действиями одного игрока.
  // Без этого спам "walk" даёт бесконечные XP/points/лут.
  const ACTION_COOLDOWN_MS = 2000;
  const lastPlayerActionAt = new Map<number, number>();

  app.post("/locations/:id/action", requireAuth, (req, res) => {
    const player = (req as AuthedRequest).player;
    const body = req.body as LocationActionRequest;

    const action = locationActions[body.actionId];
    if (!action) {
      res.status(400).json({ error: "Unknown action" });
      return;
    }

    const nowMs = Date.now();
    const lastAt = lastPlayerActionAt.get(player.id) ?? 0;
    if (nowMs - lastAt < ACTION_COOLDOWN_MS) {
      res.status(429).json({ error: "Слишком часто, подождите немного" });
      return;
    }
    lastPlayerActionAt.set(player.id, nowMs);

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

    const now = nowGameTime();
    db.transaction((tx) => {
      if (action.itemTypes.length > 0 && Math.random() < action.dropChance) { // Выдача предмета
        const itemType = action.itemTypes[Math.floor(Math.random() * action.itemTypes.length)];
        grantItems(tx, player.id, itemType, 1, now);
        progressQuests(player.id, "collect", itemType)
      }

      if (body.actionId === "walk") {
        progressQuests(player.id, "walk", location.id)
      }

      tx.update(players)
        .set({ points: sql`${players.points} + ${action.points}`, lastSeenAt: now })
        .where(eq(players.id, player.id))
        .run()

      addXpForPlayer(player.id, action.xp) // начислить опыт за выполненно действие

      tx.insert(events).values({ playerId: player.id, locationId: location.id, type: action.eventType, createdAt: now }).run();
    });

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
      message: action.message(location.name),
      player: toPlayerDto(updatedPlayer),
      inventory: inventory.map(toInventoryItemDto),
      event: toEventDto(event)
    };

    broadcastLocation(location.id)

    res.json(response);
  })
  
  // Получить онлайн игроков для выбора противника в ПвП.
  // Онлайн определяется наличием активных сокетов у игрока (isPlayerOnline),
  // самого себя из списка исключаем.
}
