// Pure production-engine simulation; never opens a game database.
// npm run build:prod && node docs/combat/simulate-group-event.mjs
import { writeFileSync } from 'node:fs';
import { DEFAULT_GROUP_EVENT_CONFIG } from '../../packages/shared/dist/contracts/group-events.js';
import { ITEM_BALANCE, HEALING_BALANCE } from '../../packages/shared/dist/item-balance.js';
import { equipmentMoves } from '../../apps/server/dist/modules/combat/battle/moves.js';
import { SQUARE_MOBS } from '../../apps/server/dist/modules/mobs/catalogs/square.js';
import { mobMoves, scaleMob } from '../../apps/server/dist/modules/mobs/balance.js';
import { commitMobChoices, livingFighters, resolveGroupRound } from '../../apps/server/dist/modules/combat/battle/group-round.js';

let seed = 27102026;
const random = () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
const trials = 100, results = [];
for (let level = 1; level <= 8; level++) {
  const rarity = level >= 7 ? 'legendary' : level >= 5 ? 'epic' : level >= 3 ? 'rare' : level >= 2 ? 'uncommon' : 'common';
  const tier = ITEM_BALANCE[rarity], points = level - 1, attackPoints = Math.floor(points / 2), defensePoints = Math.floor((points - attackPoints) / 2);
  const fighter = { maxHp: 100 + (points - attackPoints - defensePoints) * 5, strength: 10 + attackPoints * 2 + tier.damage,
    defense: 5 + defensePoints + tier.defense, moves: equipmentMoves({ type:'weapon',rarity,catalogKey:'mop' },{ type:'armor',rarity,catalogKey:'leather_armor' }) };
  const healing = HEALING_BALANCE[rarity]?.healAmount ?? HEALING_BALANCE.common.healAmount;
  const waves = DEFAULT_GROUP_EVENT_CONFIG.waves.map((w, wi) => w.mobKeys.map((key, slot) => {
    const template = SQUARE_MOBS.find(m => m.key === key);
    const { mob } = scaleMob({ ...template, catalogKey:key, level:1, locationId:'square', loot:[], pointsReward:1, coinReward:1 }, level, []);
    return { id:`${wi}-${slot}`,name:mob.name,maxHp:Math.floor(mob.maxHealth*w.hpMultiplier),strength:Math.floor(mob.strength*w.damageMultiplier),defense:mob.defense,moves:mobMoves(mob),team:1,wave:wi+1 };
  }));
  for (const tactic of ['focus', 'guard']) {
    let wins = 0, rounds = 0;
    for (let trial = 0; trial < trials; trial++) {
      let state = { fighters:Array.from({length:3},(_,i)=>({...structuredClone(fighter),id:`player-${i}`,name:`Игрок ${i}`,team:0,wave:0})),hp:Array(3).fill(fighter.maxHp),choices:Array(3).fill(null),targets:Array(3).fill(null),
        cooldowns:[{},{},{}],effects:[],statuses:[],passiveProgress:[{},{},{}],healingUsed:[0,0,0],events:[],exitRequested:[false,false,false],processedRequests:[],idleRounds:0,waves };
      const addWave = wave => { for(const f of structuredClone(waves[wave])) {state.fighters.push(f);state.hp.push(f.maxHp);state.choices.push(null);state.targets.push(null);state.cooldowns.push({});state.passiveProgress.push({});state.healingUsed.push(0);state.exitRequested.push(false);} };
      let wave = 0; addWave(wave);
      for(let round=1; round<=200; round++) {
        commitMobChoices(state,round,random);
        const targets = livingFighters(state,1);
        for(const side of livingFighters(state,0)) {
          const f = state.fighters[side], available = f.moves.filter(m=>(state.cooldowns[side][m.id]??1)<=round);
          let move = available.find(m=>m.id==='weapon_strong') ?? available.find(m=>m.kind==='attack');
          if(tactic==='guard' && round%2===0) move = available.find(m=>m.kind==='defend') ?? move;
          if(!state.healingUsed[side] && state.hp[side] <= f.maxHp*.5) {
            move = { id:'potion',name:'Лечение',kind:'heal',priority:1,accuracy:100,power:0,cooldownRounds:0,itemType:999,healAmount:healing };
            f.moves.push(move);
          }
          state.choices[side] = move.id; state.targets[side] = targets[0];
        }
        state = resolveGroupRound(state,round,'simulation',random).state;
        if(!livingFighters(state,0).length) { rounds+=round; break; }
        if(!livingFighters(state,1).length) {
          if(++wave===waves.length) { wins++;rounds+=round;break; }
          addWave(wave);
        }
        if(round===200) rounds+=round;
      }
    }
    results.push({level,tactic,winPercent:Math.round(wins/trials*1000)/10,averageRounds:Number((rounds/trials).toFixed(1))});
  }
}
writeFileSync(new URL('./group-event-balance-results.json',import.meta.url),JSON.stringify({seed:27102026,trialsPerCase:trials,results},null,2)+'\n');
console.table(results);
