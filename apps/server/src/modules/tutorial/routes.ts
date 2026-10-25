import { TUTORIAL_MOB_ID,TUTORIAL_REWARD_KEY,type TutorialStartResponse } from "@mmobot/shared";
import { and,eq } from "drizzle-orm";
import type { Express } from "express";
import { db } from "../../database/connection.js";
import { toPlayerDtoEquipped } from "../../database/mappers.js";
import { combatSessions,items,locations,mobs,players } from "../../database/schema.js";
import { broadcastLocation,emitToPlayer,moveSocketToLocation } from "../../infrastructure/realtime/socket-server.js";
import { nowGameTime } from "../../shared/time.js";
import { requireAuth,type AuthedRequest } from "../auth/auth.js";
import { expireStaleCombatSessions,getCombatState,startCombat } from "../combat/pve.js";
import { assertOutsideCombat } from "../inventory/store.js";
import { checkLocationAccess } from "../locations/access.js";
import { movePlayer } from "../locations/presence.js";

export function createTutorialRoutes(app: Express): void {
  app.post("/tutorial/start", requireAuth, (req, res) => {
    const original = (req as AuthedRequest).player;
    expireStaleCombatSessions();
    const player = db.select().from(players).where(eq(players.id, original.id)).get()!;
    if (!player.isCreated || !["welcome", "battle"].includes(player.tutorialStep)) {
      return res.status(409).json({ error: "Первое поручение уже завершено или недоступно" });
    }
    const square = db.select().from(locations).where(eq(locations.id, "square")).get();
    if (!square) return res.status(409).json({ error: "Площадь пока недоступна" });
    if (!checkLocationAccess(player, square, res)) return;

    try {
      const state = db.transaction(() => {
        const active = db.select().from(combatSessions).where(and(eq(combatSessions.playerId, player.id), eq(combatSessions.status, "active"))).get();
        if (active?.mobId === TUTORIAL_MOB_ID) {
          return getCombatState(player, active, db.select().from(mobs).where(eq(mobs.id, TUTORIAL_MOB_ID)).get()!);
        }
        assertOutsideCombat(db, player.id);
        if (player.idTheLastAction) throw new Error("Сначала завершите текущее действие");
        const reward = db.select().from(items).where(eq(items.catalogKey, TUTORIAL_REWARD_KEY)).get();
        if (!reward || reward.type !== "weapon") throw new Error("Награда первого поручения пока недоступна");
        db.insert(mobs).values({
          id: TUTORIAL_MOB_ID, name: "Оживший мусорный пакет", description: "Решил стать главным по району. Дворник против.",
          locationId: "square", level: 1, maxHealth: 24, strength: 1, defense: 0,
          pointsReward: 10, coinReward: 10, respawnSeconds: 1, loot: [],
        }).onConflictDoNothing().run();
        db.update(players).set({ tutorialStep: "battle", currentLocationId: "square", health: player.maxHealth, lastRegenTime: nowGameTime() })
          .where(eq(players.id, player.id)).run();
        const fresh = db.select().from(players).where(eq(players.id, player.id)).get()!;
        return startCombat(fresh, db.select().from(mobs).where(eq(mobs.id, TUTORIAL_MOB_ID)).get()!);
      });
      const updated = toPlayerDtoEquipped(db.select().from(players).where(eq(players.id, player.id)).get()!);
      movePlayer(updated, "square");
      moveSocketToLocation(player.id, "square");
      if (player.currentLocationId && player.currentLocationId !== "square") broadcastLocation(player.currentLocationId);
      broadcastLocation("square");
      emitToPlayer(player.id, "player", updated);
      emitToPlayer(player.id, "combatState", state);
      res.json({ player: updated, state } satisfies TutorialStartResponse);
    } catch (error) {
      res.status(409).json({ error: error instanceof Error ? error.message : "Не удалось начать поручение" });
    }
  });

  for (const action of ["skip", "finish"] as const) {
    app.post(`/tutorial/${action}`, requireAuth, (req, res) => {
      const player = (req as AuthedRequest).player;
      if (!player.isCreated) return res.status(409).json({ error: "Сначала создайте персонажа" });
      try { assertOutsideCombat(db, player.id); }
      catch { return res.status(409).json({ error: "Сначала завершите бой" }); }
      if (action === "finish" && player.tutorialStep !== "complete" && player.tutorialStep !== "done") {
        return res.status(409).json({ error: "Сначала выполните поручение и наденьте оружие" });
      }
      db.update(players).set({ tutorialStep: "done" }).where(eq(players.id, player.id)).run();
      const updated = toPlayerDtoEquipped(db.select().from(players).where(eq(players.id, player.id)).get()!);
      emitToPlayer(player.id, "player", updated);
      res.json({ player: updated });
    });
  }
}
