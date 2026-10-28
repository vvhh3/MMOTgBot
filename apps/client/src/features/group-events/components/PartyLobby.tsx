import { useState } from 'react';
import LowerModal from '../../../shared/ui/modal/LowerModal';
import { useGroupEvent } from '../GroupEventProvider';

export function PartyLobby({ onClose }: { onClose: () => void }) {
  const { overview, player, available, command, openInvite, runSolo } = useGroupEvent();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const party = overview?.party, me = party?.members.find(m => m.playerId === player?.id);
  const leader = party?.leaderPlayerId === player?.id;
  const confirmed = party?.members.filter(m => m.status === 'joined') ?? [];
  const execute = async (action: string, body: Record<string, unknown> = {}) => {
    if (!party || busy) return;
    setBusy(true); setError(null);
    try { await command(`/event-parties/${party.id}/${action}`, body); if (action === 'start') onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось обновить группу'); }
    finally { setBusy(false); }
  };
  return <LowerModal title="Особая прогулка с компанией" error={error} onClose={onClose}>
    {!available && <p>Сейчас набор закрыт.{overview?.event?.enabled && Date.parse(overview.event.startsAt) > Date.now() ? ` Начало: ${new Date(overview.event.startsAt).toLocaleString('ru-RU')}.` : ''}</p>}
    {!party ? <><p>Соберите трёх участников. Пригласите друзей через «+» рядом с персонажем.</p>
      {available && <button className="top-glass-button" onClick={() => { onClose(); openInvite(); }}>Пригласить друга</button>}</> : <>
      <p>Участники: {confirmed.length}/3 · Готовы: {confirmed.filter(m => m.ready).length}/3</p>
      {party.members.map(m => <div className="group-friend-row" key={m.id}>
        <span>{m.name}{m.playerId === party.leaderPlayerId ? ' · Лидер' : ''}<small>{m.status === 'invited' ? 'Ожидаем ответа' : !m.online ? 'Не в сети' : m.ready ? 'Готов' : 'Не готов'}</small></span>
        {(leader && m.playerId !== player?.id) && <button className="top-glass-button" disabled={busy} onClick={() => void execute('remove', { memberId: m.id })}>{m.status === 'invited' ? 'Отменить' : 'Исключить'}</button>}
      </div>)}
      {party.members.length < 3 && available && <button className="top-glass-button" onClick={() => { onClose(); openInvite(); }}>Пригласить друга</button>}
      <button className="top-glass-button" disabled={busy || !available} onClick={() => void execute('ready', { ready: !me?.ready })}>{me?.ready ? 'Я не готов' : 'Я готов'}</button>
      {leader && <button className="top-glass-button" disabled={busy || !available || confirmed.length !== 3 || confirmed.some(m => !m.ready || !m.online)} onClick={() => void execute('start')}>Начать зачистку</button>}
      <button className="top-glass-button" disabled={busy} onClick={() => void runSolo('продолжить без группы', async () => onClose())}>Выйти из группы</button>
    </>}
  </LowerModal>;
}
