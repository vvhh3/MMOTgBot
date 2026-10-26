import { battleStatusViews, type BattleEvent, type BattleSide, type BattleState } from '@mmobot/shared';

export function event(state: BattleState, round: number, type: BattleEvent['type'], hp: [number, number], at: string,
  text: string, side?: BattleSide, details?: Pick<BattleEvent, 'source' | 'critical'>) {
  state.events.push({ sequence: state.events.length + 1, round, type, hp: [...hp], at, text,
    statuses: battleStatusViews(state, round), ...(side === undefined ? {} : { side }), ...details });
}
