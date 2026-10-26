// Proposal only. Imports the pure resolver; never opens the game database.
// Run from the repository root: node --import tsx docs/combat/simulate-item-balance.mjs
import { readFileSync } from "node:fs";
import { createBattle, resolveRound } from "../../apps/server/src/modules/combat/battle/engine.ts";

const profile = JSON.parse(readFileSync(new URL("./item-balance-profiles.json", import.meta.url), "utf8"));
const runs = 2000;
let seed = 20261025;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const at = "2026-10-25T00:00:00.000Z";
const byTier = Object.fromEntries(profile.tiers.map((tier) => [tier.id, tier]));
function fighter(tierId, { strength = 10, defense = 5, maxHp = 100, armed = true, armored = true, heal = 0 } = {}) {
  const tier = byTier[tierId];
  const moves = [{ id: "basic", name: "Basic", kind: "attack", priority: 0, accuracy: profile.basicAccuracy, power: 1, cooldownRounds: 0 }];
  if (armed) moves.push({ id: "strong", name: "Strong", kind: "attack", priority: 0, accuracy: tier.strongAccuracy, power: tier.strongPower, cooldownRounds: profile.strongCooldownRounds });
  if (armored) moves.push({ id: "guard", name: "Guard", kind: "defend", priority: 1, accuracy: 100, power: 0, cooldownRounds: profile.guardCooldownRounds,
    defense: { fullBlockChance: tier.fullBlockChance, partialBlockChance: tier.partialBlockChance, partialMultiplier: tier.partialMultiplier, reflectChance: tier.reflectChance } });
  // No itemType: the simulation retains this virtual move between rounds.
  if (heal) moves.push({ id: "heal", name: "Heal", kind: "heal", priority: 1, accuracy: 100, power: 0, cooldownRounds: 0, healAmount: heal });
  return { name: tierId, maxHp, strength: strength + (armed ? tier.damage : 0), defense: defense + (armored ? tier.defense : 0), moves };
}
function choose(state, hp, side, round, policy, heals) {
  const enemy = 1 - side;
  const own = state.fighters[side], other = state.fighters[enemy];
  const ready = (s, id) => state.fighters[s].moves.some((move) => move.id === id) && (state.cooldowns[s][id] ?? 1) <= round;
  const healing = own.moves.find((move) => move.id === "heal");
  if (policy.includes("heal") && healing && heals[side] < profile.healing.usesPerBattle
      && own.maxHp - hp[side] >= healing.healAmount) return "heal";
  // Opponent cooldown is deducible from previous resolved moves, not their hidden choice.
  if (policy.includes("guard") && ready(side, "guard") && ready(enemy, "strong")) return "guard";
  if (policy !== "basic" && ready(side, "strong") && hp[enemy] > Math.max(1, own.strength - other.defense)) return "strong";
  return "basic";
}
function series(label, left, right, policies = ["burst", "burst"]) {
  let wins = 0, losses = 0, ties = 0, rounds = 0, hpLeft = 0, roundLimitReached = 0;
  for (let game = 0; game < runs; game++) {
    // Alternate sides to check that order does not privilege the first fighter.
    const side = game % 2, enemy = 1 - side;
    let state = createBattle(side ? [right, left] : [left, right]);
    let hp = state.fighters.map((f) => f.maxHp);
    const heals = [0, 0];
    let finished = false;
    for (let round = 1; round <= 100; round++) {
      state.choices[side] = choose(state, hp, side, round, policies[0], heals);
      state.choices[enemy] = choose(state, hp, enemy, round, policies[1], heals);
      // Shared healing limit is a proposed adapter rule, not an engine feature today.
      for (const s of [0, 1]) if (state.choices[s] === "heal") {
        heals[s]++;
      }
      const result = resolveRound(state, hp, round, at, random);
      state = result.state;
      state.events = []; // Only events in this round matter; avoid retaining full histories.
      hp = result.hp;
      if (result.finished) {
        finished = true;
        rounds += round;
        hpLeft += hp[side];
        if (result.winner === side) wins++;
        else if (result.winner === enemy) losses++;
        else ties++;
        break;
      }
    }
    if (!finished) { ties++; roundLimitReached++; rounds += 100; hpLeft += hp[side]; }
  }
  return { scenario: label, games: runs, winPercent: +(100 * wins / runs).toFixed(1), lossPercent: +(100 * losses / runs).toFixed(1), tiePercent: +(100 * ties / runs).toFixed(1), roundLimitReached, meanRounds: +(rounds / runs).toFixed(2), meanRemainingHp: +(hpLeft / runs).toFixed(2) };
}
const results = [];
for (const tier of profile.tiers) {
  const f = fighter(tier.id);
  results.push(series(`${tier.id}: mirror`, f, f));
  results.push(series(`${tier.id}: burst vs basic`, f, f, ["burst", "basic"]));
  results.push(series(`${tier.id}: guard on enemy strong vs burst`, f, f, ["guard", "burst"]));
}
for (let i = 1; i < profile.tiers.length; i++) {
  const high = profile.tiers[i].id, low = profile.tiers[i - 1].id;
  results.push(series(`${high} vs ${low}: same character, full equipment`, fighter(high), fighter(low)));
}
for (const tierId of ["common", "legendary"]) for (const stats of [{ strength: 24 }, { defense: 12 }, { maxHp: 135 }]) {
  const f = fighter(tierId, stats);
  results.push(series(`${tierId}: ${JSON.stringify(stats)} mirror`, f, f));
}
for (const tier of profile.tiers.filter((tier) => tier.healAmount)) {
  const f = fighter(tier.id, { heal: tier.healAmount });
  results.push(series(`${tier.id}: heal burst mirror`, f, f, ["heal", "heal"]));
  results.push(series(`${tier.id}: heal guard mirror`, f, f, ["heal guard", "heal guard"]));
  results.push(series(`${tier.id}: heal vs no heal`, f, f, ["heal", "burst"]));
}
const mobs = [
  { name: "rat", maxHp: 10, strength: 2, defense: 0 },
  { name: "drone", maxHp: 30, strength: 6, defense: 2 },
  { name: "archive", maxHp: 45, strength: 8, defense: 3 },
  { name: "sniper", maxHp: 60, strength: 12, defense: 4 },
];
for (const mob of mobs) {
  const enemy = { ...mob, moves: [{ id: "basic", name: "Mob attack", kind: "attack", priority: 0, accuracy: 100, power: 1, cooldownRounds: 0 }] };
  results.push(series(`PvE unarmed vs ${mob.name}`, fighter("common", { armed: false, armored: false }), enemy, ["basic", "basic"]));
  results.push(series(`PvE common set vs ${mob.name}`, fighter("common"), enemy, ["burst", "basic"]));
}
process.stdout.write(JSON.stringify({ seed: 20261025, runsPerScenario: runs, results }, null, 2) + "\n");
