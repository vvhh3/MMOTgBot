import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const locations = sqliteTable("locations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  x: real("x").notNull(),
  y: real("y").notNull()
})

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
  (table) => [index("players_current_location_idx").on(table.currentLocationId)]
)

export const mobs = sqliteTable('mobs',{
  id: integer('id').primaryKey({autoIncrement: true}),
  name: text("name").notNull(),
  description: text("description").notNull(),
  level: integer("level").notNull(),
  maxHealth: integer("max_health").notNull(),
  strength: integer("strength").notNull(),
  loot: text("loot").notNull(),
  pointsReward: integer("points_reward").notNull(),
  locationId: text("location_id").references(() => locations.id,{onDelete: "cascade"})
})

export const combatSessions = sqliteTable('combat_sessions',{
    id: integer("id").primaryKey({autoIncrement: true}),
    playerId: integer("player_id").notNull().references(() => players.id, {onDelete: "cascade"}), //что за каскад? - это когда удаляется игрок, то удаляются все его сессии боя
    mobId: integer("mob_id").notNull().references(() => mobs.id, {onDelete: "cascade"}),
    playerHealth: integer("player_health").notNull(),
    mobHealth: integer("mob_health").notNull(),
    status: text("status",{enum: ["active", "victory", "defeat","fled"]}).notNull().default("active"),
    startedAt: text("started_at").notNull(),
    lastActionAt: text("last_action_at").notNull()
  },
  (table) => [uniqueIndex("combat_sessions_player_idx").on(table.playerId), index("combat_sessions_mob_idx").on(table.mobId)]
)

export const inventoryItems = sqliteTable("inventory_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    itemType: text("item_type").notNull(),
    quantity: integer("quantity").notNull(),
    acquiredAt: text("acquired_at").notNull()
  },
  (table) => [uniqueIndex("inventory_items_player_item_unique").on(table.playerId, table.itemType)]
);

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

export type PlayerRow = typeof players.$inferSelect;
export type LocationRow = typeof locations.$inferSelect;
export type InventoryItemRow = typeof inventoryItems.$inferSelect;
export type EventRow = typeof events.$inferSelect & { playerName: string };

export type CombatSessionRow = typeof combatSessions.$inferSelect;
export type MobRow = typeof mobs.$inferSelect