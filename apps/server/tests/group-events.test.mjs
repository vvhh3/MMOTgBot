import assert from 'node:assert/strict';
import { after, beforeEach, mock, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import express from 'express';
import { eq } from 'drizzle-orm';
import { DEFAULT_GROUP_EVENT_CONFIG } from '@mmobot/shared';

const directory = mkdtempSync(path.join(tmpdir(), 'mmobot-group-events-'));
process.env.DATABASE_PATH = path.join(directory, 'test.db');
process.env.BOT_TOKEN = '123456:test-token'; process.env.SESSION_SECRET = 'group-tests';
const emitted = mock.fn();
mock.module('../dist/infrastructure/telegram/notifications.js', { namedExports: { notify: mock.fn() } });
mock.module('../dist/infrastructure/realtime/socket-server.js', { namedExports: {
  isPlayerOnline: () => true, emitToPlayer: emitted, broadcastLocation: mock.fn(), moveSocketToLocation: mock.fn(),
} });
const { db, initializeDatabase } = await import('../dist/database/index.js');
const schema = await import('../dist/database/schema.js');
const { players, friendships, groupEventWindows: windows, eventParties: parties, eventPartyMembers: members, groupEventRuns: runs, groupEventRewards: rewards, pvpSessions, inventoryItems, items } = schema;
const { createGroupEventRoutes } = await import('../dist/modules/group-events/routes.js');
const { createGroupEventAdminRoutes } = await import('../dist/modules/admin/group-events.routes.js');
const { createPvpRoutes } = await import('../dist/modules/combat/pvp.js');
const { createLocationRoutes } = await import('../dist/modules/locations/routes.js');
const { createTradeRoutes } = await import('../dist/modules/trades/routes.js');
const { createPlayerRoutes } = await import('../dist/modules/players/routes.js');
const { createItemRoutes } = await import('../dist/modules/items/routes.js');
const { RegenHealth } = await import('../dist/modules/players/regen.js');
const { expireGroupEvents } = await import('../dist/modules/group-events/runs.js');
const { groupRunDto } = await import('../dist/modules/group-events/state.js');
const { nowGameTime, nowGameTimeMs } = await import('../dist/shared/time.js');
initializeDatabase();
const app = express();
createGroupEventRoutes(app); createPvpRoutes(app); createLocationRoutes(app); createTradeRoutes(app); createPlayerRoutes(app); createGroupEventAdminRoutes(app); createItemRoutes(app);
let playerId = 810000, requestId = 0;
const key = () => `command-${++requestId}`;
const getPlayer = id => db.select().from(players).where(eq(players.id, id)).get();
const getRun = id => db.select().from(runs).where(eq(runs.id, id)).get();
const getParty = id => db.select().from(parties).where(eq(parties.id, id)).get();
function call(method, routePath, player, id, body = {}) {
  const route = app._router.stack.find(layer => layer.route?.path === routePath && layer.route.methods[method])?.route;
  assert.ok(route, routePath);
  const result = { status: 200, body: undefined };
  const res = { headersSent: false, status(n) { result.status = n; return this; }, json(data) { this.headersSent = true; result.body = JSON.parse(JSON.stringify(data)); return this; } };
  route.stack.at(-1).handle({ player: getPlayer(player.id ?? player), params: { id: String(id) }, query: {}, body }, res);
  assert.notEqual(result.body, undefined, routePath);
  return result;
}
function player() {
  const id = playerId++;
  return db.insert(players).values({ id, friendId: id, name: `Друг ${id}`, isCreated: true, tutorialStep: 'done', currentLocationId: 'square',
    health: 500, maxHealth: 500, strength: 1000, defense: 100, createdAt: nowGameTime(), lastSeenAt: nowGameTime() }).returning().get();
}
function friend(a, b) { db.insert(friendships).values({ fromId: a.id, toId: b.id, status: 'accepted', createdAt: nowGameTime(), updatedAt: nowGameTime() }).run(); }
function window(config = DEFAULT_GROUP_EVENT_CONFIG) {
  return db.insert(windows).values({ locationId: 'square', enabled: true, startsAt: new Date(nowGameTimeMs() - 60000).toISOString(), endsAt: new Date(nowGameTimeMs() + 3600000).toISOString(), config: structuredClone(config), createdAt: nowGameTime(), updatedAt: nowGameTime() }).returning().get();
}
function command(action, p, partyId, body = {}) { return call('post', `/event-parties/:id/${action}`, p, partyId, { requestId: key(), ...body }); }
function group(w = window()) {
  const a = player(), b = player(), c = player(); friend(a,b); friend(a,c);
  const created = call('post', '/group-events/:id/parties', a, w.id, { requestId: key(), targetId: b.id });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.party.id;
  assert.equal(command('respond', b, id, { accept: true }).status, 200);
  assert.equal(command('invite', a, id, { targetId: c.id }).status, 200);
  assert.equal(command('respond', c, id, { accept: true }).status, 200);
  return { a,b,c,id,w };
}
function start(g) {
  for (const p of [g.a,g.b,g.c]) assert.equal(command('ready', p, g.id, { ready: true }).status, 200);
  const result = call('post', '/event-parties/:id/start', g.a, g.id);
  assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body.run;
}
function choose(p, run, extra = {}) {
  const dto = groupRunDto(getRun(run.id), p.id);
  return call('post', '/group-event-runs/:id/actions', p, run.id, { requestId: key(), round: run.round, wave: run.wave,
    expectedVersion: run.stateVersion, moveId: 'unarmed_strike', targetId: dto.fighters.find(f => f.team === 1 && f.hp > 0)?.id, ...extra });
}
beforeEach(t => {
  t.mock.method(Math, 'random', () => .5);
  db.delete(rewards).run(); db.delete(runs).run(); db.delete(members).run(); db.delete(parties).run(); db.delete(windows).run();
});
after(() => { db.$client.close(); rmSync(directory, { recursive: true, force: true }); });

test('fresh database includes the card but no enabled event; first invitation is atomic and repeat safe', () => {
  assert.equal(call('get', '/group-events/me', player()).body.event, null);
  const a = player(), b = player(), w = window();
  let result = call('post', '/group-events/:id/parties', a, w.id, { requestId: key(), targetId: b.id });
  assert.equal(result.body.code, 'FRIEND_REQUIRED'); assert.equal(db.select().from(parties).all().length, 0);
  friend(a,b); const requestId = key();
  const body = { requestId, targetId: b.id, slot: 2 };
  result = call('post', '/group-events/:id/parties', a, w.id, body);
  assert.equal(result.status, 201); assert.equal(result.body.party.members.find(m => m.playerId === b.id).slot, 2);
  assert.equal(call('post', '/group-events/:id/parties', a, w.id, body).body.party.id, result.body.party.id);
  assert.equal(db.select().from(parties).all().length, 1);
  assert.equal(call('post', '/group-events/:id/parties', a, w.id, { ...body, slot: 1 }).status, 409);
  assert.equal(getPlayer(a.id).idTheLastAction.type, 'GroupEventLobby'); assert.equal(getPlayer(b.id).idTheLastAction, null);
});

test('party capacity, invitation cancellation, membership uniqueness and leader exit are authoritative', () => {
  const g = group(), extra = player(); friend(g.a, extra);
  assert.equal(command('invite', g.a, g.id, { targetId: extra.id }).body.code, 'PARTY_FULL');
  assert.equal(command('remove', g.b, g.id, { memberId: call('get','/group-events/me', g.a).body.party.members.find(m => m.playerId === g.c.id).id }).status, 403);
  const a2 = player(); friend(a2,g.b);
  assert.equal(call('post','/group-events/:id/parties', a2, g.w.id, { requestId: key(), targetId: g.b.id }).status, 409);
  assert.equal(command('leave', g.a, g.id).status, 200);
  assert.equal(getParty(g.id).status, 'disbanded');
  for (const p of [g.a,g.b,g.c]) assert.equal(getPlayer(p.id).idTheLastAction, null);
});

test('solo walks, outgoing/incoming PvP and old trades cannot bypass group membership', () => {
  const g = group(), outsider = player();
  assert.equal(call('post','/locations/:id/action',g.a,'square',{ actionId: 'walk' }).body.code,'PARTY_EXIT_REQUIRED');
  assert.equal(call('post','/pvp',g.a,null,{ toPlayerId: outsider.id }).body.code,'PARTY_EXIT_REQUIRED');
  assert.equal(call('post','/pvp',outsider,null,{ toPlayerId: g.a.id }).body.code,'PLAYER_BUSY');
  const duel = db.insert(pvpSessions).values({ player1Id: outsider.id, player2Id: g.b.id, player1Health: 500, player2Health: 500, status: 'pending', turn: 'player1', creadetAt: nowGameTime() }).returning().get();
  assert.equal(call('post','/pvp/:id/accept',g.b,duel.id).body.code,'PARTY_EXIT_REQUIRED');
  const trade = db.insert(schema.trades).values({ fromPlayerId: outsider.id, toPlayerId: g.b.id, createdAt: nowGameTime() }).returning().get();
  assert.equal(call('post','/trades/:id/accept',g.b,trade.id).status,409);
  assert.deepEqual(getPlayer(g.b.id).idTheLastAction,{ type: 'GroupEventLobby', id: g.id });
  command('leave',g.b,g.id);
  assert.equal(call('post','/locations/:id/action',g.b,'square',{ actionId: 'walk' }).status,200);
});

test('three ready participants start one frozen run; stats changes invalidate lobby readiness', () => {
  const g = group();
  assert.equal(call('post','/event-parties/:id/start',g.a,g.id).status,409);
  command('ready',g.a,g.id,{ ready: true });
  db.update(players).set({ statPoints: 1 }).where(eq(players.id,g.a.id)).run();
  assert.equal(call('post','/me/stats',g.a,null,{ strength: 1 }).status,200);
  assert.equal(call('get','/group-events/me',g.a).body.party.members.find(m => m.playerId === g.a.id).ready,false);
  const run = start(g);
  assert.equal(run.fighters.length,6);
  assert.equal(call('post','/event-parties/:id/start',g.a,g.id).body.run.id,run.id);
  assert.equal(db.select().from(runs).all().length,1);
  const before = getPlayer(g.a.id).health;
  db.update(players).set({ lastRegenTime: new Date(nowGameTimeMs()-3600000).toISOString() }).where(eq(players.id,g.a.id)).run();
  assert.equal(RegenHealth(g.a.id),before);
  assert.equal(call('post','/me/stats',g.a,null,{ strength: 0 }).status,409);
});

test('choices from one snapshot commute, stay hidden and resolve the round once; retries include targets', () => {
  const g = group(), run = start(g), id = key();
  const target = run.fighters.find(f => f.team === 1).id;
  const first = choose(g.a,run,{ requestId:id, targetId:target });
  assert.equal(first.status,200); assert.equal(first.body.run.round,1);
  const other = call('get','/group-event-runs/:id',g.b,run.id).body;
  assert.equal(other.events.length,run.events.length);
  assert.equal(JSON.stringify(other).includes('choices'),false); assert.equal(JSON.stringify(other).includes('processedRequests'),false);
  choose(g.b,run,{ targetId:run.fighters.filter(f => f.team === 1)[1].id });
  const final = choose(g.c,run,{ targetId:run.fighters.filter(f => f.team === 1)[2].id });
  assert.equal(final.status,200); assert.equal(final.body.run.round,2); assert.equal(final.body.run.wave,2);
  const saved = JSON.stringify(getRun(run.id));
  assert.equal(choose(g.a,run,{ requestId:id, targetId:target }).status,200);
  assert.equal(JSON.stringify(getRun(run.id)),saved);
  assert.equal(choose(g.a,run,{ requestId:id, targetId:run.fighters.filter(f => f.team === 1)[1].id }).status,409);
});

test('independent groups cannot target each other or allies and successful runs award exactly once', () => {
  const config = structuredClone(DEFAULT_GROUP_EVENT_CONFIG); config.waves = [config.waves[0],config.waves.at(-1)];
  const lootItem = db.select().from(items).where(eq(items.type,'potion')).get(); config.reward.loot = [{ itemType: lootItem.id, chancePercent: 100 }];
  const w = window(config), g = group(w), h = group(w), initial = start(g), second = start(h);
  assert.equal(choose(g.a,initial,{ targetId:second.fighters.find(f => f.team === 1).id }).body.code,'INVALID_TARGET');
  assert.equal(choose(g.a,initial,{ targetId:initial.myFighterId }).body.code,'INVALID_TARGET');
  const before = getPlayer(g.a.id), secondSaved = JSON.stringify(getRun(second.id));
  let lastBody;
  for (let round = 0; round < 20 && getRun(initial.id).status === 'active'; round++) {
    const snapshot = groupRunDto(getRun(initial.id),g.a.id), enemies = snapshot.fighters.filter(f => f.team === 1 && f.hp > 0);
    for (const [i,p] of [g.a,g.b,g.c].entries()) {
      lastBody = { requestId: key(), round: snapshot.round, wave: snapshot.wave, expectedVersion: snapshot.stateVersion, moveId: 'unarmed_strike', targetId: enemies[i % enemies.length].id };
      assert.equal(call('post','/group-event-runs/:id/actions',p,initial.id,lastBody).status,200);
    }
  }
  assert.equal(getRun(initial.id).status,'victory'); assert.equal(getPlayer(g.a.id).money,before.money+config.reward.coins);
  assert.equal(db.select().from(rewards).all().length,3);
  assert.equal(JSON.stringify(getRun(second.id)),secondSaved);
  const awarded = getPlayer(g.c.id).money;
  assert.equal(call('post','/group-event-runs/:id/actions',g.c,initial.id,lastBody).status,200);
  assert.equal(getPlayer(g.c.id).money,awarded); assert.equal(db.select().from(rewards).all().length,3);
  for (const p of [g.a,g.b,g.c]) assert.equal(getPlayer(p.id).idTheLastAction,null);
});

test('closing a window expires lobbies and invites but preserves already started runs', () => {
  const w = window(), g = group(w), run = start(g), h = group(w);
  db.update(windows).set({ enabled:false }).where(eq(windows.id,w.id)).run();
  expireGroupEvents();
  assert.equal(getParty(h.id).status,'expired'); assert.equal(getRun(run.id).status,'active');
  assert.equal(getPlayer(h.b.id).idTheLastAction,null);
  assert.equal(call('get','/group-events/me',g.a).body.event.available,false);
});

test('deadlines progress once, two idle rounds abort, and a disconnected member can restore committed choices', () => {
  const g = group(), run = start(g); choose(g.a,run);
  db.update(players).set({ currentLocationId: null }).where(eq(players.id,g.a.id)).run();
  assert.equal(call('get','/group-event-runs/:id',g.a,run.id).body.actionSubmitted,true);
  const child = spawnSync(process.execPath,['--input-type=module','-e', `const {db}=await import('./apps/server/dist/database/connection.js'); const {groupEventRuns}=await import('./apps/server/dist/database/schema.js'); console.log(JSON.stringify(db.select().from(groupEventRuns).all().find(r=>r.id===${run.id}).battleState.choices)); db.$client.close();`],{cwd:path.resolve(import.meta.dirname,'../../..'),env:process.env,encoding:'utf8'});
  assert.equal(child.status,0,child.stderr); assert.equal(JSON.parse(child.stdout)[0],'unarmed_strike');
  const expire = () => { db.update(runs).set({ roundDeadlineAt: new Date(nowGameTimeMs()-1000).toISOString() }).where(eq(runs.id,run.id)).run(); expireGroupEvents(); };
  expire(); const round = getRun(run.id).roundNumber; expireGroupEvents(); assert.equal(getRun(run.id).roundNumber,round);
  expire(); expire(); assert.equal(getRun(run.id).status,'aborted'); assert.equal(db.select().from(rewards).all().length,0);
});

test('leaving a running event releases only that member and never grants their victory reward', () => {
  const g = group(), run = start(g);
  const result = call('post','/group-event-runs/:id/leave',g.b,run.id);
  assert.equal(result.status,200); assert.equal(result.body.party,null); assert.equal(getPlayer(g.b.id).idTheLastAction,null);
  assert.equal(getRun(run.id).battleState.fighters.find(f => f.playerId === g.b.id).left,true);
  assert.equal(choose(g.b,run).status,409);
  call('post','/group-event-runs/:id/leave',g.a,run.id); call('post','/group-event-runs/:id/leave',g.c,run.id);
  assert.equal(getRun(run.id).status,'defeat'); assert.equal(db.select().from(rewards).all().length,0);
});

test('failed reward transaction preserves the final round for a safe retry', () => {
  const config = structuredClone(DEFAULT_GROUP_EVENT_CONFIG); config.waves = [config.waves[0],config.waves.at(-1)];
  const g = group(window(config)); let run = start(g);
  for (const [i,p] of [g.a,g.b,g.c].entries()) choose(p,run,{ targetId:run.fighters.filter(f=>f.team===1)[i].id });
  run = groupRunDto(getRun(run.id),g.a.id); assert.equal(run.wave,2);
  choose(g.a,run); choose(g.b,run);
  const before = JSON.stringify(getRun(run.id)), money = getPlayer(g.a.id).money;
  const body = {requestId:key(),round:run.round,wave:run.wave,expectedVersion:run.stateVersion,moveId:'unarmed_strike',targetId:run.fighters.find(f=>f.team===1).id};
  db.$client.exec("CREATE TEMP TRIGGER group_reward_failure BEFORE INSERT ON group_event_rewards BEGIN SELECT RAISE(ABORT,'test reward failure'); END");
  try {
    assert.throws(()=>call('post','/group-event-runs/:id/actions',g.c,run.id,body),/test reward failure/);
    assert.equal(JSON.stringify(getRun(run.id)),before); assert.equal(getPlayer(g.a.id).money,money);
    assert.equal(db.select().from(rewards).all().length,0);
  } finally { db.$client.exec('DROP TRIGGER group_reward_failure'); }
  assert.equal(call('post','/group-event-runs/:id/actions',g.c,run.id,body).body.run.status,'victory');
  assert.equal(getPlayer(g.a.id).money,money+config.reward.coins);
});

test('event configuration and active reward snapshots protect custom item references', () => {
  const p = player(), item = db.insert(items).values({name:'Награда события',description:'Тест',type:'other'}).returning().get();
  const config = structuredClone(DEFAULT_GROUP_EVENT_CONFIG); config.reward.loot = [{itemType:item.id,chancePercent:100}];
  const w = window(config);
  assert.equal(call('delete','/items/:id',p,item.id).status,409);
  const g = group(w); start(g);
  config.reward.loot = [];
  db.update(windows).set({config}).where(eq(windows.id,w.id)).run();
  assert.equal(call('delete','/items/:id',p,item.id).status,409);
});
