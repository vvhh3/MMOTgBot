import type { GroupEventConfig, GroupBattleState, PartyMemberStatus } from '@mmobot/shared';
import type { BattleState } from '@mmobot/shared';
import { check,index,integer,real,sqliteTable,text,uniqueIndex } from "drizzle-orm/sqlite-core";
import { nowGameTime } from "../shared/time.js";
// TradeItem — тип одного пункта выкладки в трейде (из общего пакета)
import type { CasinoGameType,Cooldowns,DamageCategory,DamageType,ItemRarity,LastAction,MobLootEntry,MobCombatProfile,TradeItem,WeaponFamily,WeaponPassiveId } from "@mmobot/shared";
import { sql } from "drizzle-orm";

// Локации игрового мира: уникальный id (текстовый ключ) + название, описание и координаты x/y на карте.
export const locations = sqliteTable("locations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  x: real("x").notNull(),
  y: real("y").notNull(),
  homeImg:text("homeImg").notNull(),
  fightImg:text("fightImg").notNull(),
  minLevel: integer("min_level").notNull().default(1),
  isOpen: integer("is_open", { mode: "boolean" }).notNull().default(false),
  actions: text("actions", { mode: "json" })
    .$type<string[]>()
    .notNull()
}, (table) => [
  check("locations_min_level_positive", sql`${table.minLevel} >= 1 AND ${table.minLevel} = CAST(${table.minLevel} AS INTEGER)`),
  check("locations_is_open_boolean", sql`${table.isOpen} IN (0, 1)`),
])

// Каталог доступных обликов персонажа. В БД хранится публичный URL,
// сами изображения раздаются сервером как статические файлы.
export const characterSkins = sqliteTable("character_skins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  imageUrl: text("image_url").notNull().unique(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
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
    lastRegenTime: text("last_regen_time").notNull().$defaultFn(() => nowGameTime()),
    idTheLastAction: text("id_the_last_action", {mode: "json",}).$type<LastAction>(),
    money: integer("money").notNull().default(0),
    cooldowns: text("cooldowns", { mode: "json" }).$type<Cooldowns>().notNull().default({}),
    isCreated: integer("is_created", { mode: "boolean" }).notNull().default(false),
    factionId: text("faction_id").$type<import("@mmobot/shared").FactionId>(),
    tutorialStep: text("tutorial_step", { enum: ["welcome", "battle", "equip", "complete", "done"] }).notNull().default("done"),
    avatar: text("avatar"),
  },
  // Индекс ускоряет поиск игроков по текущей локации (напр. "кто сейчас на площади").
  (table) => [
    index("players_current_location_idx").on(table.currentLocationId),
    index("players_faction_idx").on(table.factionId),
    uniqueIndex("players_friend_id_idx").on(table.friendId),
    check("money_non_negative",sql`${table.money} >= 0`)
  ]
)

// Мобы (враги), обитающие в локациях.
// loot хранит JSON-массив { itemType, chancePercent }, по одной штуке на строку.
// Drizzle через mode: "json"
// автоматически сериализует массив в JSON при записи и парсит обратно при чтении.
// onDelete: "cascade" — при удалении локации удаляются и все её мобы.
export const mobs = sqliteTable('mobs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  catalogKey: text('catalog_key').unique(),
  combatProfile: text('combat_profile', { mode: 'json' }).$type<MobCombatProfile>(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  name: text("name").notNull(),
  description: text("description").notNull(),
  level: integer("level").notNull(),
  maxHealth: integer("max_health").notNull(),
  strength: integer("strength").notNull(),
  defense: integer("defense").notNull(),
  loot: text("loot", { mode: "json" }).$type<MobLootEntry[]>().notNull(),
  pointsReward: integer("points_reward").notNull(),
  coinReward: integer("coin_reward").notNull().default(0),
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
  price: integer("price").notNull().default(0),
  sellPrice: integer("sell_price").notNull().default(0),
  shopAvailable: integer("shop_available", { mode: "boolean" }).notNull().default(false),
  icon: text("icon").notNull().default(""),
  catalogKey: text("catalog_key").unique(),
  rarity: text("rarity").$type<ItemRarity>().notNull().default("common"),
  weaponFamily: text("weapon_family").$type<WeaponFamily>(),
  damageCategory: text("damage_category").$type<DamageCategory>(),
  damageType: text("damage_type").$type<DamageType>(),
  passiveId: text("passive_id").$type<WeaponPassiveId>(),
  passiveParams: text("passive_params", { mode: "json" }).$type<Record<string, number>>().notNull().default({}),
})

// Сессии боя: у игрока в каждый момент может быть максимум один активный бой с мобом.
// Частичный uniqueIndex на playerId ограничивает только активные сессии.
// onDelete: "cascade" — при удалении игрока/моба его сессии боя удаляются автоматически.
// Завершённые сессии хранятся 24 часа для чтения результата и повторов команд.
// aborted — техническое прекращение без наград.
export const combatSessions = sqliteTable('combat_sessions', {
  roundNumber: integer("round_number").notNull().default(1),
  roundStartedAt: text("round_started_at"),
  stateVersion: integer("state_version").notNull().default(0),
  battleState: text("battle_state", { mode: "json" }).$type<BattleState>(),
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  mobId: integer("mob_id").notNull().references(() => mobs.id, { onDelete: "cascade" }),
  playerHealth: integer("player_health").notNull(),
  mobHealth: integer("mob_health").notNull(),
  status: text("status", { enum: ["active", "victory", "defeat", "fled", "aborted"] }).notNull().default("active"),
  startedAt: text("started_at").notNull(),
  lastActionAt: text("last_action_at").notNull()
},
  (table) => [
    uniqueIndex("combat_sessions_player_idx").on(table.playerId).where(sql`${table.status} = 'active'`),
    index("combat_sessions_mob_idx").on(table.mobId),
    index("combat_sessions_status_last_action_idx").on(table.status, table.lastActionAt),
  ]
)

// Оружие хранится по экземплярам (quantity=1, собственный weaponLevel).
// Остальные предметы объединяются частичным индексом в один стек.
export const inventoryItems = sqliteTable("inventory_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    itemType: integer("item_type").notNull(), // id предмета 
    quantity: integer("quantity").notNull(),
    acquiredAt: text("acquired_at").notNull(),
    equiped: integer("equiped", { mode: "boolean" }).notNull().default(false),
    weaponLevel: integer("weapon_level")
  },
  (table) => [
    uniqueIndex("inventory_items_player_stack_unique").on(table.playerId, table.itemType).where(sql`${table.weaponLevel} IS NULL`),
    check("inventory_weapon_instance", sql`${table.weaponLevel} IS NULL OR (${table.quantity} = 1 AND ${table.weaponLevel} >= 1 AND ${table.weaponLevel} = CAST(${table.weaponLevel} AS INTEGER))`),
  ]
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
    index("events_player_idx").on(table.playerId),
    index("events_created_idx").on(table.createdAt),
  ]
);


// Каталог квестов. difficulty — сложность: easy (лёгкий) | medium (средний) | hard (тяжёлый).
// objectiveType — какое действие засчитывается (kill — убить моба, walk — прогуляться,
// collect — найти предмет на прогулке или в бою, loot — получить предмет за победу над мобом,
// visit — посетить локацию, casino_win — накопить прибыль в выигрышных раундах казино).
// targetId — id моба/предмета/локации либо mines/blackjack/ladder, NULL — любая цель.
// targetCount — количество действий/предметов или монет прибыли для casino_win.
export const quests = sqliteTable("quests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  title: text("title").notNull(),
  description: text("description").notNull(),
  difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] as const }).notNull(),
  objectiveType: text("objective_type", { enum: ["kill", "walk", "collect", "visit", "loot", "casino_win"] as const }).notNull(),
  targetId: text("target_id"), // id цели: моба/предмета/локации, NULL = любой
  targetCount: integer("target_count").notNull(), // сколько раз нужно выполнить действие
  targetXp: integer("target_xp").notNull().default(0), // награда: опыт
  targetPoints: integer("target_points").notNull().default(0), // награда: очки
  targetCoins: integer("target_coins").notNull().default(0), // награда: монеты
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
  roundNumber: integer("round_number").notNull().default(1),
  roundStartedAt: text("round_started_at"),
  stateVersion: integer("state_version").notNull().default(0),
  battleState: text("battle_state", { mode: "json" }).$type<BattleState>(),
  id: integer("id").primaryKey({autoIncrement: true}),
  player1Id: integer("player_1_id").notNull().references(() => players.id,{onDelete: "cascade"}),
  player2Id: integer("player_2_id").notNull().references(() => players.id,{onDelete: "cascade"}),
  status: text("status", {enum: ["pending","active", "finished"]}).notNull().default("pending"),
  player1Health: integer("player_1_health").notNull(),
  player2Health: integer("player_2_health").notNull(),
  turn: text("turn", {enum: ["player1", "player2"]}).notNull().default("player1"),
  winnerId: integer("winner_id"),
  creadetAt: text("creadet_at").notNull(),
  lastActionAt: text("last_action_at")
}, (table) => [
  index("pvp_player1_idx").on(table.player1Id),
  index("pvp_player2_idx").on(table.player2Id),
  index("pvp_status_last_action_idx").on(table.status, table.lastActionAt),
])

export const casinoSessions = sqliteTable("casino_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  game: text("game", { enum: ["mines", "blackjack", "ladder"] as const }).$type<CasinoGameType>().notNull(),
  status: text("status", { enum: ["active", "won", "lost"] as const }).notNull().default("active"),
  bet: integer("bet").notNull(),
  multiplier: real("multiplier").notNull().default(1),
  potentialPayout: integer("potential_payout").notNull().default(0),
  state: text("state", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  createdAt: text("created_at").notNull(),
  finishedAt: text("finished_at"),
}, (table) => [
  index("casino_sessions_player_idx").on(table.playerId),
  index("casino_sessions_player_status_idx").on(table.playerId, table.status),
])


// Типы строк таблиц (выводятся drizzle из схемы). $inferSelect — тип одной записи из SELECT.
// EventRow дополнительно включает playerName — имя игрока, подтянутое через join.
export type PlayerRow = typeof players.$inferSelect;
export type LocationRow = typeof locations.$inferSelect;
export type CharacterSkinRow = typeof characterSkins.$inferSelect;
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
export type CasinoSessionRow = typeof casinoSessions.$inferSelect

// Special co-op event. Membership is persisted independently of socket presence.
export const groupEventWindows = sqliteTable('group_event_windows', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  locationId: text('location_id').notNull().references(() => locations.id),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  startsAt: text('starts_at').notNull(), endsAt: text('ends_at').notNull(),
  minLevel: integer('min_level').notNull().default(1),
  config: text('config', { mode: 'json' }).$type<GroupEventConfig>().notNull(),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, t => [
  check('group_event_window_dates', sql`${t.startsAt} < ${t.endsAt}`),
  check('group_event_window_level', sql`${t.minLevel} >= 1 AND ${t.minLevel} = CAST(${t.minLevel} AS INTEGER)`),
  check('group_event_window_enabled', sql`${t.enabled} IN (0,1)`),
  index('group_event_window_access_idx').on(t.locationId, t.enabled, t.startsAt, t.endsAt),
]);
export const eventParties = sqliteTable('event_parties', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventWindowId: integer('event_window_id').notNull().references(() => groupEventWindows.id),
  leaderPlayerId: integer('leader_player_id').notNull().references(() => players.id),
  status: text('status', { enum: ['forming','active','finished','disbanded','expired'] }).notNull().default('forming'),
  version: integer('version').notNull().default(0),
  creationRequestId: text('creation_request_id').notNull(), creationFingerprint: text('creation_fingerprint').notNull(),
  processedRequests: text('processed_requests', { mode: 'json' }).$type<{ playerId: number; requestId: string; fingerprint: string }[]>().notNull().default([]),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(), expiresAt: text('expires_at').notNull(),
}, t => [
  check('event_party_status', sql`${t.status} IN ('forming','active','finished','disbanded','expired')`),
  check('event_party_version', sql`${t.version} >= 0 AND ${t.version} = CAST(${t.version} AS INTEGER)`),
  uniqueIndex('event_party_creation_unique').on(t.leaderPlayerId, t.creationRequestId), index('event_party_status_expiry_idx').on(t.status,t.expiresAt)]);
export const eventPartyMembers = sqliteTable('event_party_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  partyId: integer('party_id').notNull().references(() => eventParties.id),
  playerId: integer('player_id').notNull().references(() => players.id),
  invitedByPlayerId: integer('invited_by_player_id').references(() => players.id),
  slot: integer('slot').notNull(),
  status: text('status').$type<PartyMemberStatus>().notNull(),
  ready: integer('ready', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(), inviteExpiresAt: text('invite_expires_at'), joinedAt: text('joined_at'), endedAt: text('ended_at'),
}, t => [
  check('event_member_status', sql`${t.status} IN ('invited','joined','active','left','declined','cancelled','expired','finished')`),
  check('event_member_slot', sql`${t.slot} IN (0,1,2)`), check('event_member_ready', sql`${t.ready} IN (0,1)`),
  uniqueIndex('event_member_current_unique').on(t.playerId).where(sql`${t.status} IN ('joined','active')`),
  uniqueIndex('event_member_slot_unique').on(t.partyId,t.slot).where(sql`${t.status} IN ('invited','joined','active')`),
  uniqueIndex('event_member_party_player_unique').on(t.partyId,t.playerId).where(sql`${t.status} IN ('invited','joined','active')`),
  index('event_member_invite_idx').on(t.playerId,t.status,t.inviteExpiresAt),
]);
export const groupEventRuns = sqliteTable('group_event_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  partyId: integer('party_id').notNull().references(() => eventParties.id),
  eventWindowId: integer('event_window_id').notNull().references(() => groupEventWindows.id),
  status: text('status', { enum: ['active','victory','defeat','aborted'] }).notNull().default('active'),
  configSnapshot: text('config_snapshot', { mode: 'json' }).$type<GroupEventConfig>().notNull(),
  battleState: text('battle_state', { mode: 'json' }).$type<GroupBattleState>().notNull(),
  waveNumber: integer('wave_number').notNull().default(1), roundNumber: integer('round_number').notNull().default(1),
  stateVersion: integer('state_version').notNull().default(0),
  roundStartedAt: text('round_started_at').notNull(), roundDeadlineAt: text('round_deadline_at').notNull(),
  startedAt: text('started_at').notNull(), lastActionAt: text('last_action_at').notNull(), expiresAt: text('expires_at').notNull(), finishedAt: text('finished_at'),
}, t => [
  check('group_event_run_status', sql`${t.status} IN ('active','victory','defeat','aborted')`),
  check('group_event_run_numbers', sql`${t.waveNumber} >= 1 AND ${t.waveNumber} = CAST(${t.waveNumber} AS INTEGER) AND ${t.roundNumber} >= 1 AND ${t.roundNumber} = CAST(${t.roundNumber} AS INTEGER) AND ${t.stateVersion} >= 0 AND ${t.stateVersion} = CAST(${t.stateVersion} AS INTEGER)`),
  uniqueIndex('group_event_run_party_unique').on(t.partyId), index('group_event_run_deadline_idx').on(t.status,t.roundDeadlineAt), index('group_event_run_expiry_idx').on(t.status,t.expiresAt)]);
export const groupEventRewards = sqliteTable('group_event_rewards', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  runId: integer('run_id').notNull().references(() => groupEventRuns.id),
  eventWindowId: integer('event_window_id').notNull().references(() => groupEventWindows.id),
  playerId: integer('player_id').notNull().references(() => players.id),
  xp: integer('xp').notNull(), points: integer('points').notNull(), coins: integer('coins').notNull(),
  items: text('items', { mode: 'json' }).$type<{ name: string; quantity: number; itemType: number }[]>().notNull(),
  grantedAt: text('granted_at').notNull(),
}, t => [
  check('group_event_reward_amounts', sql`${t.xp} >= 0 AND ${t.xp} = CAST(${t.xp} AS INTEGER) AND ${t.points} >= 0 AND ${t.points} = CAST(${t.points} AS INTEGER) AND ${t.coins} >= 0 AND ${t.coins} = CAST(${t.coins} AS INTEGER)`),
  uniqueIndex('group_event_reward_unique').on(t.runId,t.playerId), index('group_event_reward_player_idx').on(t.playerId,t.eventWindowId)]);
export type EventPartyRow = typeof eventParties.$inferSelect;
export type GroupEventRunRow = typeof groupEventRuns.$inferSelect;
export type GroupEventWindowRow = typeof groupEventWindows.$inferSelect;
