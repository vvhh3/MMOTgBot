import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveGroupRound } from '../dist/modules/combat/battle/group-round.js';
const attack = { id: 'attack', name: 'Удар', kind: 'attack', priority: 0, accuracy: 100, power: 1, cooldownRounds: 0 };
const fighter = (i, moves = [attack]) => ({ id: `f-${i}`, name: `Боец ${i}`, team: i < 3 ? 0 : 1, wave: 1, maxHp: 100, strength: 20, defense: 0, moves });
function state() {
  return { fighters: Array.from({length:6},(_,i) => fighter(i)), hp: [100,100,100,100,100,100],
    choices: Array(6).fill('attack'), targets: [3,4,5,0,1,2], cooldowns: Array.from({length:6},()=>({})),
    effects: [], statuses: [], events: [], exitRequested: Array(6).fill(false), processedRequests: [],
    passiveProgress: Array.from({length:6},()=>({})), healingUsed: Array(6).fill(0), idleRounds: 0, waves: [] };
}

test('six fighters execute one shared round; one defeated fighter does not stop the others', () => {
  const s = state(); s.hp[0] = 0;
  const copy = structuredClone(s), r = resolveGroupRound(s,1,'now',()=>.5);
  assert.deepEqual(s,copy);
  assert.equal(r.state.events.filter(e => e.type === 'attack').length,5);
  assert.ok(r.state.events.every(e => e.side !== 0));
  assert.ok(r.state.events.every(e => e.hp.length === 6));
  assert.ok(r.state.hp[1] < 100); assert.ok(r.state.hp[2] < 100);
});
test('focused attacks retarget a defeated enemy while still allowing all teammates to act', () => {
  const s = state(); s.choices = ['attack','attack','attack',null,null,null]; s.targets = [3,3,3,null,null,null]; s.hp[3] = 1;
  const r = resolveGroupRound(s,1,'now',()=>.5).state;
  assert.equal(r.hp[3],0); assert.ok(r.hp[4] < 100); assert.equal(r.events.filter(e => e.type === 'attack').length,3);
});
test('guard and reflection apply independently to multiple incoming hits', () => {
  const s = state(); const guard = { ...attack, id: 'guard', kind: 'defend', defense: { fullBlockChance: 100, partialBlockChance: 0, partialMultiplier: .5, reflectChance: 100 } };
  s.fighters[0].moves = [guard]; s.choices = ['guard',null,null,'attack','attack',null]; s.targets = [3,null,null,0,0,null];
  const r = resolveGroupRound(s,1,'now',()=>.5).state;
  assert.equal(r.hp[0],100); assert.equal(r.hp[3],85); assert.equal(r.hp[4],85);
  assert.equal(r.events.filter(e => e.type === 'reflect').length,2);
});
test('poison ticks once on a living participant even when another participant is dead', () => {
  const s = state(); s.hp[0] = 0; s.choices.fill(null);
  s.statuses = [{ kind: 'poison', source: 3, target: 1, value: 8, untilRound: 2 }];
  const first = resolveGroupRound(s,1,'now',()=>.5).state;
  assert.equal(first.hp[1],92); assert.equal(first.statuses.length,1);
  const second = resolveGroupRound(first,2,'later',()=>.5).state;
  assert.equal(second.hp[1],84); assert.equal(second.statuses.length,0);
});
test('a wave ending does not erase the surviving players periodic effects', () => {
  const s = state(); s.hp[4] = 0; s.hp[5] = 0; s.hp[3] = 1;
  s.choices = ['attack',null,null,null,null,null]; s.targets[0] = 3;
  s.statuses = [{ kind:'poison',source:3,target:1,value:8,untilRound:2 }];
  const r = resolveGroupRound(s,1,'now',()=>.5).state;
  assert.equal(r.hp[3],0); assert.equal(r.hp[1],92);
});
test('skipped turns do not become attacks or guards and dead actors do not consume queued potions', () => {
  const s = state(); s.choices.fill(null);
  assert.equal(resolveGroupRound(s,1,'now').state.events.length,0);
  const potion = { ...attack, id: 'potion', kind: 'heal', priority: 1, itemType: 1, healAmount: 50 };
  const lethal = { ...attack, id: 'lethal', priority: 2, power: 100 };
  s.fighters[0].moves = [potion]; s.fighters[3].moves = [lethal]; s.hp[0] = 10;
  s.choices[0] = 'potion'; s.choices[3] = 'lethal'; s.targets[3] = 0;
  const r = resolveGroupRound(s,1,'now',()=>.5);
  assert.equal(r.state.hp[0],0); assert.equal(r.consumedItems.length,0); assert.equal(r.state.healingUsed[0],0);
});
test('debt reactions from two attackers retain separate owners', () => {
  const s = state(); const guard = { ...attack, id:'guard',kind:'defend',defense:{fullBlockChance:100,partialBlockChance:0,partialMultiplier:.5,reflectChance:0} };
  s.fighters[0].moves = [guard]; s.choices = ['guard',null,null,'attack','attack',null]; s.targets = [3,null,null,0,0,null];
  for (const i of [3,4]) s.fighters[i].passives = { weapon: { id:'fine_print',params:{damageBonusPerMarkPercent:15} } };
  const r = resolveGroupRound(s,1,'now',()=>.5).state;
  assert.deepEqual(r.statuses.filter(e => e.kind === 'debt').map(e => e.source).sort(),[3,4]);
});
