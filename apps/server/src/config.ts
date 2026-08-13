import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env") });

export const config = {
  botToken: readEnv("BOT_TOKEN"),
  sessionSecret: process.env.SESSION_SECRET ?? readEnv("BOT_TOKEN"),
  port: Number(process.env.PORT ?? 4000),
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS),
  databasePath: path.resolve(process.env.DATABASE_PATH ?? "./apps/server/data/mmobot.db"),
  devBypassAuth: process.env.DEV_BYPASS_AUTH === "true"
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

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
}
