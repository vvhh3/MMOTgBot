import { ne } from "drizzle-orm";
import type express from "express";
import { db } from "../../database/connection.js";
import { players } from "../../database/schema.js";
import { isPlayerOnline } from "../../infrastructure/realtime/socket-server.js";
import { requireAuth,type AuthedRequest } from "../auth/auth.js";

export function createOnlinePlayerRoutes(app: express.Express): void {
  app.get('/players/online', requireAuth, (req, res) => {
    const me = (req as AuthedRequest).player

    const all = db.select({
      id: players.id,
      name: players.name,
      level: players.level,
      currentLocationId: players.currentLocationId
    })
      .from(players)
      .where(ne(players.id, me.id))
      .all()

    const onlinePlayers = all
      .filter((p) => isPlayerOnline(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        level: p.level,
        locationId: p.currentLocationId
      }))

    res.json({ players: onlinePlayers })
  })

  // === БОЁВКА ===

  // НАЧАТЬ БОЙ
}
