import type { AuthRequest,AuthResponse } from "@mmobot/shared";
import { eq } from "drizzle-orm";
import type express from "express";
import { db } from "../../database/connection.js";
import { toPlayerDtoEquipped } from "../../database/mappers.js";
import { players } from "../../database/schema.js";
import { nowGameTime } from "../../shared/time.js";
import { createSessionToken,validateTelegramInitData } from "./auth.js";

export function createAuthRoutes(app: express.Express): void {
  function insertPlayerWithUniqueFriendId(playerData: Omit<typeof players.$inferInsert, "friendId">) {
    const MAX_ATTEMPTS = 10;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const friendId = Math.floor(1000 + Math.random() * 9000)
      try {
        db.insert(players)
          .values({ ...playerData, friendId })
          .run();
        return friendId;
      } catch (error) {
        // конфликт уникальности - пробуем другое число
        if (isUniqueConstraintError(error)) continue
        throw error
      }
    }
    throw new Error("Не удалось сгенерировать уникальный friendId");
  }
  
  function isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Error && error.message.includes("UNIQUE constraint failed");
  }

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

      const existing = db.select().from(players).where(eq(players.id, telegramUser.id)).get();

      if (existing) {
        db.update(players)
          .set({ name, lastSeenAt: now })
          .where(eq(players.id, telegramUser.id))
          .run();
      } else {
        insertPlayerWithUniqueFriendId({ id: telegramUser.id, name, createdAt: now, lastSeenAt: now, isCreated: false });
      }

      const player = db.select().from(players).where(eq(players.id, telegramUser.id)).get()!;
      const response: AuthResponse = {
        token: createSessionToken(player.id),
        player: toPlayerDtoEquipped(player)
      };
      res.json(response);
    } catch (error) {
      res.status(401).json({ error: error instanceof Error ? error.message : "Invalid initData" });
    }
  })
}
