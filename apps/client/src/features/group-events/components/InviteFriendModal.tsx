import type { FriendDto } from '@mmobot/shared';
import { useState } from 'react';
import LowerModal from '../../../shared/ui/modal/LowerModal';
import LevelBadge from '../../../shared/ui/LevelBadge';
import { useGroupEvent } from '../GroupEventProvider';

export function InviteFriendModal({ friends, slot, onClose }: { friends: FriendDto[]; slot?: number; onClose: () => void }) {
  const { overview, available, command } = useGroupEvent();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const invite = async (id: number) => {
    if (!available || busy || !overview?.event) return;
    setBusy(true); setError(null);
    try {
      const path = overview.party ? `/event-parties/${overview.party.id}/invite` : `/group-events/${overview.event.id}/parties`;
      await command(path, { targetId: id, slot }); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось пригласить друга'); }
    finally { setBusy(false); }
  };
  return <LowerModal title="Пригласить друга" error={error} onClose={busy ? () => undefined : onClose}>
    <p className="text-xs">Для участия друг должен быть в сети, на Площади и свободен от другого занятия.</p>
    {!available && <p role="status">Набор на событие уже закрыт.</p>}
    {!friends.length && <p>Список друзей пуст. Добавить друзей можно на экране «Команда».</p>}
    {friends.map(friend => {
      const invited = overview?.party?.members.some(m => m.playerId === friend.id);
      return <div className="game-card game-card--white flex items-center justify-between gap-3 p-3" key={friend.id}>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-semibold [overflow-wrap:anywhere]">{friend.name}</span>
          <LevelBadge level={friend.level} />
          <span className="game-badge self-start" data-tone={friend.online ? 'ready' : 'offline'}>{friend.online ? 'В сети' : 'Не в сети'}</span>
        </div>
        <button className="game-button" disabled={busy || !available || !friend.online || invited} onClick={() => void invite(friend.id)}>{invited ? 'В группе' : 'Пригласить'}</button>
      </div>;
    })}
  </LowerModal>;
}
