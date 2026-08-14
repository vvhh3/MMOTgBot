import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { isValid, parse } from "@tma.js/init-data-node";
import type { Request, Response, NextFunction } from "express";
import { config } from "./config.js";
import { db, type PlayerRow } from "./db.js";
import { players } from "./db/schema.js";

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type AuthedRequest = Request & {
  player: PlayerRow; // описание пользователя
};

export function validateTelegramInitData(initData: string): TelegramUser { // проверка initData от телеграма на валидность
  if (config.devBypassAuth) {
    const raw = new URLSearchParams(initData).get("user");
    if (!raw) {
      throw new Error("Telegram initData has no user");
    }
    return JSON.parse(raw) as TelegramUser;
  }

  if (!isValid(initData, config.botToken)) {
    throw new Error("Telegram initData signature mismatch");
  }

  const user = parse(initData).user;
  if (!user) {
    throw new Error("Telegram initData has no user");
  }

  return user;
}

export function createSessionToken(playerId: number): string { // создание токена с playerId
  return jwt.sign({ playerId }, config.sessionSecret);
}

export function verifySessionToken(token: string): number { // проверка токена на валидность и получение playerId
  const payload = jwt.verify(token, config.sessionSecret) as { playerId: number };
  return payload.playerId;
}

export const requireAdmin = (req: Request,res: Response,next: NextFunction) => {
  const player = (req as AuthedRequest).player
  if(!config.adminIds.includes(player.id)){
    res.status(400).json({error: "Admin access required"})
    return
  }
  next()
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void { /// проверка авторизации по токену
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  try {
    const playerId = verifySessionToken(token);
    const player = db.select().from(players).where(eq(players.id, playerId)).get() as PlayerRow | undefined;
    if (!player) {
      res.status(401).json({ error: "Player not found" });
      return;
    }

    db.update(players).set({ lastSeenAt: new Date().toISOString() }).where(eq(players.id, playerId)).run();
    (req as AuthedRequest).player = player;
    next();
  } catch {
    res.status(401).json({ error: "Invalid bearer token" });
  }
}
