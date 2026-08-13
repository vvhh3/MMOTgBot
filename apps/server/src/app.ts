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
import {
  db,
  initializeDatabase,
  toEventDto,
  toInventoryItemDto,
  toLocationDto,
  toPlayerDto,
  type EventRow,
  type InventoryItemRow,
  type LocationRow,
  type PlayerRow
} from "./db.js";
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
  app.use(cors({ origin: config.clientUrl }));
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
      const name =
        telegramUser.username ??
        [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ") ??
        `Player ${telegramUser.id}`;

      db.prepare(`
        INSERT INTO players (id, name, level, points, current_location_id, created_at, last_seen_at)
        VALUES (?, ?, 1, 0, NULL, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, last_seen_at = excluded.last_seen_at
      `).run(telegramUser.id, name, now, now);

      const player = db.prepare("SELECT * FROM players WHERE id = ?").get(telegramUser.id) as PlayerRow;
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
      .prepare("SELECT * FROM inventory_items WHERE player_id = ? ORDER BY acquired_at DESC")
      .all(player.id) as InventoryItemRow[];

    const response: MeResponse = {
      player: toPlayerDto(player),
      inventory: inventory.map(toInventoryItemDto)
    };
    res.json(response);
  });

  app.get("/locations", requireAuth, (_req, res) => {
    const locations = db.prepare("SELECT * FROM locations ORDER BY name ASC").all() as LocationRow[];
    const response: LocationsResponse = { locations: locations.map(toLocationDto) };
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
    const location = db.prepare("SELECT * FROM locations WHERE id = ?").get(req.params.id) as LocationRow | undefined;
    if (!location) {
      res.status(404).json({ error: "Location not found" });
      return;
    }

    db.prepare("UPDATE players SET current_location_id = ?, last_seen_at = ? WHERE id = ?").run(
      location.id,
      new Date().toISOString(),
      player.id
    );
    const updatedPlayer = db.prepare("SELECT * FROM players WHERE id = ?").get(player.id) as PlayerRow;
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

    if (player.current_location_id !== req.params.id) {
      res.status(409).json({ error: "Enter this location before acting" });
      return;
    }

    const location = db.prepare("SELECT * FROM locations WHERE id = ?").get(req.params.id) as LocationRow | undefined;
    if (!location) {
      res.status(404).json({ error: "Location not found" });
      return;
    }

    const now = new Date().toISOString();
    db.transaction(() => {
      db.prepare(`
        INSERT INTO inventory_items (player_id, item_type, quantity, acquired_at)
        VALUES (?, 'city-supply', 1, ?)
        ON CONFLICT(player_id, item_type) DO UPDATE SET
          quantity = quantity + 1,
          acquired_at = excluded.acquired_at
      `).run(player.id, now);
      db.prepare("UPDATE players SET points = points + 1, last_seen_at = ? WHERE id = ?").run(now, player.id);
      db.prepare("INSERT INTO events (player_id, location_id, type, created_at) VALUES (?, ?, 'scavenge', ?)").run(
        player.id,
        location.id,
        now
      );
    })();

    const updatedPlayer = db.prepare("SELECT * FROM players WHERE id = ?").get(player.id) as PlayerRow;
    movePlayer(toPlayerDto(updatedPlayer), location.id);

    const inventory = db
      .prepare("SELECT * FROM inventory_items WHERE player_id = ? ORDER BY acquired_at DESC")
      .all(player.id) as InventoryItemRow[];
    const event = db
      .prepare(`
        SELECT events.*, players.name AS player_name
        FROM events
        JOIN players ON players.id = events.player_id
        WHERE events.player_id = ? AND events.location_id = ?
        ORDER BY events.created_at DESC, events.id DESC
        LIMIT 1
      `)
      .get(player.id, location.id) as EventRow;

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
  const location = db.prepare("SELECT * FROM locations WHERE id = ?").get(locationId) as LocationRow | undefined;
  if (!location) {
    return null;
  }

  const recentEvents = db
    .prepare(`
      SELECT events.*, players.name AS player_name
      FROM events
      JOIN players ON players.id = events.player_id
      WHERE events.location_id = ?
      ORDER BY events.created_at DESC, events.id DESC
      LIMIT 10
    `)
    .all(locationId) as EventRow[];

  return {
    location: toLocationDto(location),
    players: getPlayersInLocation(locationId),
    actions: [...actions],
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
