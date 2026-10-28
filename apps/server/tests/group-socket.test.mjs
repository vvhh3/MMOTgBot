import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { eq } from 'drizzle-orm';
import { DEFAULT_GROUP_EVENT_CONFIG } from '@mmobot/shared';

test('real socket lifecycle restores party location and preserves membership across reconnects and tabs', async () => {
  const directory = mkdtempSync(path.join(tmpdir(),'mmobot-group-socket-'));
  process.env.DATABASE_PATH = path.join(directory,'test.db');
  process.env.BOT_TOKEN = '123456:socket-test'; process.env.SESSION_SECRET = 'socket-test';
  const { db, initializeDatabase } = await import('../dist/database/index.js');
  const { players, groupEventWindows, eventParties, eventPartyMembers } = await import('../dist/database/schema.js');
  const { nowGameTime, nowGameTimeMs } = await import('../dist/shared/time.js');
  const { initRealTime, isPlayerOnline } = await import('../dist/infrastructure/realtime/socket-server.js');
  const { getPlayersInLocation } = await import('../dist/modules/locations/presence.js');
  initializeDatabase();
  const server = http.createServer(), io = initRealTime(server);
  try {
    const p = db.insert(players).values({id:920001,friendId:920001,name:'Друг',health:75,isCreated:true,tutorialStep:'done',currentLocationId:null,createdAt:nowGameTime(),lastSeenAt:nowGameTime()}).returning().get();
    const window = db.insert(groupEventWindows).values({locationId:'square',enabled:true,startsAt:new Date(nowGameTimeMs()-10000).toISOString(),endsAt:new Date(nowGameTimeMs()+60000).toISOString(),config:DEFAULT_GROUP_EVENT_CONFIG,createdAt:nowGameTime(),updatedAt:nowGameTime()}).returning().get();
    const party = db.insert(eventParties).values({eventWindowId:window.id,leaderPlayerId:p.id,creationRequestId:'create',creationFingerprint:'create',createdAt:nowGameTime(),updatedAt:nowGameTime(),expiresAt:new Date(nowGameTimeMs()+60000).toISOString()}).returning().get();
    db.insert(eventPartyMembers).values({partyId:party.id,playerId:p.id,slot:0,status:'joined',createdAt:nowGameTime()}).run();
    db.update(players).set({idTheLastAction:{type:'GroupEventLobby',id:party.id}}).where(eq(players.id,p.id)).run();
    const connect = io.sockets.listeners('connection').at(-1);
    assert.equal(typeof connect,'function');
    const socket = id => {
      const rooms = new Set(), handlers = {}, received = [];
      return {id,data:{playerId:p.id},rooms,handlers,received,join(room){rooms.add(room);},leave(room){rooms.delete(room);},emit(...args){received.push(args);},on(name,fn){handlers[name]=fn;}};
    };
    const first = socket('first'); connect(first);
    assert.equal(isPlayerOnline(p.id),true);
    assert.equal(db.select().from(players).where(eq(players.id,p.id)).get().currentLocationId,'square');
    assert.ok(first.rooms.has('location:square'));
    assert.ok(getPlayersInLocation('square').some(row=>row.id===p.id));
    const second = socket('second'); connect(second);
    first.handlers.disconnect('test');
    assert.equal(isPlayerOnline(p.id),true);
    assert.equal(db.select().from(players).where(eq(players.id,p.id)).get().currentLocationId,'square');
    second.handlers.disconnect('test');
    assert.equal(isPlayerOnline(p.id),false);
    assert.equal(db.select().from(players).where(eq(players.id,p.id)).get().currentLocationId,null);
    assert.equal(db.select().from(eventPartyMembers).get().status,'joined');
    const restored = socket('restored'); connect(restored);
    const current = db.select().from(players).where(eq(players.id,p.id)).get();
    assert.equal(current.currentLocationId,'square'); assert.deepEqual(current.idTheLastAction,{type:'GroupEventLobby',id:party.id});
    assert.ok(restored.received.some(([name])=>name==='locationState'));
    restored.handlers.disconnect('test');
  } finally {
    await new Promise(resolve=>io.close(()=>resolve()));
    await new Promise(resolve=>setTimeout(resolve,350)); // Drain the location broadcast debounce before closing its DB.
    db.$client.close(); rmSync(directory,{recursive:true,force:true});
  }
});
