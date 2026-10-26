import assert from 'node:assert/strict';
import { test } from 'node:test';
import { basicAttack, createBattle, resolveRound, availableMove } from '../dist/modules/combat/battle/engine.js';
const attack = basicAttack(false);
const fighter = (name, moves = [attack]) => ({ name, maxHp: 100, strength: 40, defense: 0, moves });
const battle = (left = [attack], right = [attack]) => {
  const state = createBattle([fighter('A', left), fighter('B', right)]);
  state.choices = [left[0].id, right[0].id]; return state;
};
test('ordinary attacks miss at the 95 percent boundary', () => {
  const guard = { ...attack, id: 'guard', kind: 'defend', defense: { fullBlockChance: 100, partialBlockChance: 0, partialMultiplier: .5, reflectChance: 0 } };
  for (const [roll, missed] of [[.9499, false], [.95, true]]) {
    const result = resolveRound(battle([attack], [guard]), [100, 100], 1, 'now', () => roll);
    assert.equal(result.state.events.some(e => e.type === 'miss'), missed);
  }
});
test('equal priority is randomized; a knocked out fighter cannot act', () => {
  for (const [roll, first] of [[0, 0], [.9, 1]]) {
    const result = resolveRound(battle(), [1, 1], 1, 'now', () => roll);
    assert.equal(result.winner, first);
    assert.equal(result.state.events.filter(e => e.type === 'attack').length, 1);
  }
});
test('protection resolves first and reflection uses damage BEFORE the block', () => {
  const guard = { id: 'guard', name: 'Щит', kind: 'defend', priority: 0, accuracy: 100, power: 0, cooldownRounds: 2,
    defense: { fullBlockChance: 100, partialBlockChance: 0, partialMultiplier: .25, reflectChance: 100 } };
  const result = resolveRound(battle([guard], [attack]), [100, 100], 2, 'now', () => 0);
  assert.equal(result.state.events[0].type, 'defend');
  assert.deepEqual(result.hp, [100, 80]);
  assert.equal(result.state.cooldowns[0].guard, 5);
  assert.throws(() => availableMove(result.state, 0, 'guard', 4));
  assert.equal(availableMove(result.state, 0, 'guard', 5).id, 'guard');
});
test('partial block reflects half of incoming damage, without recursive reflection', () => {
  const guard = { ...attack, id: 'guard', kind: 'defend', defense: { fullBlockChance: 0, partialBlockChance: 100, partialMultiplier: .25, reflectChance: 100 } };
  const result = resolveRound(battle([guard], [attack]), [100, 100], 1, 'now', () => 0);
  assert.deepEqual(result.hp, [90, 80]);
  assert.equal(result.state.events.filter(e => e.type === 'reflect').length, 1);
});
test('a broken guard allows full damage and does not reflect', () => {
  const guard = { ...attack, id: 'guard', kind: 'defend', defense: { fullBlockChance: 0, partialBlockChance: 0, partialMultiplier: .25, reflectChance: 100 } };
  assert.deepEqual(resolveRound(battle([guard], [attack]), [100, 100], 1, 'now', () => 0).hp, [60, 100]);
});
test('miss does no damage or effect, spends the action and starts the configured cooldown', () => {
  const risky = { ...attack, id: 'risky', accuracy: 0, cooldownRounds: 2, effect: { stat: 'strength', multiplier: .5, durationRounds: 2 } };
  const result = resolveRound(battle([risky], [attack]), [100, 100], 1, 'now', () => 0);
  assert.equal(result.hp[1], 100);
  assert.equal(result.state.effects.length, 0);
  assert.equal(result.state.cooldowns[0].risky, 4);
  assert.ok(result.state.events.some(e => e.type === 'miss'));
});
test('resolver leaves input untouched and records ordered HP snapshots', () => {
  const original = battle(), copy = structuredClone(original);
  const result = resolveRound(original, [100, 100], 1, 'now', () => 0);
  assert.deepEqual(original, copy);
  assert.deepEqual(result.state.events.map(e => e.hp), [[100, 60], [60, 60]]);
  assert.deepEqual(result.state.events.map(e => e.sequence), [1, 2]);
});
