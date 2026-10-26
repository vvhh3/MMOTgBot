import type { LocationDto } from "@mmobot/shared";
import { getLocationAccess } from "@mmobot/shared";
import { and,eq,isNull,ne,sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config/env.js";
import { balanceCatalogItem } from "../modules/items/catalogs/balance.js";
import { seedMemeItemCatalog } from "../modules/items/catalogs/meme-items.js";
import { seedWeaponCatalog } from "../modules/items/catalogs/weapons.js";
import { canBypassLocationRestrictions } from "../modules/locations/access.js";
import { squareMobProfile,templateLoot } from '../modules/mobs/balance.js';
import { SQUARE_MOBS } from '../modules/mobs/catalogs/square.js';
import { replaceArchivedDailyQuests } from '../modules/quests/routes.js';
import { casinoSessions,characterSkins,combatSessions,items,locations,mobs,players,quests } from "./schema.js";

import { databaseExistedAtStartup,db,sqlite } from "./connection.js";

export function initializeDatabase(): void {
  const countPlayers = (): number | null => {
    if (!tableExists("players")) return null;
    return (sqlite.prepare('SELECT COUNT(*) AS count FROM "players"').get() as { count: number }).count;
  };
  const fileStat = (filePath: string) => {
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    return { size: stat.size, inode: stat.ino, mtime: stat.mtime.toISOString() };
  };
  console.info("[database] before migrations", JSON.stringify({
    path: config.databasePath,
    realPath: fs.existsSync(config.databasePath) ? fs.realpathSync(config.databasePath) : null,
    existedBeforeOpen: databaseExistedAtStartup,
    volumeMountPath: process.env.RAILWAY_VOLUME_MOUNT_PATH ?? null,
    dbFile: fileStat(config.databasePath),
    walFile: fileStat(`${config.databasePath}-wal`),
    players: countPlayers(),
  }));
  // Применяем миграции из папки drizzle (файлы 0000_*.sql, 0001_*.sql и т.д.).
  // drizzle следит за применёнными миграциями и выполняет только новые.
  migrate(db, { migrationsFolder: migrationsFolder() });
  // Старое поле создавалось вне SQL-миграций и отсутствует в чистой базе.
  // Удаляем его условно; больше ни один путь запуска не добавляет расы.
  if (columnExists("players", "race")) sqlite.exec('ALTER TABLE "players" DROP COLUMN "race"');
  // Сессии старых версий, завершённые до удаления при расчёте результата.
  db.delete(casinoSessions).where(ne(casinoSessions.status, "active")).run();
  console.info("[database] after migrations", JSON.stringify({ players: countPlayers() }));

  // Автофикс схемы: колонка locations.actions есть в коде и схеме, но не была
  // добавлена ни одной миграцией. Идемпотентно создаём её, если ещё не существует,
  // чтобы INSERT/SELECT не падали с "no column named actions".
  ensureLocationsActions();
  ensureItemsShopAvailable();

  // Автофикс старых колонок конструктора персонажа (is_created, avatar).
  ensurePlayerCharacterColumns();

  // Ниже — сид (начальные данные), который заносится в БД при первом запуске.
  // Список стартовых локаций: id, название, описание и координаты.
  const seedLocations: LocationDto[] = [
    { id: "square", name: "Площадь", description: "Описание площади", x: 31, y: 40 ,homeImg:"square-home.svg",fightImg:"square-fight.svg",actions:["fight","walk","money",], minLevel: 1, isOpen: true},
    { id: "rialto", name: "Рынок", description: "Описание рынка", x: 39, y: 37 ,homeImg:"square-home.svg",fightImg:"square-fight.svg",actions:["exchange","shop"], minLevel: 1, isOpen: true},
    { id: "market", name: "Сити парк", description: "Описание сити парка", x: 42, y: 33 ,homeImg:"market-home.svg",fightImg:"market-fight.svg",actions:["mines","blackjack","ladder"], minLevel: 1, isOpen: true},
    { id: "park", name: "Парк Победы", description: "Описание парка победы", x: 39, y: 27,homeImg:"park-home.svg",fightImg:"park-fight.svg",actions:["fight","walk"], minLevel: 1, isOpen: false},
    { id: "forest", name: "Солдатсикй лес", description: "Описание солдатского леса", x: 64, y: 33,homeImg:"forest-home.svg",fightImg:"forest-fight.svg",actions:["fight","walk"], minLevel: 1, isOpen: false},
    { id: "railway", name: "Липяги", description: "Описание станции", x: 70, y: 38,homeImg:"railway-home.svg",fightImg:"railway-fight.svg",actions:["fight","walk"], minLevel: 1, isOpen: false}
  ]

  const seedItems: typeof items.$inferInsert[] = [
    { id: 1, catalogKey: "rusty_knife", name: "Ржавый нож", description: "Простой нож", type: "weapon", weaponFamily: "legacy", damageCategory: "physical", damageType: "piercing", shopAvailable: true, icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 29L13 19M13 19L29 3L13 19Z"/> </svg>'},
    { id: 2, catalogKey: "leather_armor", name: "Кожаная броня", description: "Лёгкая защитная броня", type: "armor", shopAvailable: true, icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M16 2L6 8v8c0 6 4 10 10 12 6-2 10-6 10-12V8L16 2z'/><path d='M16 12v8'/><path d='M12 16h8'/></svg>"},
    { id: 3, catalogKey: "small_medkit", name: "Малая аптечка", description: "Восстанавливает здоровье", type: "potion", shopAvailable: true, icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M16 5v22M5 16h22'/><rect x='4' y='4' width='24' height='24' rx='4'/></svg>"},
    { id: 4, catalogKey: "scrap_metal", name: "Металлолом", description: "Полезный материал", type: "material", damage: 0, defense: 0, healAmount: 0, price: 5, shopAvailable: false, icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M5 27l4-4 5-6 8-9M9 23l-3-3M18 27c4-7 8-14 9-22l-6 1c-1 4-3 8-5 11'/></svg>" },
    { id: 5, catalogKey: "old_rifle", rarity: "rare", name: "Старая винтовка", description: "Рабочее оружие", type: "weapon", weaponFamily: "legacy", damageCategory: "physical", damageType: "piercing", shopAvailable: true, icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M3 24h26M3 24l2-6h24l0 6M7 24v4M12 24v4M17 24v4M22 24v4M14 18h6'/></svg>" }
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
        // minLevel/isOpen управляются в БД и не сбрасываются при перезапуске.
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
  db.insert(items)
    .values(seedItems.map(balanceCatalogItem))
    .onConflictDoNothing()
    .run()

  // Новый предмет получает свободный id, чтобы не затереть предметы из админки.
  const stick = db.select().from(items).where(eq(items.catalogKey, "training_stick")).get()
    ?? db.select().from(items).where(eq(items.name, "Палка")).get()
    ?? db.insert(items).values({
      catalogKey: "training_stick", name: "Палка", description: "Простое оружие, которое можно добыть на Площади",
      type: "weapon", weaponFamily: "legacy", damageCategory: "physical", damageType: "blunt", damage: 1, price: 2, shopAvailable: false,
      icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round'><path d='M7 27L23 5M17 13L25 12'/></svg>",
    }).returning().get();
  if (stick.description === 'Простое оружие, которое можно добыть у крыс на Площади') {
    db.update(items).set({ description: 'Простое оружие, которое можно добыть на Площади' }).where(eq(items.id, stick.id)).run();
  }
  seedWeaponCatalog(db);
  seedMemeItemCatalog(db);
  // One stable key per template; restarts preserve admin edits, empty loot and archives.
  const itemCatalog = db.select().from(items).all();
  for (const profile of SQUARE_MOBS) {
    const reward = { normal: [8, 5], strong: [15, 10], elite: [25, 20], boss: [55, 45] }[profile.rank];
    const combatProfile = squareMobProfile(profile);
    db.insert(mobs).values({ catalogKey: profile.key, combatProfile, name: profile.name, description: profile.description,
      locationId: 'square', level: 1, maxHealth: profile.maxHealth, strength: profile.strength, defense: profile.defense,
      pointsReward: reward[0], coinReward: reward[1], respawnSeconds: 1,
      loot: templateLoot(profile.rank, profile.loot, itemCatalog),
    }).onConflictDoNothing({ target: mobs.catalogKey }).run();
    // Existing IDs, base stats and loot stay intact; only the previously code-owned profile is initialized.
    db.update(mobs).set({ combatProfile }).where(and(eq(mobs.catalogKey, profile.key), isNull(mobs.combatProfile))).run();
  }
  const mobId = (key: string) => String(db.select().from(mobs).where(eq(mobs.catalogKey, key)).get()!.id);

  // Дополняем каталог и в существующей БД. Награды/настройки уже созданных
  // заданий не перезаписываем, повторный запуск не создаёт копии.
  const seedQuests: typeof quests.$inferInsert[] = [
    { title: "Прогулка по набережной", description: "Прогуляйтесь по любой локации 3 раза", difficulty: "easy", objectiveType: "walk", targetId: null, targetCount: 3, targetXp: 30, targetPoints: 5, targetCoins: 10 },
    { title: "На довольствие не подавать", description: "Победите двух голубей на муниципальном довольствии на Площади", difficulty: "easy", objectiveType: "kill", targetId: mobId('square_pigeon'), targetCount: 2, targetXp: 30, targetPoints: 5, targetCoins: 15 },
    { title: "Ветер перемен", description: "Победите два пакета встречного ветра на Площади", difficulty: "easy", objectiveType: "kill", targetId: mobId('square_bag'), targetCount: 2, targetXp: 30, targetPoints: 5, targetCoins: 15 },
    { title: "Разведка Сити парка", description: "Посетите Сити парк", difficulty: "medium", objectiveType: "visit", targetId: "market", targetCount: 1, targetXp: 80, targetPoints: 15, targetCoins: 20 },
    { title: "Площадь под контролем", description: "Победите десять противников во время прогулок", difficulty: "hard", objectiveType: "kill", targetId: null, targetCount: 10, targetXp: 120, targetPoints: 25, targetCoins: 60 },
    { title: "Знакомство с рынком", description: "Посетите Рынок", difficulty: "easy", objectiveType: "visit", targetId: "rialto", targetCount: 1, targetXp: 25, targetPoints: 5, targetCoins: 10 },
    { title: "Патруль Площади", description: "Прогуляйтесь по Площади 5 раз", difficulty: "easy", objectiveType: "walk", targetId: "square", targetCount: 5, targetXp: 40, targetPoints: 10, targetCoins: 15 },
    { title: "Запасливый новичок", description: "Найдите 3 любых предмета на прогулках или в боях", difficulty: "easy", objectiveType: "collect", targetId: null, targetCount: 3, targetXp: 40, targetPoints: 10, targetCoins: 15 },
    { title: "Первая удача", description: "Накопите 20 монет прибыли в выигрышных раундах любой игры казино (без учёта ставки)", difficulty: "easy", objectiveType: "casino_win", targetId: null, targetCount: 20, targetXp: 40, targetPoints: 10, targetCoins: 10 },
    { title: "Пять кругов — не крюк", description: "Прогуляйтесь по Площади пять раз", difficulty: "medium", objectiveType: "walk", targetId: "square", targetCount: 5, targetXp: 50, targetPoints: 10, targetCoins: 25 },
    { title: "Охотник за трофеями", description: "Победите 5 любых монстров", difficulty: "medium", objectiveType: "kill", targetId: null, targetCount: 5, targetXp: 120, targetPoints: 25, targetCoins: 35 },
    { title: "Мелочь, а неприятно", description: "Победите водяного мелкого номинала на Площади", difficulty: "medium", objectiveType: "kill", targetId: mobId('square_fountain'), targetCount: 1, targetXp: 55, targetPoints: 10, targetCoins: 30 },
    { title: "Культурно объяснили", description: "Победите афишу «Концерт вчера» на Площади", difficulty: "medium", objectiveType: "kill", targetId: mobId('square_poster'), targetCount: 1, targetXp: 55, targetPoints: 10, targetCoins: 30 },
    { title: "Знаток двадцати одного", description: "Накопите 50 монет прибыли в выигрышных раундах «21» (без учёта ставки)", difficulty: "medium", objectiveType: "casino_win", targetId: "blackjack", targetCount: 50, targetXp: 100, targetPoints: 20, targetCoins: 25 },
    { title: "Трофеи без гарантии", description: "Добудьте три любых предмета за победы над противниками", difficulty: "hard", objectiveType: "loot", targetId: null, targetCount: 3, targetXp: 100, targetPoints: 20, targetCoins: 50 },
    { title: "Крупный выигрыш", description: "Накопите 200 монет прибыли в выигрышных раундах любой игры казино (без учёта ставки)", difficulty: "hard", objectiveType: "casino_win", targetId: null, targetCount: 200, targetXp: 250, targetPoints: 50, targetCoins: 60 },
    { title: "На вершине удачи", description: "Накопите 100 монет прибыли в выигрышных раундах «Лестницы» (без учёта ставки)", difficulty: "hard", objectiveType: "casino_win", targetId: "ladder", targetCount: 100, targetXp: 220, targetPoints: 45, targetCoins: 50 }
  ];
  db.transaction((tx) => {
    const existingTitles = new Set(tx.select({ title: quests.title }).from(quests).all().map((quest) => quest.title));
    const missingQuests = seedQuests.filter((quest) => !existingTitles.has(quest.title));
    if (missingQuests.length > 0) tx.insert(quests).values(missingQuests).run();
  });
  replaceArchivedDailyQuests();
  resetUnavailablePlayerLocations();
}

// После изменения правил игроки не должны оставаться в закрытых локациях.
// На следующем входе они смогут выбрать доступную точку на карте.
function resetUnavailablePlayerLocations(): void {
  db.transaction((tx) => {
    const residents = tx.select({ player: players, location: locations }).from(players)
      .innerJoin(locations, eq(players.currentLocationId, locations.id)).all();
    for (const { player, location } of residents) {
      if (getLocationAccess(location, player.level, canBypassLocationRestrictions(player)) === "available") continue;
      tx.update(players).set({
        currentLocationId: null,
        ...(player.idTheLastAction?.type === "TakeAWalk" ? { idTheLastAction: null } : {}),
      }).where(eq(players.id, player.id)).run();
      tx.update(combatSessions).set({ status: "fled" })
        .where(and(eq(combatSessions.playerId, player.id), eq(combatSessions.status, "active"))).run();
    }
  });
}

// Путь к папке с миграциями: рядом с этим файлом (apps/server/src) поднимаемся на уровень выше → apps/server/drizzle.
function migrationsFolder(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle");
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
  if (!columnExists("players", "avatar")) {
    sqlite.exec(`ALTER TABLE "players" ADD COLUMN "avatar" text`);
  }
}

