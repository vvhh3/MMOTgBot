import type { GroupBattleState } from '@mmobot/shared';
import { executeAction } from './action.js';
import { expireEffects, finishRoundEffects, type BattleContext } from './effects.js';
import { chooseFighterMove } from '../../mobs/balance.js';

export function livingFighters(state: GroupBattleState, team: 0 | 1) {
  return state.fighters.map((f, i) => ({ f, i })).filter(({ f, i }) => f.team === team && !f.left && state.hp[i] > 0).map(({ i }) => i);
}
export function commitMobChoices(state: GroupBattleState, round: number, random = Math.random) {
  const targets = livingFighters(state, 0);
  for (const side of livingFighters(state, 1)) {
    state.choices[side] = chooseFighterMove(state.fighters[side].moves, state.cooldowns[side], round, random);
    state.targets[side] = targets[Math.floor(random() * targets.length)] ?? null;
  }
}
export function resolveGroupRound(input: GroupBattleState, round: number, at: string, random = Math.random) {
  const state = structuredClone(input);
  const finished = () => !livingFighters(state, 0).length || !livingFighters(state, 1).length;
  const ctx: BattleContext = { state, hp: state.hp, round, at, random, isFinished: () => !livingFighters(state, 0).length,
    attackers: target => state.fighters.map((f, i) => ({ f, i })).filter(({ f, i }) => f.team !== state.fighters[target].team && !f.left && state.hp[i] > 0 && state.targets[i] === target && state.choices[i] !== null).map(({ i }) => i) };
  const guards = state.fighters.map(() => undefined as typeof state.fighters[number]['moves'][number]['defense']);
  const consumedItems: { side: number; itemType: number }[] = [];
  const order = [...livingFighters(state, 0), ...livingFighters(state, 1)];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const moveFor = (side: number) => state.fighters[side].moves.find(m => m.id === state.choices[side]);
  const priority = (side: number) => { const m = moveFor(side); return m?.kind === 'defend' ? Math.max(1, m.priority) : m?.priority ?? 0; };
  order.sort((a,b) => priority(b) - priority(a));
  for (const side of order) {
    if (finished()) break;
    if (state.hp[side] <= 0 || state.fighters[side].left) continue;
    const move = moveFor(side);
    if (!move) continue; // A missed deadline is a wait, never a free guard or attack.
    const enemies = livingFighters(state, state.fighters[side].team === 0 ? 1 : 0);
    const desired = state.targets[side];
    const target = desired !== null && enemies.includes(desired) ? desired : enemies[0];
    if (target === undefined) break;
    const start = state.events.length;
    executeAction(ctx, side, target, move, guards, consumedItems);
    for (const e of state.events.slice(start)) {
      e.target ??= e.type === 'heal' || e.type === 'defend' ? side : target;
      if (e.type === 'attack' || e.type === 'block' || e.type === 'miss') e.text += ` → ${state.fighters[target].name}`;
    }
  }
  finishRoundEffects(ctx); expireEffects(ctx);
  for (const consumed of consumedItems) state.healingUsed[consumed.side]++;
  state.choices = state.fighters.map(() => null);
  state.targets = state.fighters.map(() => null);
  for (const f of state.fighters) f.moves = f.moves.filter(m => m.itemType === undefined);
  return { state, consumedItems };
}
