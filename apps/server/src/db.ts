import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { EventDto, InventoryItemDto, LocationDto, PlayerDto,MobDto } from "@mmobot/shared";
import { config } from "./config.js";
import { locations, mobs } from "./db/schema.js";
import type { EventRow, InventoryItemRow, LocationRow, PlayerRow,MobRow } from "./db/schema.js";

// export type { EventRow, InventoryItemRow, LocationRow, PlayerRow } from "./db/schema.js";

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

  const seedMobs: MobDto[] = [
    { id: 0, name: "Крыса", description: "какое то описание", level: 1, loot: ['Кусок сыра'], pointsReward: 10, locationId: "station", maxHealth: 10, strength: 2, defense: 0, respawnSeconds: 60 },
    { id: 1, name: "Громила", description: "какое то описание", level: 2, loot: ['Кусок мяса'], pointsReward: 25, locationId: "market", maxHealth: 25, strength: 5, defense: 1, respawnSeconds: 120 },
    { id: 2, name: "Ржавый дрон", description: "какое то описание", level: 3, loot: ['Ржавый механизм'], pointsReward: 30, locationId: "workshop", maxHealth: 30, strength: 6, defense: 2, respawnSeconds: 120 },
    { id: 3, name: "Страж архива", description: "какое то описание", level: 4, loot: ['Архивный документ'], pointsReward: 45, locationId: "archive", maxHealth: 45, strength: 8, defense: 3, respawnSeconds: 180 },
    { id: 4, name: "Снайпер", description: "какое то описание", level: 5, loot: ['Снайперская винтовка'], pointsReward: 60, locationId: "tower", maxHealth: 60, strength: 12, defense: 4, respawnSeconds: 240 }
  ]

  db.insert(locations).values(seedLocations).onConflictDoNothing().run();
  db.insert(mobs).values(seedMobs).onConflictDoNothing().run();
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
    currentLocationId: row.currentLocationId,
    health: row.health,
    maxHp: row.maxHealth,
    strength: row.strength,
    defense: row.defense
  };
}

export function toMobDto(row: MobRow): MobDto{
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    level: row.level,
    maxHealth: row.maxHealth,
    strength: row.strength,
    defense: row.defense,
    loot: row.loot,
    pointsReward: row.pointsReward,
    locationId: row.locationId,
    respawnSeconds: row.respawnSeconds
  }
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