import assert from "node:assert/strict";
import { after, beforeEach, mock, test } from "node:test";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";

// Keep integration assertions deterministic; accuracy itself is covered separately.
beforeEach((t) => { t.mock.method(Math, 'random', () => 0); });

const directory = mkdtempSync(path.join(tmpdir(), "mmobot-loot-"));
process.env.DATABASE_PATH = path.join(directory, "test.db");
process.env.BOT_TOKEN = "123456:test-token";
process.env.SESSION_SECRET = "loot-tests";
process.env.ADMIN_IDS = "1";
process.env.DEV_BYPASS_AUTH = "false";
const emit = mock.fn();
mock.module("../dist/infrastructure/telegram/notifications.js", { namedExports: { notify: mock.fn() } });
mock.module("../dist/infrastructure/realtime/socket-server.js", { namedExports: {
  isPlayerOnline: () => false, emitToPlayer: emit, broadcastLocation: mock.fn(), moveSocketToLocation: mock.fn(),
} });

const migrationSource = fileURLToPath(new URL("../drizzle/", import.meta.url));
const oldMigrations = path.join(directory, "old-migrations");
mkdirSync(path.join(oldMigrations, "meta"), { recursive: true });
const journal = JSON.parse(readFileSync(path.join(migrationSource, "meta/_journal.json"), "utf8"));
journal.entries = journal.entries.filter((entry) => entry.idx < 27);
writeFileSync(path.join(oldMigrations, "meta/_journal.json"), JSON.stringify(journal));
for (const entry of journal.entries) copyFileSync(path.join(migrationSource, `${entry.tag}.sql`), path.join(oldMigrations, `${entry.tag}.sql`));
const legacy = new Database(process.env.DATABASE_PATH);
legacy.pragma("foreign_keys = ON");
migrate(drizzle(legacy), { migrationsFolder: oldMigrations });
legacy.exec(`
  INSERT INTO locations (id, name, description, x, y, homeImg, fightImg, is_open) VALUES ('square', 'Площадь', 'Описание', 1, 1, 'a', 'b', 1);
  INSERT INTO mobs (id, name, description, level, loot, points_reward, coin_reward, location_id, max_health, strength, defense, respawn_seconds) VALUES
    (90, 'Старый', 'Сохранить', 3, '[1,1,3]', 17, 9, 'square', 10, 2, 0, 60),
    (91, 'Пустой', 'Сохранить', 1, '[]', 10, 0, 'square', 10, 1, 0, 60),
    (92, 'С шансом', 'Сохранить', 1, '[{"itemType":3,"chancePercent":12.5}]', 10, 0, 'square', 10, 1, 0, 60);
`);
legacy.close();

const { db, initializeDatabase } = await import("../dist/database/index.js");
const { items, mobs, players, inventoryItems, combatSessions, playerQuests, quests, events } = await import("../dist/database/schema.js");
const { createApp } = await import("../dist/app.js");
const { createSessionToken } = await import("../dist/modules/auth/auth.js");
const { nowGameTime, todayGameDate } = await import("../dist/shared/time.js");
const { parseLoot, rollLoot } = await import("../dist/modules/combat/loot.js");
const { startCombat, moveCombatAction, isMobAlive } = await import("../dist/modules/combat/pve.js");
const app = createApp();
after(() => { db.$client.close(); rmSync(directory, { recursive: true, force: true }); });

let nextPlayer = 100;
const mobById = (id) => db.select().from(mobs).where(eq(mobs.id, id)).get();
const playerById = (id) => db.select().from(players).where(eq(players.id, id)).get();
const inventory = (id) => db.select().from(inventoryItems).where(eq(inventoryItems.playerId, id)).all();
function player(values = {}) {
  const id = nextPlayer++;
  return db.insert(players).values({ id, friendId: id, name: `Игрок ${id}`, currentLocationId: "square", strength: 1000, createdAt: nowGameTime(), lastSeenAt: nowGameTime(), ...values }).returning().get();
}
function mob(loot, values = {}) {
  return db.insert(mobs).values({ name: "Тестовый", description: "Лут", level: 1, maxHealth: 1, strength: 0, defense: 0, loot, pointsReward: 10, coinReward: 3, locationId: "square", respawnSeconds: 60, ...values }).returning().get();
}
function request(method, routePath, { playerId, id, body = {} } = {}) {
  const route = app._router.stack.find((layer) => layer.route?.path === routePath && layer.route.methods[method])?.route;
  assert.ok(route, `${method} ${routePath}`);
  const req = { params: { id: String(id) }, body, header: () => `Bearer ${createSessionToken(playerId)}`, player: playerById(playerId) };
  const result = { status: 200, body: undefined };
  const res = { status(value) { result.status = value; return this; }, json(value) { result.body = JSON.parse(JSON.stringify(value)); return this; }, end() { return this; } };
  let index = 0;
  const next = () => route.stack[index++]?.handle(req, res, next);
  next();
  return result;
}
function quest(playerId, objectiveType, targetId = null) {
  const q = db.insert(quests).values({ title: "Тест лута", description: "Тест", difficulty: "easy", objectiveType, targetId, targetCount: 10 }).returning().get();
  return db.insert(playerQuests).values({ playerId, questId: q.id, assignedDay: todayGameDate() }).returning().get();
}
const progress = (id) => db.select().from(playerQuests).where(eq(playerQuests.id, id)).get().progress;

// Проверяем границы детерминированно, без случайно падающей статистической проверки.
test("rolls honor 0%, 100%, fractional chances and independent rows", () => {
  assert.deepEqual(rollLoot([{ itemType: 1, chancePercent: 0 }, { itemType: 2, chancePercent: 100 }], () => { throw new Error("No roll needed"); }), [2]);
  const draws = [0.249, 0.75, 0.014];
  assert.deepEqual(rollLoot([{ itemType: 1, chancePercent: 25 }, { itemType: 2, chancePercent: 75 }, { itemType: 3, chancePercent: 1.5 }], () => draws.shift()), [1, 3]);
  assert.deepEqual(rollLoot([{ itemType: 1, chancePercent: 50 }, { itemType: 2, chancePercent: 50 }], () => 0.49), [1, 2]);
  assert.deepEqual(rollLoot([{ itemType: 1, chancePercent: 50 }, { itemType: 2, chancePercent: 50 }], () => 0.5), []);
});

test("migration preserves old guaranteed drops, duplicates, empty loot and existing chances", () => {
  assert.deepEqual(mobById(90).loot, [{ itemType: 1, chancePercent: 100 }, { itemType: 1, chancePercent: 100 }, { itemType: 3, chancePercent: 100 }]);
  assert.equal(mobById(90).pointsReward, 17);
  assert.equal(mobById(90).coinReward, 9);
  assert.deepEqual(mobById(91).loot, []);
  assert.deepEqual(mobById(92).loot, [{ itemType: 3, chancePercent: 12.5 }]);
  assert.deepEqual(db.$client.pragma("foreign_key_check"), []);
});

test("admin saves fractional chances, rejects invalid/unknown entries and accepts legacy IDs", () => {
  const p = player();
  const update = (loot) => request("put", "/mobs/:id", { playerId: p.id, id: 90, body: { loot } });
  assert.equal(update([{ itemType: 1, chancePercent: 0 }, { itemType: 3, chancePercent: 0.25 }]).status, 200);
  const saved = mobById(90).loot;
  for (const invalid of [null, {}, [null], [0], [-1], [1.2], [{ itemType: 999999, chancePercent: 50 }], ...[-1, 101, "50", NaN, Infinity, null, undefined].map((chancePercent) => [{ itemType: 1, chancePercent }])]) {
    assert.equal(update(invalid).status, 400);
    assert.deepEqual(mobById(90).loot, saved);
  }
  assert.deepEqual(parseLoot([1, 3]), [{ itemType: 1, chancePercent: 100 }, { itemType: 3, chancePercent: 100 }]);
  assert.equal(update([1]).status, 200);
  const created = request("post", "/mobs", { playerId: p.id, body: { name: "Нулевые статы", description: "Допустимо", level: 1, maxHealth: 1, strength: 0, defense: 0, pointsReward: 0, coinReward: 0, respawnSeconds: 1, locationId: "square", loot: [{ itemType: 3, chancePercent: 10 }] } });
  assert.equal(created.status, 200);
});

test("restart preserves edited probabilities and an empty loot table for mob ID zero", () => {
  const p = player();
  assert.equal(request("put", "/mobs/:id", { playerId: p.id, id: 0, body: { loot: [] } }).status, 200);
  db.update(mobs).set({ loot: [{ itemType: 3, chancePercent: 17.5 }] }).where(eq(mobs.id, 90)).run();
  initializeDatabase();
  assert.deepEqual(mobById(0).loot, []);
  assert.deepEqual(mobById(90).loot, [{ itemType: 3, chancePercent: 17.5 }]);
});

test("HTTP result, socket, inventory and quests contain only actual drops; repeat cannot grant again", () => {
  const p = player();
  const target = mob([{ itemType: 1, chancePercent: 100 }, { itemType: 3, chancePercent: 50 }, { itemType: 4, chancePercent: 25 }, { itemType: 5, chancePercent: 0 }]);
  const collected = quest(p.id, "collect"), looted = quest(p.id, "loot"), missed = quest(p.id, "loot", "4"), killed = quest(p.id, "kill", String(target.id));
  const started = request("post", "/combat/start", { playerId: p.id, body: { mobId: target.id } });
  assert.deepEqual(started.body.droppedItems, []);
  const draws = [0, 0, 0, 0.1, 0.9]; // order, accuracy, damage, potion succeeds, scrap fails
  const rng = mock.method(Math, "random", () => { assert.ok(draws.length > 0, "unexpected reroll"); return draws.shift(); });
  try {
    const body = { action: 'attack', sessionId: started.body.id, round: started.body.round, expectedVersion: started.body.stateVersion, requestId: 'loot-win' };
    const result = request("post", "/combat/action", { playerId: p.id, body });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.state.droppedItems.map((item) => item.id), [1, 3]);
    assert.ok(result.body.state.log.every((entry) => !entry.text.startsWith("Добыча:")));
    assert.deepEqual(result.body.state.mob.loot, target.loot);
    assert.deepEqual(result.body.inventory.map((entry) => entry.itemType).sort(), [1, 3]);
    assert.equal(result.body.inventory.find((entry) => entry.itemType === 1).weaponLevel, 1);
    assert.equal(progress(collected.id), 2); assert.equal(progress(looted.id), 2);
    assert.equal(progress(missed.id), 0); assert.equal(progress(killed.id), 1);
    assert.equal(playerById(p.id).money, 3);
    assert.equal(playerById(p.id).xp, 10);
    const socketState = emit.mock.calls.filter((call) => call.arguments[0] === p.id && call.arguments[1] === "combatState").at(-1).arguments[2];
    assert.deepEqual(socketState.droppedItems.map((item) => item.id), [1, 3]);
    assert.equal(request("post", "/combat/action", { playerId: p.id, body }).status, 200);
    assert.equal(request("post", "/combat/action", { playerId: p.id, body: { ...body, requestId: 'new-after-end' } }).status, 409);
    assert.equal(rng.mock.callCount(), 5);
    assert.equal(inventory(p.id).length, 2);
  } finally { rng.mock.restore(); }
});

test("a win can drop nothing while still granting coins and kill progress", () => {
  const p = player(), target = mob([{ itemType: 1, chancePercent: 1 }]);
  const q = quest(p.id, "kill", String(target.id));
  startCombat(p, target);
  const session = db.select().from(combatSessions).where(eq(combatSessions.playerId, p.id)).get();
  const draws = [0, 0, 0, 0.99];
  const rng = mock.method(Math, "random", () => draws.shift());
  try {
    const result = moveCombatAction(p, target, session, "attack");
    assert.equal(result.status, "victory");
    assert.deepEqual(result.droppedItems, []);
    assert.deepEqual(inventory(p.id), []);
    assert.equal(playerById(p.id).money, 3);
    assert.equal(progress(q.id), 1);
    assert.ok(result.log.every((entry) => entry.text !== "Предметы не выпали"));
  } finally { rng.mock.restore(); }
});

test("active combat reads, fleeing and defeat never award loot", () => {
  for (const mode of ["active", "fled", "defeat"]) {
    const p = player({ strength: 1, health: mode === "defeat" ? 1 : 100 });
    const target = mob([{ itemType: 1, chancePercent: 100 }], { maxHealth: 999, strength: mode === "defeat" ? 999 : 0 });
    startCombat(p, target);
    const rng = mock.method(Math, "random", () => 0);
    try {
      const current = request("get", "/combat/state", { playerId: p.id });
      assert.deepEqual(current.body.droppedItems, []);
      assert.equal(rng.mock.callCount(), 0);
      const session = db.select().from(combatSessions).where(eq(combatSessions.playerId, p.id)).get();
      const result = moveCombatAction(playerById(p.id), target, session, mode === "fled" ? "flee" : "attack");
      assert.equal(result.status, mode);
      assert.deepEqual(result.droppedItems, []);
      assert.deepEqual(inventory(p.id), []);
      assert.equal(playerById(p.id).money, 0);
    } finally { rng.mock.restore(); }
  }
});

test("failed reward writes roll back the whole turn and never leave partial loot", () => {
  const p = player(), target = mob([{ itemType: 1, chancePercent: 100 }, { itemType: 3, chancePercent: 100 }]);
  startCombat(p, target);
  const session = db.select().from(combatSessions).where(eq(combatSessions.playerId, p.id)).get();
  const originalEvents = db.select().from(events).all().length;
  db.$client.exec(`CREATE TRIGGER loot_test_failure BEFORE INSERT ON inventory_items WHEN NEW.player_id = ${p.id} AND NEW.item_type = 3 BEGIN SELECT RAISE(ABORT, 'test failure'); END;`);
  try {
    assert.throws(() => moveCombatAction(p, target, session, "attack"), /test failure/);
    assert.deepEqual(inventory(p.id), []);
    assert.equal(playerById(p.id).money, 0);
    assert.equal(playerById(p.id).xp, 0);
    assert.equal(db.select().from(events).all().length, originalEvents);
    assert.deepEqual(db.select().from(combatSessions).where(eq(combatSessions.id, session.id)).get(), session);
    assert.equal(isMobAlive(target), true);
  } finally { db.$client.exec("DROP TRIGGER loot_test_failure"); }
  assert.equal(moveCombatAction(p, target, session, "attack").droppedItems.length, 2);
  assert.throws(() => moveCombatAction(p, target, session, "attack"), /завершён/);
  assert.equal(inventory(p.id).length, 2);
});

test('combat prevents external healing, stat changes and regeneration; other players are isolated', async () => {
  const { RegenHealth } = await import('../dist/modules/players/regen.js');
  const p = player({ health: 40, statPoints: 2 });
  const other = player({ health: 30, lastRegenTime: new Date(Date.parse(nowGameTime()) - 100000).toISOString() });
  const target = mob([], { maxHealth: 500 });
  db.insert(inventoryItems).values({ playerId: p.id, itemType: 3, quantity: 2, acquiredAt: nowGameTime() }).run();
  const started = startCombat(p, target);
  assert.equal(started.moves[0].id, 'unarmed_strike');
  assert.equal(request('post', '/inventory/use', { playerId: p.id, body: { itemType: 3 } }).status, 409);
  assert.equal(request('post', '/me/stats', { playerId: p.id, body: { maxHealth: 1 } }).status, 409);
  db.update(players).set({ lastRegenTime: new Date(Date.parse(nowGameTime()) - 100000).toISOString() }).where(eq(players.id, p.id)).run();
  assert.equal(RegenHealth(p.id), 40);
  assert.equal(playerById(other.id).health, 30);
  assert.equal(RegenHealth(other.id), 40);
  assert.equal(playerById(p.id).health, 40);
  assert.equal(inventory(p.id)[0].quantity, 2);
});

test('saved final PvE result remains readable without repeating loot, and ownership is checked', () => {
  const p = player(), outsider = player(), target = mob([{ itemType: 3, chancePercent: 100 }]);
  const started = startCombat(p, target);
  const body = { action: 'attack', sessionId: started.id, round: 1, expectedVersion: 0, requestId: 'final-read' };
  const result = request('post', '/combat/action', { playerId: p.id, body });
  assert.equal(result.body.state.status, 'victory');
  assert.equal(request('post', '/combat/action', { playerId: outsider.id, body }).status, 404);
  assert.deepEqual(db.select().from(combatSessions).where(eq(combatSessions.id, started.id)).get().battleState.droppedItems.map(i => i.id), [3]);
  assert.equal(inventory(p.id)[0].quantity, 1);
  const second = startCombat(playerById(p.id), mob([]));
  assert.notEqual(second.id, started.id);
  assert.equal(request('post', '/combat/action', { playerId: p.id, body }).status, 200);
  assert.equal(inventory(p.id)[0].quantity, 1);
});

test('PvE potion heals before the mob, spends one action and one item, and survives retries', () => {
  const p = player({ health: 40, defense: 0 }), target = mob([], { maxHealth: 500, strength: 2 });
  db.insert(inventoryItems).values({ playerId: p.id, itemType: 3, quantity: 2, acquiredAt: nowGameTime() }).run();
  const started = startCombat(p, target);
  const body = { action: 'use', itemType: 3, sessionId: started.id, round: 1, expectedVersion: 0, requestId: 'heal-once' };
  const random = mock.method(Math, 'random', () => 0);
  try {
    const result = request('post', '/combat/action', { playerId: p.id, body });
    assert.equal(result.status, 200);
    assert.equal(result.body.state.playerHp, 53);
    assert.equal(result.body.state.healingAvailable, false);
    assert.equal(result.body.state.mobHp, 500);
    assert.equal(result.body.state.round, 2);
    assert.equal(result.body.inventory.find(i => i.itemType === 3).quantity, 1);
    assert.equal(result.body.state.events[0].type, 'heal');
    assert.equal(result.body.state.events[1].type, 'attack');
    const saved = db.select().from(combatSessions).where(eq(combatSessions.id, started.id)).get();
    assert.equal(request('post', '/combat/action', { playerId: p.id, body }).status, 200);
    assert.deepEqual(db.select().from(combatSessions).where(eq(combatSessions.id, started.id)).get(), saved);
    assert.equal(inventory(p.id).find(i => i.itemType === 3).quantity, 1);
    const again = request('post', '/combat/action', { playerId: p.id, body: {
      ...body, round: result.body.state.round, expectedVersion: result.body.state.stateVersion, requestId: 'heal-twice',
    } });
    assert.equal(again.status, 400);
    assert.equal(inventory(p.id).find(i => i.itemType === 3).quantity, 1);
    assert.deepEqual(db.select().from(combatSessions).where(eq(combatSessions.id, started.id)).get(), saved);
  } finally { random.mock.restore(); }
});

test('invalid or full-health healing cannot spend a potion or advance PvE', () => {
  const p = player(), target = mob([], { maxHealth: 500 });
  db.insert(inventoryItems).values({ playerId: p.id, itemType: 3, quantity: 2, acquiredAt: nowGameTime() }).run();
  const started = startCombat(p, target);
  for (const itemType of [3, 4, 999999]) {
    assert.equal(request('post', '/combat/action', { playerId: p.id, body: { action: 'use', itemType, sessionId: started.id, round: 1, expectedVersion: 0, requestId: `invalid-heal-${itemType}` } }).status, 400);
  }
  assert.equal(inventory(p.id).find(i => i.itemType === 3).quantity, 2);
  assert.equal(db.select().from(combatSessions).where(eq(combatSessions.id, started.id)).get().roundNumber, 1);
});
