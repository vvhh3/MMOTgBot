import assert from 'node:assert/strict';
import { after, beforeEach, mock, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import { eq } from 'drizzle-orm';

const directory = mkdtempSync(path.join(tmpdir(), 'mmobot-maintenance-'));
process.env.DATABASE_PATH = path.join(directory, 'test.db');
process.env.BOT_TOKEN = '123456:test-token';
process.env.SESSION_SECRET = 'maintenance-tests';
mock.module('../dist/infrastructure/telegram/notifications.js', { namedExports: { notify: mock.fn() } });
mock.module('../dist/infrastructure/realtime/socket-server.js', { namedExports: {
  isPlayerOnline: () => false, emitToPlayer: mock.fn(), broadcastLocation: mock.fn(), moveSocketToLocation: mock.fn(),
} });

const { db, initializeDatabase } = await import('../dist/database/index.js');
const { combatSessions, events, inventoryItems, mobs, playerQuests, players, pvpSessions, quests } = await import('../dist/database/schema.js');
const { cleanupFinishedBattleSessions, cleanupOldEvents, startMaintenance, CLEANUP_BATCH_SIZE,
  CLEANUP_INTERVAL_MS, EVENTS_RETENTION_DAYS, FINISHED_BATTLE_RETENTION_MS, PVP_MAINTENANCE_INTERVAL_MS } = await import('../dist/jobs/maintenance.js');
const { startCombat, moveCombatAction } = await import('../dist/modules/combat/pve.js');
const { createPvpRoutes, getPvpStateForPlayer } = await import('../dist/modules/combat/pvp.js');
const { createBattle, basicAttack } = await import('../dist/modules/combat/battle/engine.js');
const { nowGameTime, nowGameTimeMs, todayGameDate } = await import('../dist/shared/time.js');
initializeDatabase();
const target = db.insert(mobs).values({ name: 'Тестовый', description: 'Очистка', level: 1,
  maxHealth: 1, strength: 0, defense: 0, loot: [{ itemType: 3, chancePercent: 100 }],
  pointsReward: 10, coinReward: 3, locationId: 'square', respawnSeconds: 60 }).returning().get();
const app = express();
createPvpRoutes(app);

after(() => { db.$client.close(); rmSync(directory, { recursive: true, force: true }); });
let clockMs;
let nextPlayerId = 900000;
beforeEach((t) => {
  clockMs = Date.parse('2026-10-26T12:00:00Z');
  t.mock.method(Date, 'now', () => clockMs);
  t.mock.method(Math, 'random', () => 0);
  db.delete(players).run();
});

const ago = (ms) => new Date(nowGameTimeMs() - ms).toISOString();
const old = () => ago(FINISHED_BATTLE_RETENTION_MS + 1);
const getPlayer = (id) => db.select().from(players).where(eq(players.id, id)).get();
const getCombat = (id) => db.select().from(combatSessions).where(eq(combatSessions.id, id)).get();
const getPvp = (id) => db.select().from(pvpSessions).where(eq(pvpSessions.id, id)).get();
function player() {
  const id = nextPlayerId++;
  return db.insert(players).values({ id, friendId: id, name: `Игрок ${id}`, strength: 1000,
    currentLocationId: 'square', createdAt: nowGameTime(), lastSeenAt: nowGameTime() }).returning().get();
}
function combat(p, overrides = {}) {
  return db.insert(combatSessions).values({ playerId: p.id, mobId: target.id, playerHealth: 70, mobHealth: 0,
    status: 'victory', startedAt: old(), lastActionAt: old(), ...overrides }).returning().get();
}
function duel(a, b, overrides = {}) {
  return db.insert(pvpSessions).values({ player1Id: a.id, player2Id: b.id, player1Health: 80, player2Health: 35,
    status: 'finished', creadetAt: old(), lastActionAt: old(), ...overrides }).returning().get();
}
function action(p, type, id) {
  db.update(players).set({ idTheLastAction: { type, id } }).where(eq(players.id, p.id)).run();
}
function pvpRequest(p, session, body) {
  const route = app._router.stack.find(layer => layer.route?.path === '/pvp/:id/action').route;
  const result = { status: 200 };
  const res = { status(code) { result.status = code; return this; }, json(value) { result.body = value; return this; } };
  route.stack[0].handle({ player: getPlayer(p.id), params: { id: String(session.id) }, body }, res);
  return result;
}

test('only terminal battles past retention are deleted, including legacy invitations without lastActionAt', () => {
  const a = player(), b = player();
  const terminal = ['victory', 'defeat', 'fled', 'aborted'].map(status => combat(a, { status }));
  const boundary = combat(a, { lastActionAt: ago(FINISHED_BATTLE_RETENTION_MS) });
  const recent = combat(a, { lastActionAt: ago(FINISHED_BATTLE_RETENTION_MS - 1) });
  const active = combat(a, { status: 'active' });
  const finished = duel(a, b), legacy = duel(a, b, { lastActionAt: null });
  const recentLegacy = duel(a, b, { lastActionAt: null, creadetAt: nowGameTime() });
  const recentPvp = duel(a, b, { lastActionAt: nowGameTime() });
  const activePvp = duel(a, b, { status: 'active' }), pending = duel(a, b, { status: 'pending', lastActionAt: null });
  const snapshot = db.select().from(players).all();

  cleanupFinishedBattleSessions();
  for (const row of [...terminal, boundary]) assert.equal(getCombat(row.id), undefined);
  for (const row of [recent, active]) assert.deepEqual(getCombat(row.id), row);
  for (const row of [finished, legacy]) assert.equal(getPvp(row.id), undefined);
  for (const row of [recentLegacy, recentPvp, activePvp, pending]) assert.deepEqual(getPvp(row.id), row);
  assert.deepEqual(db.select().from(players).all(), snapshot);
  cleanupFinishedBattleSessions();
  assert.deepEqual(db.select().from(players).all(), snapshot);
  assert.deepEqual(db.$client.pragma('foreign_key_check'), []);
});

test('clears only matching battle references for the participants and preserves other current actions', () => {
  const a = player(), b = player(), c = player(), d = player(), e = player(), f = player();
  const pve = combat(a), pvp = duel(b, c), changed = combat(d), sameId = combat(e);
  const active = combat(d, { status: 'active', lastActionAt: nowGameTime() });
  action(a, 'TakeAWalk', pve.id);
  action(b, 'Fight', pvp.id);
  action(c, 'Fight', pvp.id);
  action(d, 'TakeAWalk', active.id);
  action(e, 'Trade', sameId.id);
  action(f, 'Fight', pvp.id);
  cleanupFinishedBattleSessions();
  for (const p of [a, b, c]) assert.equal(getPlayer(p.id).idTheLastAction, null);
  assert.deepEqual(getPlayer(d.id).idTheLastAction, { type: 'TakeAWalk', id: active.id });
  assert.deepEqual(getPlayer(e.id).idTheLastAction, { type: 'Trade', id: sameId.id });
  assert.deepEqual(getPlayer(f.id).idTheLastAction, { type: 'Fight', id: pvp.id });
  assert.equal(getCombat(changed.id), undefined);
});

test('a failed reference update rolls back deletion in both battle tables', () => {
  const a = player(), b = player();
  const pve = combat(a), pvp = duel(a, b);
  action(a, 'TakeAWalk', pve.id);
  db.$client.exec(`CREATE TRIGGER reject_cleanup BEFORE UPDATE OF id_the_last_action ON players
    WHEN OLD.id = ${a.id} BEGIN SELECT RAISE(ABORT, 'cleanup failure'); END;`);
  try {
    assert.throws(() => cleanupFinishedBattleSessions(), /cleanup failure/);
    assert.deepEqual(getCombat(pve.id), pve);
    assert.deepEqual(getPvp(pvp.id), pvp);
    assert.deepEqual(getPlayer(a.id).idTheLastAction, { type: 'TakeAWalk', id: pve.id });
  } finally { db.$client.exec('DROP TRIGGER reject_cleanup'); }
});

test('event cleanup preserves the seven-day boundary and the recent walk used for cooldowns', () => {
  const a = player();
  const cutoff = ago(EVENTS_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const add = (createdAt, type) => db.insert(events).values({ playerId: a.id, locationId: 'square', type, createdAt }).returning().get();
  const expired = add(new Date(Date.parse(cutoff) - 1).toISOString(), 'kill');
  const boundary = add(cutoff, 'death'), walk = add(nowGameTime(), 'walk');
  cleanupOldEvents();
  assert.equal(db.select().from(events).where(eq(events.id, expired.id)).get(), undefined);
  assert.deepEqual(db.select().from(events).all(), [boundary, walk]);
});

test('cleanup processes a bounded batch from each table and drains the remainder on the next pass', () => {
  const a = player(), b = player();
  db.transaction(() => {
    for (let i = 0; i < CLEANUP_BATCH_SIZE + 1; i++) {
      combat(a); duel(a, b);
      db.insert(events).values({ playerId: a.id, locationId: 'square', type: 'kill', createdAt: ago(8 * 24 * 60 * 60 * 1000) }).run();
    }
  });
  cleanupFinishedBattleSessions(); cleanupOldEvents();
  for (const table of [combatSessions, pvpSessions, events]) assert.equal(db.select().from(table).all().length, 1);
  cleanupFinishedBattleSessions(); cleanupOldEvents();
  for (const table of [combatSessions, pvpSessions, events]) assert.equal(db.select().from(table).all().length, 0);
});

test('PvE result and final request survive cleanup; rewards, loot and quests survive eventual deletion', () => {
  const a = player();
  const q = db.insert(quests).values({ title: 'Очистка', description: 'Тест', difficulty: 'easy', objectiveType: 'kill', targetCount: 5 }).returning().get();
  db.insert(playerQuests).values({ playerId: a.id, questId: q.id, assignedDay: todayGameDate() }).run();
  const started = startCombat(a, target), row = getCombat(started.id);
  const request = { sessionId: row.id, round: row.roundNumber, expectedVersion: row.stateVersion, requestId: 'finish-pve' };
  const result = moveCombatAction(a, target, row, 'attack', request);
  assert.equal(result.status, 'victory');
  const snapshot = {
    player: getPlayer(a.id), inventory: db.select().from(inventoryItems).all(), quests: db.select().from(playerQuests).all(),
  };
  assert.equal(snapshot.player.money, 3);
  assert.equal(snapshot.inventory[0].quantity, 1);
  assert.equal(snapshot.quests[0].progress, 1);
  cleanupFinishedBattleSessions();
  assert.deepEqual(moveCombatAction(a, target, row, 'attack', request), result);
  clockMs += FINISHED_BATTLE_RETENTION_MS;
  cleanupFinishedBattleSessions();
  assert.equal(getCombat(row.id), undefined);
  assert.throws(() => moveCombatAction(a, target, row, 'attack', request), /Бой не найден/);
  assert.deepEqual(getPlayer(a.id), snapshot.player);
  assert.deepEqual(db.select().from(inventoryItems).all(), snapshot.inventory);
  assert.deepEqual(db.select().from(playerQuests).all(), snapshot.quests);
});

test('both PvP participants can read the result and retry the final command until deletion without duplicate rewards', () => {
  const a = player(), b = player();
  const state = createBattle([a, b].map(p => ({ name: p.name, strength: 100, defense: 0, maxHp: 100, moves: [basicAttack(false)] })));
  const row = duel(a, b, { status: 'active', player2Health: 1, creadetAt: nowGameTime(), lastActionAt: nowGameTime(),
    roundStartedAt: nowGameTime(), battleState: state });
  const command = (id) => ({ action: 'attack', sessionId: row.id, round: row.roundNumber,
    expectedVersion: row.stateVersion, requestId: id, moveId: 'unarmed_strike' });
  assert.equal(pvpRequest(a, row, command('first')).status, 200);
  const final = command('final'), result = pvpRequest(b, row, final);
  assert.equal(result.body.state.finished, true);
  assert.equal(getPlayer(a.id).points, 10);
  cleanupFinishedBattleSessions();
  for (const p of [a, b]) assert.equal(getPvpStateForPlayer(row.id, p.id).finished, true);
  assert.deepEqual(pvpRequest(b, row, final), result);
  const snapshot = db.select().from(players).all();
  clockMs += FINISHED_BATTLE_RETENTION_MS;
  cleanupFinishedBattleSessions();
  assert.equal(getPvpStateForPlayer(row.id, b.id), null);
  assert.equal(pvpRequest(b, row, final).status, 404);
  assert.deepEqual(db.select().from(players).all(), snapshot);
});

test('startup and scheduled maintenance expire abandoned battles before retention and keep fresh results', () => {
  const a = player(), b = player();
  const pve = combat(a, { status: 'active' });
  const pvp = duel(a, b, { status: 'active' });
  const expiredPve = combat(a), expiredPvp = duel(a, b);
  const intervals = [];
  const timer = mock.method(global, 'setInterval', (fn, ms) => { intervals.push({ fn, ms }); return { unref() {} }; });
  try { startMaintenance(); } finally { timer.mock.restore(); }
  assert.equal(getCombat(pve.id).status, 'aborted');
  assert.equal(getPvp(pvp.id).status, 'finished');
  assert.equal(getCombat(pve.id).lastActionAt, nowGameTime());
  assert.equal(getPvp(pvp.id).lastActionAt, nowGameTime());
  assert.equal(getCombat(expiredPve.id), undefined);
  assert.equal(getPvp(expiredPvp.id), undefined);
  const expiry = intervals.find(i => i.ms === PVP_MAINTENANCE_INTERVAL_MS);
  const cleanup = intervals.find(i => i.ms === CLEANUP_INTERVAL_MS);
  assert.ok(expiry); assert.ok(cleanup);
  const pending = duel(a, b, { status: 'pending', creadetAt: nowGameTime(), lastActionAt: null });
  const active = combat(a, { status: 'active', lastActionAt: nowGameTime() });
  clockMs += 6 * 60 * 1000;
  expiry.fn();
  assert.equal(getCombat(active.id).status, 'aborted');
  assert.equal(getPvp(pending.id).status, 'finished');
  clockMs += FINISHED_BATTLE_RETENTION_MS;
  cleanup.fn();
  assert.equal(db.select().from(combatSessions).all().length, 0);
  assert.equal(db.select().from(pvpSessions).all().length, 0);
});
