import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";

const directory = mkdtempSync(path.join(tmpdir(), "mmobot-casino-"));
process.env.DATABASE_PATH = path.join(directory, "test.db");
process.env.BOT_TOKEN = "123456:test-token";
process.env.SESSION_SECRET = "casino-tests";
mock.module("../dist/notification.js", { namedExports: { notify: mock.fn() } });

const { db, initializeDatabase } = await import("../dist/db.js");
const { casinoSessions, players } = await import("../dist/db/schema.js");
const { createCasinoRoutes } = await import("../dist/casino.js");
const { nowGameTime } = await import("../dist/time.js");
initializeDatabase();

after(() => {
  db.$client.close();
  rmSync(directory, { recursive: true, force: true });
});

// Реальные обработчики с изолированной БД, без сетевого сервера.
const routes = new Map();
createCasinoRoutes(Object.fromEntries(["get", "post"].map((method) => [
  method, (url, handler) => routes.set(`${method} ${url}`, handler),
])));
function request(method, url, playerId, body = {}) {
  const result = { status: 200, body: undefined };
  const res = {
    status(status) { result.status = status; return this; },
    json(value) { result.body = JSON.parse(JSON.stringify(value)); return this; },
  };
  routes.get(`${method} ${url}`)({ player: { id: playerId }, body }, res);
  assert.ok(result.status < 400, JSON.stringify(result));
  return result.body;
}
let nextPlayerId = 1;
function start(game, options) {
  const id = nextPlayerId++;
  db.insert(players).values({
    id, friendId: id, name: `Игрок ${id}`, money: 1000,
    currentLocationId: "market", createdAt: nowGameTime(), lastSeenAt: nowGameTime(),
  }).run();
  const response = request("post", "/casino/start", id, { game, bet: 10, ...options });
  assert.equal(response.status, "active");
  assert.equal(Object.hasOwn(response[game], "bombCells"), false);
  const session = db.select().from(casinoSessions).where(eq(casinoSessions.id, response.id)).get();
  return { playerId: id, session };
}
function assertHidden(game, playerId) {
  const response = request("get", "/casino/session", playerId);
  assert.equal(response.status, "active");
  assert.equal(Object.hasOwn(response[game], "bombCells"), false);
}

test("mines hide the active board and reveal it after losing", () => {
  const { playerId, session } = start("mines", { mineCount: 3 });
  const bombs = session.state.mines;
  assertHidden("mines", playerId);
  const safeCell = Array.from({ length: 25 }, (_, cell) => cell).find((cell) => !bombs.includes(cell));
  const safe = request("post", "/casino/mines/reveal", playerId, { cell: safeCell });
  assert.equal(safe.status, "active");
  assert.deepEqual(safe.mines.revealed, [safeCell]);
  assert.equal(Object.hasOwn(safe.mines, "bombCells"), false);
  const lost = request("post", "/casino/mines/reveal", playerId, { cell: bombs[0] });
  assert.equal(lost.status, "lost");
  assert.deepEqual(lost.mines.bombCells, bombs);
  assert.equal(lost.mines.explodedCell, bombs[0]);
  assert.deepEqual(lost.mines.revealed, [safeCell]);
  const next = request("post", "/casino/start", playerId, { game: "mines", bet: 10, mineCount: 3 });
  assert.equal(next.status, "active");
  assert.equal(Object.hasOwn(next.mines, "bombCells"), false);
});

test("mines reveal the full board after cashing out", () => {
  const { playerId, session } = start("mines", { mineCount: 3 });
  const bombs = session.state.mines;
  const safeCell = Array.from({ length: 25 }, (_, cell) => cell).find((cell) => !bombs.includes(cell));
  request("post", "/casino/mines/reveal", playerId, { cell: safeCell });
  assertHidden("mines", playerId);
  const won = request("post", "/casino/mines/cashout", playerId);
  assert.equal(won.status, "won");
  assert.deepEqual(won.mines.bombCells, bombs);
  assert.deepEqual(won.mines.revealed, [safeCell]);
  assert.equal(Object.hasOwn(won.mines, "explodedCell"), false);
});

for (const bombCount of [1, 2]) {
  test(`ladder reveals all eight levels after losing with ${bombCount} bombs per level`, () => {
    const { playerId, session } = start("ladder", { ladderBombCount: bombCount });
    const bombs = session.state.bombCells;
    assertHidden("ladder", playerId);
    const safeCell = [0, 1, 2].find((cell) => !bombs[0].includes(cell));
    const safe = request("post", "/casino/ladder/choose", playerId, { cell: safeCell });
    assert.equal(safe.status, "active");
    assert.equal(Object.hasOwn(safe.ladder, "bombCells"), false);
    assertHidden("ladder", playerId);
    const lost = request("post", "/casino/ladder/choose", playerId, { cell: bombs[1][0] });
    assert.equal(lost.status, "lost");
    assert.deepEqual(lost.ladder.bombCells, bombs);
    assert.equal(lost.ladder.bombCells.length, 8);
    assert.ok(lost.ladder.bombCells.every((level) => level.length === bombCount));
    assert.equal(lost.ladder.level, 2);
    assert.equal(lost.ladder.failedCell, bombs[1][0]);
  });

  for (const finish of ["cashout", "last level"]) {
    test(`ladder reveals all levels after ${finish} with ${bombCount} bombs per level`, () => {
      const { playerId, session } = start("ladder", { ladderBombCount: bombCount });
      const bombs = session.state.bombCells;
      const levels = finish === "cashout" ? 1 : bombs.length;
      let response;
      for (let level = 0; level < levels; level += 1) {
        assertHidden("ladder", playerId);
        const cell = [0, 1, 2].find((cell) => !bombs[level].includes(cell));
        response = request("post", "/casino/ladder/choose", playerId, { cell });
      }
      if (finish === "cashout") {
        assertHidden("ladder", playerId);
        response = request("post", "/casino/ladder/cashout", playerId);
      }
      assert.equal(response.status, "won");
      assert.deepEqual(response.ladder.bombCells, bombs);
      assert.equal(response.ladder.level, levels);
      assert.equal(Object.hasOwn(response.ladder, "failedCell"), false);
    });
  }
}

test("legacy ladder sessions reveal bombs from their stored safe cells", () => {
  const { playerId, session } = start("ladder", { ladderBombCount: 2 });
  const safeCells = [0, 1, 2, 0, 1, 2, 0, 1];
  db.update(casinoSessions).set({ state: { safeCells, choices: [] } })
    .where(eq(casinoSessions.id, session.id)).run();
  assertHidden("ladder", playerId);
  const lost = request("post", "/casino/ladder/choose", playerId, { cell: 1 });
  assert.equal(lost.status, "lost");
  assert.equal(lost.ladder.bombCount, 2);
  assert.deepEqual(lost.ladder.bombCells, [[1, 2], [0, 2], [0, 1], [1, 2], [0, 2], [0, 1], [1, 2], [0, 2]]);
});
