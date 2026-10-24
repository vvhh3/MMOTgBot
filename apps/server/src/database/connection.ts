import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config/env.js";

// Создаём папку для БД, если её ещё нет (например, apps/server/data).
export const databaseExistedAtStartup = fs.existsSync(config.databasePath);
fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

// Открываем SQLite-файл. WAL — режим журналирования, позволяющий одновременно читать
// и писать, не блокируя сервер. foreign_keys = ON включает проверку внешних ключей.
export const sqlite = new Database(config.databasePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// drizzle — обёртка над better-sqlite3, дающая типизированные запросы к таблицам.
export const db = drizzle(sqlite);

