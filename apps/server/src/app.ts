import { and, asc, desc, eq, sql } from "drizzle-orm";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url"
import type {
  AuthRequest,
  AuthResponse,
  CombatActionRequest,
  CombatActionResponse,
  CombatStartRequest,
  EnterLocationResponse,
  LeaderBoardResponse,
  LocationActionRequest,
  LocationActionResponse,
  LocationStateResponse,
  LocationsResponse,
  MeResponse
} from "@mmobot/shared"
import { createSessionToken, requireAdmin, requireAuth, validateTelegramInitData, type AuthedRequest } from "./auth.js";
import { getCombatState, isMobAlive, moveCombatAction, startCombat, usePotion } from "./combat.js";
import { config } from "./config.js";
import { db, initializeDatabase, toEventDto, toInventoryItemDto, toLocationDto, toPlayerDto, toMobDto, toPlayerDtoEquipped } from "./db.js";
import { combatSessions, events, inventoryItems, locations, players, mobs } from "./db/schema.js";
import { getPlayersInLocation, hydratePresenceFromDatabase, movePlayer } from "./presence.js";

import { createMobRoutes } from "./mobs.js";
import { createItemRoutes } from "./items.js";
import { createQuestRoutes, progressQuests } from "./quests.js";
import { buildLocationState } from "./state.js";

import { broadcastLocation, emitToPlayer, moveSocketToLocation } from "./realTime.js";
import { InventoryRoutes } from "./inventory.js";
import { addXpForPlayer } from "./level.js";
import { nowGameTime } from "./time.js";

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

  //Мобы
  app.use("/mobs", requireAuth, requireAdmin)
  createMobRoutes(app)

  //Предметы
  app.use("/items", requireAuth, requireAdmin)
  createItemRoutes(app)

  //Инвентарь
  app.use("/inventory",requireAuth)
  InventoryRoutes(app)

  //Квесты
  app.use("/quests", requireAuth)
  createQuestRoutes(app)

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
      const now = nowGameTime();
      const name = telegramUser.username || [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ") || `Player ${telegramUser.id}`;

      db.insert(players)
        .values({ id: telegramUser.id, name, createdAt: now, lastSeenAt: now })
        .onConflictDoUpdate({ target: players.id, set: { name, lastSeenAt: now } })
        .run();

      const player = db.select().from(players).where(eq(players.id, telegramUser.id)).get()!;
      const response: AuthResponse = {
        token: createSessionToken(player.id),
        player: toPlayerDtoEquipped(player)
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
      player: toPlayerDtoEquipped(player),
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
      .set({ currentLocationId: location.id, lastSeenAt: nowGameTime() })
      .where(eq(players.id, player.id))
      .run();
    const updatedPlayer = db.select().from(players).where(eq(players.id, player.id)).get()!;
    movePlayer(toPlayerDto(updatedPlayer), location.id);

    moveSocketToLocation(player.id, location.id)
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

    const now = nowGameTime();
    db.transaction((tx) => {
      if (action.itemTypes.length > 0 && Math.random() < action.dropChance) { // Выдача предмета
        const itemType = action.itemTypes[Math.floor(Math.random() * action.itemTypes.length)];
        tx.insert(inventoryItems)
          .values({ playerId: player.id, itemType, quantity: 1, acquiredAt: now })
          .onConflictDoUpdate({
            target: [inventoryItems.playerId, inventoryItems.itemType],
            set: { quantity: sql`${inventoryItems.quantity} + 1`, acquiredAt: now }
          })
          .run()
        progressQuests(player.id, "collect", itemType)
      }

      if (body.actionId === "walk") {
        progressQuests(player.id, "walk")
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
  });

  // === БОЁВКА ===

  // НАЧАТЬ БОЙ
  app.post("/combat/start", requireAuth, (req, res) => {
    const player = (req as AuthedRequest).player;
    const body = req.body as CombatStartRequest;

    // 1. Моб существует? (mobId приходит строкой из JSON, а id в БД — число)
    const mob = db.select().from(mobs).where(eq(mobs.id, Number(body.mobId))).get();
    if (!mob) {
      res.status(404).json({ error: "Mob not found" });
      return;
    }

    // 2. Игрок в той же локации, что и моб?
    if (player.currentLocationId !== mob.locationId) {
      res.status(409).json({ error: "Enter this location before fighting" });
      return;
    }

    // 3. Нет ли уже активного боя? (уникальный индекс и так не даст дубль,
    //    но лучше вернуть понятную ошибку заранее)
    const active = db
      .select()
      .from(combatSessions)
      .where(and(
        eq(combatSessions.playerId, player.id),
        eq(combatSessions.status, "active")
      ))
      .get();
    if (active) {
      res.status(409).json({ error: "You already have an active combat" });
      return;
    }

    // 4. Моб не в респауне?
    if (!isMobAlive(mob)) {
      res.status(409).json({ error: "This mob is defeated, come back later" });
      return;
    }

    // 5. Игрок жив? После поражения HP = 0, регенерация вернёт его постепенно.
    if (player.health <= 0) {
      res.status(409).json({ error: "Восстановите здоровье перед боем" });
      return;
    }

    // 6. Начинаем бой
    const state = startCombat(player, mob)

    emitToPlayer(player.id, "combatState", state)

    res.json(state)
  });

// СДЕЛАТЬ ХОД: POST /combat/action  (action: "attack" | "flee" | "use")
    app.post("/combat/action", requireAuth, (req, res) => {
      const player = (req as AuthedRequest).player;
      const body = req.body as CombatActionRequest;

      // 1. Есть ли активная сессия боя у игрока?
      const session = db
        .select()
        .from(combatSessions)
        .where(and(
          eq(combatSessions.playerId, player.id),
          eq(combatSessions.status, "active")))
        .get()

      if (!session) {
        res.status(409).json({ error: "No active combat" });
        return;
      }

      // 2. Берём моба из сессии
      const mob = db.select().from(mobs).where(eq(mobs.id, session.mobId)).get();
      if (!mob) {
        res.status(404).json({ error: "Mob not found" });
        return;
      }

      // 3. Совершаем ход: внутри обновляются HP, инвентарь, очки и события
      //    use — выпить зелье в бою, остальное — обычные ходы
      const state = body.action === "use"
        ? usePotion(player, Number(body.itemType), session, mob)
        : moveCombatAction(player, mob, session, body.action);

      if (!state) {
        res.status(400).json({ error: "Нет такого зелья в инвентаре" });
        return;
      }

    // 4. Перечитываем игрока и инвентарь из БД — они могли измениться после боя
    //    (лут, очки, HP), поэтому отдаём клиенту свежие данные.
    const updatedPlayer = db.select().from(players).where(eq(players.id, player.id)).get()!
    const inventory = db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.playerId, player.id))
      .orderBy(desc(inventoryItems.acquiredAt))
      .all();

    emitToPlayer(player.id, "combatState", state)
    emitToPlayer(player.id, "player", toPlayerDto(updatedPlayer))
    emitToPlayer(player.id, "inventory", inventory.map(toInventoryItemDto))
    broadcastLocation(mob.locationId)

    res.json({
      state,
      player: toPlayerDtoEquipped(updatedPlayer),
      inventory: inventory.map(toInventoryItemDto)
    } satisfies CombatActionResponse);
  });
  
  // ТЕКУЩЕЕ СОСТОЯНИЕ БОЯ: GET /combat/state
  // НЕ для поллинга! Актуальное состояние клиент получает через socket-событие
  // "combatState" (см. realTime.ts / emitToPlayer). Этот роут нужен только один раз:
  // при открытии экрана боя или после переподключения сокета.
  app.get("/combat/state", requireAuth, (req, res) => {
    const player = (req as AuthedRequest).player;

    // 1. Есть ли активная сессия?
    const session = db
      .select()
      .from(combatSessions)
      .where(and(
        eq(combatSessions.playerId, player.id),
        eq(combatSessions.status, "active")))
      .get()
    if (!session || session.status !== "active") {
      res.status(404).json({ error: "No active combat" });
      return;
    }

    // 2. Берём моба и возвращаем текущее состояние
    const mob = db.select().from(mobs).where(eq(mobs.id, session.mobId)).get()!;
    res.json(getCombatState(player, session, mob));
  });



  app.get("/leaderboard", requireAuth, (_req, res) => {
    const leaders = db.select().from(players)
      .orderBy(desc(players.points))
      .limit(10)
      .all()

    const response: LeaderBoardResponse = {
      entries: leaders.map((p) => ({ player: toPlayerDto(p), points: p.points }))
    }
    res.json(response)
  })

  serveClient(app);
  
  return app;
}

function serveClient(app: express.Express): void {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(currentDir, "../../client/dist");

  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => { //объяснить это вообще что и зачем
    const isApiPath =
      req.path === "/health" ||
      req.path === "/auth" ||
      req.path === "/me" ||
      req.path.startsWith("/locations") ||
      req.path.startsWith("/mobs") ||
      req.path.startsWith("/quests") ||
      req.path.startsWith("/combat");
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
