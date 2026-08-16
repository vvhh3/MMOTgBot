import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Локации игрового мира: уникальный id (текстовый ключ) + название, описание и координаты x/y на карте.
export const locations = sqliteTable("locations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  x: real("x").notNull(),
  y: real("y").notNull()
})

// Игроки. Значения по умолчанию задают стартовые характеристики нового персонажа.
// currentLocationId — ссылка на локацию, в которой сейчас находится игрок (может быть NULL, если ещё нигде нет).
export const players = sqliteTable("players",
  {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    health: integer('health').notNull().default(100),
    maxHealth: integer('max_health').notNull().default(100),
    strength: integer('strength').notNull().default(10),
    defense: integer("defense").notNull().default(5),
    level: integer("level").notNull().default(1),
    points: integer("points").notNull().default(0),
    currentLocationId: text("current_location_id").references(() => locations.id),
    createdAt: text("created_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull()
  },
  // Индекс ускоряет поиск игроков по текущей локации (напр. "кто сейчас на площади").
  (table) => [index("players_current_location_idx").on(table.currentLocationId)]
)

// Мобы (враги), обитающие в локациях.
// loot хранится как JSON-строка в колонке text, но drizzle через mode: "json" и $type<string[]>()
// автоматически сериализует массив в JSON при записи и парсит обратно при чтении.
// onDelete: "cascade" — при удалении локации удаляются и все её мобы.
export const mobs = sqliteTable('mobs',{
  id: integer('id').primaryKey({autoIncrement: true}),
  name: text("name").notNull(),
  description: text("description").notNull(),
  level: integer("level").notNull(),
  maxHealth: integer("max_health").notNull(),
  strength: integer("strength").notNull(),
  defense: integer("defense").notNull(),
  loot: text("loot", { mode: "json" }).$type<number[]>().notNull(),
  pointsReward: integer("points_reward").notNull(),
  locationId: text("location_id").notNull().references(() => locations.id,{onDelete: "cascade"}),
  respawnSeconds: integer("respawn_seconds").notNull(),
})

// Каталог предметов игры: оружие, броня, расходники и материалы.
// id — числовой ключ. Лут мобов (mobs.loot) и инвентарь игрока (inventoryItems.itemType)
// ссылаются на него по числовому id.
export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  type: text("type", { enum: ["weapon", "armor", "consumable", "material", "other"] as const }).notNull(),
  damage: integer("damage").notNull().default(0),
  defense: integer("defense").notNull().default(0),
  healAmount: integer("heal_amount").notNull().default(0),
  price: integer("price").notNull().default(0)
})

// Сессии боя: у игрока в каждый момент может быть максимум один активный бой с мобом.
// uniqueIndex на playerId гарантирует это на уровне БД.
// onDelete: "cascade" — при удалении игрока/моба его сессии боя удаляются автоматически.
// status: active (идёт бой) | victory | defeat | fled (игрок сбежал).
export const combatSessions = sqliteTable('combat_sessions',{
    id: integer("id").primaryKey({autoIncrement: true}),
    playerId: integer("player_id").notNull().references(() => players.id, {onDelete: "cascade"}),
    mobId: integer("mob_id").notNull().references(() => mobs.id, {onDelete: "cascade"}),
    playerHealth: integer("player_health").notNull(),
    mobHealth: integer("mob_health").notNull(),
    status: text("status",{enum: ["active", "victory", "defeat","fled"]}).notNull().default("active"),
    startedAt: text("started_at").notNull(),
    lastActionAt: text("last_action_at").notNull()
  },
  (table) => [uniqueIndex("combat_sessions_player_idx").on(table.playerId), index("combat_sessions_mob_idx").on(table.mobId)]
)

// Предметы в инвентаре игрока. uniqueIndex не даёт дублировать один и тот же предмет у игрока
// (вместо этого увеличивается quantity).
export const inventoryItems = sqliteTable("inventory_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    itemType: integer("item_type").notNull(), // id предмета 
    quantity: integer("quantity").notNull(),
    acquiredAt: text("acquired_at").notNull(),
    equiped: integer("equiped" ,{mode: "boolean"}).notNull().default(false)
  },
  (table) => [uniqueIndex("inventory_items_player_item_unique").on(table.playerId, table.itemType)]
);

// Журнал игровых событий (что происходило в локации). type — например, "entered", "scavenge".
// Индексы ускоряют выборку последних событий по локации и историю событий игрока.
export const events = sqliteTable("events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    createdAt: text("created_at").notNull()
  },
  (table) => [
    index("events_location_created_idx").on(table.locationId, table.createdAt),
    index("events_player_idx").on(table.playerId)
  ]
);

// Типы строк таблиц (выводятся drizzle из схемы). $inferSelect — тип одной записи из SELECT.
// EventRow дополнительно включает playerName — имя игрока, подтянутое через join.
export type PlayerRow = typeof players.$inferSelect;
export type LocationRow = typeof locations.$inferSelect;
export type InventoryItemRow = typeof inventoryItems.$inferSelect;
export type EventRow = typeof events.$inferSelect & { playerName: string };

export type MobRow = typeof mobs.$inferSelect
export type ItemRow = typeof items.$inferSelect
export type CombatSessionRow = typeof combatSessions.$inferSelect;