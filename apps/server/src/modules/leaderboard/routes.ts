import type { LeaderBoardResponse } from "@mmobot/shared";
import { FACTIONS,type FactionLeaderboardResponse } from "@mmobot/shared";
import { count,desc,eq,sql } from "drizzle-orm";
import type express from "express";
import { db } from "../../database/connection.js";
import { toPlayerDto } from "../../database/mappers.js";
import { players } from "../../database/schema.js";
import { requireAuth } from "../auth/auth.js";

export function createLeaderboardRoutes(app: express.Express): void {
  app.get("/leaderboard/factions", requireAuth, (_req, res) => {
    const totals = db.select({
      factionId: players.factionId,
      members: count(),
      totalPoints: sql<number>`coalesce(sum(${players.points}), 0)`.mapWith(Number),
    }).from(players).where(eq(players.isCreated, true)).groupBy(players.factionId).all();
    const response: FactionLeaderboardResponse = {
      entries: FACTIONS.map(({ id }) => {
        const total = totals.find((row) => row.factionId === id);
        return { factionId: id, members: total?.members ?? 0, totalPoints: total?.totalPoints ?? 0 };
      }).sort((a, b) => b.members - a.members || b.totalPoints - a.totalPoints || a.factionId.localeCompare(b.factionId)),
    };
    res.json(response);
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
}
