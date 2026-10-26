import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { and, eq } from "drizzle-orm";
import { Deck } from "@block52/deck";

// Изолированная БД и заглушка Telegram: тесты не используют данные/сервисы игры.
const directory = mkdtempSync(path.join(tmpdir(), "mmobot-quests-"));
process.env.DATABASE_PATH = path.join(directory, "test.db");
process.env.BOT_TOKEN = "123456:test-token";
process.env.SESSION_SECRET = "quest-tests";
process.env.ADMIN_IDS = "1";
const notifications = mock.fn();
mock.module("../dist/infrastructure/telegram/notifications.js", { namedExports: { notify: notifications } });

// Воспроизводим обновление существующей базы с пользовательскими данными.
const migrationSource = fileURLToPath(new URL("../drizzle/", import.meta.url));
const oldMigrations = path.join(directory, "old-migrations");
mkdirSync(path.join(oldMigrations, "meta"), { recursive: true });
const journal = JSON.parse(readFileSync(path.join(migrationSource, "meta/_journal.json"), "utf8"));
journal.entries = journal.entries.filter((entry) => entry.idx < 24);
writeFileSync(path.join(oldMigrations, "meta/_journal.json"), JSON.stringify(journal));
for (const entry of journal.entries) {
  copyFileSync(path.join(migrationSource, `${entry.tag}.sql`), path.join(oldMigrations, `${entry.tag}.sql`));
}
const oldSqlite = new Database(process.env.DATABASE_PATH);
migrate(drizzle(oldSqlite), { migrationsFolder: oldMigrations });
oldSqlite.exec(`
  INSERT INTO quests (id, title, description, difficulty, objective_type, target_count, target_xp, target_points)
    VALUES (1, 'Прогулка по набережной', 'Изменено администратором', 'easy', 'walk', 7, 99, 11),
           (2, 'Авторское задание', 'Сохранить при обновлении', 'hard', 'kill', 2, 200, 30),
           (3, 'Устранить громилу', 'Убейте 2 громил в Сити парке', 'medium', 'kill', 2, 120, 25);
  UPDATE quests SET target_id = '1' WHERE id = 3;
  INSERT INTO players (id, friend_id, name, created_at, last_seen_at, last_regen_time, money)
    VALUES (1, 1, 'Администратор', '2026-01-01', '2026-01-01', '2026-01-01', 123);
  INSERT INTO player_quests (player_id, quest_id, assigned_day, progress)
    VALUES (1, 1, '2026-01-01', 2), (1, 3, '2026-01-01', 1);
  INSERT INTO items (id, name, description, type) VALUES (6, 'Авторский предмет', 'Не перезаписывать', 'material');
  INSERT INTO locations (id, name, description, x, y, homeImg, fightImg)
    VALUES ('market', 'Сити парк', 'Старая локация', 42, 33, 'market-home.svg', 'market-fight.svg');
  INSERT INTO mobs (id, name, description, level, loot, points_reward, location_id, max_health, strength, defense, respawn_seconds)
    VALUES (1, 'Громила', 'Старый моб', 2, '[2]', 25, 'market', 25, 5, 1, 120);
  INSERT INTO combat_sessions (id, player_id, mob_id, player_health, mob_health, started_at, last_action_at)
    VALUES (1, 1, 1, 100, 25, '2026-01-01', '2026-01-01');
  UPDATE players SET id_the_last_action = '{"id":1,"type":"TakeAWalk"}' WHERE id = 1;
`);
oldSqlite.close();

const { db, initializeDatabase } = await import("../dist/database/index.js");
const { quests, playerQuests, players, items, mobs, locations, inventoryItems, combatSessions, casinoSessions } = await import("../dist/database/schema.js");
const { createQuestRoutes, progressQuests } = await import("../dist/modules/quests/routes.js");
const { createCasinoRoutes } = await import("../dist/modules/casino/routes.js");
const { startCombat, moveCombatAction } = await import("../dist/modules/combat/pve.js");
const { nowGameTime, todayGameDate } = await import("../dist/shared/time.js");
const { buildLocationState } = await import("../dist/modules/locations/state.js");
initializeDatabase();

after(() => {
  db.$client.close();
  rmSync(directory, { recursive: true, force: true });
});

// Запускаем реальные обработчики и admin middleware без открытия сетевого порта.
const routes = new Map();
const app = Object.fromEntries(["get", "post", "put", "delete"].map((method) => [
  method, (url, ...handlers) => routes.set(`${method} ${url}`, handlers),
]));
createQuestRoutes(app);
createCasinoRoutes(app);
function request(method, url, { playerId = 1, body = {}, id } = {}) {
  const req = { body, params: { id: String(id) }, player: getPlayer(playerId) };
  const result = { status: 200, body: undefined };
  const res = {
    status(status) { result.status = status; return this; },
    json(body) { result.body = body; return this; },
    end() { return this; },
  };
  const handlers = routes.get(`${method} ${url}`);
  assert.ok(handlers, `Missing route: ${method} ${url}`);
  let nextIndex = 0;
  const next = () => handlers[nextIndex++]?.(req, res, next);
  next();
  return result;
}

let nextPlayerId = 10;
let nextQuestName = 1;
function getPlayer(id) { return db.select().from(players).where(eq(players.id, id)).get(); }
function player() {
  const id = nextPlayerId++;
  return db.insert(players).values({
    id, friendId: id, name: `Игрок ${id}`, money: 1000, strength: 1000,
    currentLocationId: "market", createdAt: nowGameTime(), lastSeenAt: nowGameTime(),
  }).returning().get();
}
function assign(playerId, overrides = {}, assignment = {}) {
  const quest = db.insert(quests).values({
    title: `Тест ${nextQuestName++}`, description: "Тестовое задание", difficulty: "easy",
    objectiveType: "kill", targetCount: 5, ...overrides,
  }).returning().get();
  return db.insert(playerQuests).values({
    playerId, questId: quest.id, assignedDay: todayGameDate(), ...assignment,
  }).returning().get();
}
function assigned(id) { return db.select().from(playerQuests).where(eq(playerQuests.id, id)).get(); }
function casino(playerId, game, overrides = {}) {
  return db.insert(casinoSessions).values({
    playerId, game, bet: 100, potentialPayout: 150,
    state: game === "mines" ? { mines: [24], revealed: [0] } : { choices: [0], bombCount: 1 },
    createdAt: nowGameTime(), ...overrides,
  }).returning().get();
}

test("all migrations also create a fresh database with zero coin rewards by default", () => {
  const fresh = new Database(":memory:");
  try {
    migrate(drizzle(fresh), { migrationsFolder: migrationSource });
    fresh.exec("INSERT INTO quests (title, description, difficulty, objective_type, target_count) VALUES ('Новый', 'Описание', 'easy', 'walk', 1)");
    assert.equal(fresh.prepare("SELECT target_coins FROM quests").get().target_coins, 0);
  } finally {
    fresh.close();
  }
});

test("migration and catalog expansion preserve existing quests, progress, money and items", () => {
  const oldQuest = db.select().from(quests).where(eq(quests.id, 1)).get();
  assert.equal(oldQuest.targetCoins, 0);
  assert.equal(oldQuest.description, "Изменено администратором");
  assert.equal(oldQuest.targetCount, 7);
  assert.equal(oldQuest.targetXp, 99);
  assert.equal(assigned(1).progress, 2);
  assert.equal(getPlayer(1).money, 123);
  assert.equal(db.select().from(items).where(eq(items.id, 6)).get().name, "Авторский предмет");
  const catalog = db.select().from(quests).all();
  assert.equal(catalog.length, 19); // 17 current templates + custom and archived templates
  assert.equal(catalog.filter((q) => q.objectiveType === "loot" && q.isActive).length, 1);
  assert.equal(catalog.filter((q) => q.objectiveType === "casino_win").length, 4);
  const stick = db.select().from(items).where(eq(items.name, "Палка")).get();
  assert.ok(stick.id > 6);
  const pigeon = db.select().from(mobs).where(eq(mobs.catalogKey, 'square_pigeon')).get();
  assert.ok(pigeon.loot.some((entry) => entry.itemType === stick.id));
  assert.deepEqual(db.select().from(locations).where(eq(locations.id, "market")).get().actions, ["mines", "blackjack", "ladder"]);
  const cityPark = buildLocationState("market");
  assert.deepEqual(cityPark.actions, []);
  assert.deepEqual(cityPark.mobs, []);
  assert.ok(buildLocationState("square").actions.some((action) => action.id === "fight"));
  assert.equal(db.select().from(mobs).where(eq(mobs.id, 1)).get().isActive, false);
  assert.equal(db.select().from(combatSessions).where(eq(combatSessions.playerId, 1)).get().status, 'aborted');
  assert.equal(getPlayer(1).idTheLastAction, null);
  const replacedQuest = db.select().from(quests).where(eq(quests.id, 3)).get();
  assert.equal(replacedQuest.title, "Устранить громилу");
  assert.equal(replacedQuest.targetId, "1");
  assert.equal(replacedQuest.isActive, false);
  assert.equal(replacedQuest.targetXp, 120);
  assert.equal(assigned(2).questId, 3);
  assert.equal(assigned(2).progress, 1);
  initializeDatabase();
  assert.deepEqual(db.select().from(quests).all(), catalog);
  assert.equal(db.select().from(items).where(eq(items.name, "Палка")).all().length, 1);
  assert.equal(db.select().from(mobs).where(eq(mobs.id, pigeon.id)).get().loot.filter((entry) => entry.itemType === stick.id).length, 1);
});

test("admin creates and edits coin rewards and can clear a specific target", () => {
  const result = request("post", "/quests", { body: {
    title: "Казино", description: "Выиграть монеты", difficulty: "medium", objectiveType: "casino_win",
    targetId: "mines", targetCount: 50, targetCoins: 25,
  } });
  assert.equal(result.status, 200);
  assert.equal(result.body.quest.targetCoins, 25);
  assert.equal(result.body.quest.targetXp, 0);
  const updated = request("put", "/quests/:id", { id: result.body.quest.id, body: { targetId: null, targetCoins: 40 } });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.quest.targetId, null);
  assert.equal(updated.body.quest.targetCoins, 40);
  assert.equal(updated.body.quest.targetCount, 50);
  assert.equal(request("get", "/quests/:id", { id: result.body.quest.id }).body.quest.targetCoins, 40);
});

test("quest API rejects invalid rewards, counts, objective types, targets and non-admin creation", () => {
  const body = { title: "Проверка", description: "Проверка", difficulty: "easy", objectiveType: "kill", targetCount: 1 };
  for (const invalid of [
    { targetCoins: -1 }, { targetCoins: 1.5 }, { targetCoins: "20" }, { targetCoins: null },
    { targetCoins: Number.MAX_SAFE_INTEGER + 1 }, { targetXp: -1 }, { targetPoints: 0.5 },
    { targetCount: 0 }, { targetCount: 1.5 }, { difficulty: "unknown" }, { objectiveType: "unknown" },
    { title: " " }, { targetId: {} }, { targetId: "999999" },
    { objectiveType: "loot", targetId: "999999" }, { objectiveType: "visit", targetId: "missing" },
    { objectiveType: "casino_win", targetId: "square" },
  ]) assert.equal(request("post", "/quests", { body: { ...body, ...invalid } }).status, 400, JSON.stringify(invalid));
  const created = request("post", "/quests", { body });
  assert.equal(created.body.quest.targetCoins, 0);
  assert.equal(request("put", "/quests/:id", { id: created.body.quest.id, body: { targetCoins: -5 } }).status, 400);
  assert.equal(request("post", "/quests", { playerId: player().id, body }).status, 400);
});

test("daily assignment returns one quest per difficulty, with coin rewards, without duplicates", () => {
  const p = player();
  const first = request("get", "/quests/daily", { playerId: p.id }).body.quests;
  assert.equal(first.length, 3);
  assert.deepEqual(first.map((q) => q.quest.difficulty).sort(), ["easy", "hard", "medium"]);
  assert.ok(first.every((q) => Number.isInteger(q.quest.targetCoins)));
  assert.deepEqual(request("get", "/quests/daily", { playerId: p.id }).body.quests, first);
});

test("progress supports amounts, exact/wildcard targets, current day and completion limits", () => {
  const p = player();
  const exact = assign(p.id, { objectiveType: "casino_win", targetId: "mines", targetCount: 100 });
  const any = assign(p.id, { objectiveType: "casino_win", targetCount: 50 });
  const otherGame = assign(p.id, { objectiveType: "casino_win", targetId: "blackjack" });
  const yesterday = assign(p.id, { objectiveType: "casino_win" }, { assignedDay: "2000-01-01" });
  const otherPlayer = assign(player().id, { objectiveType: "casino_win" });
  for (const amount of [0, -1, 1.5, NaN, Infinity]) progressQuests(p.id, "casino_win", "mines", amount);
  assert.equal(assigned(exact.id).progress, 0);
  const before = notifications.mock.callCount();
  progressQuests(p.id, "casino_win", "mines", 40);
  progressQuests(p.id, "casino_win", "mines", 80);
  progressQuests(p.id, "casino_win", "mines", 100);
  assert.equal(assigned(exact.id).progress, 100);
  assert.equal(assigned(any.id).progress, 50);
  assert.equal(assigned(exact.id).status, "completed");
  assert.ok(assigned(exact.id).completedAt);
  assert.equal(notifications.mock.callCount() - before, 2);
  for (const q of [otherGame, yesterday, otherPlayer]) assert.equal(assigned(q.id).progress, 0);
});

test("walk and visit quests match location targets", () => {
  const p = player();
  const walk = assign(p.id, { objectiveType: "walk", targetId: "park" });
  const visit = assign(p.id, { objectiveType: "visit", targetId: "rialto" });
  progressQuests(p.id, "walk", "square");
  progressQuests(p.id, "visit", "market");
  assert.equal(assigned(walk.id).progress, 0);
  assert.equal(assigned(visit.id).progress, 0);
  progressQuests(p.id, "walk", "park");
  progressQuests(p.id, "visit", "rialto");
  assert.equal(assigned(walk.id).progress, 1);
  assert.equal(assigned(visit.id).progress, 1);
});

test("combat loot advances item and kill quests; ordinary collection does not advance loot quests", () => {
  const p = player();
  const stick = db.select().from(items).where(eq(items.name, "Палка")).get();
  const rat = db.insert(mobs).values({ name: 'Тестовый противник', description: 'Проверка заданий', level: 1, maxHealth: 1,
    strength: 0, defense: 0, pointsReward: 1, locationId: 'square', respawnSeconds: 1, loot: [{ itemType: stick.id, chancePercent: 100 }] }).returning().get();
  const loot = assign(p.id, { objectiveType: "loot", targetId: String(stick.id), targetCount: 1 });
  const collect = assign(p.id, { objectiveType: "collect", targetCount: 10 });
  const wrongLoot = assign(p.id, { objectiveType: "loot", targetId: "5" });
  const kill = assign(p.id, { objectiveType: "kill", targetId: String(rat.id), targetCount: 1 });
  progressQuests(p.id, "collect", stick.id);
  assert.equal(assigned(loot.id).progress, 0);
  startCombat(p, rat);
  const session = db.select().from(combatSessions).where(eq(combatSessions.playerId, p.id)).get();
  assert.equal(moveCombatAction(p, rat, session, "attack").status, "victory");
  assert.equal(assigned(loot.id).status, "completed");
  assert.equal(assigned(kill.id).status, "completed");
  assert.equal(assigned(wrongLoot.id).progress, 0);
  assert.equal(assigned(collect.id).progress, 1 + rat.loot.length);
  assert.equal(db.select().from(inventoryItems).where(and(eq(inventoryItems.playerId, p.id), eq(inventoryItems.itemType, stick.id))).get().quantity, 1);
});

test("casino progress counts settled profit, excludes pushes/losses and cannot repeat a cashout", () => {
  const p = player();
  const any = assign(p.id, { objectiveType: "casino_win", targetCount: 1000 });
  const mines = assign(p.id, { objectiveType: "casino_win", targetId: "mines", targetCount: 1000 });
  const blackjack = assign(p.id, { objectiveType: "casino_win", targetId: "blackjack", targetCount: 1000 });
  casino(p.id, "mines");
  assert.equal(assigned(any.id).progress, 0);
  assert.equal(request("post", "/casino/mines/cashout", { playerId: p.id }).status, 200);
  assert.equal(assigned(any.id).progress, 50);
  assert.equal(assigned(mines.id).progress, 50);
  assert.equal(assigned(blackjack.id).progress, 0);
  assert.equal(getPlayer(p.id).money, p.money + 150);
  assert.equal(request("post", "/casino/mines/cashout", { playerId: p.id }).status, 409);
  assert.equal(assigned(any.id).progress, 50);
  casino(p.id, "ladder", { potentialPayout: 170 });
  request("post", "/casino/ladder/cashout", { playerId: p.id });
  assert.equal(assigned(any.id).progress, 120);
  casino(p.id, "mines", { potentialPayout: 100 });
  request("post", "/casino/mines/cashout", { playerId: p.id });
  assert.equal(assigned(any.id).progress, 120);
  casino(p.id, "mines");
  request("post", "/casino/mines/reveal", { playerId: p.id, body: { cell: 24 } });
  assert.equal(assigned(any.id).progress, 120);
});

test("opening safe cells does not count potential winnings until cashout", () => {
  const p = player();
  const q = assign(p.id, { objectiveType: "casino_win", targetCount: 1000 });
  assert.equal(request("post", "/casino/start", { playerId: p.id, body: { game: "mines", bet: 100, mineCount: 5 } }).status, 201);
  const session = db.select().from(casinoSessions).where(eq(casinoSessions.playerId, p.id)).get();
  const cell = Array.from({ length: 25 }, (_, i) => i).find((i) => !session.state.mines.includes(i));
  const revealed = request("post", "/casino/mines/reveal", { playerId: p.id, body: { cell } });
  assert.equal(revealed.body.status, "active");
  assert.equal(assigned(q.id).progress, 0);
  assert.equal(getPlayer(p.id).money, p.money - 100);
  const finished = request("post", "/casino/mines/cashout", { playerId: p.id });
  assert.equal(assigned(q.id).progress, finished.body.potentialPayout - 100);
  assert.equal(getPlayer(p.id).money, p.money + assigned(q.id).progress);
});

test("blackjack wins, draws and losses award only positive profit", () => {
  const p = player();
  const q = assign(p.id, { objectiveType: "casino_win", targetId: "blackjack", targetCount: 1000 });
  for (const [dealerRank, expected] of [["8", 100], ["K", 100], ["A", 100]]) {
    casino(p.id, "blackjack", { state: {
      deck: new Deck().toString(),
      playerCards: [{ rank: "K", suit: "clubs" }, { rank: "Q", suit: "hearts" }],
      dealerCards: [{ rank: "K", suit: "spades" }, { rank: dealerRank, suit: "diamonds" }],
    } });
    const response = request("post", "/casino/blackjack/action", { playerId: p.id, body: { action: "stand" } });
    assert.equal(response.status, 200);
    assert.equal(assigned(q.id).progress, expected);
  }
});

test("completing the ladder automatically settles profit once", () => {
  const p = player();
  const q = assign(p.id, { objectiveType: "casino_win", targetId: "ladder", targetCount: 10000 });
  casino(p.id, "ladder", { state: { choices: Array(7).fill(0), bombCount: 1, bombCells: Array.from({ length: 8 }, () => [2]) } });
  const response = request("post", "/casino/ladder/choose", { playerId: p.id, body: { cell: 0 } });
  assert.equal(response.body.status, "won");
  assert.equal(assigned(q.id).progress, response.body.potentialPayout - 100);
  assert.equal(request("post", "/casino/ladder/cashout", { playerId: p.id }).status, 409);
});

test("claim adds coins, points and XP once; uncompleted and other players' quests cannot be claimed", () => {
  const p = player();
  const q = assign(p.id, { targetXp: 120, targetPoints: 7, targetCoins: 45, targetCount: 1 });
  const casinoQuest = assign(p.id, { objectiveType: "casino_win", targetCount: 100 });
  assert.equal(request("post", "/quests/:id/claim", { playerId: p.id, id: q.id }).status, 409);
  progressQuests(p.id, "kill", 0);
  assert.equal(request("post", "/quests/:id/claim", { playerId: player().id, id: q.id }).status, 404);
  const response = request("post", "/quests/:id/claim", { playerId: p.id, id: q.id });
  assert.equal(response.status, 200);
  assert.equal(response.body.player.money, p.money + 45);
  assert.equal(response.body.player.points, p.points + 7);
  assert.equal(response.body.player.xp, p.xp + 120);
  assert.equal(response.body.player.level, 2);
  assert.equal(response.body.player.statPoints, 1);
  assert.equal(assigned(q.id).status, "claimed");
  assert.equal(assigned(casinoQuest.id).progress, 0);
  assert.equal(request("post", "/quests/:id/claim", { playerId: p.id, id: q.id }).status, 409);
  assert.equal(getPlayer(p.id).money, p.money + 45);
});

test("a failed reward transaction rolls back coins, points and claimed status", () => {
  const p = player();
  const q = assign(p.id, { targetXp: 10, targetPoints: 5, targetCoins: 25 }, { status: "completed", progress: 5 });
  db.$client.exec(`CREATE TEMP TRIGGER fail_quest_xp BEFORE UPDATE OF xp ON players
    WHEN NEW.id = ${p.id} BEGIN SELECT RAISE(ABORT, 'test reward failure'); END;`);
  try {
    assert.throws(() => request("post", "/quests/:id/claim", { playerId: p.id, id: q.id }), /test reward failure/);
    assert.equal(assigned(q.id).status, "completed");
    assert.equal(assigned(q.id).claimedAt, null);
    assert.equal(getPlayer(p.id).money, p.money);
    assert.equal(getPlayer(p.id).points, p.points);
    assert.equal(getPlayer(p.id).xp, p.xp);
  } finally {
    db.$client.exec("DROP TRIGGER fail_quest_xp");
  }
});
