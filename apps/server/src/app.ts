import { and, asc, desc, eq, sql } from "drizzle-orm";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AuthRequest,
  AuthResponse,
  EnterLocationResponse,
  LocationActionRequest,
  LocationActionResponse,
  LocationStateResponse,
  LocationsResponse,
  MeResponse
} from "@mmobot/shared";
import { createSessionToken, requireAuth, validateTelegramInitData, type AuthedRequest } from "./auth.js";
import { config } from "./config.js";
import { db, initializeDatabase, toEventDto, toInventoryItemDto, toLocationDto, toPlayerDto,toMobDto } from "./db.js";
import { events, inventoryItems, locations, players,mobs } from "./db/schema.js";
import { getPlayersInLocation, hydratePresenceFromDatabase, movePlayer } from "./presence.js";

const actions = [
  {
    id: "scavenge",
    label: "Выполнить действие",
    description: "Найти припасы в текущей локации."
  }
] as const;

export function createApp(): express.Express {
  initializeDatabase();
  hydratePresenceFromDatabase();

  const app = express();
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.devBypassAuth || origin === config.clientUrl || config.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      }
    })
  );
  app.use(express.json());

  serveClient(app);

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/auth", (req, res) => {
    const body = req.body as AuthRequest;
    if (!body.initData) {
      res.status(400).json({ error: "initData is required" });
      return;
    }

    try {
      const telegramUser = validateTelegramInitData(body.initData);
      const now = new Date().toISOString();
      const name = telegramUser.username ?? 
      [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ") ??
        `Player ${telegramUser.id}`;

      db.insert(players)
        .values({ id: telegramUser.id, name, createdAt: now, lastSeenAt: now })
        .onConflictDoUpdate({ target: players.id, set: { name, lastSeenAt: now } })
        .run();

      const player = db.select().from(players).where(eq(players.id, telegramUser.id)).get()!;
      const response: AuthResponse = {
        token: createSessionToken(player.id),
        player: toPlayerDto(player)
      };
      res.json(response);
    } catch (error) {
      res.status(401).json({ error: error instanceof Error ? error.message : "Invalid initData" });
    }
  });

  app.get("/me", requireAuth, (req, res) => {
    const player = (req as AuthedRequest).player;
    const inventory = db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.playerId, player.id))
      .orderBy(desc(inventoryItems.acquiredAt))
      .all();

    const response: MeResponse = {
      player: toPlayerDto(player),
      inventory: inventory.map(toInventoryItemDto)
    };
    res.json(response);
  });

  app.get("/locations", requireAuth, (_req, res) => {
    const locationRows = db.select().from(locations).orderBy(asc(locations.name)).all();
    const response: LocationsResponse = { locations: locationRows.map(toLocationDto) };
    res.json(response);
  });

  app.get("/locations/:id/state", requireAuth, (req, res) => {
    const state = buildLocationState(req.params.id);
    if (!state) {
      res.status(404).json({ error: "Location not found" });
      return;
    }

    res.json(state);
  });

  app.post("/locations/:id/enter", requireAuth, (req, res) => {
    const player = (req as AuthedRequest).player;
    const location = db.select().from(locations).where(eq(locations.id, req.params.id)).get();
    if (!location) {
      res.status(404).json({ error: "Location not found" });
      return;
    }

    db.update(players)
      .set({ currentLocationId: location.id, lastSeenAt: new Date().toISOString() })
      .where(eq(players.id, player.id))
      .run();
    const updatedPlayer = db.select().from(players).where(eq(players.id, player.id)).get()!;
    movePlayer(toPlayerDto(updatedPlayer), location.id);

    const response: EnterLocationResponse = {
      player: toPlayerDto(updatedPlayer),
      state: buildLocationState(location.id)!
    };
    res.json(response);
  });

  app.post("/locations/:id/action", requireAuth, (req, res) => {
    const player = (req as AuthedRequest).player;
    const body = req.body as LocationActionRequest;

    if (body.actionId !== "scavenge") {
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

    const now = new Date().toISOString();
    db.transaction((tx) => {
      tx.insert(inventoryItems)
        .values({ playerId: player.id, itemType: "city-supply", quantity: 1, acquiredAt: now })
        .onConflictDoUpdate({
          target: [inventoryItems.playerId, inventoryItems.itemType],
          set: { quantity: sql`${inventoryItems.quantity} + 1`, acquiredAt: now }
        })
        .run();
      tx.update(players)
        .set({ points: sql`${players.points} + 1`, lastSeenAt: now })
        .where(eq(players.id, player.id))
        .run();
      tx.insert(events).values({ playerId: player.id, locationId: location.id, type: "scavenge", createdAt: now }).run();
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
      message: `Вы нашли припасы: ${location.name}.`,
      player: toPlayerDto(updatedPlayer),
      inventory: inventory.map(toInventoryItemDto),
      event: toEventDto(event)
    };
    res.json(response);
  });

  return app;
}

function buildLocationState(locationId: string): LocationStateResponse | null {
  const location = db.select().from(locations).where(eq(locations.id, locationId)).get();
  if (!location) {
    return null;
  }

  const recentEvents = db
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
    .where(eq(events.locationId, locationId))
    .orderBy(desc(events.createdAt), desc(events.id))
    .limit(10)
    .all();
  const locationMobs = db.select().from(mobs).where(eq(mobs.locationId,locationId)).all()// что за eq??

  return {
    location: toLocationDto(location),
    players: getPlayersInLocation(locationId),
    actions: [...actions],
    mobs: locationMobs.map(toMobDto),
    recentEvents: recentEvents.map(toEventDto),
    serverTime: new Date().toISOString()
  };
}

function serveClient(app: express.Express): void {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(currentDir, "../../client/dist");

  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    const isApiPath =
      req.path === "/health" ||
      req.path === "/auth" ||
      req.path === "/me" ||
      req.path.startsWith("/locations");
    if (isApiPath) {
      next();
      return;
    }
    res.sendFile(path.join(clientDist, "index.html"), (error) => {
      if (error) {
        next();
      }
    });
  });
}