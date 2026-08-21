import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { EventDto, InventoryItemDto, LocationDto, PlayerDto, MobDto, ItemDto, QuestsDto } from "@mmobot/shared";
import { config } from "./config.js";
import { locations, mobs, quests } from "./db/schema.js";
import type { EventRow, InventoryItemRow, LocationRow, PlayerRow, MobRow, ItemRow, QuestsRow } from "./db/schema.js";
import { getPlayerStats } from "./combat.js";

export type { EventRow, InventoryItemRow, LocationRow, PlayerRow, MobRow, ItemRow } from "./db/schema.js";

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
    { id: 0, name: "Крыса", description: "какое то описание", level: 1, loot: [1], pointsReward: 10, locationId: "square", maxHealth: 10, strength: 2, defense: 0, respawnSeconds: 60 },
    { id: 1, name: "Громила", description: "какое то описание", level: 2, loot: [2], pointsReward: 25, locationId: "market" ,maxHealth: 25, strength: 5, defense: 1, respawnSeconds: 120 },
    { id: 2, name: "Ржавый дрон", description: "какое то описание", level: 3, loot: [3], pointsReward: 30, locationId: "park", maxHealth: 30, strength: 6, defense: 2, respawnSeconds: 120 },
    { id: 3, name: "Страж архива", description: "какое то описание", level: 4, loot: [4], pointsReward: 45, locationId: "forest",maxHealth: 45, strength: 8, defense: 3, respawnSeconds: 180 },
    { id: 4, name: "Снайпер", description: "какое то описание", level: 5, loot: [5], pointsReward: 60, locationId: "railway",maxHealth: 60, strength: 12, defense: 4, respawnSeconds: 240 }
  ]

  // Вставляем сид. onConflictDoNothing — если запись с таким же id/primary key уже есть,
  // она не обновляется и не вызывает ошибку (вставка пропускается). Благодаря этому
  // сид безопасно повторно выполняется при каждом запуске сервера.
  db.insert(locations).values(seedLocations).onConflictDoNothing().run();
  db.insert(mobs).values(seedMobs).onConflictDoNothing().run();

  // Стартовые квесты (каталог). Добавляются только если таблица пуста,
  // чтобы не дублироваться при каждом запуске.
  const seedQuests: typeof quests.$inferInsert[] = [
    { title: "Прогулка по набережной", description: "Прогуляйтесь по любой локации 3 раза", difficulty: "easy", objectiveType: "walk", targetId: null, targetCount: 3, targetXp: 30, targetPoints: 5 },
    { title: "Охота на крыс", description: "Убейте 2 крыс", difficulty: "easy", objectiveType: "kill", targetId: "0", targetCount: 2, targetXp: 50, targetPoints: 10 },
    { title: "Устранить громилу", description: "Убейте 2 громил в Сити парке", difficulty: "medium", objectiveType: "kill", targetId: "1", targetCount: 2, targetXp: 120, targetPoints: 25 },
    { title: "Разведка Сити парка", description: "Посетите Сити парк", difficulty: "medium", objectiveType: "visit", targetId: "market", targetCount: 1, targetXp: 80, targetPoints: 15 },
    { title: "Зачистка Парка Победы", description: "Убейте 3 ржавых дронов", difficulty: "hard", objectiveType: "kill", targetId: "2", targetCount: 3, targetXp: 250, targetPoints: 50 },
    { title: "Охота на снайпера", description: "Убейте снайпера на Липягах", difficulty: "hard", objectiveType: "kill", targetId: "4", targetCount: 1, targetXp: 300, targetPoints: 60 }
  ];
  if (db.select().from(quests).all().length === 0) {
    db.insert(quests).values(seedQuests).run();
  }
}

// Путь к папке с миграциями: рядом с этим файлом (apps/server/src) поднимаемся на уровень выше → apps/server/drizzle.
function migrationsFolder(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../drizzle");
}

// Функции ниже превращают "сырые" строки из БД (Row-типы) в DTO — объекты, которые
// отдаются клиенту. Это прослойка между внутренним форматом хранения и внешним API.

//получить дефолтные статы игрока
export function toPlayerDto(row: PlayerRow): PlayerDto {
  return {
    id: row.id,
    name: row.name,
    level: row.level,
    xp: row.xp,
    points: row.points,
    currentLocationId: row.currentLocationId,
    health: row.health,
    maxHp: row.maxHealth,
    strength: row.strength,
    defense: row.defense
  }
}

// получить данные игрока с экипировкой 
export function toPlayerDtoEquipped(row: PlayerRow): PlayerDto {
  const dto = toPlayerDto(row)
  const statsEquiped = getPlayerStats(row) 
  return {...dto,strength: statsEquiped.strength, defense: statsEquiped.defense}
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
    // loot в БД хранится как JSON-строка, но drizzle с mode: "json" уже вернул его массивом string[].
    loot: row.loot,
    pointsReward: row.pointsReward,
    locationId: row.locationId,
    respawnSeconds: row.respawnSeconds
  }
}

export function toItemDto(row: ItemRow): ItemDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    damage: row.damage,
    defense: row.defense,
    healAmount: row.healAmount,
    price: row.price
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
    acquiredAt: row.acquiredAt,
    equiped: row.equiped
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
export function toQuestDto(row: QuestsRow): QuestsDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    difficulty: row.difficulty,
    objectiveType: row.objectiveType,
    targetId: row.targetId,
    targetCount: row.targetCount,
    targetXp: row.targetXp,
    targetPoints: row.targetPoints,
  };
}