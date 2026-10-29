import { useState } from 'react';
import { useGroupEvent } from '../GroupEventProvider';

export function PartyInviteNotification() {
  const { overview, command } = useGroupEvent();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const respond = async (partyId: number, accept: boolean) => {
    if (busy) return; setBusy(true); setError(null);
    try { await command(`/event-parties/${partyId}/respond`, { accept }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Ошибка ответа'); }
    finally { setBusy(false); }
  };
  return <>{overview?.invites.map(invite => <div className="flex flex-col gap-2" key={invite.id}>
    <p className="text-xs">{invite.fromName} приглашает вас на особую прогулку втроём!</p>
    <div className="flex gap-2"><button className="game-button flex-1" disabled={busy} onClick={() => void respond(invite.partyId, true)}>Принять</button>
      <button className="game-button game-button--danger flex-1" disabled={busy} onClick={() => void respond(invite.partyId, false)}>Отклонить</button></div>
  </div>)}{error && <p role="alert" className="text-xs text-red-600">{error}</p>}</>;
}
