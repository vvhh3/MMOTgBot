import type { ReactNode } from 'react';

type Place = { slot: number; member?: { name: string; image: string; hp: number; maxHp: number; pending: boolean; ready: boolean } };
export function PartySlotsView({ places, canInvite, onInvite, onOpenLobby, children }: {
  places: Place[]; canInvite: boolean; onInvite: (slot: number) => void; onOpenLobby: () => void; children: ReactNode;
}) {
  const renderSlot = ({ slot, member }: Place) => <div className="party-side-slot" key={slot}>
    {member ? <button className="party-companion" onClick={onOpenLobby} aria-label={`Участник группы: ${member.name}`}>
      <span>{member.name}</span>
      {member.pending ? <small>Ожидаем ответа…</small> : <>
        <small>{member.hp}/{member.maxHp} HP {member.ready ? '· Готов' : ''}</small>
        <img src={member.image} alt={member.name} />
      </>}
    </button> : canInvite ? <button type="button" className="party-add-button" onClick={() => onInvite(slot)} aria-label="Пригласить друга в группу">+</button> : null}
  </div>;
  return <div className="party-character-row">{renderSlot(places[0])}{children}{renderSlot(places[1])}</div>;
}
