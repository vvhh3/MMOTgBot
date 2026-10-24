import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import { eq } from "drizzle-orm";

const directory = mkdtempSync(path.join(tmpdir(), "mmobot-pvp-"));
process.env.DATABASE_PATH = path.join(directory, "test.db");
process.env.BOT_TOKEN = "123456:test-token";
process.env.SESSION_SECRET = "pvp-tests";
const emitted = mock.fn();
mock.module("../dist/notification.js", { namedExports: { notify: mock.fn() } });
mock.module("../dist/realTime.js", { namedExports: {
  isPlayerOnline: () => false, emitToPlayer: emitted,
  broadcastLocation: mock.fn(), moveSocketToLocation: mock.fn(),
} });

const { db, initializeDatabase } = await import("../dist/db.js");
const { players, pvpSessions } = await import("../dist/db/schema.js");
const { createPvpRoutes, expireStalePvpSessions, STALE_PVP_MS } = await import("../dist/pvp.js");
const { receivingTheLastAction } = await import("../dist/theLastAction.js");
const { startMaintenance, PVP_MAINTENANCE_INTERVAL_MS } = await import("../dist/maintenance.js");
const { nowGameTime, nowGameTimeMs } = await import("../dist/time.js");
initializeDatabase();
const app = express();
createPvpRoutes(app);
receivingTheLastAction(app);

after(() => {
  db.$client.close();
  rmSync(directory, { recursive: true, force: true });
});

let nextId = 80000;
function player() {
  const id = nextId++;
  return db.insert(players).values({
    id, friendId: id, name: `Игрок ${id}`, health: 100, maxHealth: 100,
    createdAt: nowGameTime(), lastSeenAt: nowGameTime(),
  }).returning().get();
}
function duel(overrides = {}) {
  const a = player();
  const b = player();
  const session = db.insert(pvpSessions).values({
    player1Id: a.id, player2Id: b.id, player1Health: 80, player2Health: 35,
    status: "active", turn: "player1", creadetAt: nowGameTime(), lastActionAt: nowGameTime(),
    ...overrides,
  }).returning().get();
  for (const p of [a, b]) db.update(players).set({ idTheLastAction: { type: "Fight", id: session.id } }).where(eq(players.id, p.id)).run();
  return { a, b, session };
}
const getPlayer = (id) => db.select().from(players).where(eq(players.id, id)).get();
const getSession = (id) => db.select().from(pvpSessions).where(eq(pvpSessions.id, id)).get();
function request(method, routePath, playerId, id, body = {}) {
  const route = app._router.stack.find((layer) => layer.route?.path === routePath && layer.route.methods[method])?.route;
  assert.ok(route);
  const req = { player: getPlayer(playerId), params: { id: String(id) }, body };
  const result = { status: 200, body: undefined };
  const res = {
    headersSent: false,
    status(value) { result.status = value; return this; },
    json(value) { this.headersSent = true; result.body = JSON.parse(JSON.stringify(value)); return this; },
  };
  route.stack[0].handle(req, res);
  assert.notEqual(result.body, undefined, "Каждая ветка должна завершить HTTP-запрос");
  return result;
}

test("тайм-аут засчитывает поражение ожидаемому игроку и награждает соперника один раз", () => {
  assert.equal(STALE_PVP_MS, 5 * 60 * 1000);
  const { a, b, session } = duel({ lastActionAt: new Date(nowGameTimeMs() - STALE_PVP_MS - 1).toISOString() });
  expireStalePvpSessions();
  assert.equal(getSession(session.id).status, "finished");
  assert.equal(getSession(session.id).winnerId, b.id);
  assert.equal(getSession(session.id).player1Health, 0);
  for (const p of [a, b]) {
    assert.equal(getPlayer(p.id).idTheLastAction, null);
    assert.equal(getPlayer(p.id).health, p.id === a.id ? 0 : p.health);
    assert.equal(getPlayer(p.id).points, p.points + (p.id === b.id ? 10 : 0));
    assert.equal(getPlayer(p.id).xp, p.xp + (p.id === b.id ? 10 : 0));
    const event = emitted.mock.calls.findLast(({ arguments: args }) => args[0] === p.id && args[1] === "pvpState");
    assert.equal(event.arguments[2].finished, true);
    assert.equal(event.arguments[2].isWon, p.id === b.id);
  }
  const count = emitted.mock.callCount();
  expireStalePvpSessions();
  assert.equal(emitted.mock.callCount(), count);
  assert.equal(getPlayer(b.id).points, b.points + 10);
});

test("приглашение без lastActionAt тоже истекает, свежая дуэль продолжает работать", () => {
  const old = duel({ status: "pending", lastActionAt: null, creadetAt: new Date(nowGameTimeMs() - STALE_PVP_MS - 1000).toISOString() });
  const fresh = duel();
  expireStalePvpSessions();
  assert.equal(getSession(old.session.id).status, "finished");
  assert.equal(getSession(old.session.id).winnerId, null);
  assert.equal(getPlayer(old.a.id).health, old.a.health);
  assert.equal(getPlayer(old.b.id).points, old.b.points);
  assert.equal(getSession(fresh.session.id).status, "active");
});

test("второй игрок восстанавливает свои HP и реальный результат завершённой дуэли", () => {
  const { a, b, session } = duel();
  const active = request("post", "/theLastAction", b.id, session.id).body.info;
  assert.equal(active.myHp, 35);
  assert.equal(active.partnerHp, 80);
  assert.equal(active.myTurn, false);
  db.update(pvpSessions).set({ status: "finished", winnerId: a.id }).where(eq(pvpSessions.id, session.id)).run();
  const finished = request("post", "/theLastAction", b.id, session.id).body.info;
  assert.equal(finished.finished, true);
  assert.equal(finished.isWon, false);
  assert.equal(getPlayer(b.id).idTheLastAction, null);
});

test("восстановление истёкшей дуэли не выдаёт повторных наград и отвечает на запрос", () => {
  const { a, b, session } = duel({ lastActionAt: new Date(nowGameTimeMs() - STALE_PVP_MS - 1000).toISOString() });
  assert.equal(request("post", "/theLastAction", a.id, session.id).body.info.finished, true);
  assert.equal(request("post", "/theLastAction", a.id, session.id).body.info, null);
  assert.equal(getPlayer(a.id).points, a.points);
  assert.equal(getPlayer(a.id).health, 0);
  assert.equal(getPlayer(b.id).points, b.points + 10);
  assert.equal(getPlayer(b.id).xp, b.xp + 10);
  assert.equal(getPlayer(b.id).health, b.health);
});

test("сдача в чужой ход приносит поражение, повторный запрос не меняет победителя", () => {
  const { a, b, session } = duel();
  const stranger = player();
  assert.equal(request("delete", "/pvp/:id", stranger.id, session.id).status, 404);
  assert.equal(request("get", "/pvp/:id", stranger.id, session.id).status, 404);
  const cancelled = request("delete", "/pvp/:id", b.id, session.id);
  assert.equal(cancelled.body.state.finished, true);
  assert.equal(cancelled.body.state.isWon, false);
  assert.equal(cancelled.body.state.myHp, 0);
  assert.equal(getSession(session.id).winnerId, a.id);
  assert.equal(getPlayer(b.id).health, 0);
  assert.equal(getPlayer(a.id).idTheLastAction, null);
  assert.equal(request("delete", "/pvp/:id", b.id, session.id).status, 200);
  assert.equal(request("delete", "/pvp/:id", a.id, session.id).body.state.isWon, true);
  assert.equal(getPlayer(a.id).points, a.points + 10);
  assert.equal(getPlayer(a.id).xp, a.xp + 10);
});

test("очистка старой дуэли не стирает ссылку на новое занятие игрока", () => {
  const { a, session } = duel({ lastActionAt: new Date(nowGameTimeMs() - STALE_PVP_MS - 1000).toISOString() });
  db.update(players).set({ idTheLastAction: { type: "Trade", id: 123 } }).where(eq(players.id, a.id)).run();
  expireStalePvpSessions();
  assert.deepEqual(getPlayer(a.id).idTheLastAction, { type: "Trade", id: 123 });
  assert.equal(getSession(session.id).status, "finished");
});

test("HTTP-ответ хода позволяет восстановить очередь без доставки сокета", () => {
  const { a, b, session } = duel();
  assert.equal(request("post", "/pvp/:id/action", b.id, session.id, { action: "attack" }).status, 409);
  const result = request("post", "/pvp/:id/action", a.id, session.id, { action: "attack" });
  assert.equal(result.status, 200);
  assert.equal(result.body.state.myTurn, false);
  assert.equal(result.body.state.myHp, 80);
  assert.ok(result.body.state.partnerHp < 35);
  const opponent = request("get", "/pvp/:id", b.id, session.id).body;
  assert.equal(opponent.myTurn, true);
  assert.equal(opponent.myHp, result.body.state.partnerHp);
});

test("обслуживание завершает просроченный PvP через 10 секунд, не через час", (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  startMaintenance();
  const { session } = duel({ lastActionAt: new Date(nowGameTimeMs() - STALE_PVP_MS - 1000).toISOString() });
  t.mock.timers.tick(PVP_MAINTENANCE_INTERVAL_MS - 1);
  assert.equal(getSession(session.id).status, "active");
  t.mock.timers.tick(1);
  assert.equal(getSession(session.id).status, "finished");
});

test("при тайм-ауте второго игрока выигрывает первый", () => {
  const { a, b, session } = duel({ turn: "player2", lastActionAt: new Date(nowGameTimeMs() - STALE_PVP_MS - 1).toISOString() });
  expireStalePvpSessions();
  assert.equal(getSession(session.id).winnerId, a.id);
  assert.equal(getSession(session.id).player2Health, 0);
  assert.equal(getPlayer(b.id).health, 0);
  assert.equal(getPlayer(a.id).points, a.points + 10);
});

test("отказ от непринятого приглашения не создаёт победу или поражение", () => {
  const { a, b, session } = duel({ status: "pending", lastActionAt: null });
  assert.equal(request("delete", "/pvp/:id", b.id, session.id).body.state.isWon, null);
  assert.equal(getSession(session.id).winnerId, null);
  for (const p of [a, b]) {
    assert.equal(getPlayer(p.id).health, p.health);
    assert.equal(getPlayer(p.id).xp, p.xp);
    assert.equal(getPlayer(p.id).points, p.points);
  }
});

for (const turn of ["player1", "player2"]) {
  test(`успешный побег ${turn} засчитывает ему поражение`, (t) => {
    t.mock.method(Math, "random", () => 0);
    const { a, b, session } = duel({ turn });
    const loser = turn === "player1" ? a : b;
    const winner = turn === "player1" ? b : a;
    const result = request("post", "/pvp/:id/action", loser.id, session.id, { action: "flee" });
    assert.equal(result.body.state.finished, true);
    assert.equal(result.body.state.isWon, false);
    assert.equal(result.body.state.myHp, 0);
    assert.equal(getSession(session.id).winnerId, winner.id);
    assert.equal(getPlayer(loser.id).health, 0);
    assert.equal(getPlayer(winner.id).xp, winner.xp + 10);
    assert.equal(getPlayer(winner.id).points, winner.points + 10);
    assert.equal(request("get", "/pvp/:id", winner.id, session.id).body.isWon, true);
  });
}

test("неудачный побег оставляет бой активным и не выдаёт награду", (t) => {
  t.mock.method(Math, "random", () => 0.9);
  const { a, b, session } = duel();
  const result = request("post", "/pvp/:id/action", a.id, session.id, { action: "flee" });
  assert.equal(result.body.state.finished, false);
  assert.equal(result.body.state.myTurn, false);
  assert.ok(result.body.state.myHp < 80);
  assert.equal(getPlayer(b.id).points, b.points);
});

test("смертельный удар и последующая сдача выдают только одну награду", () => {
  const { a, b, session } = duel({ player2Health: 1 });
  const result = request("post", "/pvp/:id/action", a.id, session.id, { action: "attack" });
  assert.equal(result.body.state.isWon, true);
  assert.equal(result.body.state.partnerHp, 0);
  assert.equal(request("delete", "/pvp/:id", a.id, session.id).body.state.isWon, true);
  assert.equal(getPlayer(b.id).health, 0);
  assert.equal(getPlayer(a.id).points, a.points + 10);
  assert.equal(getPlayer(a.id).xp, a.xp + 10);
});

test("ошибка выдачи награды откатывает весь результат дуэли", () => {
  const { a, b, session } = duel();
  const beforeA = getPlayer(a.id);
  const beforeB = getPlayer(b.id);
  const eventCount = emitted.mock.callCount();
  db.$client.exec(`CREATE TRIGGER fail_pvp_reward BEFORE UPDATE OF points ON players
    WHEN NEW.id = ${a.id} BEGIN SELECT RAISE(ABORT, 'test reward failure'); END;`);
  try {
    assert.throws(() => request("delete", "/pvp/:id", b.id, session.id), /test reward failure/);
    assert.equal(getSession(session.id).status, "active");
    assert.deepEqual(getPlayer(a.id), beforeA);
    assert.deepEqual(getPlayer(b.id), beforeB);
    assert.equal(emitted.mock.callCount(), eventCount);
  } finally {
    db.$client.exec("DROP TRIGGER fail_pvp_reward");
  }
});
