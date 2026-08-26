import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { EventDto, FriendsOverviewResponse, FriendDto, InventoryItemDto, LocationDto, PlayerDto, MobDto, ItemDto, QuestsDto } from "@mmobot/shared";
import { config } from "./config.js";
import { friendships, items, locations, mobs, players, quests } from "./db/schema.js";
import type { EventRow, InventoryItemRow, LocationRow, PlayerRow, MobRow, ItemRow, QuestsRow } from "./db/schema.js";
import { getPlayerStats } from "./combat.js";
import { getLevelXpBounds } from "./level.js";
import { isPlayerOnline } from "./realTime.js";

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
    { id: "square", name: "Площадь", description: "Описание площади", x: 31, y: 40 ,homeImg:"square-home.svg",fightImg:"square-fight.svg",actions:["fight","walk","money"]},
    { id: "market", name: "Сити парк", description: "Описание сити парка", x: 42, y: 33 ,homeImg:"market-home.svg",fightImg:"market-fight.svg",actions:[]},
    { id: "park", name: "Парк Победы", description: "Описание парка победы", x: 40, y: 27,homeImg:"park-home.svg",fightImg:"park-fight.svg",actions:[]},
    { id: "forest", name: "Солдатсикй лес", description: "Описание солдатского леса", x: 64, y: 33,homeImg:"forest-home.svg",fightImg:"forest-fight.svg",actions:[] },
    { id: "railway", name: "Липяги", description: "Описание станции", x: 70, y: 38,homeImg:"railway-home.svg",fightImg:"railway-fight.svg",actions:[] }
  ]

  // Стартовые мобы. locationId должен ссылаться на существующую локацию из seedLocations,
  // иначе сработает проверка FOREIGN KEY.
  const seedMobs: MobDto[] = [
    { id: 0, name: "Крыса", description: "какое то описание", level: 1, loot: [1], pointsReward: 10, locationId: "square", maxHealth: 10, strength: 2, defense: 0, respawnSeconds: 60 },
    { id: 1, name: "Громила", description: "какое то описание", level: 2, loot: [2], pointsReward: 25, locationId: "market" ,maxHealth: 25, strength: 5, defense: 1, respawnSeconds: 120 },
    { id: 2, name: "Ржавый дрон", description: "какое то описание", level: 3, loot: [3], pointsReward: 30, locationId: "park", maxHealth: 30, strength: 6, defense: 2, respawnSeconds: 120 },
    { id: 3, name: "Страж архива", description: "какое то описание", level: 4, loot: [4], pointsReward: 45, locationId: "forest",maxHealth: 45, strength: 8, defense: 3, respawnSeconds: 180 },
    { id: 4, name: "Снайпер", description: "какое то описание", level: 5, loot: [5], pointsReward: 60, locationId: "railway",maxHealth: 60, strength: 12, defense: 4, respawnSeconds: 240 }
  ]

  const seedItems: typeof items.$inferInsert[] = [
    { id: 1, name: "Ржавый нож", description: "Простой нож", type: "weapon", damage: 3, defense: 0, healAmount: 0, price: 10 },
    { id: 2, name: "Кожаная броня", description: "Лёгкая защитная броня", type: "armor", damage: 0, defense: 2, healAmount: 0, price: 15 },
    { id: 3, name: "Малая аптечка", description: "Восстанавливает здоровье", type: "potion", damage: 0, defense: 0, healAmount: 10, price: 12 },
    { id: 4, name: "Металлолом", description: "Полезный материал", type: "material", damage: 0, defense: 0, healAmount: 0, price: 5 },
    { id: 5, name: "Старая винтовка", description: "Рабочее оружие", type: "weapon", damage: 8, defense: 0, healAmount: 0, price: 30 }
  ]

  // Вставляем сид. Для локаций onConflictDoUpdate: при изменении координат/названия
  // в коде они обновляются в БД при следующем запуске сервера
  // В ПРОДЕ ПОТОМ ПЕРЕДЕЛАТЬ ПОД МИГРАЦИИ
  db.insert(locations)
    .values(seedLocations)
    .onConflictDoUpdate({
      target: locations.id,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        x: sql`excluded.x`,
        y: sql`excluded.y`,
        homeImg:sql`excluded.homeImg`,
        fightImg:sql`excluded.fightImg`,
        actions: sql`excluded.actions`,
      }
    })
    .run()
  db.insert(mobs).values(seedMobs).onConflictDoNothing().run()
  db.insert(items).values(seedItems).onConflictDoNothing().run()

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
  const { levelStartXp, nextLevelXp } = getLevelXpBounds(row.xp)
  
  return {
    id: row.id,
    friendId: row.friendId,
    name: row.name,
    level: row.level,
    xp: row.xp,
    xpLevelStart: levelStartXp,
    xpNextLevel: nextLevelXp,
    points: row.points,
    currentLocationId: row.currentLocationId,
    health: row.health,
    maxHp: row.maxHealth,
    strength: row.strength,
    defense: row.defense,
    statPoints: row.statPoints // нераспределённые очки — клиент по ним показывает кнопку прокачки
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
export function toFriendDto(p: { id: number; name: string; level: number }): FriendDto {
    return { 
      id: p.id, 
      name: p.name, 
      level: p.level,
       online: isPlayerOnline(p.id) 
      }
}

// Собирает полный обзор друзей игрока: принятые друзья + ожидающие заявки
// (входящие/исходящие). Онлайн каждого друга вычисляется через isPlayerOnline.
export function buildFriendsOverview(playerId: number): FriendsOverviewResponse {
  const rows = db.select().from(friendships)
    .where(or(eq(friendships.fromId, playerId), eq(friendships.toId, playerId)))
    .all();
  const accepted = rows.filter((r) => r.status === "accepted");
  const pending = rows.filter((r) => r.status === "pending");

  const friendIds = accepted.map((r) => (r.fromId === playerId ? r.toId : r.fromId));
  const friendRows = friendIds.length
    ? db.select({ id: players.id, name: players.name, level: players.level })
        .from(players).where(inArray(players.id, friendIds)).all()
    : [];
  const friends: FriendDto[] = friendRows.map((p) => toFriendDto(p));

  const requests = pending.map((r) => {
    const otherId = r.fromId === playerId ? r.toId : r.fromId;
    const other = db.select({ id: players.id, name: players.name, level: players.level })
      .from(players).where(eq(players.id, otherId)).get();
    return {
      id: r.id,
      playerId: other?.id ?? 0,
      name: other?.name ?? "?",
      level: other?.level ?? 1,
      direction: (r.fromId === playerId ? "outgoing" : "incoming") as "incoming" | "outgoing"
    };
  });

  return { friends, requests };
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
    y: row.y,
    homeImg:row.homeImg,
    fightImg:row.fightImg,
    actions:row.actions
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