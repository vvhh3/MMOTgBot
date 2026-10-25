import assert from "node:assert/strict";
import { after,mock,test } from "node:test";
import { mkdtempSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { and,eq } from "drizzle-orm";
import { TUTORIAL_MOB_ID,TUTORIAL_REWARD_KEY } from "@mmobot/shared";

const directory = mkdtempSync(path.join(tmpdir(), "mmobot-tutorial-"));
process.env.DATABASE_PATH = path.join(directory, "test.db");
process.env.BOT_TOKEN = "123456:test-token";
process.env.SESSION_SECRET = "tutorial-tests";
process.env.DEV_BYPASS_AUTH = "false";
mock.module("../dist/infrastructure/telegram/notifications.js", { namedExports: { notify: mock.fn() } });
mock.module("../dist/infrastructure/realtime/socket-server.js", { namedExports: {
  emitToPlayer: mock.fn(), isPlayerOnline: () => false, broadcastLocation: mock.fn(), moveSocketToLocation: mock.fn(),
} });
const { db,sqlite } = await import("../dist/database/connection.js");
const { players,mobs,items,inventoryItems,combatSessions } = await import("../dist/database/schema.js");
const { initializeDatabase } = await import("../dist/database/initialize.js");
const { createApp } = await import("../dist/app.js");
const { createSessionToken,requireAuth } = await import("../dist/modules/auth/auth.js");
const { moveCombatAction } = await import("../dist/modules/combat/pve.js");
const { buildLocationState } = await import("../dist/modules/locations/state.js");
const { nowGameTime,nowGameTimeMs } = await import("../dist/shared/time.js");
const app = createApp();
after(() => { sqlite.close(); rmSync(directory, { recursive: true, force: true }); });

let nextId = 500;
function player(overrides = {}) {
  const id = nextId++;
  return db.insert(players).values({ id, friendId: id, name: `Новичок ${id}`, isCreated: false,
    createdAt: nowGameTime(), lastSeenAt: nowGameTime(), ...overrides }).returning().get();
}
function getPlayer(id) { return db.select().from(players).where(eq(players.id, id)).get(); }
function request(method, url, playerId, body = {}, authenticated = true) {
  const route = app._router.stack.find((layer) => layer.route?.path === url && layer.route.methods[method])?.route;
  assert.ok(route, `${method} ${url}`);
  const req = { body, params: {}, query: {}, header: () => authenticated ? `Bearer ${createSessionToken(playerId)}` : undefined };
  const result = { status: 200, body: undefined };
  const res = { status(value) { result.status = value; return this; }, json(value) { result.body = JSON.parse(JSON.stringify(value)); return this; } };
  let index = 0;
  const next = () => route.stack[index++]?.handle(req, res, next);
  // Inventory auth is registered on its router prefix, not each route.
  if (url.startsWith("/inventory/")) requireAuth(req, res, next);
  else next();
  return result;
}
function newcomer() {
  const p = player();
  const result = request("post", "/me/character", p.id, { name: "Новичок", avatar: "/character-images/skins1.svg", factionId: "nefors", tutorialStep: "complete" });
  assert.equal(result.status, 200);
  assert.equal(result.body.player.tutorialStep, "welcome");
  return getPlayer(p.id);
}
function begin(id) {
  const result = request("post", "/tutorial/start", id);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body.state;
}
function attack(id, state) {
  const command = { action: "attack", sessionId: state.id, round: state.round, expectedVersion: state.stateVersion,
    requestId: randomUUID(), moveId: state.moves[0].id };
  const response = request("post", "/combat/action", id, command);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return { response: response.body, command };
}
function win(id, state) {
  for (let i = 0; i < 10; i++) {
    const result = attack(id, state);
    state = result.response.state;
    if (state.status === "victory") return result;
  }
  assert.fail("Tutorial should finish in a few rounds");
}
function rewardInstances(id) {
  const reward = db.select().from(items).where(eq(items.catalogKey, TUTORIAL_REWARD_KEY)).get();
  return db.select().from(inventoryItems).where(and(eq(inventoryItems.playerId, id), eq(inventoryItems.itemType, reward.id))).all();
}

test("only character creation opts players in; existing characters are not forced into tutorial", () => {
  const existing = player({ isCreated: true, xp: 450, money: 123 });
  assert.equal(getPlayer(existing.id).tutorialStep, "done");
  assert.equal(request("post", "/tutorial/start", existing.id).status, 409);
  assert.equal(request("post", "/tutorial/start", player().id).status, 409);
  const p = newcomer();
  assert.equal(request("post", "/tutorial/start", p.id, {}, false).status, 401);
  assert.equal(request("post", "/tutorial/finish", p.id).status, 409);
  assert.equal(getPlayer(p.id).tutorialStep, "welcome");
});

test("personal battle is resumable, hidden from normal encounters and independent for two players", () => {
  const first = newcomer();
  const second = newcomer();
  const state = begin(first.id);
  assert.equal(getPlayer(first.id).currentLocationId, "square");
  assert.equal(getPlayer(first.id).tutorialStep, "battle");
  assert.equal(state.mob.id, TUTORIAL_MOB_ID);
  assert.equal(begin(first.id).id, state.id);
  const other = begin(second.id);
  assert.notEqual(other.id, state.id);
  assert.ok(!buildLocationState("square").mobs.some((mob) => mob.id === TUTORIAL_MOB_ID));
  assert.equal(request("post", "/combat/start", second.id, { mobId: TUTORIAL_MOB_ID }).status, 409);
  const chosen = { sessionId: state.id, round: state.round, expectedVersion: state.stateVersion, requestId: randomUUID(), action: "attack", moveId: state.moves[0].id };
  assert.equal(request("post", "/combat/action", second.id, chosen).status, 404);
  assert.equal(request("post", "/tutorial/skip", first.id).status, 409);
  win(first.id, state);
  assert.equal(db.select().from(combatSessions).where(eq(combatSessions.id, other.id)).get().mobHealth, other.mobHp);
  win(second.id, other);
});

test("victory grants one weapon, coins and XP; duplicate commands and another start cannot repeat rewards", () => {
  const p = newcomer();
  const { response, command } = win(p.id, begin(p.id));
  assert.equal(response.player.tutorialStep, "equip");
  assert.equal(response.state.droppedItems.length, 1);
  assert.equal(rewardInstances(p.id).length, 1);
  const before = getPlayer(p.id);
  assert.equal(before.points, 10);
  assert.equal(before.money, 10);
  assert.equal(before.xp, 10);
  assert.equal(request("post", "/combat/action", p.id, command).status, 200);
  assert.equal(request("post", "/tutorial/start", p.id).status, 409);
  assert.equal(request("post", "/tutorial/finish", p.id).status, 409);
  assert.equal(rewardInstances(p.id).length, 1);
  assert.equal(getPlayer(p.id).money, before.money);
  assert.equal(getPlayer(p.id).xp, before.xp);
});

test("only actual weapon equipment completes the guide; finishing and skipping are persistent", () => {
  const p = newcomer();
  win(p.id, begin(p.id));
  const weapon = rewardInstances(p.id)[0];
  const armor = db.insert(inventoryItems).values({ playerId: p.id, itemType: 2, quantity: 1, acquiredAt: nowGameTime() }).returning().get();
  assert.equal(request("post", "/inventory/equip", p.id, { inventoryItemId: armor.id }).status, 200);
  assert.equal(getPlayer(p.id).tutorialStep, "equip");
  assert.equal(request("post", "/inventory/equip", p.id, { inventoryItemId: weapon.id }).body.player.tutorialStep, "complete");
  assert.equal(request("post", "/tutorial/finish", p.id).body.player.tutorialStep, "done");
  assert.equal(request("post", "/tutorial/finish", p.id).status, 200);
  assert.equal(request("post", "/tutorial/start", p.id).status, 409);
  const skip = newcomer();
  assert.equal(request("post", "/tutorial/skip", skip.id).body.player.tutorialStep, "done");
  assert.equal(rewardInstances(skip.id).length, 0);
  assert.equal(request("post", "/tutorial/start", skip.id).status, 409);
  initializeDatabase();
  assert.equal(getPlayer(p.id).tutorialStep, "done");
  assert.equal(getPlayer(skip.id).tutorialStep, "done");
});

test("expired personal battle can restart without rewards; active progress survives startup", () => {
  const p = newcomer();
  const state = begin(p.id);
  db.update(combatSessions).set({ lastActionAt: new Date(nowGameTimeMs() - 6 * 60 * 1000).toISOString() }).where(eq(combatSessions.id, state.id)).run();
  const retry = begin(p.id);
  assert.notEqual(retry.id, state.id);
  assert.equal(rewardInstances(p.id).length, 0);
  assert.equal(getPlayer(p.id).xp, 0);
  initializeDatabase();
  assert.equal(getPlayer(p.id).tutorialStep, "battle");
  assert.equal(begin(p.id).id, retry.id);
  win(p.id, retry);
  initializeDatabase();
  assert.equal(getPlayer(p.id).tutorialStep, "equip");
  assert.equal(rewardInstances(p.id).length, 1);
});

test("failed item grant rolls back victory, tutorial progress and rewards together", () => {
  const p = newcomer();
  const state = begin(p.id);
  db.update(combatSessions).set({ mobHealth: 1 }).where(eq(combatSessions.id, state.id)).run();
  const session = db.select().from(combatSessions).where(eq(combatSessions.id, state.id)).get();
  const mob = db.select().from(mobs).where(eq(mobs.id, TUTORIAL_MOB_ID)).get();
  sqlite.exec(`CREATE TRIGGER reject_tutorial_reward BEFORE INSERT ON inventory_items WHEN NEW.player_id = ${p.id} BEGIN SELECT RAISE(ABORT, 'blocked reward'); END`);
  try {
    assert.throws(() => moveCombatAction(getPlayer(p.id), mob, session, "attack"), /blocked reward/);
    assert.equal(getPlayer(p.id).tutorialStep, "battle");
    assert.equal(getPlayer(p.id).money, 0);
    assert.equal(getPlayer(p.id).xp, 0);
    assert.equal(db.select().from(combatSessions).where(eq(combatSessions.id, state.id)).get().status, "active");
  } finally { sqlite.exec("DROP TRIGGER reject_tutorial_reward"); }
  const result = win(p.id, state);
  assert.equal(result.response.player.tutorialStep, "equip");
  assert.equal(rewardInstances(p.id).length, 1);
});
