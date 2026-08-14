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

export type { EventRow, InventoryItemRow, LocationRow, PlayerRow, MobRow } from "./db/schema.js";

// Создаём папку для БД, если её ещё нет (например, apps/server/data).
fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

// Открываем SQLite-файл. WAL — режим журналирования, позволяющий одновременно читать
// и писать, не блокируя сервер. foreign_keys = ON включает проверку внешних ключей.
const sqlite = new Database(config.databasePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// drizzle — обёртка над better-sqlite3, дающая типизированные запросы к таблицам.
export const db = drizzle(sqlite);

export function initializeDatabase(): void {
  // Применяем миграции из папки drizzle (файлы 0000_*.sql, 0001_*.sql и т.д.).
  // drizzle следит за применёнными миграциями и выполняет только новые.
  migrate(db, { migrationsFolder: migrationsFolder() });

  // Ниже — сид (начальные данные), который заносится в БД при первом запуске.
  // Список стартовых локаций: id, название, описание и координаты.
  const seedLocations: LocationDto[] = [
    { id: "square", name: "Площадь", description: "Описание площади", x: 18, y: 72 },
    { id: "market", name: "Сити парк", description: "Описание сити парка", x: 46, y: 58 },
    { id: "park", name: "Парк Победы", description: "Описание парка победы", x: 70, y: 38 },
    { id: "forest", name: "Солдатсикй лес", description: "Описание солдатского леса", x: 32, y: 25 },
    { id: "railway", name: "Липяги", description: "Описание станции", x: 82, y: 76 }
  ];

  // Стартовые мобы. locationId должен ссылаться на существующую локацию из seedLocations,
  // иначе сработает проверка FOREIGN KEY.
  const seedMobs: MobDto[] = [
    { id: 0, name: "Крыса", description: "какое то описание", level: 1, loot: ['Кусок сыра'], pointsReward: 10, locationId: "square",health:10, maxHealth: 10, strength: 2, defense: 0, respawnSeconds: 60 },
    { id: 1, name: "Громила", description: "какое то описание", level: 2, loot: ['Кусок мяса'], pointsReward: 25, locationId: "market", health:25 ,maxHealth: 25, strength: 5, defense: 1, respawnSeconds: 120 },
    { id: 2, name: "Ржавый дрон", description: "какое то описание", level: 3, loot: ['Ржавый механизм'], pointsReward: 30, locationId: "park",health: 30, maxHealth: 30, strength: 6, defense: 2, respawnSeconds: 120 },
    { id: 3, name: "Страж архива", description: "какое то описание", level: 4, loot: ['Архивный документ'], pointsReward: 45, locationId: "forest", health: 45,maxHealth: 45, strength: 8, defense: 3, respawnSeconds: 180 },
    { id: 4, name: "Снайпер", description: "какое то описание", level: 5, loot: ['Снайперская винтовка'], pointsReward: 60, locationId: "railway", health: 60,maxHealth: 60, strength: 12, defense: 4, respawnSeconds: 240 }
  ]

  // Вставляем сид. onConflictDoNothing — если запись с таким же id/primary key уже есть,
  // она не обновляется и не вызывает ошибку (вставка пропускается). Благодаря этому
  // сид безопасно повторно выполняется при каждом запуске сервера.
  db.insert(locations).values(seedLocations).onConflictDoNothing().run();
  db.insert(mobs).values(seedMobs).onConflictDoNothing().run();
}

// Путь к папке с миграциями: рядом с этим файлом (apps/server/src) поднимаемся на уровень выше → apps/server/drizzle.
function migrationsFolder(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../drizzle");
}

// Функции ниже превращают "сырые" строки из БД (Row-типы) в DTO — объекты, которые
// отдаются клиенту. Это прослойка между внутренним форматом хранения и внешним API.

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
    health: row.health,
    maxHealth: row.maxHealth,
    strength: row.strength,
    defense: row.defense,
    // loot в БД хранится как JSON-строка, но drizzle с mode: "json" уже вернул его массивом string[].
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