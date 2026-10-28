import { battleStatusViews, type EventPartyDto, type GroupEventOverview, type GroupEventStateDto } from '@mmobot/shared';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { eventParties, eventPartyMembers, groupEventRewards, groupEventRuns, players, type GroupEventRunRow } from '../../database/schema.js';
import { isPlayerOnline } from '../../infrastructure/realtime/socket-server.js';
import { nowGameTime } from '../../shared/time.js';
import { currentGroupEvent, eventUtc, GroupEventError } from './availability.js';
import { currentPartyMember } from './participation.js';

export function groupRunDto(run: GroupEventRunRow, playerId: number): GroupEventStateDto {
  const state = run.battleState, side = state.fighters.findIndex(f => f.playerId === playerId);
  if (side < 0) throw new GroupEventError('Прохождение не найдено', 'RUN_NOT_FOUND', 404);
  const statuses = battleStatusViews(state, run.roundNumber);
  const reward = db.select().from(groupEventRewards).where(and(eq(groupEventRewards.runId, run.id), eq(groupEventRewards.playerId, playerId))).get();
  return { id: run.id, partyId: run.partyId, status: run.status, wave: run.waveNumber, totalWaves: run.configSnapshot.waves.length,
    round: run.roundNumber, stateVersion: run.stateVersion, deadline: eventUtc(run.roundDeadlineAt), serverTime: eventUtc(nowGameTime()),
    myFighterId: state.fighters[side].id,
    fighters: state.fighters.map((f, i) => ({ id: f.id, index: i, playerId: f.playerId, name: f.name, avatar: f.avatar, team: f.team,
      hp: state.hp[i], maxHp: f.maxHp, left: !!f.left, submitted: !!state.choices[i], statuses: statuses[i], wave: f.wave }))
      .filter(f => f.team === 0 || f.wave === run.waveNumber),
    moves: state.fighters[side].moves.filter(m => m.itemType === undefined).map(m => ({ ...m, availableFromRound: state.cooldowns[side][m.id] ?? 1 })),
    actionSubmitted: !!state.choices[side], healingAvailable: state.healingUsed[side] < 1,
    events: state.events, reward: reward ? { xp: reward.xp, points: reward.points, coins: reward.coins, items: reward.items } : null };
}
export function partyDto(id: number): EventPartyDto | null {
  const party = db.select().from(eventParties).where(eq(eventParties.id, id)).get();
  if (!party) return null;
  const run = db.select({ id: groupEventRuns.id }).from(groupEventRuns).where(eq(groupEventRuns.partyId, id)).get();
  const members = db.select({ member: eventPartyMembers, player: players }).from(eventPartyMembers)
    .innerJoin(players, eq(players.id, eventPartyMembers.playerId)).where(and(eq(eventPartyMembers.partyId, id), inArray(eventPartyMembers.status, ['invited','joined','active']))).orderBy(eventPartyMembers.slot).all();
  return { id: party.id, eventWindowId: party.eventWindowId, leaderPlayerId: party.leaderPlayerId, version: party.version, status: party.status,
    runId: run?.id ?? null, members: members.map(({ member: m, player: p }) => ({ id: m.id, playerId: p.id, name: p.name, avatar: p.avatar,
      hp: p.health, maxHp: p.maxHealth, slot: m.slot, status: m.status, ready: m.ready, online: isPlayerOnline(p.id) })) };
}
let revision = 0;
export function groupOverview(playerId: number): GroupEventOverview {
  const membership = currentPartyMember(db, playerId);
  const invites = db.select({ member: eventPartyMembers, party: eventParties }).from(eventPartyMembers)
    .innerJoin(eventParties, eq(eventParties.id, eventPartyMembers.partyId))
    .where(and(eq(eventPartyMembers.playerId, playerId), eq(eventPartyMembers.status, 'invited'), eq(eventParties.status, 'forming'))).all()
    .map(({ member: m }) => {
      const from = db.select().from(players).where(eq(players.id, m.invitedByPlayerId!)).get();
      return { id: m.id, partyId: m.partyId, fromName: from?.name ?? 'Друг', expiresAt: eventUtc(m.inviteExpiresAt!) };
    });
  const last = membership ?? (() => {
    const m = db.select().from(eventPartyMembers).where(and(eq(eventPartyMembers.playerId, playerId), eq(eventPartyMembers.status, 'finished'))).orderBy(desc(eventPartyMembers.id)).get();
    return m ? { member: m, party: db.select().from(eventParties).where(eq(eventParties.id, m.partyId)).get()! } : null;
  })();
  const run = last ? db.select().from(groupEventRuns).where(eq(groupEventRuns.partyId, last.party.id)).get() : null;
  revision = Math.max(revision + 1, Date.now() * 1000);
  return { revision, event: currentGroupEvent(), party: membership ? partyDto(membership.party.id) : null, invites,
    run: run ? groupRunDto(run, playerId) : null };
}
