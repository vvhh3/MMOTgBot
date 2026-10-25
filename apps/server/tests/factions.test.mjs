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
import { FACTIONS } from "@mmobot/shared";

const directory = mkdtempSync(path.join(tmpdir(), "mmobot-factions-"));
process.env.DATABASE_PATH = path.join(directory, "test.db");
process.env.BOT_TOKEN = "123456:test-token";
process.env.SESSION_SECRET = "faction-tests";
process.env.DEV_BYPASS_AUTH = "false";
const emitted = mock.fn();
mock.module("../dist/infrastructure/telegram/notifications.js", { namedExports: { notify: mock.fn() } });
mock.module("../dist/infrastructure/realtime/socket-server.js", { namedExports: {
  emitToPlayer: emitted, isPlayerOnline: () => false,
  broadcastLocation: mock.fn(), moveSocketToLocation: mock.fn(),
} });

// Reproduce a real pre-faction database, including columns added by the old
// startup compatibility code rather than migrations.
const source = fileURLToPath(new URL("../drizzle/", import.meta.url));
const old = path.join(directory, "old");
mkdirSync(path.join(old, "meta"), { recursive: true });
const journal = JSON.parse(readFileSync(path.join(source, "meta/_journal.json"), "utf8"));
journal.entries = journal.entries.filter((entry) => entry.idx < 29);
writeFileSync(path.join(old, "meta/_journal.json"), JSON.stringify(journal));
for (const entry of journal.entries) copyFileSync(path.join(source, `${entry.tag}.sql`), path.join(old, `${entry.tag}.sql`));
const legacy = new Database(process.env.DATABASE_PATH);
migrate(drizzle(legacy), { migrationsFolder: old });
legacy.exec(`
  ALTER TABLE players ADD COLUMN race text;
  ALTER TABLE players ADD COLUMN avatar text;
  ALTER TABLE players ADD COLUMN is_created integer NOT NULL DEFAULT 1;
  INSERT INTO players (id, friend_id, name, race, avatar, health, xp, level, points, money, strength, defense, stat_points, created_at, last_seen_at, last_regen_time)
    VALUES (1, 1, 'Старый персонаж', 'Орк', '/character-images/skins2.svg', 100, 450, 3, 123, 456, 17, 8, 4, '2026-01-01', '2026-01-01', '2026-01-01');
  INSERT INTO inventory_items (player_id, item_type, quantity, acquired_at) VALUES (1, 3, 4, '2026-01-01');
  INSERT INTO quests (id, title, description, difficulty, objective_type, target_count) VALUES (800, 'Сохранить', 'Сохранить', 'easy', 'walk', 3);
  INSERT INTO player_quests (player_id, quest_id, assigned_day, progress) VALUES (1, 800, '2026-01-01', 2);
`);
const preserved = legacy.prepare("SELECT name, avatar, health, xp, level, points, money, strength, defense, stat_points, is_created FROM players WHERE id = 1").get();
legacy.close();

const { db, sqlite } = await import("../dist/database/connection.js");
const { initializeDatabase } = await import("../dist/database/initialize.js");
const { players } = await import("../dist/database/schema.js");
const { createApp } = await import("../dist/app.js");
const { createSessionToken } = await import("../dist/modules/auth/auth.js");
const { config } = await import("../dist/config/env.js");
const { nowGameTime } = await import("../dist/shared/time.js");
const app = createApp();
after(() => { sqlite.close(); rmSync(directory, { recursive: true, force: true }); });

function request(method, url, { playerId = 1, body = {}, authenticated = true } = {}) {
  const route = app._router.stack.find((layer) => layer.route?.path === url && layer.route.methods[method])?.route;
  assert.ok(route, `${method} ${url}`);
  const req = { body, header: () => authenticated ? `Bearer ${createSessionToken(playerId)}` : undefined };
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
let nextId = 100;
function player(overrides = {}) {
  const id = nextId++;
  return db.insert(players).values({ id, friendId: id, name: `Игрок ${id}`, isCreated: false,
    createdAt: nowGameTime(), lastSeenAt: nowGameTime(), ...overrides }).returning().get();
}
function getPlayer(id) { return db.select().from(players).where(eq(players.id, id)).get(); }

test("upgrade removes race, leaves faction unselected and preserves character, inventory and quests", () => {
  assert.ok(!sqlite.pragma("table_info(players)").some((column) => column.name === "race"));
  assert.equal(getPlayer(1).factionId, null);
  assert.deepEqual(sqlite.prepare("SELECT name, avatar, health, xp, level, points, money, strength, defense, stat_points, is_created FROM players WHERE id = 1").get(), preserved);
  assert.equal(sqlite.prepare("SELECT quantity FROM inventory_items WHERE player_id = 1").get().quantity, 4);
  assert.equal(sqlite.prepare("SELECT progress FROM player_quests WHERE player_id = 1 AND quest_id = 800").get().progress, 2);
  assert.deepEqual(sqlite.pragma("foreign_key_check"), []);
});

test("empty faction leaderboard includes every group, legacy characters do not inflate counts", () => {
  const result = request("get", "/leaderboard/factions");
  assert.equal(result.status, 200);
  assert.equal(result.body.entries.length, FACTIONS.length);
  assert.ok(result.body.entries.every((entry) => entry.members === 0 && entry.totalPoints === 0));
});

test("each faction can create a character; unknown IDs, old races and malformed bodies are rejected", () => {
  for (const faction of FACTIONS) {
    const p = player();
    const result = request("post", "/me/character", { playerId: p.id, body: {
      name: "Новый игрок", avatar: "/character-images/skins1.svg", factionId: faction.id,
    } });
    assert.equal(result.status, 200);
    assert.equal(result.body.player.factionId, faction.id);
    assert.equal(result.body.player.isCreated, true);
    assert.equal("race" in result.body.player, false);
    assert.equal(getPlayer(p.id).factionId, faction.id);
  }
  const p = player();
  for (const factionId of ["Орк", "Нефоры", "unknown", "__proto__", null, {}, 1]) {
    assert.equal(request("post", "/me/character", { playerId: p.id, body: {
      name: "Игрок", avatar: "/character-images/skins1.svg", factionId,
    } }).status, 400);
  }
  assert.equal(request("post", "/me/character", { playerId: p.id, body: null }).status, 400);
  assert.equal(request("post", "/me/character", { playerId: p.id, body: {
    name: "Игрок", avatar: "/character-images/skins1.svg", race: "Орк",
  } }).status, 400);
  assert.equal(getPlayer(p.id).isCreated, false);
});

test("existing characters cannot select or change a faction through character creation", () => {
  const before = getPlayer(1);
  const callsBefore = emitted.mock.callCount();
  const result = request("post", "/me/character", { body: {
    factionId: "nefors", avatar: "/character-images/skins1.svg", money: 0, xp: 0, name: "Подмена",
  } });
  assert.equal(result.status, 409);
  const afterSelection = getPlayer(1);
  for (const key of ["name", "avatar", "xp", "level", "points", "money", "strength", "defense", "statPoints", "isCreated"]) {
    assert.equal(afterSelection[key], before[key], key);
  }
  assert.equal(request("get", "/me").body.player.factionId, null);
  assert.equal(getPlayer(1).isCreated, true);
  const member = player({ isCreated: true, factionId: "nefors" });
  assert.equal(request("post", "/me/character", { playerId: member.id, body: {
    name: "Подмена", avatar: "/character-images/skins1.svg", factionId: "offniks",
  } }).status, 409);
  assert.equal(getPlayer(member.id).factionId, "nefors");
  assert.equal(emitted.mock.callCount(), callsBefore);
});

test("creation and leaderboard require authentication; standalone faction selection is removed", () => {
  assert.equal(request("get", "/leaderboard/factions", { authenticated: false }).status, 401);
  assert.equal(request("post", "/me/character", { authenticated: false }).status, 401);
  assert.ok(!app._router.stack.some((layer) => layer.route?.path === "/me/faction"));
});

test("leaderboard aggregates unique created characters, excludes unassigned and unfinished ones", () => {
  const baseline = request("get", "/leaderboard/factions").body.entries;
  player({ isCreated: true, factionId: "normies", points: 70 });
  player({ isCreated: true, factionId: "normies", points: 30 });
  player({ isCreated: false, factionId: "normies", points: 9000 });
  player({ isCreated: true, factionId: null, points: 8000 });
  const result = request("get", "/leaderboard/factions").body.entries;
  for (const entry of result) {
    const previous = baseline.find((row) => row.factionId === entry.factionId);
    assert.equal(entry.members - previous.members, entry.factionId === "normies" ? 2 : 0);
    assert.equal(entry.totalPoints - previous.totalPoints, entry.factionId === "normies" ? 100 : 0);
  }
  assert.ok(result.every((entry, index) => index === 0 || result[index - 1].members >= entry.members));
  assert.ok(Array.isArray(request("get", "/leaderboard").body.entries));
});

test("startup is repeatable, persisted faction survives and race never reappears", () => {
  const p = player();
  assert.equal(request("post", "/me/character", { playerId: p.id, body: {
    name: "Новый игрок", avatar: "/character-images/skins1.svg", factionId: "nefors",
  } }).status, 200);
  initializeDatabase();
  assert.equal(getPlayer(1).factionId, null);
  assert.equal(getPlayer(1).isCreated, true);
  assert.equal(getPlayer(p.id).factionId, "nefors");
  assert.ok(!sqlite.pragma("table_info(players)").some((column) => column.name === "race"));
  const reopened = new Database(process.env.DATABASE_PATH, { readonly: true });
  try { assert.equal(reopened.prepare("SELECT faction_id FROM players WHERE id = ?").get(p.id).faction_id, "nefors"); }
  finally { reopened.close(); }
});

test("dev reset clears faction; production reset is forbidden", () => {
  assert.equal(request("post", "/me/character/reset").status, 403);
  const p = player({ isCreated: true, factionId: "gamers" });
  config.devBypassAuth = true;
  try {
    const result = request("post", "/me/character/reset", { playerId: p.id });
    assert.equal(result.status, 200);
    assert.equal(result.body.player.factionId, null);
    assert.equal(result.body.player.isCreated, false);
  } finally { config.devBypassAuth = false; }
});
