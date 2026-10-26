import assert from "node:assert/strict";
import { after, beforeEach, mock, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import { eq } from "drizzle-orm";

// Keep integration assertions deterministic; accuracy itself is covered separately.
beforeEach((t) => { t.mock.method(Math, 'random', () => 0); });

const directory = mkdtempSync(path.join(tmpdir(), "mmobot-pvp-"));
process.env.DATABASE_PATH = path.join(directory, "test.db");
process.env.BOT_TOKEN = "123456:test-token";
process.env.SESSION_SECRET = "pvp-tests";
const emitted = mock.fn();
mock.module("../dist/infrastructure/telegram/notifications.js", { namedExports: { notify: mock.fn() } });
mock.module("../dist/infrastructure/realtime/socket-server.js", { namedExports: {
  isPlayerOnline: () => false, emitToPlayer: emitted,
  broadcastLocation: mock.fn(), moveSocketToLocation: mock.fn(),
} });

const { db, initializeDatabase } = await import("../dist/database/index.js");
const { players, pvpSessions } = await import("../dist/database/schema.js");
const { createPvpRoutes, expireStalePvpSessions, STALE_PVP_MS } = await import("../dist/modules/combat/pvp.js");
const { receivingTheLastAction } = await import("../dist/modules/players/last-action.js");
const { startMaintenance, PVP_MAINTENANCE_INTERVAL_MS } = await import("../dist/jobs/maintenance.js");
const { createBattle, basicAttack } = await import("../dist/modules/combat/battle/engine.js");
const { nowGameTime, nowGameTimeMs } = await import("../dist/shared/time.js");
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
    roundStartedAt: overrides.lastActionAt ?? nowGameTime(),
    battleState: createBattle([a, b].map(p => ({ name: p.name, strength: 10, defense: 5, maxHp: 100, moves: [basicAttack(false)] }))),
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


let commandId = 0;
function command(session, extra = {}) {
  return { sessionId: session.id, round: session.roundNumber, expectedVersion: session.stateVersion,
    requestId: `request-${++commandId}`, action: 'attack', moveId: 'unarmed_strike', ...extra };
}
function choose(p, session, body = command(session)) { return request('post', '/pvp/:id/action', p.id, session.id, body); }
function exit(p, session, requested = true, body = command(session, { requested })) {
  return request('post', '/pvp/:id/exit-request', p.id, session.id, body);
}

test('both choices from the same snapshot resolve one hidden round; duplicates never reroll', () => {
  const { a, b, session } = duel();
  const first = command(session), second = command(session);
  const waiting = choose(a, session, first);
  assert.equal(waiting.status, 200);
  assert.equal(waiting.body.state.actionSubmitted, true);
  assert.equal(waiting.body.state.myHp, 80);
  const partner = request('get', '/pvp/:id', b.id, session.id).body;
  assert.equal(partner.actionSubmitted, false);
  assert.equal(partner.events.length, 0);
  assert.equal(JSON.stringify(partner).includes('processedRequests'), false);
  assert.equal(JSON.stringify(partner).includes('choices'), false);
  assert.equal(choose(a, getSession(session.id)).status, 409);
  const resolved = choose(b, session, second);
  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.state.round, 2);
  const saved = getSession(session.id);
  assert.ok(saved.player1Health < 80 && saved.player2Health < 35);
  assert.equal(choose(b, session, second).status, 200);
  assert.deepEqual(getSession(session.id), saved);
  assert.equal(choose(b, session, { ...second, moveId: 'other' }).status, 409);
});

test('one missing choice times out after five minutes and rewards only once', () => {
  const { a, b, session } = duel();
  choose(a, session);
  const past = new Date(nowGameTimeMs() - STALE_PVP_MS - 1).toISOString();
  db.update(pvpSessions).set({ roundStartedAt: past }).where(eq(pvpSessions.id, session.id)).run();
  expireStalePvpSessions();
  assert.equal(getSession(session.id).winnerId, a.id);
  assert.equal(getPlayer(a.id).health, 80);
  assert.equal(getPlayer(b.id).health, 0);
  assert.equal(getPlayer(a.id).xp, 10);
  assert.equal(getPlayer(a.id).points, 10);
  expireStalePvpSessions();
  assert.equal(getPlayer(a.id).xp, 10);
  assert.equal(getPlayer(a.id).idTheLastAction, null);
});

test('both missing choices finish without winner, rewards or lost HP', () => {
  const { a, b, session } = duel({ lastActionAt: new Date(nowGameTimeMs() - STALE_PVP_MS - 1).toISOString() });
  expireStalePvpSessions();
  assert.equal(getSession(session.id).status, 'finished');
  assert.equal(getSession(session.id).winnerId, null);
  assert.equal(getSession(session.id).battleState.finishReason, 'inactivity');
  assert.equal(getPlayer(a.id).health, 80);
  assert.equal(getPlayer(b.id).health, 35);
  assert.equal(getPlayer(a.id).xp, 0);
  assert.equal(getPlayer(b.id).xp, 0);
});

test('exit request does not occupy the action or extend the deadline; mutual exit preserves HP', () => {
  const { a, b, session } = duel();
  assert.equal(exit(a, session).status, 200);
  const waiting = getSession(session.id);
  assert.equal(waiting.lastActionAt, session.lastActionAt);
  assert.equal(waiting.roundStartedAt, session.roundStartedAt);
  assert.equal(waiting.battleState.choices[0], null);
  assert.equal(choose(a, waiting).status, 200);
  const result = exit(b, getSession(session.id));
  assert.equal(result.body.state.finished, true);
  assert.equal(result.body.state.finishReason, 'mutual_exit');
  assert.equal(result.body.state.isWon, null);
  assert.equal(getPlayer(a.id).health, 80);
  assert.equal(getPlayer(b.id).health, 35);
  assert.equal(getPlayer(a.id).points, 0);
  assert.equal(getPlayer(b.id).points, 0);
});

test('an exit request can be withdrawn, and old unilateral escape routes are blocked', () => {
  const { a, b, session } = duel();
  assert.equal(request('delete', '/pvp/:id', a.id, session.id).status, 409);
  assert.equal(choose(a, session, command(session, { action: 'flee' })).status, 400);
  exit(a, session);
  exit(a, getSession(session.id), false);
  exit(b, getSession(session.id));
  assert.equal(getSession(session.id).status, 'active');
  assert.deepEqual(getSession(session.id).battleState.exitRequested, [false, true]);
});

test('late action and exit cannot undo timeout or award a second reward', () => {
  const { a, b, session } = duel();
  choose(a, session);
  const body = command(getSession(session.id));
  db.update(pvpSessions).set({ roundStartedAt: new Date(nowGameTimeMs() - STALE_PVP_MS - 1).toISOString() }).where(eq(pvpSessions.id, session.id)).run();
  assert.equal(exit(b, session, true, { ...body, requested: true }).status, 409);
  assert.equal(getSession(session.id).winnerId, a.id);
  assert.equal(choose(b, session, body).status, 409);
  assert.equal(getPlayer(a.id).xp, 10);
});

test('knockout and reward are atomic; retry of the final action is harmless', () => {
  const { a, b, session } = duel({ player2Health: 1 });
  choose(a, session);
  const last = command(getSession(session.id));
  db.$client.exec(`CREATE TRIGGER fail_round_reward BEFORE UPDATE OF points ON players WHEN NEW.id = ${a.id} BEGIN SELECT RAISE(ABORT, 'reward failure'); END;`);
  const before = getSession(session.id), beforeA = getPlayer(a.id), beforeB = getPlayer(b.id);
  try {
    assert.throws(() => choose(b, session, last), /reward failure/);
    assert.deepEqual(getSession(session.id), before);
    assert.deepEqual(getPlayer(a.id), beforeA);
    assert.deepEqual(getPlayer(b.id), beforeB);
  } finally { db.$client.exec('DROP TRIGGER fail_round_reward'); }
  assert.equal(choose(b, session, last).body.state.finished, true);
  assert.equal(getPlayer(a.id).xp, 10);
  const final = getSession(session.id);
  assert.equal(choose(b, session, last).status, 200);
  assert.deepEqual(getSession(session.id), final);
});

test('stored requests and choices survive re-reading and restoring the battle', () => {
  const { a, b, session } = duel();
  const body = command(session);
  choose(b, session, body);
  const restored = request('post', '/theLastAction', b.id, session.id).body.info;
  assert.equal(restored.myHp, 35);
  assert.equal(restored.actionSubmitted, true);
  assert.equal(restored.myTurn, false);
  assert.equal(choose(b, session, body).status, 200);
  assert.equal(choose(a, getSession(session.id)).status, 200);
});

test('pending invitation expiry and cancellation have no rewards or HP changes', () => {
  const { a, b, session } = duel({ status: 'pending', lastActionAt: null, roundStartedAt: null,
    creadetAt: new Date(nowGameTimeMs() - STALE_PVP_MS - 1).toISOString() });
  expireStalePvpSessions();
  assert.equal(getSession(session.id).status, 'finished');
  assert.equal(getPlayer(a.id).health, 100);
  assert.equal(getPlayer(b.id).health, 100);
  const pending = duel({ status: 'pending' });
  assert.equal(request('delete', '/pvp/:id', pending.a.id, pending.session.id).status, 200);
  assert.equal(getPlayer(pending.a.id).xp, 0);
});

test('outsiders and malformed or unavailable actions cannot mutate a session', () => {
  const { a, session } = duel(), outsider = player();
  assert.equal(choose(outsider, session).status, 404);
  assert.equal(choose(a, session, {}).status, 400);
  assert.equal(choose(a, session, command(session, { moveId: 'unknown' })).status, 409);
  assert.equal(choose(a, session, command(session, { action: 'use' })).status, 400);
  assert.deepEqual(getSession(session.id), session);
});

test('maintenance retains the existing ten-second PvP timer', () => {
  assert.equal(PVP_MAINTENANCE_INTERVAL_MS, 10000);
  assert.equal(STALE_PVP_MS, 300000);
  const intervals = [];
  const timer = mock.method(global, 'setInterval', (fn, ms) => { intervals.push({ fn, ms }); return { unref() {} }; });
  try { startMaintenance(); } finally { timer.mock.restore(); }
  assert.ok(intervals.some(i => i.ms === 10000));
});

test('accepted choice and replay receipt survive an actual fresh process', async () => {
  const { execFileSync } = await import('node:child_process');
  const { a, session } = duel();
  choose(a, session);
  const code = `const { getPvpStateForPlayer } = await import('./dist/modules/combat/pvp.js');
    const state = getPvpStateForPlayer(${session.id}, ${a.id});
    process.stdout.write(JSON.stringify(state));`;
  const restored = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], { cwd: process.cwd(), env: process.env, encoding: 'utf8' }));
  assert.equal(restored.actionSubmitted, true);
  assert.equal(restored.myHp, 80);
  assert.equal(restored.round, 1);
  assert.equal(getSession(session.id).battleState.processedRequests.length, 1);
});

test('an active PvE prevents accepting a duel, without changing the invitation', async () => {
  const { combatSessions, mobs } = await import('../dist/database/schema.js');
  const { a, b, session } = duel({ status: 'pending', battleState: null });
  const target = db.select().from(mobs).where(eq(mobs.catalogKey, 'square_pigeon')).get();
  const pve = db.insert(combatSessions).values({ playerId: a.id, mobId: target.id, playerHealth: 100, mobHealth: 10,
    status: 'active', startedAt: nowGameTime(), lastActionAt: nowGameTime() }).returning().get();
  assert.equal(request('post', '/pvp/:id/accept', b.id, session.id).status, 409);
  assert.equal(getSession(session.id).status, 'pending');
  db.delete(combatSessions).where(eq(combatSessions.id, pve.id)).run();
});

test('PvP healing stays hidden until both choices, then heals before attack and consumes once', async () => {
  const { inventoryItems } = await import('../dist/database/schema.js');
  const { a, b, session } = duel();
  db.insert(inventoryItems).values({ playerId: a.id, itemType: 3, quantity: 2, acquiredAt: nowGameTime() }).run();
  const body = command(session, { action: 'use', itemType: 3 });
  const first = choose(a, session, body);
  assert.equal(first.status, 200);
  assert.equal(first.body.state.myHp, 80);
  assert.equal(db.select().from(inventoryItems).where(eq(inventoryItems.playerId, a.id)).get().quantity, 2);
  assert.ok(first.body.state.moves.every(m => m.itemType === undefined));
  const partner = request('get', '/pvp/:id', b.id, session.id).body;
  assert.equal(partner.events.length, 0);
  const random = mock.method(Math, 'random', () => 0);
  try { assert.equal(choose(b, getSession(session.id)).status, 200); } finally { random.mock.restore(); }
  const saved = getSession(session.id);
  assert.equal(saved.player1Health, 90);
  assert.equal(saved.battleState.events[0].type, 'heal');
  assert.equal(saved.battleState.events.filter(e => e.type === 'attack').length, 1);
  assert.equal(saved.player2Health, 35);
  assert.equal(db.select().from(inventoryItems).where(eq(inventoryItems.playerId, a.id)).get().quantity, 1);
  assert.equal(choose(a, session, body).status, 200);
  assert.deepEqual(getSession(session.id), saved);
  assert.equal(db.select().from(inventoryItems).where(eq(inventoryItems.playerId, a.id)).get().quantity, 1);
  assert.equal(request('get', '/pvp/:id', a.id, session.id).body.healingAvailable, false);
  const repeatedHeal = command(saved, { action: 'use', itemType: 3 });
  assert.equal(choose(a, saved, repeatedHeal).status, 400);
  assert.deepEqual(getSession(session.id), saved);
});

test('mutual exit does not consume a queued healing item', async () => {
  const { inventoryItems } = await import('../dist/database/schema.js');
  const { a, b, session } = duel();
  db.insert(inventoryItems).values({ playerId: a.id, itemType: 3, quantity: 1, acquiredAt: nowGameTime() }).run();
  choose(a, session, command(session, { action: 'use', itemType: 3 }));
  exit(a, getSession(session.id));
  exit(b, getSession(session.id));
  assert.equal(getSession(session.id).status, 'finished');
  assert.equal(getPlayer(a.id).health, 80);
  assert.equal(db.select().from(inventoryItems).where(eq(inventoryItems.playerId, a.id)).get().quantity, 1);
});

test('PvP reveals status effects only after both choices, with identical absolute sides for both clients and safe retry', () => {
  const { a, b, session } = duel();
  const state = session.battleState;
  state.fighters[0].passives = { weapon: { id: 'independent_life', params: { chancePercent: 100, durationRounds: 3, damageCoefficientPercent: 50 } } };
  db.update(pvpSessions).set({ battleState: state }).where(eq(pvpSessions.id, session.id)).run();
  const bodyA = command(session), bodyB = command(session);
  assert.equal(choose(a, session, bodyA).status, 200);
  assert.deepEqual(request('get', '/pvp/:id', b.id, session.id).body.statuses, [[], []]);
  const random = mock.method(Math, 'random', () => 0);
  try { assert.equal(choose(b, getSession(session.id), bodyB).status, 200); } finally { random.mock.restore(); }
  const outgoing = request('get', '/pvp/:id', a.id, session.id).body;
  const incoming = request('get', '/pvp/:id', b.id, session.id).body;
  assert.equal(outgoing.statuses[1][0].kind, 'poison');
  assert.deepEqual(incoming.statuses, outgoing.statuses);
  assert.ok(outgoing.events.some(event => event.statuses[1].some(status => status.kind === 'poison')));
  const persisted = getSession(session.id);
  choose(b, persisted, bodyB);
  assert.deepEqual(getSession(session.id), persisted);
});

test('simultaneous periodic knockout ends PvP as a draw with no rewards', () => {
  const { a, b, session } = duel({ player1Health: 1, player2Health: 1 });
  const state = session.battleState;
  for (const fighter of state.fighters) fighter.moves = [{ id: 'unarmed_strike', name: 'Ожидание', kind: 'defend', accuracy: 100, priority: 1, power: 0, cooldownRounds: 0 }];
  state.statuses = [0, 1].map(target => ({ kind: 'burn', target, source: 1 - target, value: 10, untilRound: 2 }));
  db.update(pvpSessions).set({ battleState: state }).where(eq(pvpSessions.id, session.id)).run();
  choose(a, session);
  const result = choose(b, getSession(session.id));
  assert.equal(result.body.state.finished, true);
  assert.equal(result.body.state.isWon, null);
  assert.deepEqual(result.body.state.statuses, [[], []]);
  for (const original of [a, b]) {
    const saved = getPlayer(original.id);
    assert.equal(saved.health, 0);
    assert.equal(saved.points, original.points);
    assert.equal(saved.xp, original.xp);
  }
});
