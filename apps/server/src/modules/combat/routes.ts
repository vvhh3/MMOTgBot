import type { CombatActionResponse,CombatStartRequest } from "@mmobot/shared";
import { TUTORIAL_MOB_ID } from "@mmobot/shared";
import { and,desc,eq } from "drizzle-orm";
import type express from "express";
import { db } from "../../database/connection.js";
import { toInventoryItemDto,toPlayerDto,toPlayerDtoEquipped } from "../../database/mappers.js";
import { combatSessions,inventoryItems,locations,mobs,players } from "../../database/schema.js";
import { broadcastLocation,emitToPlayer } from "../../infrastructure/realtime/socket-server.js";
import { requireAuth,type AuthedRequest } from "../auth/auth.js";
import { checkLocationAccess } from "../locations/access.js";
import { BattleError,parseBattleRequest } from "./battle/state.js";
import { expireStaleCombatSessions,getCombatState,moveCombatAction } from "./pve.js";

export function createCombatRoutes(app: express.Express): void {
  app.post("/combat/start", requireAuth, (req, res) => {
    const player = (req as AuthedRequest).player;
    const body = req.body as CombatStartRequest;
    if (Number(body?.mobId) === TUTORIAL_MOB_ID) return res.status(409).json({ error: "Начните первое поручение через обучение" });

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
    const location = db.select().from(locations).where(eq(locations.id, mob.locationId)).get()!;
    if (!checkLocationAccess(player, location, res)) return;

    // Encounters are selected by the walk handler, never by a client-supplied mob ID.
    res.status(409).json({ error: 'Встречи с противниками начинаются через прогулку' });
  });

  // СДЕЛАТЬ ХОД: POST /combat/action  (action: "attack" | "flee" | "use")
  app.post("/combat/action", requireAuth, (req, res) => {
    const player = (req as AuthedRequest).player;
    expireStaleCombatSessions();
    let request;
    try { request = parseBattleRequest(req.body); }
    catch (error) { return res.status(400).json({ error: (error as Error).message }); }
    if (req.body.action !== 'attack' && req.body.action !== 'flee' && req.body.action !== 'use') return res.status(400).json({ error: 'Неизвестное действие боя' });
    const session = db.select().from(combatSessions).where(and(eq(combatSessions.id, request.sessionId), eq(combatSessions.playerId, player.id))).get();
    if (!session) return res.status(404).json({ error: 'Бой не найден' });
    const mob = db.select().from(mobs).where(eq(mobs.id, session.mobId)).get();
    if (!mob) return res.status(404).json({ error: 'Моб не найден' });
    let state;
    try { state = moveCombatAction(player, mob, session, req.body.action, request); }
    catch (error) {
      if (error instanceof BattleError) return res.status(error.status).json({ error: error.message });
      throw error;
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

    expireStaleCombatSessions();
    const requestedId = req.query?.sessionId === undefined ? null : Number(req.query.sessionId);
    if (requestedId !== null && (!Number.isSafeInteger(requestedId) || requestedId < 1)) return res.status(400).json({ error: 'Некорректный ID боя' });
    const session = db.select().from(combatSessions).where(and(eq(combatSessions.playerId, player.id),
      requestedId === null ? eq(combatSessions.status, 'active') : eq(combatSessions.id, requestedId))).get();
    if (!session) return res.status(404).json({ error: 'Бой не найден' });

    // 2. Берём моба и возвращаем текущее состояние
    const mob = db.select().from(mobs).where(eq(mobs.id, session.mobId)).get()!;
    res.json(getCombatState(player, session, mob));
  });
}
