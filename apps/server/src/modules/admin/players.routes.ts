import { and,desc,eq,like,sql } from "drizzle-orm";
import type express from "express";
import { db } from "../../database/connection.js";
import { toPlayerDto } from "../../database/mappers.js";
import { characterSkins,players } from "../../database/schema.js";
import { emitToPlayer } from "../../infrastructure/realtime/socket-server.js";
import { requireAdmin,requireAuth,type AuthedRequest } from "../auth/auth.js";
import { addXpForPlayer } from "../players/level.js";

export function createAdminPlayerRoutes(app: express.Express): void {
  app.get("/admin/players", requireAuth, requireAdmin, (req, res) => {
    const query = String(req.query.q ?? "").trim();
    const numericQuery = Number(query);
    const found = query
      ? Number.isInteger(numericQuery)
        ? db.select().from(players).where(eq(players.id, numericQuery)).limit(30).all()
        : db.select().from(players).where(like(players.name, `%${query}%`)).limit(30).all()
      : db.select().from(players).orderBy(desc(players.id)).limit(30).all();
    res.json({ players: found.map(toPlayerDto) });
  });

  app.patch("/admin/player", requireAuth, requireAdmin, (req, res) => {
    const body = req.body as {
      playerId?: unknown;
      money?: unknown;
      xp?: unknown;
      name?: unknown;
      avatar?: unknown;
    };
    const targetId = body.playerId === undefined ? (req as AuthedRequest).player.id : Number(body.playerId);
    if (!Number.isSafeInteger(targetId) || targetId < 1) {
      res.status(400).json({ error: "Invalid player id" });
      return;
    }
    const target = db.select().from(players).where(eq(players.id, targetId)).get();
    if (!target) {
      res.status(404).json({ error: "Player not found" });
      return;
    }

    const money = body.money ?? 0;
    const xp = body.xp ?? 0;
    if (!Number.isSafeInteger(money) || Number(money) < 0 || Number(money) > 1_000_000_000) {
      res.status(400).json({ error: "Money must be a whole number between 0 and 1000000000" });
      return;
    }
    if (!Number.isSafeInteger(xp) || Number(xp) < 0 || Number(xp) > 1_000_000_000) {
      res.status(400).json({ error: "XP must be a whole number between 0 and 1000000000" });
      return;
    }

    const updates: Partial<typeof players.$inferInsert> = {};
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 20) {
        res.status(400).json({ error: "Name must be between 2 and 20 characters" });
        return;
      }
      updates.name = body.name.trim();
    }
    if (body.avatar !== undefined) {
      const avatar = body.avatar;
      const selectedSkin = typeof avatar === "string"
        ? db.select({ id: characterSkins.id }).from(characterSkins)
            .where(and(eq(characterSkins.imageUrl, avatar), eq(characterSkins.enabled, true)))
            .get()
        : undefined;
      if (!selectedSkin) {
        res.status(400).json({ error: "Invalid avatar" });
        return;
      }
      updates.avatar = avatar as string;
    }

    db.update(players)
      .set({ ...updates, money: sql`${players.money} + ${Number(money)}` })
      .where(eq(players.id, targetId))
      .run();
    if (Number(xp) > 0) addXpForPlayer(targetId, Number(xp));

    const updatedPlayer = db.select().from(players).where(eq(players.id, targetId)).get();
    if (!updatedPlayer) {
      res.status(404).json({ error: "Player not found" });
      return;
    }
    const playerDto = toPlayerDto(updatedPlayer);
    emitToPlayer(targetId, "player", playerDto);
    res.json({ player: playerDto });
  });
}
