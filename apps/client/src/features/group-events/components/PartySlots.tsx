import type { ReactNode } from 'react';
import { getSkins } from '../../character/lib/skins';
import { useGroupEvent } from '../GroupEventProvider';
import { PartySlotsView } from './PartySlotsView';

export function PartySlots({ children }: { children: ReactNode }) {
  const { overview, player, available, openInvite, openLobby } = useGroupEvent();
  const party = overview?.party, me = party?.members.find(m => m.playerId === player?.id);
  const slots = [0,1,2].filter(slot => slot !== (me?.slot ?? 0));
  const places = slots.map(slot => {
    const member = party?.members.find(m => m.slot === slot);
    return { slot, member: member ? { name: member.name, image: getSkins(member.avatar), hp: member.hp, maxHp: member.maxHp,
      pending: member.status === 'invited', ready: member.ready } : undefined };
  });
  return <PartySlotsView compactMemberInfo places={places} canInvite={available && player?.currentLocationId === 'square' && party?.status !== 'active'} onInvite={openInvite} onOpenLobby={openLobby}>{children}</PartySlotsView>;
}
