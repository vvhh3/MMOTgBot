// Run after building shared/server: node docs/combat/simulate-mob-balance.mjs
// Pure simulation: uses the production round engine, never opens the game database.
import { writeFileSync } from 'node:fs';
import { ITEM_BALANCE, HEALING_BALANCE } from '../../packages/shared/dist/item-balance.js';
import { createBattle, resolveRound } from '../../apps/server/dist/modules/combat/battle/engine.js';
import { equipmentMoves } from '../../apps/server/dist/modules/combat/battle/moves.js';
import { SQUARE_MOBS } from '../../apps/server/dist/modules/mobs/catalogs/square.js';
import { chooseMobMove, mobMoves, scaleMob } from '../../apps/server/dist/modules/mobs/balance.js';

let seed = 26102026;
const random = () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
const rarityAt = level => level >= 7 ? 'legendary' : level >= 5 ? 'epic' : level >= 3 ? 'rare' : level >= 2 ? 'uncommon' : 'common';
const trials = 200;
const results = [];
for (let level = 1; level <= 8; level++) {
  const rarity = rarityAt(level);
  const tier = ITEM_BALANCE[rarity];
  for (const build of ['unarmed', 'balanced', 'attack', 'defense', 'health']) {
    const points = level - 1;
    const attackPoints = build === 'attack' ? points : build === 'defense' || build === 'health' ? 0 : Math.floor(points / 2);
    const defensePoints = build === 'defense' ? points : build === 'health' ? 0 : Math.floor((points - attackPoints) / 2);
    const healthPoints = points - attackPoints - defensePoints;
    const armed = build !== 'unarmed';
    const weapon = armed ? { type: 'weapon', rarity, catalogKey: 'mop' } : undefined;
    const armor = armed ? { type: 'armor', rarity, catalogKey: 'leather_armor' } : undefined;
    const fighter = { name: 'Игрок', maxHp: 100 + healthPoints * 5,
      strength: 10 + attackPoints * 2 + (armed ? tier.damage : 0),
      defense: 5 + defensePoints + (armed ? tier.defense : 0), moves: equipmentMoves(weapon, armor) };
    const healAmount = !armed ? 0 : level >= 7 ? HEALING_BALANCE.legendary.healAmount : level >= 3 ? HEALING_BALANCE.rare.healAmount
      : level >= 2 ? HEALING_BALANCE.uncommon.healAmount : HEALING_BALANCE.common.healAmount;
    for (const profile of SQUARE_MOBS) {
      const template = { ...profile, id: 1, catalogKey: profile.key, level: 1, locationId: 'square', isActive: true,
        loot: [], pointsReward: 1, coinReward: 1, respawnSeconds: 1 };
      const { mob } = scaleMob(template, level, []);
      for (const tactic of ['attack', 'guard']) {
        if (!armed && tactic === 'guard') continue;
        let wins = 0, rounds = 0;
        for (let trial = 0; trial < trials; trial++) {
          let state = createBattle([fighter, { name: mob.name, maxHp: mob.maxHealth, strength: mob.strength, defense: mob.defense, moves: mobMoves(mob) }]);
          let hp = [fighter.maxHp, mob.maxHealth];
          let healed = false;
          for (let round = 1; round <= 80; round++) {
            // Enemy commits before the player policy; the policy never reads choices[1].
            state.choices[1] = chooseMobMove(state, round, random);
            const available = fighter.moves.filter(move => (state.cooldowns[0][move.id] ?? 1) <= round);
            const strong = available.find(move => move.id === 'weapon_strong');
            const guard = available.find(move => move.kind === 'defend');
            let selected = strong?.id ?? available.find(move => move.kind === 'attack').id;
            if (tactic === 'guard' && guard && round % 2 === 0) selected = guard.id;
            if (!healed && healAmount > 0 && hp[0] <= fighter.maxHp * .55 && hp[0] + healAmount <= fighter.maxHp) {
              selected = 'potion'; healed = true;
              state.fighters[0].moves.push({ id: 'potion', name: 'Лечение', kind: 'heal', priority: 1, accuracy: 100, power: 0,
                cooldownRounds: 0, itemType: 999, healAmount });
            }
            state.choices[0] = selected;
            const resolved = resolveRound(state, hp, round, 'simulation', random);
            state = resolved.state; hp = resolved.hp;
            if (resolved.finished || round === 80) {
              wins += resolved.winner === 0 ? 1 : 0; rounds += round; break;
            }
          }
        }
        results.push({ level, build, tactic, mob: profile.key, rank: profile.rank,
          winPercent: Math.round(wins / trials * 1000) / 10, averageRounds: Math.round(rounds / trials * 10) / 10 });
      }
    }
  }
}
writeFileSync(new URL('./mob-balance-results.json', import.meta.url), `${JSON.stringify({ seed: 26102026, trialsPerCase: trials, results }, null, 2)}\n`);
for (const level of [1, 4, 8]) {
  console.log(`Level ${level}`);
  console.table(results.filter(row => row.level === level && row.mob === 'square_fourteen').map(({ build, tactic, winPercent, averageRounds }) => ({ build, tactic, winPercent, averageRounds })));
}
