import type { LocationDto,MobDto } from "@mmobot/shared";
import { getLocationAccess } from "@mmobot/shared";
import { and,eq,ne,sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config/env.js";
import { seedMemeItemCatalog } from "../modules/items/catalogs/meme-items.js";
import { seedWeaponCatalog } from "../modules/items/catalogs/weapons.js";
import { canBypassLocationRestrictions } from "../modules/locations/access.js";
import { casinoSessions,characterSkins,combatSessions,items,locations,mobs,players,quests } from "./schema.js";

import { databaseExistedAtStartup,db,sqlite } from "./connection.js";

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
    { id: "square", name: "Площадь", description: "Описание площади", x: 31, y: 40 ,homeImg:"square-home.svg",fightImg:"square-fight.svg",actions:["fight","walk","money",], minLevel: 1, isOpen: true},
    { id: "rialto", name: "Рынок", description: "Описание рынка", x: 39, y: 37 ,homeImg:"square-home.svg",fightImg:"square-fight.svg",actions:["exchange","shop"], minLevel: 1, isOpen: true},
    { id: "market", name: "Сити парк", description: "Описание сити парка", x: 42, y: 33 ,homeImg:"market-home.svg",fightImg:"market-fight.svg",actions:["mines","blackjack","ladder"], minLevel: 1, isOpen: true},
    { id: "park", name: "Парк Победы", description: "Описание парка победы", x: 39, y: 27,homeImg:"park-home.svg",fightImg:"park-fight.svg",actions:["fight","walk"], minLevel: 1, isOpen: false},
    { id: "forest", name: "Солдатсикй лес", description: "Описание солдатского леса", x: 64, y: 33,homeImg:"forest-home.svg",fightImg:"forest-fight.svg",actions:["fight","walk"], minLevel: 1, isOpen: false},
    { id: "railway", name: "Липяги", description: "Описание станции", x: 70, y: 38,homeImg:"railway-home.svg",fightImg:"railway-fight.svg",actions:["fight","walk"], minLevel: 1, isOpen: false}
  ]

  // Стартовые мобы. locationId должен ссылаться на существующую локацию из seedLocations,
  // иначе сработает проверка FOREIGN KEY.
  const seedMobs: MobDto[] = [
    { id: 0, name: "Крыса", description: "какое то описание", level: 1, loot: [{ itemType: 1, chancePercent: 100 }], pointsReward: 10, coinReward: 5, locationId: "square", maxHealth: 10, strength: 2, defense: 0, respawnSeconds: 60 },
    { id: 2, name: "Ржавый дрон", description: "какое то описание", level: 3, loot: [{ itemType: 3, chancePercent: 100 }], pointsReward: 30, coinReward: 15, locationId: "park", maxHealth: 30, strength: 6, defense: 2, respawnSeconds: 120 },
    { id: 3, name: "Страж архива", description: "какое то описание", level: 4, loot: [{ itemType: 4, chancePercent: 100 }], pointsReward: 45, coinReward: 20, locationId: "forest",maxHealth: 45, strength: 8, defense: 3, respawnSeconds: 180 },
    { id: 4, name: "Снайпер", description: "какое то описание", level: 5, loot: [{ itemType: 5, chancePercent: 100 }], pointsReward: 60, coinReward: 30, locationId: "railway",maxHealth: 60, strength: 12, defense: 4, respawnSeconds: 240 }
  ]

  const seedItems: typeof items.$inferInsert[] = [
    { id: 1, name: "Ржавый нож", description: "Простой нож", type: "weapon", weaponFamily: "legacy", damageCategory: "physical", damageType: "piercing", damage: 3, defense: 0, healAmount: 0, price: 10, shopAvailable: true, icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 29L13 19M13 19L29 3L13 19Z"/> </svg>'},
    { id: 2, name: "Кожаная броня", description: "Лёгкая защитная броня", type: "armor", damage: 0, defense: 2, healAmount: 0, price: 15, shopAvailable: true, icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M16 2L6 8v8c0 6 4 10 10 12 6-2 10-6 10-12V8L16 2z'/><path d='M16 12v8'/><path d='M12 16h8'/></svg>"},
    { id: 3, name: "Малая аптечка", description: "Восстанавливает здоровье", type: "potion", damage: 0, defense: 0, healAmount: 10, price: 12, shopAvailable: true, icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M16 5v22M5 16h22'/><rect x='4' y='4' width='24' height='24' rx='4'/></svg>"},
    { id: 4, name: "Металлолом", description: "Полезный материал", type: "material", damage: 0, defense: 0, healAmount: 0, price: 5, shopAvailable: false, icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M5 27l4-4 5-6 8-9M9 23l-3-3M18 27c4-7 8-14 9-22l-6 1c-1 4-3 8-5 11'/></svg>" },
    { id: 5, name: "Старая винтовка", description: "Рабочее оружие", type: "weapon", weaponFamily: "legacy", damageCategory: "physical", damageType: "piercing", damage: 8, defense: 0, healAmount: 0, price: 30, shopAvailable: true, icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M3 24h26M3 24l2-6h24l0 6M7 24v4M12 24v4M17 24v4M22 24v4M14 18h6'/></svg>" }
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
    .values(seedItems)
    .onConflictDoNothing()
    .run()

  // Новый предмет получает свободный id, чтобы не затереть предметы из админки.
  const stick = db.select().from(items).where(eq(items.name, "Палка")).get()
    ?? db.insert(items).values({
      name: "Палка", description: "Простое оружие, которое можно добыть у крыс на Площади",
      type: "weapon", weaponFamily: "legacy", damageCategory: "physical", damageType: "blunt", damage: 1, price: 2, shopAvailable: false,
      icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round'><path d='M7 27L23 5M17 13L25 12'/></svg>",
    }).returning().get();
  seedWeaponCatalog(db);
  seedMemeItemCatalog(db);
  // Настройки добычи существующих мобов, включая пустой список, сохраняются.
  db.insert(mobs).values(seedMobs.map((mob) => mob.id === 0
    ? { ...mob, loot: [...mob.loot, { itemType: stick.id, chancePercent: 100 }] }
    : mob)).onConflictDoNothing().run();
  removeCityParkCombat();

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
  if (!columnExists("players", "race")) {
    sqlite.exec(`ALTER TABLE "players" ADD COLUMN "race" text`);
  }
  if (!columnExists("players", "avatar")) {
    sqlite.exec(`ALTER TABLE "players" ADD COLUMN "avatar" text`);
  }
}

