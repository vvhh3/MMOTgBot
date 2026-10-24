import type { LeaderBoardResponse } from "@mmobot/shared";
import { desc } from "drizzle-orm";
import type express from "express";
import { db } from "../../database/connection.js";
import { toPlayerDto } from "../../database/mappers.js";
import { players } from "../../database/schema.js";
import { requireAuth } from "../auth/auth.js";

export function createLeaderboardRoutes(app: express.Express): void {
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
}
