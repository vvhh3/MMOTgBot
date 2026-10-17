import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { getLocationAccess } from "@mmobot/shared";

const directory = mkdtempSync(path.join(tmpdir(), "mmobot-locations-"));
process.env.DATABASE_PATH = path.join(directory, "test.db");
process.env.BOT_TOKEN = "123456:test-token";
process.env.SESSION_SECRET = "location-tests";
process.env.ADMIN_IDS = "1";
process.env.DEV_BYPASS_AUTH = "false";
const broadcast = mock.fn();
const moveSockets = mock.fn();
mock.module("../dist/notification.js", { namedExports: { notify: mock.fn() } });
mock.module("../dist/realTime.js", { namedExports: {
  isPlayerOnline: () => false, emitToPlayer: mock.fn(),
  broadcastLocation: broadcast, moveSocketToLocation: moveSockets,
} });

// Обновляем настоящую старую схему, включая локации с игроками и внешними ключами.
const migrationSource = fileURLToPath(new URL("../drizzle/", import.meta.url));
const oldMigrations = path.join(directory, "old-migrations");
mkdirSync(path.join(oldMigrations, "meta"), { recursive: true });
const journal = JSON.parse(readFileSync(path.join(migrationSource, "meta/_journal.json"), "utf8"));
journal.entries = journal.entries.filter((entry) => entry.idx < 25);
writeFileSync(path.join(oldMigrations, "meta/_journal.json"), JSON.stringify(journal));
for (const entry of journal.entries) {
  copyFileSync(path.join(migrationSource, `${entry.tag}.sql`), path.join(oldMigrations, `${entry.tag}.sql`));
}
const legacy = new Database(process.env.DATABASE_PATH);
legacy.pragma("foreign_keys = ON");
migrate(drizzle(legacy), { migrationsFolder: oldMigrations });
legacy.exec(`
  INSERT INTO locations (id, name, description, x, y, homeImg, fightImg) VALUES
    ('square', 'Площадь', 'Описание', 1, 1, 'square-home.svg', 'square-fight.svg'),
    ('park', 'Парк Победы', 'Описание', 2, 2, 'park-home.svg', 'park-fight.svg'),
    ('custom', 'Авторская локация', 'Сохранить', 3, 3, 'custom.svg', 'custom.svg');
  INSERT INTO players (id, friend_id, name, current_location_id, money, created_at, last_seen_at, last_regen_time) VALUES
    (1, 1, 'Админ', 'park', 123, '2026-01-01', '2026-01-01', '2026-01-01'),
    (100, 100, 'Игрок', 'park', 456, '2026-01-01', '2026-01-01', '2026-01-01');
  INSERT INTO mobs (id, name, description, level, loot, points_reward, location_id, max_health, strength, defense, respawn_seconds)
    VALUES (40, 'Авторский моб', 'Сохранить', 1, '[]', 10, 'park', 10, 1, 1, 60);
  INSERT INTO events (player_id, location_id, type, created_at) VALUES (100, 'park', 'walk', '2026-01-01');
  INSERT INTO combat_sessions (id, player_id, mob_id, player_health, mob_health, started_at, last_action_at)
    VALUES (1, 100, 40, 100, 10, '2026-01-01', '2026-01-01');
  UPDATE players SET id_the_last_action = '{"id":1,"type":"TakeAWalk"}' WHERE id = 100;
`);
legacy.close();

const { db, initializeDatabase } = await import("../dist/db.js");
const { locations, players, mobs, events, combatSessions, quests, playerQuests } = await import("../dist/db/schema.js");
const { config } = await import("../dist/config.js");
const { createApp } = await import("../dist/app.js");
const { createSessionToken } = await import("../dist/auth.js");
const { getPlayersInLocation } = await import("../dist/presence.js");
const { nowGameTime, todayGameDate } = await import("../dist/time.js");
const app = createApp();

after(() => {
  db.$client.close();
  rmSync(directory, { recursive: true, force: true });
});

let nextPlayerId = 200;
function player(overrides = {}) {
  const id = nextPlayerId++;
  return db.insert(players).values({
    id, friendId: id, name: `Игрок ${id}`, currentLocationId: "square",
    createdAt: nowGameTime(), lastSeenAt: nowGameTime(), ...overrides,
  }).returning().get();
}
function location(id) { return db.select().from(locations).where(eq(locations.id, id)).get(); }
function getPlayer(id) { return db.select().from(players).where(eq(players.id, id)).get(); }
function request(method, routePath, { playerId = 1, id, body = {}, authenticated = true } = {}) {
  const route = app._router.stack.find((layer) => layer.route?.path === routePath && layer.route.methods[method])?.route;
  assert.ok(route, `${method} ${routePath}`);
  const req = {
    params: { id }, body,
    header: () => authenticated ? `Bearer ${createSessionToken(playerId)}` : undefined,
  };
  const result = { status: 200, body: undefined };
  const res = {
    status(value) { result.status = value; return this; },
    json(value) { result.body = JSON.parse(JSON.stringify(value)); return this; },
  };
  let index = 0;
  const next = () => route.stack[index++]?.handle(req, res, next);
  next();
  return result;
}

test("migration preserves related data, closes unfinished locations and releases ordinary residents", () => {
  assert.deepEqual(db.select().from(locations).all().filter((l) => l.isOpen).map((l) => l.id).sort(), ["market", "rialto", "square"]);
  assert.ok(db.select().from(locations).all().every((l) => l.minLevel === 1));
  assert.equal(location("custom").description, "Сохранить");
  assert.equal(db.select().from(mobs).where(eq(mobs.id, 40)).get().name, "Авторский моб");
  assert.equal(db.select().from(events).all().length, 1);
  assert.equal(getPlayer(100).money, 456);
  assert.equal(getPlayer(100).currentLocationId, null);
  assert.equal(getPlayer(100).idTheLastAction, null);
  assert.equal(db.select().from(combatSessions).where(eq(combatSessions.id, 1)).get().status, "fled");
  assert.equal(getPlayer(1).currentLocationId, "park");
  assert.deepEqual(db.$client.pragma("foreign_key_check"), []);
});

test("fresh database has safe defaults and rejects invalid levels and booleans", () => {
  const fresh = new Database(":memory:");
  try {
    migrate(drizzle(fresh), { migrationsFolder: migrationSource });
    fresh.exec("INSERT INTO locations (id, name, description, x, y, homeImg, fightImg) VALUES ('new', 'Новая', 'Описание', 0, 0, 'a', 'b')");
    assert.deepEqual(fresh.prepare("SELECT min_level, is_open FROM locations").get(), { min_level: 1, is_open: 0 });
    for (const invalid of [0, -1, 1.5]) {
      assert.throws(() => fresh.prepare("UPDATE locations SET min_level = ?").run(invalid), /CHECK constraint failed/);
    }
    assert.throws(() => fresh.exec("UPDATE locations SET is_open = 2"), /CHECK constraint failed/);
  } finally { fresh.close(); }
});

test("map lists every location and derives the bypass flag from the authenticated player", () => {
  const p = player();
  const result = request("get", "/locations", { playerId: p.id });
  assert.equal(result.status, 200);
  assert.equal(result.body.locations.length, 7);
  assert.equal(result.body.canBypassRestrictions, false);
  assert.equal(result.body.locations.find((l) => l.id === "forest").isOpen, false);
  assert.equal(result.body.locations.find((l) => l.id === "square").minLevel, 1);
  assert.equal(request("get", "/locations").body.canBypassRestrictions, true);
  assert.equal(request("post", "/locations/:id/enter", { id: "square", authenticated: false }).status, 401);
});

test("denied entry does not move the player, sockets, presence or quest progress", () => {
  const p = player({ level: 50 });
  const quest = db.insert(quests).values({ title: "Визит", description: "Парк", difficulty: "easy", objectiveType: "visit", targetId: "park", targetCount: 1 }).returning().get();
  const assignment = db.insert(playerQuests).values({ playerId: p.id, questId: quest.id, assignedDay: todayGameDate() }).returning().get();
  const socketCalls = moveSockets.mock.callCount();
  const broadcasts = broadcast.mock.callCount();
  const result = request("post", "/locations/:id/enter", {
    playerId: p.id, id: "park", body: { isOpen: true, level: 999, canBypassRestrictions: true },
  });
  assert.equal(result.status, 403);
  assert.equal(result.body.code, "LOCATION_IN_DEVELOPMENT");
  assert.equal(getPlayer(p.id).currentLocationId, "square");
  assert.equal(moveSockets.mock.callCount(), socketCalls);
  assert.equal(broadcast.mock.callCount(), broadcasts);
  assert.equal(getPlayersInLocation("park").some((resident) => resident.id === p.id), false);
  assert.equal(db.select().from(playerQuests).where(eq(playerQuests.id, assignment.id)).get().progress, 0);
  assert.equal(request("get", "/locations/:id/state", { playerId: p.id, id: "park" }).status, 403);
});

test("all three released locations allow ordinary players; missing IDs return 404", () => {
  const p = player();
  for (const id of ["square", "rialto", "market"]) {
    const result = request("post", "/locations/:id/enter", { playerId: p.id, id });
    assert.equal(result.status, 200);
    assert.equal(result.body.player.currentLocationId, id);
    assert.equal(result.body.state.location.isOpen, true);
    assert.ok(getPlayersInLocation(id).some((resident) => resident.id === p.id));
  }
  assert.equal(request("post", "/locations/:id/enter", { playerId: p.id, id: "missing" }).status, 404);
});

test("level gate unlocks exactly at the threshold and development status has priority", () => {
  const p = player({ level: 4 });
  db.update(locations).set({ isOpen: true, minLevel: 5 }).where(eq(locations.id, "forest")).run();
  try {
    const denied = request("post", "/locations/:id/enter", { playerId: p.id, id: "forest" });
    assert.equal(denied.status, 403);
    assert.equal(denied.body.code, "LOCATION_LEVEL_REQUIRED");
    assert.equal(denied.body.minLevel, 5);
    assert.equal(getLocationAccess(location("forest"), 4), "level_required");
    for (const level of [5, 6]) {
      db.update(players).set({ level }).where(eq(players.id, p.id)).run();
      assert.equal(request("post", "/locations/:id/enter", { playerId: p.id, id: "forest" }).status, 200);
      assert.equal(getLocationAccess(location("forest"), level), "available");
    }
    db.update(locations).set({ isOpen: false }).where(eq(locations.id, "forest")).run();
    assert.equal(getLocationAccess(location("forest"), 1), "coming_soon");
    assert.equal(request("post", "/locations/:id/enter", { playerId: p.id, id: "forest" }).body.code, "LOCATION_IN_DEVELOPMENT");
  } finally {
    db.update(locations).set({ isOpen: false, minLevel: 1 }).where(eq(locations.id, "forest")).run();
  }
});

test("admins and the dev stand bypass both gates on the server and map", () => {
  const p = player();
  db.update(locations).set({ minLevel: 99 }).where(eq(locations.id, "railway")).run();
  try {
    assert.equal(request("post", "/locations/:id/enter", { id: "railway" }).status, 200);
    assert.equal(request("get", "/locations/:id/state", { id: "railway" }).status, 200);
    config.devBypassAuth = true;
    assert.equal(request("get", "/locations", { playerId: p.id }).body.canBypassRestrictions, true);
    assert.equal(request("post", "/locations/:id/enter", { playerId: p.id, id: "railway" }).status, 200);
    assert.equal(getLocationAccess(location("railway"), 1, true), "available");
    initializeDatabase();
    assert.equal(getPlayer(p.id).currentLocationId, "railway");
  } finally {
    config.devBypassAuth = false;
    db.update(locations).set({ minLevel: 1 }).where(eq(locations.id, "railway")).run();
  }
});

test("a stale resident cannot act or start combat in an unavailable location", () => {
  const p = player({ currentLocationId: "park" });
  assert.equal(request("post", "/locations/:id/action", { playerId: p.id, id: "park", body: { actionId: "walk" } }).status, 403);
  assert.equal(request("post", "/combat/start", { playerId: p.id, body: { mobId: 2 } }).status, 403);
  assert.equal(getPlayer(p.id).xp, 0);
  assert.equal(db.select().from(combatSessions).where(eq(combatSessions.playerId, p.id)).get(), undefined);
});

test("restart preserves configured access rules and releases players below the required level", () => {
  const p = player({ currentLocationId: "forest", level: 2 });
  db.update(locations).set({ isOpen: true, minLevel: 8 }).where(eq(locations.id, "forest")).run();
  try {
    initializeDatabase();
    assert.equal(location("forest").isOpen, true);
    assert.equal(location("forest").minLevel, 8);
    assert.equal(getPlayer(p.id).currentLocationId, null);
  } finally {
    db.update(locations).set({ isOpen: false, minLevel: 1 }).where(eq(locations.id, "forest")).run();
  }
});
