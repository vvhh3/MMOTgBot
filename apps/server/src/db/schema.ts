import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { nowGameTime } from "../time.js";
// TradeItem — тип одного пункта выкладки в трейде (из общего пакета)
import type { TradeItem } from "@mmobot/shared";

// Локации игрового мира: уникальный id (текстовый ключ) + название, описание и координаты x/y на карте.
export const locations = sqliteTable("locations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  x: real("x").notNull(),
  y: real("y").notNull(),
  homeImg:text("homeImg").notNull(),
  fightImg:text("fightImg").notNull(),
  actions: text("actions", { mode: "json" })
    .$type<string[]>()
    .notNull()
})

// Игроки. Значения по умолчанию задают стартовые характеристики нового персонажа.
// currentLocationId — ссылка на локацию, в которой сейчас находится игрок (может быть NULL, если ещё нигде нет).
export const players = sqliteTable("players",
  {
    id: integer("id").primaryKey(),
    friendId: integer("friend_id").notNull().default(0),
    name: text("name").notNull(),
    health: integer('health').notNull().default(100),
    maxHealth: integer('max_health').notNull().default(100),
    strength: integer('strength').notNull().default(10),
    defense: integer("defense").notNull().default(5),
    level: integer("level").notNull().default(1),
    xp: integer("xp").notNull().default(0), // очки опыта 
    points: integer("points").notNull().default(0), // Зачем я сделал очки? Будут идти для лидерборда
    // нераспределённые очки характеристик: даются за уровень, тратятся
    // через POST /me/stats на maxHealth / strength / defense
    statPoints: integer("stat_points").notNull().default(0),
    currentLocationId: text("current_location_id").references(() => locations.id),
    createdAt: text("created_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(), // что это за поле? Время последнеё активности игрока
    lastRegenTime: text("last_regen_time").notNull().$defaultFn(() => nowGameTime())
  },
  // Индекс ускоряет поиск игроков по текущей локации (напр. "кто сейчас на площади").
  (table) => [
    index("players_current_location_idx").on(table.currentLocationId),
    uniqueIndex("players_friend_id_idx").on(table.friendId)
  ]
)

// Мобы (враги), обитающие в локациях.
// loot хранится как JSON-строка в колонке text, но drizzle через mode: "json" и $type<string[]>()
// автоматически сериализует массив в JSON при записи и парсит обратно при чтении.
// onDelete: "cascade" — при удалении локации удаляются и все её мобы.
export const mobs = sqliteTable('mobs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  level: integer("level").notNull(),
  maxHealth: integer("max_health").notNull(),
  strength: integer("strength").notNull(),
  defense: integer("defense").notNull(),
  loot: text("loot", { mode: "json" }).$type<number[]>().notNull(),
  pointsReward: integer("points_reward").notNull(),
  locationId: text("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
  respawnSeconds: integer("respawn_seconds").notNull(),
})

// Каталог предметов игры: оружие, броня, расходники и материалы.
// id — числовой ключ. Лут мобов (mobs.loot) и инвентарь игрока (inventoryItems.itemType)
// ссылаются на него по числовому id.
export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  type: text("type", { enum: ["weapon", "armor", "potion", "material", "other"] as const }).notNull(),
  damage: integer("damage").notNull().default(0),
  defense: integer("defense").notNull().default(0),
  healAmount: integer("heal_amount").notNull().default(0), // зачем это поле? Это поле для показа сколько захилит предмет
  price: integer("price").notNull().default(0)
})

// Сессии боя: у игрока в каждый момент может быть максимум один активный бой с мобом.
// uniqueIndex на playerId гарантирует это на уровне БД.
// onDelete: "cascade" — при удалении игрока/моба его сессии боя удаляются автоматически.
// status: active (идёт бой) | victory | defeat | fled (игрок сбежал).
export const combatSessions = sqliteTable('combat_sessions', {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  mobId: integer("mob_id").notNull().references(() => mobs.id, { onDelete: "cascade" }),
  playerHealth: integer("player_health").notNull(),
  mobHealth: integer("mob_health").notNull(),
  status: text("status", { enum: ["active", "victory", "defeat", "fled"] }).notNull().default("active"),
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
    equiped: integer("equiped", { mode: "boolean" }).notNull().default(false)
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


// Каталог квестов. difficulty — сложность: easy (лёгкий) | medium (средний) | hard (тяжёлый).
// objectiveType — какое действие засчитывается (kill — убить моба, walk — прогуляться,
// collect — собрать предмет, visit — посетить локацию).
// targetId — конкретная цель (id моба/предмета/локации), NULL — любой объект.
// targetCount — сколько раз нужно выполнить действие. targetXp/targetPoints — награда.
export const quests = sqliteTable("quests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] as const }).notNull(),
  objectiveType: text("objective_type", { enum: ["kill", "walk", "collect", "visit"] as const }).notNull(),
  targetId: text("target_id"), // id цели: моба/предмета/локации, NULL = любой
  targetCount: integer("target_count").notNull(), // сколько раз нужно выполнить действие
  targetXp: integer("target_xp").notNull().default(0), // награда: опыт
  targetPoints: integer("target_points").notNull().default(0), // награда: очки
}, (table) => [index("quests_diffcluty_idx").on(table.difficulty)])

// Выданные игроку квесты. assignedDay — дата выдачи ("2026-08-20").
// uniqueIndex не даст выдать один и тот же квест игроку дважды в один день.
export const playerQuests = sqliteTable("player_quests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  questId: integer("quest_id").notNull().references(() => quests.id, { onDelete: "cascade" }),
  assignedDay: text("assigned_day").notNull(),// дата выдачи квеста ("2026-08-20")
  progress: integer("progress").notNull().default(0), // сколько из targetCount уже сделано (3/5)
  status: text("status", { enum: ["waiting", "completed", "claimed"] as const }).notNull().default("waiting"),
  completedAt: text("completed_at"),
  claimedAt: text("claimed_at") // когда забрана награда за квест
}, (table) => [
  uniqueIndex("player_quests_day_unique").on(table.playerId, table.assignedDay, table.questId),
  index("player_quests_player_idx").on(table.playerId)
])

//Обмем между игроками
export const trades = sqliteTable("trades", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromPlayerId: integer("from_player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  toPlayerId: integer("to_player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  // pending = приглашение, open = окно трейда, accepted/declined/cancelled = итог
  status: text("status", { enum: ["pending", "open", "accepted", "declined", "cancelled"] as const }).notNull().default("pending"),
  fromOffer: text("from_offer", { mode: "json" }).$type<TradeItem[]>().notNull().default([]),
  toOffer: text("to_offer", { mode: "json" }).$type<TradeItem[]>().notNull().default([]),
  fromReady: integer("from_ready", { mode: "boolean" }).notNull().default(false),
  toReady: integer("to_ready", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("trades_to_player_idx").on(table.toPlayerId, table.status),
  index("trades_from_player_idx").on(table.fromPlayerId, table.status)
]);


// Друзья: заявка/дружба между двумя игроками.
// fromId — кто отправил заявку, toId — кто её получил.
// status:
//   pending  — заявка отправлена, ждёт ответа
//   accepted — игроки стали друзьями
//   declined — получатель отклонил заявку
//   removed  — кто-то удалил друга / отозвал заявку
// Уникальный индекс на пару (fromId, toId) не даёт отправить
// одну и ту же заявку дважды, а также хранить зеркальную пару (A→B и B→A).
export const friendships = sqliteTable("friendships", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromId: integer("from_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  toId: integer("to_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["pending", "accepted", "declined", "removed"] }).notNull().default("pending"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
}, (table) => [
  uniqueIndex("friendships_pair_unique").on(table.fromId, table.toId)
]);

export const pvpSessions = sqliteTable("pvp_sessions", {
  id: integer("id").primaryKey({autoIncrement: true}),
  player1Id: integer("player_1_id").notNull().references(() => players.id,{onDelete: "cascade"}),
  player2Id: integer("player_2_id").notNull().references(() => players.id,{onDelete: "cascade"}),
  status: text("status", {enum: ["pending","active", "finished"]}).notNull().default("pending"),
  player1Health: integer("player_1_health").notNull(),
  player2Health: integer("player_2_health").notNull(),
  turn: text("turn", {enum: ["player1", "player2"]}).notNull().default("player1"),
  winnerId: integer("winner_id"),
  creadetAt: text("creadet_at").notNull(),
  lastActionAt: text("last_action_at").notNull()
}, (table) => [
  index("pvp_player1_idx").on(table.player1Id),
  index("pvp_player2_idx").on(table.player2Id),
])


// Типы строк таблиц (выводятся drizzle из схемы). $inferSelect — тип одной записи из SELECT.
// EventRow дополнительно включает playerName — имя игрока, подтянутое через join.
export type PlayerRow = typeof players.$inferSelect;
export type LocationRow = typeof locations.$inferSelect;
export type InventoryItemRow = typeof inventoryItems.$inferSelect;
export type EventRow = typeof events.$inferSelect & { playerName: string };

export type MobRow = typeof mobs.$inferSelect
export type ItemRow = typeof items.$inferSelect
export type CombatSessionRow = typeof combatSessions.$inferSelect;

export type QuestsRow = typeof quests.$inferSelect
export type PlayerQuestsRow = typeof playerQuests.$inferSelect


export type TradeRow = typeof trades.$inferSelect
export type PvpSessionRow = typeof pvpSessions.$inferSelect
export type FriendshipRow = typeof friendships.$inferSelect