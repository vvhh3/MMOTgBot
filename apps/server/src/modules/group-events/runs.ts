import { type GroupBattleState, type GroupEventActionRequest, type GroupFighter } from '@mmobot/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { eventParties, eventPartyMembers, groupEventRuns, groupEventWindows, items, mobs, players, type GroupEventRunRow } from '../../database/schema.js';
import { isPlayerOnline } from '../../infrastructure/realtime/socket-server.js';
import { nowGameTime } from '../../shared/time.js';
import { event } from '../combat/battle/events.js';
import { commitMobChoices, livingFighters, resolveGroupRound } from '../combat/battle/group-round.js';
import { consumePotion, preparePotion } from '../combat/battle/potions.js';
import { mobFighter, playerFighter } from '../combat/battle/stats.js';
import { scaleMob } from '../mobs/balance.js';
import { afterGameTime, GroupEventError, requestKey, requireWindow, windowDto } from './availability.js';
import { assertPlayerFree, clearGroupAction, closeParty, resetPartyReady } from './parties.js';
import { grantGroupRewards } from './rewards.js';

export function appendWave(state: GroupBattleState, wave: number) {
  for (const fighter of structuredClone(state.waves[wave - 1])) {
    state.fighters.push(fighter); state.hp.push(fighter.maxHp); state.choices.push(null); state.targets.push(null);
    state.cooldowns.push({}); state.exitRequested.push(false); state.passiveProgress!.push({}); state.healingUsed.push(0);
  }
}
export function startGroupRun(playerId: number, partyId: number) {
  return db.transaction(() => {
    const party = db.select().from(eventParties).where(eq(eventParties.id, partyId)).get();
    if (!party || party.leaderPlayerId !== playerId) throw new GroupEventError('Запустить событие может лидер группы', 'FORBIDDEN', 403);
    const old = db.select().from(groupEventRuns).where(eq(groupEventRuns.partyId, partyId)).get();
    if (old) return old;
    if (party.status !== 'forming' || party.expiresAt <= nowGameTime()) throw new GroupEventError('Группа уже закрыта');
    const window = requireWindow(party.eventWindowId);
    const members = db.select().from(eventPartyMembers).where(and(eq(eventPartyMembers.partyId, partyId), eq(eventPartyMembers.status, 'joined'))).orderBy(eventPartyMembers.slot).all();
    if (members.length !== 3 || members.some(m => !m.ready)) throw new GroupEventError('Для старта нужны три готовых участника');
    const team = members.map(m => {
      const p = assertPlayerFree(m.playerId, partyId);
      if (p.currentLocationId !== 'square' || p.level < window.minLevel || !isPlayerOnline(p.id)) throw new GroupEventError('Все участники должны быть на Площади, в сети и подходить по уровню');
      return p;
    });
    const config = structuredClone(window.config), level = Math.max(...team.map(p => p.level));
    const catalog = db.select().from(items).all();
    const waves = config.waves.map((w, wi) => w.mobKeys.map((key, slot): GroupFighter => {
      const template = db.select().from(mobs).where(eq(mobs.catalogKey, key)).get();
      if (!template) throw new GroupEventError('Противник события недоступен');
      const mob = scaleMob(template, level, catalog).mob;
      return { ...mobFighter(mob), maxHp: Math.max(1, Math.floor(mob.maxHealth * w.hpMultiplier)),
        strength: Math.max(1, Math.floor(mob.strength * w.damageMultiplier)), id: `party-${partyId}-wave-${wi + 1}-mob-${slot}`, team: 1, wave: wi + 1 };
    }));
    if (!config.reward.loot.length) {
      const boss = db.select().from(mobs).where(eq(mobs.catalogKey, config.waves.at(-1)!.mobKeys[0])).get()!;
      config.reward.loot = scaleMob(boss, level, catalog).mob.loot;
    }
    const fighters: GroupFighter[] = team.map(p => ({ ...playerFighter(p), id: `player-${p.id}`, playerId: p.id, avatar: p.avatar, team: 0, wave: 0 }));
    const state: GroupBattleState = { fighters, hp: team.map(p => p.health), choices: [null,null,null], targets: [null,null,null], cooldowns: [{},{},{}],
      effects: [], statuses: [], passiveProgress: [{},{},{}], exitRequested: [false,false,false], events: [], processedRequests: [], healingLimit: 1,
      healingUsed: [0,0,0], idleRounds: 0, waves };
    appendWave(state, 1); commitMobChoices(state, 1);
    event(state, 1, 'effect', state.hp, nowGameTime(), 'Волна 1. Особая прогулка начинается!');
    const run = db.insert(groupEventRuns).values({ partyId, eventWindowId: window.id, configSnapshot: config, battleState: state,
      roundStartedAt: nowGameTime(), roundDeadlineAt: afterGameTime(config.roundSeconds * 1000), startedAt: nowGameTime(), lastActionAt: nowGameTime(), expiresAt: afterGameTime(config.durationMinutes * 60000) }).returning().get();
    db.update(eventParties).set({ status: 'active', version: party.version + 1, updatedAt: nowGameTime() }).where(eq(eventParties.id, partyId)).run();
    db.update(eventPartyMembers).set({ status: 'active', ready: false }).where(and(eq(eventPartyMembers.partyId, partyId), eq(eventPartyMembers.status, 'joined'))).run();
    for (const p of team) db.update(players).set({ idTheLastAction: { type: 'GroupEvent', id: run.id }, lastRegenTime: nowGameTime() }).where(eq(players.id, p.id)).run();
    return run;
  });
}
function syncHealth(run: GroupEventRunRow) {
  run.battleState.fighters.forEach((f, i) => {
    if (f.playerId && !f.left) db.update(players).set({ health: run.battleState.hp[i], lastRegenTime: nowGameTime() }).where(eq(players.id, f.playerId)).run();
  });
}
export function finishGroupRun(run: GroupEventRunRow, status: 'victory' | 'defeat' | 'aborted') {
  if (run.status !== 'active') return;
  run.status = status; run.finishedAt = nowGameTime(); run.lastActionAt = nowGameTime(); run.stateVersion++;
  run.battleState.statuses = []; run.battleState.effects = [];
  event(run.battleState, run.roundNumber, 'finish', run.battleState.hp, nowGameTime(), status === 'victory' ? 'Босс повержен! Особая прогулка завершена.' : status === 'defeat' ? 'Группа потерпела поражение.' : 'Прохождение завершено из-за бездействия или истечения времени.');
  db.update(groupEventRuns).set(run).where(eq(groupEventRuns.id, run.id)).run();
  syncHealth(run);
  if (status === 'victory') grantGroupRewards(run);
  for (const f of run.battleState.fighters) if (f.playerId) clearGroupAction(f.playerId, run.id, 'GroupEvent');
  db.update(eventPartyMembers).set({ status: 'finished', ready: false, endedAt: nowGameTime() }).where(and(eq(eventPartyMembers.partyId, run.partyId), eq(eventPartyMembers.status, 'active'))).run();
  db.update(eventParties).set({ status: 'finished', updatedAt: nowGameTime() }).where(eq(eventParties.id, run.partyId)).run();
}
function advanceRound(run: GroupEventRunRow, timedOut: boolean) {
  const state = run.battleState;
  const living = livingFighters(state, 0);
  const nobodyActed = living.every(i => !state.choices[i]);
  state.idleRounds = timedOut && nobodyActed ? state.idleRounds + 1 : 0;
  if (state.idleRounds >= 2) { finishGroupRun(run, 'aborted'); return; }
  const result = resolveGroupRound(state, run.roundNumber, nowGameTime());
  run.battleState = result.state;
  for (const c of result.consumedItems) consumePotion(run.battleState.fighters[c.side].playerId!, c.itemType);
  if (!livingFighters(run.battleState, 0).length) { finishGroupRun(run, 'defeat'); return; }
  if (!livingFighters(run.battleState, 1).length) {
    if (run.waveNumber === run.configSnapshot.waves.length) { finishGroupRun(run, 'victory'); return; }
    run.waveNumber++; appendWave(run.battleState, run.waveNumber);
    event(run.battleState, run.roundNumber, 'effect', run.battleState.hp, nowGameTime(), `Волна ${run.waveNumber}${run.waveNumber === run.configSnapshot.waves.length ? ': финальный босс!' : ' начинается!'}`);
  }
  run.roundNumber++; run.stateVersion++; run.lastActionAt = nowGameTime(); run.roundStartedAt = nowGameTime();
  run.roundDeadlineAt = afterGameTime(run.configSnapshot.roundSeconds * 1000);
  commitMobChoices(run.battleState, run.roundNumber);
  db.update(groupEventRuns).set(run).where(eq(groupEventRuns.id, run.id)).run(); syncHealth(run);
}
export function actInGroupRun(playerId: number, runId: number, input: GroupEventActionRequest) {
  return db.transaction(() => {
    const run = db.select().from(groupEventRuns).where(eq(groupEventRuns.id, runId)).get();
    const side = run?.battleState.fighters.findIndex(f => f.playerId === playerId) ?? -1;
    if (!run || side < 0) throw new GroupEventError('Прохождение не найдено', 'RUN_NOT_FOUND', 404);
    const key = requestKey(input.requestId), fingerprint = JSON.stringify([runId,input.wave,input.round,input.moveId,input.itemType,input.targetId]);
    const old = run.battleState.processedRequests.find(r => r.playerId === playerId && r.requestId === key);
    if (old) { if (old.fingerprint !== fingerprint) throw new GroupEventError('Этот ID запроса уже использован'); return run; }
    if (run.status !== 'active' || run.battleState.fighters[side].left || run.battleState.hp[side] <= 0) throw new GroupEventError('Сейчас нельзя сделать ход');
    if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0 || input.expectedVersion > run.stateVersion || input.round !== run.roundNumber || input.wave !== run.waveNumber) throw new GroupEventError('Состояние изменилось. Обновите бой', 'STALE_STATE');
    const state = run.battleState;
    if (state.choices[side]) throw new GroupEventError('Ход уже принят');
    const moveId = input.itemType !== undefined ? preparePotion(state, side, playerId, input.itemType, state.hp[side]) : input.moveId;
    const move = state.fighters[side].moves.find(m => m.id === moveId);
    if (!move || (state.cooldowns[side][move.id] ?? 1) > run.roundNumber || (input.itemType === undefined && move.itemType !== undefined) || state.healingUsed[side] >= 1 && move.kind === 'heal') throw new GroupEventError('Приём недоступен');
    let target = state.fighters.findIndex(f => f.id === input.targetId);
    if (move.kind === 'attack' || move.kind === 'weaken') {
      if (!livingFighters(state, 1).includes(target)) throw new GroupEventError('Выберите живого противника', 'INVALID_TARGET');
    } else if (!livingFighters(state, 1).includes(target)) target = livingFighters(state, 1)[0];
    state.choices[side] = move.id; state.targets[side] = target;
    state.processedRequests.push({ playerId, requestId: key, fingerprint });
    run.stateVersion++; run.lastActionAt = nowGameTime();
    if (livingFighters(state, 0).every(i => state.choices[i])) advanceRound(run, false);
    else db.update(groupEventRuns).set(run).where(eq(groupEventRuns.id, run.id)).run();
    return run;
  });
}
export function leaveGroupRun(playerId: number, runId: number) {
  return db.transaction(() => {
    const run = db.select().from(groupEventRuns).where(eq(groupEventRuns.id, runId)).get();
    const side = run?.battleState.fighters.findIndex(f => f.playerId === playerId) ?? -1;
    if (!run || side < 0) throw new GroupEventError('Прохождение не найдено', 'RUN_NOT_FOUND', 404);
    if (run.status !== 'active' || run.battleState.fighters[side].left) return run;
    run.battleState.fighters[side].left = true; run.battleState.choices[side] = null;
    run.battleState.statuses = run.battleState.statuses?.filter(s => s.target !== side);
    run.battleState.effects = run.battleState.effects.filter(e => e.target !== side);
    run.stateVersion++;
    db.update(players).set({ health: run.battleState.hp[side], lastRegenTime: nowGameTime() }).where(eq(players.id, playerId)).run();
    db.update(eventPartyMembers).set({ status: 'left', endedAt: nowGameTime() }).where(and(eq(eventPartyMembers.partyId, run.partyId), eq(eventPartyMembers.playerId, playerId), eq(eventPartyMembers.status, 'active'))).run();
    clearGroupAction(playerId, run.id, 'GroupEvent');
    event(run.battleState, run.roundNumber, 'flee', run.battleState.hp, nowGameTime(), `${run.battleState.fighters[side].name} покидает группу`, side);
    if (!livingFighters(run.battleState, 0).length) finishGroupRun(run, 'defeat');
    else if (livingFighters(run.battleState, 0).every(i => run.battleState.choices[i])) advanceRound(run, false);
    else db.update(groupEventRuns).set(run).where(eq(groupEventRuns.id, run.id)).run();
    return run;
  });
}
export function expireGroupEvents(): number[] {
  const changed = new Set<number>();
  const now = nowGameTime();
  db.transaction(() => {
    for (const party of db.select().from(eventParties).where(eq(eventParties.status, 'forming')).all()) {
      const window = db.select().from(groupEventWindows).where(eq(groupEventWindows.id, party.eventWindowId)).get();
      if (!window || !windowDto(window).available || party.expiresAt <= now) { closeParty(party.id, 'expired'); changed.add(party.id); continue; }
      for (const m of db.select().from(eventPartyMembers).where(and(eq(eventPartyMembers.partyId, party.id), eq(eventPartyMembers.status, 'invited'))).all()) {
        if (m.inviteExpiresAt && m.inviteExpiresAt <= now) {
          db.update(eventPartyMembers).set({ status: 'expired', endedAt: now }).where(eq(eventPartyMembers.id, m.id)).run();
          resetPartyReady(party.id); changed.add(party.id);
          db.update(eventParties).set({ version: party.version + 1 }).where(eq(eventParties.id, party.id)).run();
        }
      }
    }
    for (const run of db.select().from(groupEventRuns).where(eq(groupEventRuns.status, 'active')).all()) {
      if (run.expiresAt <= now) { finishGroupRun(run, 'aborted'); changed.add(run.partyId); }
      else if (run.roundDeadlineAt <= now) { advanceRound(run, true); changed.add(run.partyId); }
    }
  });
  return [...changed];
}
