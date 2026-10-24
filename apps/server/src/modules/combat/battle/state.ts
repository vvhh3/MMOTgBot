import type { BattlePublicState,BattleRequest,BattleSide,BattleState } from '@mmobot/shared';

export class BattleError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
export function parseBattleRequest(body: unknown): BattleRequest {
  const b = body as BattleRequest | null;
  if (!b || !Number.isSafeInteger(b.sessionId) || b.sessionId < 1 || !Number.isSafeInteger(b.round) || b.round < 1 ||
    (b.moveId !== undefined && (typeof b.moveId !== 'string' || !/^[\w-]{1,100}$/.test(b.moveId))) ||
    (b.itemType !== undefined && (!Number.isSafeInteger(b.itemType) || b.itemType < 1)) ||
    !Number.isSafeInteger(b.expectedVersion) || b.expectedVersion < 0 || typeof b.requestId !== 'string' || !/^[\w-]{1,100}$/.test(b.requestId))
    throw new BattleError('Обновите состояние боя и повторите действие', 400);
  return b;
}
export function checkRequest(state: BattleState, playerId: number, request: BattleRequest, command: string, round: number, version: number) {
  const fingerprint = JSON.stringify([request.sessionId, request.round, command]);
  const old = state.processedRequests.find(r => r.playerId === playerId && r.requestId === request.requestId);
  if (old) {
    if (old.fingerprint !== fingerprint) throw new BattleError('ID запроса уже использован для другой команды');
    return true;
  }
  // Independent choices submitted from the same snapshot commute within a round.
  if (request.round !== round || request.expectedVersion > version) throw new BattleError('Состояние боя изменилось. Обновите его');
  return false;
}
export function rememberRequest(state: BattleState, playerId: number, request: BattleRequest, command: string) {
  state.processedRequests.push({ playerId, requestId: request.requestId, fingerprint: JSON.stringify([request.sessionId, request.round, command]) });
}
export function publicBattle(state: BattleState | null, round: number, version: number, startedAt: string | null, side: BattleSide): BattlePublicState {
  return {
    round, stateVersion: version, roundStartedAt: startedAt,
    events: state?.events ?? [], actionSubmitted: !!state?.choices[side], finishReason: state?.finishReason,
    moves: state?.fighters[side].moves.filter(m => m.itemType === undefined).map(m => ({ ...m, availableFromRound: state.cooldowns[side][m.id] ?? 1 })) ?? [],
  };
}
