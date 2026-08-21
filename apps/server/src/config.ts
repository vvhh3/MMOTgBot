import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const devBypassAuth = process.env.DEV_BYPASS_AUTH === "true";

export const config = {
  botToken: readEnv("BOT_TOKEN"),
  // Секрет сессий обязателен в проде. Фолбэк на BOT_TOKEN убран: утечка токена
  // бота не должна компрометировать все JWT-сессии. В dev-режиме допускаем дефолт.
  sessionSecret: process.env.SESSION_SECRET ?? (devBypassAuth ? "dev-insecure-secret" : readEnv("SESSION_SECRET")),
  port: Number(process.env.PORT ?? 4000),
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS),
  databasePath: path.resolve(process.env.DATABASE_PATH ?? "./apps/server/data/mmobot.db"),
  devBypassAuth,
  adminIds: parseNumberList(process.env.ADMIN_IDS)
};

function parseOrigins(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function parseNumberList(raw: string| undefined): number[]{
  if(!raw) return []
  return raw.split(',').map((v) => Number(v.trim()))
}

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
}
