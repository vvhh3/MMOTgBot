import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { EventDto, InventoryItemDto, LocationDto, PlayerDto } from "@mmobot/shared";
import { config } from "./config.js";

export type PlayerRow = {
  id: number;
  name: string;
  level: number;
  points: number;
  current_location_id: string | null;
  created_at: string;
  last_seen_at: string;
};

export type LocationRow = {
  id: string;
  name: string;
  description: string;
  x: number;
  y: number;
};

export type InventoryItemRow = {
  id: number;
  player_id: number;
  item_type: string;
  quantity: number;
  acquired_at: string;
};

export type EventRow = {
  id: number;
  player_id: number;
  player_name: string;
  location_id: string;
  type: string;
  created_at: string;
};

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

export const db = new Database(config.databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      points INTEGER NOT NULL DEFAULT 0,
      current_location_id TEXT,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      FOREIGN KEY (current_location_id) REFERENCES locations(id)
    );

    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      item_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      acquired_at TEXT NOT NULL,
      UNIQUE(player_id, item_type),
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      location_id TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
    );
  `);

  const seedLocations: LocationDto[] = [
    { id: "station", name: "Станция", description: "Тихая точка входа в город.", x: 18, y: 72 },
    { id: "market", name: "Рынок", description: "Площадь с припасами и слухами.", x: 46, y: 58 },
    { id: "workshop", name: "Мастерская", description: "Здесь чинят вещи и находят детали.", x: 70, y: 38 },
    { id: "archive", name: "Архив", description: "Пыльные комнаты с полезными записями.", x: 32, y: 25 },
    { id: "tower", name: "Башня", description: "Высокая обзорная точка.", x: 82, y: 76 }
  ];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO locations (id, name, description, x, y)
    VALUES (@id, @name, @description, @x, @y)
  `);

  for (const location of seedLocations) {
    insert.run(location);
  }
}

export function toPlayerDto(row: PlayerRow): PlayerDto {
  return {
    id: row.id,
    name: row.name,
    level: row.level,
    points: row.points,
    currentLocationId: row.current_location_id
  };
}

export function toLocationDto(row: LocationRow): LocationDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    x: row.x,
    y: row.y
  };
}

export function toInventoryItemDto(row: InventoryItemRow): InventoryItemDto {
  return {
    id: row.id,
    itemType: row.item_type,
    quantity: row.quantity,
    acquiredAt: row.acquired_at
  };
}

export function toEventDto(row: EventRow): EventDto {
  return {
    id: row.id,
    playerId: row.player_id,
    playerName: row.player_name,
    locationId: row.location_id,
    type: row.type,
    createdAt: row.created_at
  };
}
