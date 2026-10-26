// Pure engine simulation. Build shared/server first; this script never opens the game database.
// node docs/combat/simulate-passive-balance.mjs
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { getItemMinLevel, ITEM_BALANCE, resolvePassiveParams } from '../../packages/shared/dist/index.js';
import { createBattle, resolveRound } from '../../apps/server/dist/modules/combat/battle/engine.js';
import { equipmentMoves } from '../../apps/server/dist/modules/combat/battle/moves.js';
import { WEAPON_CATALOG } from '../../apps/server/dist/modules/items/catalogs/weapons.js';
import { MEME_ITEM_CATALOG } from '../../apps/server/dist/modules/items/catalogs/meme-items.js';
import { SQUARE_MOBS } from '../../apps/server/dist/modules/mobs/catalogs/square.js';
import { chooseMobMove, mobMoves, scaleMob } from '../../apps/server/dist/modules/mobs/balance.js';

const trials = 200, results = [];
const templates = ['square_pigeon', 'square_fountain', 'square_ilyich'].map(key => SQUARE_MOBS.find(mob => mob.key === key));
assert.ok(templates.every(Boolean), 'Simulation requires existing normal/strong/boss templates');
const catalog = [...WEAPON_CATALOG, ...MEME_ITEM_CATALOG].filter(item => item.passiveId);
const randomGenerator = initial => {
  let seed = initial;
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
};
for (const item of catalog) for (const level of [...new Set([getItemMinLevel(item), 8])]) {
  const tier = ITEM_BALANCE[item.rarity], points = level - 1;
  const attackPoints = Math.floor(points / 2), defensePoints = Math.floor((points - attackPoints) / 2);
  const maxHp = 100 + (points - attackPoints - defensePoints) * 5;
  const weapon = item.type === 'weapon' ? item : { rarity: item.rarity, type: 'weapon' };
  const armor = item.type === 'armor' ? item : { rarity: item.rarity, type: 'armor' };
  const player = { name: item.name, maxHp, strength: 10 + attackPoints * 2 + tier.damage,
    defense: 5 + defensePoints + tier.defense, damageType: weapon.damageType ?? 'blunt', moves: equipmentMoves(weapon, armor) };
  const snapshot = { id: item.passiveId, params: resolvePassiveParams(item.passiveId, item.passiveParams) };
  for (const profile of templates) for (const policy of ['attack', 'guard']) {
    const { mob } = scaleMob({ ...profile, id: 1, catalogKey: profile.key, level: 1, locationId: 'square', isActive: true,
      loot: [], pointsReward: 1, coinReward: 1, respawnSeconds: 1 }, level, []);
    for (const enabled of [false, true]) {
      let wins = 0, totalRounds = 0, limited = 0;
      for (let trial = 0; trial < trials; trial++) {
        // Spread initial seeds: consecutive LCG seeds otherwise correlate opening rolls.
        const random = randomGenerator((20261026 ^ Math.imul(trial + 1, 0x9e3779b1)) >>> 0);
        const left = { ...player, ...(enabled && item.type !== 'potion' ? { passives: { [item.type]: snapshot } } : {}) };
        let state = createBattle([left, { name: mob.name, maxHp: mob.maxHealth, strength: mob.strength, defense: mob.defense, moves: mobMoves(mob) }]);
        let hp = [maxHp, mob.maxHealth], usedPotion = false;
        for (let round = 1; round <= 100; round++) {
          state.choices[1] = chooseMobMove(state, round, random);
          const ready = state.fighters[0].moves.filter(move => (state.cooldowns[0][move.id] ?? 1) <= round);
          let moveId = ready.find(move => move.id === 'weapon_strong')?.id ?? 'weapon_attack';
          if (policy === 'guard' && round % 2 === 0 && ready.some(move => move.kind === 'defend')) moveId = 'armor_guard';
          if (item.type === 'potion' && !usedPotion && hp[0] <= maxHp * .5) {
            usedPotion = true; moveId = 'potion';
            state.fighters[0].moves.push({ id: moveId, name: item.name, kind: 'heal', priority: 1, accuracy: 100, power: 0,
              cooldownRounds: 0, itemType: 999, healAmount: item.healAmount, ...(enabled ? { passive: snapshot } : {}) });
          }
          state.choices[0] = moveId;
          const result = resolveRound(state, hp, round, 'simulation', random);
          hp = result.hp; state = result.state;
          assert.ok(hp[0] >= 0 && hp[0] <= maxHp && hp[1] >= 0 && hp[1] <= mob.maxHealth);
          state.events = []; // Do not retain histories across simulated rounds.
          if (result.finished || round === 100) {
            wins += result.winner === 0 ? 1 : 0; totalRounds += round;
            limited += !result.finished ? 1 : 0;
            break;
          }
        }
      }
      results.push({ item: item.catalogKey, passive: item.passiveId, level, mob: profile.key, policy, enabled,
        winPercent: wins / trials * 100, averageRounds: Number((totalRounds / trials).toFixed(2)), limited });
    }
  }
}
const totalBattles = results.length * trials;
const report = { seed: 20261026, trialsPerCase: trials, totalBattles,
  note: 'Two basic policies, minimum required level and level 8, three enemies. No claim of optimal play or a full balance guarantee.', results };
writeFileSync(new URL('./passive-balance-results.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ totalBattles, cases: results.length, cappedBattles: results.reduce((sum, row) => sum + row.limited, 0) }));
