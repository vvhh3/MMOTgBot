import type { ReactNode } from 'react';

type Place = { slot: number; member?: { name: string; image: string; hp: number; maxHp: number; pending: boolean; ready: boolean } };
export function PartySlotsView({ places, canInvite, onInvite, onOpenLobby, children, compactMemberInfo = false }: {
  places: Place[]; canInvite: boolean; onInvite: (slot: number) => void; onOpenLobby: () => void; children: ReactNode; compactMemberInfo?: boolean;
}) {
  const renderSlot = ({ slot, member }: Place) => <div className="party-side-slot" key={slot}>
    {member ? <button className={`party-companion${compactMemberInfo ? ' party-companion--compact' : ''}`} onClick={onOpenLobby} aria-label={`Участник группы: ${member.name}${compactMemberInfo ? member.pending ? ', ожидаем ответа' : `, здоровье ${member.hp} из ${member.maxHp}${member.ready ? ', готов' : ''}` : ''}`}>
      {compactMemberInfo ? <span className="party-companion-heading">
        <span className="party-companion-nickname" title={member.name}>{member.name}</span>
        {!member.pending && member.ready && <span className="party-companion-ready" aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 3 3 7-7" /></svg>
        </span>}
      </span> : <span>{member.name}</span>}
      {member.pending ? <small>Ожидаем ответа…</small> : <>
        {compactMemberInfo ? <span className="party-companion-hp" aria-hidden="true">
          <span style={{ width: `${Math.max(0, Math.min(100, member.maxHp > 0 ? member.hp / member.maxHp * 100 : 0))}%` }} />
        </span> : <small>{member.hp}/{member.maxHp} HP {member.ready ? '· Готов' : ''}</small>}
        <img src={member.image} alt={member.name} />
      </>}
    </button> : canInvite ? <button type="button" className="game-button game-button--icon party-add-button" onClick={() => onInvite(slot)} aria-label="Пригласить друга в группу">+</button> : null}
  </div>;
  return <div className="party-character-row">{renderSlot(places[0])}{children}{renderSlot(places[1])}</div>;
}
