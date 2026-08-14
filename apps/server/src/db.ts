import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { EventDto, InventoryItemDto, LocationDto, PlayerDto } from "@mmobot/shared";
import { config } from "./config.js";
import { locations } from "./db/schema.js";
import type { EventRow, InventoryItemRow, LocationRow, PlayerRow } from "./db/schema.js";

export type { EventRow, InventoryItemRow, LocationRow, PlayerRow } from "./db/schema.js";

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

const sqlite = new Database(config.databasePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite);

export function initializeDatabase(): void {
  migrate(db, { migrationsFolder: migrationsFolder() });

  const seedLocations: LocationDto[] = [
    { id: "square", name: "Площадь", description: "Описание площади", x: 18, y: 72 },
    { id: "market", name: "Сити парк", description: "Описание сити парка", x: 46, y: 58 },
    { id: "park", name: "Парк Победы", description: "Описание парка победы", x: 70, y: 38 },
    { id: "forest", name: "Солдатсикй лес", description: "Описание солдатского леса", x: 32, y: 25 },
    { id: "railway", name: "Липяги", description: "Описание станции", x: 82, y: 76 }
  ];

  db.insert(locations).values(seedLocations).onConflictDoNothing().run();
}

function migrationsFolder(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../drizzle");
}

export function toPlayerDto(row: PlayerRow): PlayerDto {
  return {
    id: row.id,
    name: row.name,
    level: row.level,
    points: row.points,
    currentLocationId: row.currentLocationId
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
    itemType: row.itemType,
    quantity: row.quantity,
    acquiredAt: row.acquiredAt
  };
}

export function toEventDto(row: EventRow): EventDto {
  return {
    id: row.id,
    playerId: row.playerId,
    playerName: row.playerName,
    locationId: row.locationId,
    type: row.type,
    createdAt: row.createdAt
  };
}