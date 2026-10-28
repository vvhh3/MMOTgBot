import { and, eq, inArray } from 'drizzle-orm';
import type { db } from '../../database/connection.js';
import { eventParties, eventPartyMembers } from '../../database/schema.js';
import { GroupEventError } from './availability.js';

export type ParticipationDatabase = Pick<typeof db, 'select'>;
export function currentPartyMember(tx: ParticipationDatabase, playerId: number) {
  return tx.select({ member: eventPartyMembers, party: eventParties }).from(eventPartyMembers)
    .innerJoin(eventParties, eq(eventPartyMembers.partyId, eventParties.id))
    .where(and(eq(eventPartyMembers.playerId, playerId), inArray(eventPartyMembers.status, ['joined','active']), inArray(eventParties.status, ['forming','active']))).get();
}
export function assertOutsideParty(tx: ParticipationDatabase, playerId: number) {
  if (currentPartyMember(tx, playerId)) throw new GroupEventError('Сначала выйдите из группы, чтобы начать одиночное действие', 'PARTY_EXIT_REQUIRED');
}
export function isInGroupBattle(tx: ParticipationDatabase, playerId: number) {
  return currentPartyMember(tx, playerId)?.party.status === 'active';
}
