import type { MultiBattleState, MultiBattleEvent } from '@mmobot/shared';
import { battleStatusViews, type BattleEvent } from '@mmobot/shared';

export function event(state: MultiBattleState, round: number, type: BattleEvent['type'], hp: number[], at: string,
  text: string, side?: number, details?: Pick<MultiBattleEvent, 'source' | 'critical' | 'target'>) {
  state.events.push({ sequence: state.events.length + 1, round, type, hp: [...hp], at, text,
    statuses: battleStatusViews(state, round), ...(side === undefined ? {} : { side }), ...details });
}
