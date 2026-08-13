import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { config } from "./config.js";
import { db, type PlayerRow } from "./db.js";

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type AuthedRequest = Request & {
  player: PlayerRow;
};

export function validateTelegramInitData(initData: string): TelegramUser {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    throw new Error("Telegram initData has no hash");
  }

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(config.botToken).digest();
  const expectedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const signatureMatches =
    hash.length === expectedHash.length && crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expectedHash, "hex"));
  if (!signatureMatches && !config.devBypassAuth) {
    throw new Error("Telegram initData signature mismatch");
  }

  const userRaw = params.get("user");
  if (!userRaw) {
    throw new Error("Telegram initData has no user");
  }

  const user = JSON.parse(userRaw) as TelegramUser;
  if (!user.id) {
    throw new Error("Telegram user id is missing");
  }

  return user;
}

export function createSessionToken(playerId: number): string {
  const payload = Buffer.from(JSON.stringify({ playerId, iat: Date.now() }), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", config.sessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string): number {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    throw new Error("Malformed token");
  }

  const expected = crypto.createHmac("sha256", config.sessionSecret).update(payload).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error("Bad token signature");
  }

  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { playerId: number };
  return parsed.playerId;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  try {
    const playerId = verifySessionToken(token);
    const player = db.prepare("SELECT * FROM players WHERE id = ?").get(playerId) as PlayerRow | undefined;
    if (!player) {
      res.status(401).json({ error: "Player not found" });
      return;
    }

    db.prepare("UPDATE players SET last_seen_at = ? WHERE id = ?").run(new Date().toISOString(), playerId);
    (req as AuthedRequest).player = player;
    next();
  } catch {
    res.status(401).json({ error: "Invalid bearer token" });
  }
}
