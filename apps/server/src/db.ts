import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import type { EventDto, FriendsOverviewResponse, FriendDto, InventoryItemDto, LocationDto, PlayerDto, MobDto, ItemDto, QuestsDto } from "@mmobot/shared";
import { config } from "./config.js";
import { casinoSessions, characterSkins, combatSessions, friendships, items, locations, mobs, players, quests } from "./db/schema.js";
import type { EventRow, InventoryItemRow, LocationRow, PlayerRow, MobRow, ItemRow, QuestsRow } from "./db/schema.js";
import { getPlayerStats } from "./combat.js";
import { getLevelXpBounds } from "./level.js";
import { isPlayerOnline } from "./realTime.js";

export type { EventRow, InventoryItemRow, LocationRow, PlayerRow, MobRow, ItemRow } from "./db/schema.js";

// Создаём папку для БД, если её ещё нет (например, apps/server/data).
const databaseExistedAtStartup = fs.existsSync(config.databasePath);
fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

// Открываем SQLite-файл. WAL — режим журналирования, позволяющий одновременно читать
// и писать, не блокируя сервер. foreign_keys = ON включает проверку внешних ключей.
const sqlite = new Database(config.databasePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// drizzle — обёртка над better-sqlite3, дающая типизированные запросы к таблицам.
export const db = drizzle(sqlite);

export function initializeDatabase(): void {
  const countPlayers = (): number | null => {
    if (!tableExists("players")) return null;
    return (sqlite.prepare('SELECT COUNT(*) AS count FROM "players"').get() as { count: number }).count;
  };
  console.info("[database] before migrations", JSON.stringify({
    path: config.databasePath,
    existedBeforeOpen: databaseExistedAtStartup,
    volumeMountPath: process.env.RAILWAY_VOLUME_MOUNT_PATH ?? null,
    players: countPlayers(),
  }));
  // Применяем миграции из папки drizzle (файлы 0000_*.sql, 0001_*.sql и т.д.).
  // drizzle следит за применёнными миграциями и выполняет только новые.
  migrate(db, { migrationsFolder: migrationsFolder() });
  // Сессии старых версий, завершённые до удаления при расчёте результата.
  db.delete(casinoSessions).where(ne(casinoSessions.status, "active")).run();
  console.info("[database] after migrations", JSON.stringify({ players: countPlayers() }));

  // Автофикс схемы: колонка locations.actions есть в коде и схеме, но не была
  // добавлена ни одной миграцией. Идемпотентно создаём её, если ещё не существует,
  // чтобы INSERT/SELECT не падали с "no column named actions".
  ensureLocationsActions();
  ensureItemsShopAvailable();

  // Автофикс схемы: колонки конструктора персонажа (is_created, race, avatar).
  ensurePlayerCharacterColumns();

  // Ниже — сид (начальные данные), который заносится в БД при первом запуске.
  // Список стартовых локаций: id, название, описание и координаты.
  const seedLocations: LocationDto[] = [
    { id: "square", name: "Площадь", description: "Описание площади", x: 31, y: 40 ,homeImg:"square-home.svg",fightImg:"square-fight.svg",actions:["fight","walk","money",]},
    { id: "rialto", name: "Рынок", description: "Описание рынка", x: 35, y: 35 ,homeImg:"square-home.svg",fightImg:"square-fight.svg",actions:["exchange","shop"]},
    { id: "market", name: "Сити парк", description: "Описание сити парка", x: 42, y: 33 ,homeImg:"market-home.svg",fightImg:"market-fight.svg",actions:["mines","blackjack","ladder"]},
    { id: "park", name: "Парк Победы", description: "Описание парка победы", x: 39, y: 27,homeImg:"park-home.svg",fightImg:"park-fight.svg",actions:["fight","walk"]},
    { id: "forest", name: "Солдатсикй лес", description: "Описание солдатского леса", x: 64, y: 33,homeImg:"forest-home.svg",fightImg:"forest-fight.svg",actions:["fight","walk"]},
    { id: "railway", name: "Липяги", description: "Описание станции", x: 70, y: 38,homeImg:"railway-home.svg",fightImg:"railway-fight.svg",actions:["fight","walk"]}
  ]

  // Стартовые мобы. locationId должен ссылаться на существующую локацию из seedLocations,
  // иначе сработает проверка FOREIGN KEY.
  const seedMobs: MobDto[] = [
    { id: 0, name: "Крыса", description: "какое то описание", level: 1, loot: [1], pointsReward: 10, coinReward: 5, locationId: "square", maxHealth: 10, strength: 2, defense: 0, respawnSeconds: 60 },
    { id: 2, name: "Ржавый дрон", description: "какое то описание", level: 3, loot: [3], pointsReward: 30, coinReward: 15, locationId: "park", maxHealth: 30, strength: 6, defense: 2, respawnSeconds: 120 },
    { id: 3, name: "Страж архива", description: "какое то описание", level: 4, loot: [4], pointsReward: 45, coinReward: 20, locationId: "forest",maxHealth: 45, strength: 8, defense: 3, respawnSeconds: 180 },
    { id: 4, name: "Снайпер", description: "какое то описание", level: 5, loot: [5], pointsReward: 60, coinReward: 30, locationId: "railway",maxHealth: 60, strength: 12, defense: 4, respawnSeconds: 240 }
  ]

  const seedItems: typeof items.$inferInsert[] = [
    { id: 1, name: "Ржавый нож", description: "Простой нож", type: "weapon", damage: 3, defense: 0, healAmount: 0, price: 10, shopAvailable: true, icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 29L13 19M13 19L29 3L13 19Z"/> </svg>'},
    { id: 2, name: "Кожаная броня", description: "Лёгкая защитная броня", type: "armor", damage: 0, defense: 2, healAmount: 0, price: 15, shopAvailable: true, icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M16 2L6 8v8c0 6 4 10 10 12 6-2 10-6 10-12V8L16 2z'/><path d='M16 12v8'/><path d='M12 16h8'/></svg>"},
    { id: 3, name: "Малая аптечка", description: "Восстанавливает здоровье", type: "potion", damage: 0, defense: 0, healAmount: 10, price: 12, shopAvailable: true, icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M16 5v22M5 16h22'/><rect x='4' y='4' width='24' height='24' rx='4'/></svg>"},
    { id: 4, name: "Металлолом", description: "Полезный материал", type: "material", damage: 0, defense: 0, healAmount: 0, price: 5, shopAvailable: false, icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M5 27l4-4 5-6 8-9M9 23l-3-3M18 27c4-7 8-14 9-22l-6 1c-1 4-3 8-5 11'/></svg>" },
    { id: 5, name: "Старая винтовка", description: "Рабочее оружие", type: "weapon", damage: 8, defense: 0, healAmount: 0, price: 30, shopAvailable: true, icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M3 24h26M3 24l2-6h24l0 6M7 24v4M12 24v4M17 24v4M22 24v4M14 18h6'/></svg>" }
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
  const seedCharacterSkins: typeof characterSkins.$inferInsert[] = [
    ...Array.from({ length: 22 }, (_, index) => ({
      id: index + 1,
      name: `Персонаж ${index + 1}`,
      imageUrl: `/character-images/skins${index + 1}.svg`,
      enabled: true,
      sortOrder: index + 1,
    })),
    { id: 23, name: "Монстр", imageUrl: "/character-images/monstr.svg", enabled: true, sortOrder: 23 },
  ]
  db.insert(characterSkins)
    .values(seedCharacterSkins)
    .onConflictDoUpdate({
      target: characterSkins.id,
      set: {
        name: sql`excluded.name`,
        imageUrl: sql`excluded.image_url`,
        sortOrder: sql`excluded.sort_order`,
      },
    })
    .run()
  db.insert(mobs).values(seedMobs).onConflictDoNothing().run()
  removeCityParkCombat();
  db.insert(items)
    .values(seedItems)
    .onConflictDoUpdate({
      target: items.id,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        type: sql`excluded.type`,
        damage: sql`excluded.damage`,
        defense: sql`excluded.defense`,
        healAmount: sql`excluded.heal_amount`,
        price: sql`excluded.price`,
        icon: sql`excluded.icon`,
      }
    })
    .run()

  // Новый предмет получает свободный id, чтобы не затереть предметы из админки.
  const stick = db.select().from(items).where(eq(items.name, "Палка")).get()
    ?? db.insert(items).values({
      name: "Палка", description: "Простое оружие, которое можно добыть у крыс на Площади",
      type: "weapon", damage: 1, price: 2, shopAvailable: false,
      icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round'><path d='M7 27L23 5M17 13L25 12'/></svg>",
    }).returning().get();
  const rat = db.select().from(mobs).where(eq(mobs.id, 0)).get();
  if (rat && !rat.loot.includes(stick.id)) {
    db.update(mobs).set({ loot: [...rat.loot, stick.id] }).where(eq(mobs.id, rat.id)).run();
  }

  // Дополняем каталог и в существующей БД. Награды/настройки уже созданных
  // заданий не перезаписываем, повторный запуск не создаёт копии.
  const seedQuests: typeof quests.$inferInsert[] = [
    { title: "Прогулка по набережной", description: "Прогуляйтесь по любой локации 3 раза", difficulty: "easy", objectiveType: "walk", targetId: null, targetCount: 3, targetXp: 30, targetPoints: 5, targetCoins: 10 },
    { title: "Охота на крыс", description: "Убейте 2 крыс", difficulty: "easy", objectiveType: "kill", targetId: "0", targetCount: 2, targetXp: 50, targetPoints: 10, targetCoins: 15 },
    { title: "Охота на дронов", description: "Победите 2 ржавых дронов в Парке Победы", difficulty: "medium", objectiveType: "kill", targetId: "2", targetCount: 2, targetXp: 120, targetPoints: 25, targetCoins: 30 },
    { title: "Разведка Сити парка", description: "Посетите Сити парк", difficulty: "medium", objectiveType: "visit", targetId: "market", targetCount: 1, targetXp: 80, targetPoints: 15, targetCoins: 20 },
    { title: "Зачистка Парка Победы", description: "Убейте 3 ржавых дронов", difficulty: "hard", objectiveType: "kill", targetId: "2", targetCount: 3, targetXp: 250, targetPoints: 50, targetCoins: 60 },
    { title: "Охота на снайпера", description: "Убейте снайпера на Липягах", difficulty: "hard", objectiveType: "kill", targetId: "4", targetCount: 1, targetXp: 300, targetPoints: 60, targetCoins: 75 },
    { title: "Первое оружие", description: "Добудьте 1 палку с побеждённой крысы на Площади", difficulty: "easy", objectiveType: "loot", targetId: String(stick.id), targetCount: 1, targetXp: 35, targetPoints: 5, targetCoins: 10 },
    { title: "Знакомство с рынком", description: "Посетите Рынок", difficulty: "easy", objectiveType: "visit", targetId: "rialto", targetCount: 1, targetXp: 25, targetPoints: 5, targetCoins: 10 },
    { title: "Патруль Площади", description: "Прогуляйтесь по Площади 5 раз", difficulty: "easy", objectiveType: "walk", targetId: "square", targetCount: 5, targetXp: 40, targetPoints: 10, targetCoins: 15 },
    { title: "Запасливый новичок", description: "Найдите 3 любых предмета на прогулках или в боях", difficulty: "easy", objectiveType: "collect", targetId: null, targetCount: 3, targetXp: 40, targetPoints: 10, targetCoins: 15 },
    { title: "Первая удача", description: "Накопите 20 монет прибыли в выигрышных раундах любой игры казино (без учёта ставки)", difficulty: "easy", objectiveType: "casino_win", targetId: null, targetCount: 20, targetXp: 40, targetPoints: 10, targetCoins: 10 },
    { title: "Патруль Парка Победы", description: "Прогуляйтесь по Парку Победы 5 раз", difficulty: "medium", objectiveType: "walk", targetId: "park", targetCount: 5, targetXp: 100, targetPoints: 20, targetCoins: 25 },
    { title: "Охотник за трофеями", description: "Победите 5 любых монстров", difficulty: "medium", objectiveType: "kill", targetId: null, targetCount: 5, targetXp: 120, targetPoints: 25, targetCoins: 35 },
    { title: "Полевой медик", description: "Добудьте 2 малые аптечки с ржавых дронов в Парке Победы", difficulty: "medium", objectiveType: "loot", targetId: "3", targetCount: 2, targetXp: 120, targetPoints: 25, targetCoins: 30 },
    { title: "Коллекция ржавых ножей", description: "Добудьте 3 ржавых ножа с крыс на Площади", difficulty: "medium", objectiveType: "loot", targetId: "1", targetCount: 3, targetXp: 90, targetPoints: 20, targetCoins: 25 },
    { title: "Знаток двадцати одного", description: "Накопите 50 монет прибыли в выигрышных раундах «21» (без учёта ставки)", difficulty: "medium", objectiveType: "casino_win", targetId: "blackjack", targetCount: 50, targetXp: 100, targetPoints: 20, targetCoins: 25 },
    { title: "Стражи больше не помеха", description: "Победите 3 стражей архива в лесу", difficulty: "hard", objectiveType: "kill", targetId: "3", targetCount: 3, targetXp: 280, targetPoints: 55, targetCoins: 70 },
    { title: "Запасы металлолома", description: "Добудьте 3 единицы металлолома со стражей архива", difficulty: "hard", objectiveType: "loot", targetId: "4", targetCount: 3, targetXp: 260, targetPoints: 50, targetCoins: 65 },
    { title: "Арсенал снайпера", description: "Добудьте 2 старые винтовки со снайперов на Липягах", difficulty: "hard", objectiveType: "loot", targetId: "5", targetCount: 2, targetXp: 350, targetPoints: 65, targetCoins: 90 },
    { title: "Крупный выигрыш", description: "Накопите 200 монет прибыли в выигрышных раундах любой игры казино (без учёта ставки)", difficulty: "hard", objectiveType: "casino_win", targetId: null, targetCount: 200, targetXp: 250, targetPoints: 50, targetCoins: 60 },
    { title: "На вершине удачи", description: "Накопите 100 монет прибыли в выигрышных раундах «Лестницы» (без учёта ставки)", difficulty: "hard", objectiveType: "casino_win", targetId: "ladder", targetCount: 100, targetXp: 220, targetPoints: 45, targetCoins: 50 }
  ];
  db.transaction((tx) => {
    const existingTitles = new Set(tx.select({ title: quests.title }).from(quests).all().map((quest) => quest.title));
    const missingQuests = seedQuests.filter((quest) => !existingTitles.has(quest.title));
    if (missingQuests.length > 0) tx.insert(quests).values(missingQuests).run();
  });
}

// Убираем прежнего стартового моба и из уже существующей базы.
function removeCityParkCombat(): void {
  db.transaction((tx) => {
    const brute = tx.select().from(mobs).where(and(eq(mobs.id, 1), eq(mobs.locationId, "market"))).get();
    if (brute) {
      const sessions = tx.select({ session: combatSessions, player: players })
        .from(combatSessions).innerJoin(players, eq(players.id, combatSessions.playerId))
        .where(eq(combatSessions.mobId, brute.id)).all();
      for (const { session, player } of sessions) {
        if (player.idTheLastAction?.type === "TakeAWalk" && player.idTheLastAction.id === session.id) {
          tx.update(players).set({ idTheLastAction: null }).where(eq(players.id, player.id)).run();
        }
      }
      // Связанные с мобом сессии боя удаляются по ON DELETE CASCADE.
      tx.delete(mobs).where(eq(mobs.id, brute.id)).run();
    }

    // Меняем цель старого шаблона, сохраняя его id, награды и выданные задания.
    const oldQuests = tx.select().from(quests).where(and(
      eq(quests.title, "Устранить громилу"), eq(quests.objectiveType, "kill"), eq(quests.targetId, "1")
    )).all();
    for (const quest of oldQuests) {
      tx.update(quests).set({
        title: "Охота на дронов", description: `Победите ${quest.targetCount} ржавых дронов в Парке Победы`, targetId: "2",
      }).where(eq(quests.id, quest.id)).run();
    }
  });
}

// Путь к папке с миграциями: рядом с этим файлом (apps/server/src) поднимаемся на уровень выше → apps/server/drizzle.
function migrationsFolder(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../drizzle");
}

// Проверяет, существует ли таблица в SQLite.
function tableExists(name: string): boolean {
  return !!sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name);
}

// Проверяет, есть ли колонка в таблице (имя таблицы — внутренняя константа кода, не пользовательский ввод).
function columnExists(table: string, column: string): boolean {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

// Идемпотентно добавляет колонку locations.actions, если её нет в физической таблице.
// Позволяет поднимать сервер на базе, созданной из старых миграций, не теряя данные.
function ensureLocationsActions(): void {
  if (!tableExists("locations")) return;
  if (columnExists("locations", "actions")) return;
  sqlite.exec(`ALTER TABLE "locations" ADD COLUMN "actions" text NOT NULL DEFAULT '[]'`);
}

function ensureItemsShopAvailable(): void {
  if (!tableExists("items") || columnExists("items", "shop_available")) return;
  sqlite.exec(`ALTER TABLE "items" ADD COLUMN "shop_available" integer NOT NULL DEFAULT 0`);
}

// Идемпотентно добавляет колонки конструктора персонажа в players, если их нет.
// Старые игроки получают is_created=1 (они уже "созданы"), чтобы не показывать
// им конструктор повторно.
function ensurePlayerCharacterColumns(): void {
  if (!tableExists("players")) return;
  if (!columnExists("players", "is_created")) {
    sqlite.exec(`ALTER TABLE "players" ADD COLUMN "is_created" integer NOT NULL DEFAULT 1`);
  }
  if (!columnExists("players", "race")) {
    sqlite.exec(`ALTER TABLE "players" ADD COLUMN "race" text`);
  }
  if (!columnExists("players", "avatar")) {
    sqlite.exec(`ALTER TABLE "players" ADD COLUMN "avatar" text`);
  }
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
    statPoints: row.statPoints, // нераспределённые очки — клиент по ним показывает кнопку прокачки
    idTheLastAction:row.idTheLastAction,
    money:row.money,
    cooldowns:row.cooldowns,
    isCreated: row.isCreated,
    race: row.race,
    avatar: row.avatar

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
    coinReward: row.coinReward,
    locationId: row.locationId,
    respawnSeconds: row.respawnSeconds
  }
}
export function toFriendDto(p: { id: number; friendId: number; name: string; level: number }): FriendDto {
    return { 
      id: p.id, 
      friendId: p.friendId,
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
    ? db.select({ id: players.id, friendId: players.friendId, name: players.name, level: players.level })
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
    price: row.price,
    shopAvailable: row.shopAvailable,
    icon: row.icon
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
    targetCoins: row.targetCoins,
  };
}
