import assert from 'node:assert/strict';
import { test } from 'node:test';
import { battleStatusViews, getDefaultPassiveParams } from '@mmobot/shared';
import { createBattle, resolveRound, resolveFailedEscape } from '../dist/modules/combat/battle/engine.js';
import { applyStatus, cleanse } from '../dist/modules/combat/battle/effects.js';
import { publicBattle } from '../dist/modules/combat/battle/state.js';

const attack = { id: 'weapon_attack', name: 'Удар', kind: 'attack', priority: 0, accuracy: 100, power: 1, cooldownRounds: 0 };
const guard = { id: 'guard', name: 'Защита', kind: 'defend', priority: 1, accuracy: 100, power: 0, cooldownRounds: 0 };
const passive = (id, params = {}) => ({ id, params: { ...getDefaultPassiveParams(id), ...params } });
const fighter = (name, extra = {}) => ({ name, maxHp: 500, strength: 40, defense: 0, moves: [attack, guard], ...extra });
function battle(left = {}, right = {}) {
  const state = createBattle([fighter('A', left), fighter('B', right)]);
  state.choices = ['weapon_attack', 'guard'];
  return state;
}
const resolve = (state, hp = [500, 500], round = 1, random = () => 0) => resolveRound(state, hp, round, 'now', random);
const context = (state, hp = [500, 500], round = 1, random = () => 0) => ({ state, hp, round, at: 'now', random });
const next = (result, choices = ['guard', 'guard']) => {
  const state = JSON.parse(JSON.stringify(result.state));
  state.choices = choices;
  return state;
};

test('poison ticks exactly twice, refreshes without stacking, persists as JSON and snapshots its application', () => {
  const state = battle({ passives: { weapon: passive('independent_life', { chancePercent: 100 }) } }, { defense: 2 });
  const original = structuredClone(state);
  const first = resolve(state);
  assert.deepEqual(state, original);
  assert.equal(first.hp[1], 460); // 38 direct + (4 - 2) periodic
  assert.equal(first.state.events[1].statuses[1].length, 0); // attack before poison
  assert.ok(first.state.events.find(e => e.text.includes('отравление') && e.source !== 'status').statuses[1].some(s => s.kind === 'poison'));
  const second = resolve(next(first), first.hp, 2);
  assert.equal(second.hp[1], 458);
  assert.equal(second.state.statuses.length, 0);
  assert.equal(resolve(next(second), second.hp, 3).hp[1], 458);
  const ctx = context(battle());
  applyStatus(ctx, 0, 1, { kind: 'poison', value: 20, durationRounds: 2 });
  ctx.round = 2;
  applyStatus(ctx, 0, 1, { kind: 'poison', value: 10, durationRounds: 3 });
  assert.equal(ctx.state.statuses.length, 1);
  assert.equal(ctx.state.statuses[0].value, 20);
  assert.equal(ctx.state.statuses[0].untilRound, 4);
});

test('full blocks and misses do not inflict statuses; periodic damage never starts hit chains', () => {
  for (const missed of [true, false]) {
    const state = battle({ passives: { weapon: passive('burning', { chancePercent: 100 }) } });
    if (missed) state.fighters[0].moves[0] = { ...attack, accuracy: 0 };
    else state.fighters[1].moves[1] = { ...guard, defense: { fullBlockChance: 100, partialBlockChance: 0, partialMultiplier: .5, reflectChance: 0 } };
    const result = resolve(state);
    assert.equal(result.hp[1], 500);
    assert.equal(result.state.statuses.length, 0);
  }
  const state = battle({ passives: { weapon: passive('double_click', { chancePercent: 100 }) } });
  state.choices = ['guard', 'guard'];
  state.statuses = [{ kind: 'burn', target: 1, source: 0, value: 10, untilRound: 2, damageType: 'heat' }];
  const result = resolve(state);
  assert.equal(result.hp[1], 490);
  assert.equal(result.state.events.filter(e => e.type === 'attack').length, 0);
});

test('fear and confusion are consumed on an attack attempt, including a miss, but not by guarding', () => {
  const ctx = context(battle());
  applyStatus(ctx, 1, 0, { kind: 'fear', value: 50, durationRounds: 2 });
  assert.equal(resolve(ctx.state).hp[1], 480);
  assert.equal(resolve(ctx.state).state.statuses.length, 0);
  applyStatus(ctx, 1, 0, { kind: 'confusion', value: 100, durationRounds: 2 });
  const miss = resolve(ctx.state);
  assert.equal(miss.hp[1], 500);
  assert.equal(miss.state.statuses.length, 0);
  ctx.state.choices = ['guard', 'guard'];
  assert.equal(resolve(ctx.state).state.statuses.length, 2);
});

test('foil reflects fear/confusion once, even when both fighters have foil', () => {
  const state = battle({ passives: { armor: passive('foil_reflection', { chancePercent: 100 }) } },
    { passives: { armor: passive('foil_reflection', { chancePercent: 100 }) } });
  const ctx = context(state);
  applyStatus(ctx, 0, 1, { kind: 'confusion', value: 15, durationRounds: 2 });
  assert.equal(state.statuses.length, 1);
  assert.equal(state.statuses[0].target, 0);
  assert.equal(state.events.filter(e => e.type === 'reflect').length, 1);
});

test('wet state strengthens the discharge without amplifying every electric hit', () => {
  const state = battle({ passives: { weapon: passive('short_circuit', { chancePercent: 100, damageCoefficientPercent: 50 }) } });
  const dry = resolve(state);
  applyStatus(context(state), 0, 1, { kind: 'wet', value: 0, durationRounds: 2 });
  const wet = resolve(state);
  assert.equal(dry.hp[1], 440);
  assert.equal(wet.hp[1], 430);
  assert.equal(dry.state.events.find(e => e.type === 'attack').hp[1], wet.state.events.find(e => e.type === 'attack').hp[1]);
});

test('debt has two-stack cap and strong attack consumes it on a miss; first guard awards it once per battle', () => {
  const strong = { ...attack, id: 'weapon_strong', accuracy: 0, power: 1.5 };
  const state = battle({ moves: [attack, strong, guard], passives: { weapon: passive('fine_print') } });
  const ctx = context(state);
  for (let i = 0; i < 3; i++) applyStatus(ctx, 0, 1, { kind: 'debt', value: 15, durationRounds: 1 });
  assert.equal(state.statuses[0].stacks, 2);
  state.choices[0] = 'weapon_strong';
  const result = resolve(state);
  assert.equal(result.state.statuses.length, 0);
  assert.equal(result.state.passiveProgress[0].debtUsed, true);
  assert.equal(resolve(next(result), result.hp, 2).state.statuses.length, 0);
  const amplified = battle({ moves: [attack, { ...strong, accuracy: 100 }, guard], passives: { weapon: passive('fine_print') } });
  amplified.choices[0] = 'weapon_strong';
  assert.equal(resolve(amplified).hp[1], 431); // 40 * 1.5 * 1.15
});

test('crit uses x1.5 power BEFORE defense, chance caps at 50%; ordinary weapons do not crit', () => {
  const state = battle({ passives: { weapon: passive('precision', { criticalChancePercent: 100 }) } }, { defense: 10 });
  const critical = resolve(state);
  assert.equal(critical.hp[1], 450);
  assert.equal(critical.state.events.find(e => e.type === 'attack').critical, true);
  const boundary = resolve(state, [500, 500], 1, () => .5);
  assert.equal(boundary.state.events.find(e => e.type === 'attack').critical, false);
  assert.equal(resolve(battle({}, { defense: 10 })).hp[1], 470);
});

test('DOT double knockout is a draw and completed fights expose no remaining statuses', () => {
  const state = battle();
  state.choices = ['guard', 'guard'];
  state.statuses = [0, 1].map(target => ({ kind: 'poison', target, source: 1 - target, value: 10, untilRound: 2 }));
  const result = resolve(state, [5, 5]);
  assert.equal(result.finished, true);
  assert.equal(result.winner, null);
  assert.deepEqual(result.hp, [0, 0]);
  assert.deepEqual(result.state.events.at(-1).statuses, [[], []]);
});

test('vampirism is based on HP actually removed, works on a lethal hit and does not consume potion allowance', () => {
  const state = battle({ passives: { weapon: passive('lifesteal', { chancePercent: 100, healingPercent: 100 }) } });
  const result = resolve(state, [100, 3]);
  assert.equal(result.hp[0], 103);
  assert.equal(result.hp[1], 0);
  assert.equal(publicBattle(result.state, 1, 1, null, 0).healingAvailable, true);
});

test('poison healing reduction applies to both direct healing and regeneration; each potion is counted once', () => {
  const potion = { ...attack, id: 'potion', kind: 'heal', priority: 2, itemType: 1, healAmount: 50,
    passive: passive('mothers_care', { durationRounds: 2, healingPercent: 10 }) };
  const state = battle({ moves: [potion, guard] });
  state.choices = ['potion', 'guard'];
  state.statuses = [{ kind: 'poison', target: 0, source: 1, value: 10, untilRound: 2, healingReductionPercent: 50 }];
  const result = resolve(state, [100, 500]);
  assert.equal(result.hp[0], 140); // +25 instant -10 poison +25 regen
  assert.deepEqual(result.consumedItems, [{ side: 0, itemType: 1 }]);
  assert.equal(publicBattle(result.state, 2, 1, null, 0).healingAvailable, false);
  assert.equal(result.state.events.filter(e => e.type === 'heal').length, 2);
});

test('dumpling replaces flat healing with percent healing, cleanses one debuff, leaves permanent equipment', () => {
  const potion = { ...attack, id: 'potion', kind: 'heal', priority: 2, itemType: 1, healAmount: 45, passive: passive('primordial_dumpling') };
  const state = battle({ moves: [potion, guard], passives: { armor: passive('clear_mind') } });
  state.choices = ['potion', 'guard'];
  state.statuses = [{ kind: 'fear', target: 0, source: 1, value: 15, untilRound: 2 }];
  const result = resolve(state, [100, 500]);
  assert.equal(result.hp[0], 350);
  assert.equal(result.state.statuses.length, 0);
  assert.equal(result.state.fighters[0].passives.armor.id, 'clear_mind');
});

test('shield absorbs damage, only triggers once below threshold and never revives its owner', () => {
  const state = battle({}, { passives: { armor: passive('veteran_resident') } });
  const first = resolve(state, [500, 180]);
  assert.equal(first.hp[1], 140);
  assert.equal(first.state.statuses[0].value, 100);
  const second = resolve(next(first, ['weapon_attack', 'guard']), first.hp, 2);
  assert.equal(second.hp[1], 140);
  assert.equal(second.state.statuses[0].value, 60);
  const dead = resolve(state, [500, 10]);
  assert.equal(dead.state.statuses.length, 0);
  assert.equal(dead.hp[1], 0);
});

test('first-hit reduction is not spent on a full block; psychic resistance applies only to psychic damage', () => {
  const state = battle({}, { passives: { armor: passive('saved_for_tomorrow', { damageReductionPercent: 50 }) } });
  assert.equal(resolve(state).hp[1], 480);
  state.fighters[1].moves[1] = { ...guard, defense: { fullBlockChance: 100, partialBlockChance: 0, partialMultiplier: .5, reflectChance: 0 } };
  assert.equal(resolve(state).state.passiveProgress[1].firstHitConsumed, undefined);
  const psychic = battle({ damageType: 'psychic' }, { passives: { armor: passive('clear_mind', { damageReductionPercent: 50 }) } });
  assert.equal(resolve(psychic).hp[1], 480);
  psychic.fighters[0].damageType = 'blunt';
  assert.equal(resolve(psychic).hp[1], 460);
});

test('long handle requires a reduced guard hit; ready bonus survives idle rounds and is consumed once', () => {
  const blocking = { ...guard, defense: { fullBlockChance: 100, partialBlockChance: 0, partialMultiplier: .5, reflectChance: 0 } };
  const state = battle({ moves: [attack, blocking], passives: { weapon: passive('long_handle', { armorIgnorePercent: 50 }) } }, { defense: 20 });
  state.choices = ['guard', 'weapon_attack'];
  const first = resolve(state);
  const waited = resolve(next(first), first.hp, 5);
  assert.equal(waited.state.statuses[0].kind, 'armor_piercing');
  assert.equal(resolve(next(waited, ['weapon_attack', 'guard']), waited.hp, 6).hp[1], 470);
});

test('suppression stops weapon passives for its duration, while armor and ordinary attacks still work', () => {
  const state = battle({ passives: { weapon: passive('burning', { chancePercent: 100 }), armor: passive('clear_mind') } });
  state.statuses = [{ kind: 'silence', target: 0, source: 1, value: 0, untilRound: 2 }];
  const result = resolve(state);
  assert.equal(result.hp[1], 460);
  assert.equal(result.state.statuses.some(s => s.kind === 'burn'), false);
  assert.ok(result.state.fighters[0].passives.armor);
});

test('cleanse selects among temporary states and legacy effects without removing innate properties', () => {
  const state = battle({ passives: { armor: passive('clear_mind') } });
  state.statuses = [{ kind: 'shield', target: 0, source: 0, value: 50, untilRound: 2 }];
  state.effects = [{ target: 0, stat: 'strength', multiplier: .5, untilRound: 2 }];
  const ctx = context(state);
  cleanse(ctx, 0, true);
  assert.equal(state.statuses.length, 0);
  assert.equal(state.effects.length, 1);
  cleanse(ctx, 0, false);
  assert.equal(state.effects.length, 0);
  assert.ok(state.fighters[0].passives.armor);
});

test('failed escape advances periodic effects and shields; successful legacy shape resolves without new snapshots', () => {
  const state = battle();
  state.statuses = [{ kind: 'poison', target: 1, source: 0, value: 10, untilRound: 1 }];
  const result = resolveFailedEscape(state, [500, 500], 1, 'now', () => 0);
  assert.deepEqual(result.hp, [460, 490]);
  assert.equal(result.state.statuses.length, 0);
  const legacy = battle();
  delete legacy.statuses; delete legacy.passiveProgress;
  assert.equal(resolve(legacy).hp[1], 460);
});

test('public status sides are absolute and expose duration, stacks and descriptions without mutation', () => {
  const state = battle();
  state.statuses = [{ kind: 'debt', target: 1, source: 0, value: 15, stacks: 2, untilRound: 3 }];
  state.effects = [{ target: 0, stat: 'defense', multiplier: .5, untilRound: 2 }];
  const before = structuredClone(state);
  for (const side of [0, 1]) {
    const dto = publicBattle(state, 2, 1, null, side);
    assert.equal(dto.statuses[1][0].stacks, 2);
    assert.equal(dto.statuses[1][0].remainingRounds, 2);
    assert.equal(dto.statuses[0][0].kind, 'defense_down');
    assert.ok(dto.statuses[0][0].description.includes('50%'));
  }
  assert.deepEqual(state, before);
  assert.deepEqual(battleStatusViews(state, 4), [[], []]);
});

test('alternating attacks, low HP and guarding supply their defined attack bonuses', () => {
  const strong = { ...attack, id: 'weapon_strong', power: 1.5 };
  const returning = battle({ moves: [attack, strong, guard], passives: { weapon: passive('returning', { damageBonusPercent: 50 }) } });
  const first = resolve(returning);
  assert.equal(resolve(next(first, ['weapon_strong', 'guard']), first.hp, 2).hp[1], 370); // 40 then 90
  const low = battle({ passives: { weapon: passive('last_percent', { damageBonusPercent: 50 }) } });
  const lowFirst = resolve(low, [100, 500]);
  assert.equal(lowFirst.hp[1], 440);
  assert.equal(resolve(next(lowFirst, ['weapon_attack', 'guard']), lowFirst.hp, 2).hp[1], 400);
  const family = battle({ passives: { weapon: passive('family_justice', { damageBonusPercent: 50 }) } });
  family.choices = ['guard', 'guard'];
  const guarded = resolve(family);
  assert.equal(resolve(next(guarded, ['weapon_attack', 'guard']), guarded.hp, 2).hp[1], 440);
});

test('hit counters survive serialization; misses reset CAPS and aim bonus is consumed on next attempt', () => {
  const caps = battle({ damageType: 'psychic', passives: { weapon: passive('caps_lock', { damageBonusPerHitPercent: 50 }) } });
  const first = resolve(caps);
  const second = resolve(next(first, ['weapon_attack', 'guard']), first.hp, 2);
  assert.equal(second.hp[1], 400); // 40 then 60
  const missing = next(second, ['weapon_attack', 'guard']);
  missing.fighters[0].moves[0].accuracy = 0;
  assert.equal(resolve(missing, second.hp, 3).state.passiveProgress[0].capsStacks, 0);
  const revision = battle({ passives: { weapon: passive('final_revision', { hitsRequired: 2, damageCoefficientPercent: 50 }) } });
  const one = resolve(revision), two = resolve(next(one, ['weapon_attack', 'guard']), one.hp, 2);
  assert.equal(two.hp[1], 400); // 40 + (40 + 20)
  assert.equal(two.state.passiveProgress[0].finalHits, 0);
  const aim = battle({ moves: [{ ...attack, accuracy: 0 }, guard], passives: { weapon: passive('admin_aim', { accuracyBonusPercent: 100, damageBonusPercent: 50 }) } });
  const miss = resolve(aim);
  assert.equal(miss.state.statuses[0].kind, 'aim');
  const hit = resolve(next(miss, ['weapon_attack', 'guard']), miss.hp, 2);
  assert.equal(hit.hp[1], 440);
  assert.equal(hit.state.statuses.length, 0);
});

test('armor can supply wet state for an electrical weapon without requiring a second weapon slot', () => {
  const state = battle({ passives: { weapon: passive('short_circuit', { chancePercent: 100 }), armor: passive('soaking', { chancePercent: 100 }) } });
  state.choices = ['guard', 'guard'];
  const guarded = resolve(state);
  assert.equal(guarded.state.statuses[0].kind, 'wet');
  const result = resolve(next(guarded, ['weapon_attack', 'guard']), guarded.hp, 2);
  assert.equal(result.hp[1], 451); // 40 + floor(40 * .15 * 1.5)
});

test('CAPS buff is visible, dispellable and absent from the miss playback snapshot', () => {
  const state = battle({ damageType: 'psychic', passives: { weapon: passive('caps_lock') } });
  const first = resolve(state);
  assert.equal(publicBattle(first.state, 2, 1, null, 0).statuses[0][0].kind, 'psychic_charge');
  const waiting = next(first, ['weapon_attack', 'guard']);
  waiting.fighters[0].moves[0].accuracy = 0;
  const missed = resolve(waiting, first.hp, 2);
  assert.ok(missed.state.events.find(e => e.type === 'miss').statuses[0].every(s => s.kind !== 'psychic_charge'));
  const ctx = context(next(first), first.hp, 2);
  cleanse(ctx, 0, true);
  assert.equal(ctx.state.statuses.length, 0);
});

test('effect probability uses an exclusive upper boundary; fully blocked hits do not activate low-HP shields', () => {
  const state = battle({ passives: { weapon: passive('burning', { chancePercent: 20 }) } });
  assert.equal(resolve(state, [500, 500], 1, () => .2).state.statuses.length, 0);
  assert.equal(resolve(state, [500, 500], 1, () => .19999).state.statuses[0].kind, 'burn');
  const blocking = battle({}, { passives: { armor: passive('veteran_resident') }, moves: [attack, {
    ...guard, defense: { fullBlockChance: 100, partialBlockChance: 0, partialMultiplier: .5, reflectChance: 0 },
  }] });
  const result = resolve(blocking, [500, 10]);
  assert.equal(result.state.statuses.length, 0);
  assert.equal(result.state.passiveProgress[1].veteranUsed, undefined);
});

test('escape counter consumes fear/confusion as an attack without changing its base flat damage', () => {
  for (const [kind, value, hp] of [['fear', 50, 480], ['confusion', 100, 500]]) {
    const state = battle();
    state.statuses = [{ kind, target: 1, source: 0, value, untilRound: 2 }];
    const result = resolveFailedEscape(state, [500, 500], 1, 'now', () => 0);
    assert.equal(result.hp[0], hp);
    assert.equal(result.state.statuses.length, 0);
  }
});
