import type { FriendsOverviewResponse, GroupEventOverview, InventoryItemDto, PlayerDto } from '@mmobot/shared';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../shared/api/http';
import { connectSocket } from '../../shared/api/socket';
import CenterModal from '../../shared/ui/modal/CenterModal';
import { getMe } from '../character/api';
import { getFriends } from '../friends/api';
import { enterLocation } from '../locations/api';
import { getGroupEvent, groupCommand } from './api';
import { eventIsOpen, newerGroupState } from './lib/state';
import { InviteFriendModal } from './components/InviteFriendModal';
import { PartyLobby } from './components/PartyLobby';

type SoloIntent = { label: string; partyId: number; runId: number | null; action: () => Promise<unknown> };
type GroupContext = {
  overview: GroupEventOverview | null; player: PlayerDto | null; token: string | null; available: boolean;
  openInvite: (slot?: number) => void; openLobby: () => void;
  command: (path: string, body?: Record<string, unknown>) => Promise<GroupEventOverview>;
  refresh: () => Promise<GroupEventOverview | null>;
  runSolo: (label: string, action: () => Promise<unknown>) => Promise<boolean>;
};
const Context = createContext<GroupContext | null>(null);
export function useGroupEvent() {
  const context = useContext(Context);
  if (!context) throw new Error('GroupEventProvider missing');
  return context;
}
export function GroupEventProvider({ token, player, onPlayer, onInventory, children }: {
  token: string | null; player: PlayerDto | null; onPlayer: (p: PlayerDto) => void;
  onInventory: (i: InventoryItemDto[]) => void; children: ReactNode;
}) {
  const tokenRef = useRef(token); tokenRef.current = token;
  const [overview, setOverview] = useState<GroupEventOverview | null>(null);
  const current = useRef(overview); current.current = overview;
  const clockOffset = useRef(0);
  const [now, setNow] = useState(Date.now());
  const [inviteOpen, setInviteOpen] = useState(false), [lobbyOpen, setLobbyOpen] = useState(false);
  const [inviteSlot, setInviteSlot] = useState<number | undefined>();
  const [friends, setFriends] = useState<FriendsOverviewResponse['friends']>([]);
  const [intent, setIntent] = useState<SoloIntent | null>(null);
  const leaving = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const navigate = useNavigate(), { pathname } = useLocation();
  const apply = useCallback((next: GroupEventOverview) => setOverview(old => {
    const accepted = newerGroupState(old, next);
    if (accepted === next && next.event) clockOffset.current = Date.parse(next.event.serverTime) - Date.now();
    current.current = accepted;
    return accepted;
  }), []);
  const refresh = useCallback(async () => {
    if (!token) return null;
    const next = await getGroupEvent(token);
    if (tokenRef.current !== token) return null;
    apply(next); return next;
  }, [token, apply]);
  const command = useCallback(async (path: string, body: Record<string, unknown> = {}) => {
    if (!token) throw new Error('Войдите в игру');
    const next = await groupCommand(token, path, body);
    if (tokenRef.current !== token) throw new Error('Сессия изменилась. Повторите действие.');
    apply(next); return next;
  }, [token, apply]);
  useEffect(() => {
    setOverview(null); setIntent(null); setInviteOpen(false); setLobbyOpen(false); setFriends([]); setError(null);
    clockOffset.current = 0;
    if (!token) return;
    let cancelled = false;
    const socket = connectSocket(token, false);
    const receive = (next: GroupEventOverview) => { if (!cancelled) apply(next); };
    const load = () => { void getGroupEvent(token).then(receive).catch(() => undefined); };
    socket.on('groupEventUpdate', receive); socket.on('connect', load);
    const location = () => load(); socket.on('locationState', location);
    window.addEventListener('online', load); window.addEventListener('focus', load);
    load(); const timer = window.setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(timer); socket.off('groupEventUpdate', receive); socket.off('connect', load); socket.off('locationState', location); window.removeEventListener('online', load); window.removeEventListener('focus', load); };
  }, [token, apply]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (overview?.run?.status === 'active' && pathname !== '/GroupEvent') navigate('/GroupEvent', { replace: true });
  }, [overview?.run?.id, overview?.run?.status, pathname, navigate]);
  const restoredLobby = useRef<number | null>(null);
  useEffect(() => {
    if (!token || !player || overview?.party?.status !== 'forming' || restoredLobby.current === overview.party.id) return;
    restoredLobby.current = overview.party.id;
    if (player.currentLocationId !== 'square') void enterLocation(token, 'square').then(d => onPlayer(d.player)).catch(() => { restoredLobby.current = null; });
  }, [token, player?.id, player?.currentLocationId, overview?.party?.id, overview?.party?.status, overview?.revision, onPlayer]);
  const runSolo = async (label: string, action: () => Promise<unknown>) => {
    let latest: GroupEventOverview | null;
    try { latest = await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось проверить группу'); return false; }
    if (latest?.party) { setError(null); setIntent({ label, action, partyId: latest.party.id, runId: latest.party.status === 'active' ? latest.party.runId : null }); return false; }
    try { await action(); return true; }
    catch (e) {
      if (e instanceof ApiError && e.code === 'PARTY_EXIT_REQUIRED') {
        const state = await refresh();
        if (state?.party) { setError(null); setIntent({ label, action, partyId: state.party.id, runId: state.party.status === 'active' ? state.party.runId : null }); return false; }
      }
      throw e;
    }
  };
  const confirmLeave = async () => {
    if (!intent || leaving.current || !token) return;
    leaving.current = true;
    setBusy(true); setError(null);
    try {
      const latest = await refresh();
      const actualRunId = latest?.party?.status === 'active' ? latest.party.runId : null;
      if (latest?.party && (latest.party.id !== intent.partyId || actualRunId !== intent.runId)) {
        setIntent({ ...intent, partyId: latest.party.id, runId: actualRunId });
        setError('Состояние группы изменилось. Проверьте условия выхода и подтвердите ещё раз.'); return;
      }
      if (latest?.party) await command(intent.runId ? `/group-event-runs/${intent.runId}/leave` : `/event-parties/${intent.partyId}/leave`);
      const me = await getMe(token); onPlayer(me.player); onInventory(me.inventory);
      setIntent(null); await intent.action();
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось выйти из группы'); }
    finally { leaving.current = false; setBusy(false); }
  };
  const openInvite = (slot?: number) => {
    setInviteSlot(slot);
    if (!token || !eventIsOpen(current.current?.event, Date.now() + clockOffset.current)) return;
    setError(null); setInviteOpen(true);
    void getFriends(token).then(data => setFriends(data.friends)).catch(e => setError(e.message));
  };
  return <Context.Provider value={{ overview, token, player, available: eventIsOpen(overview?.event, now + clockOffset.current), openInvite, openLobby: () => setLobbyOpen(true), command, refresh, runSolo }}>
    {children}
    {inviteOpen && <InviteFriendModal slot={inviteSlot} friends={friends} onClose={() => setInviteOpen(false)} />}
    {lobbyOpen && <PartyLobby onClose={() => setLobbyOpen(false)} />}
    {intent && <CenterModal title="Выход из группы" onClose={busy ? undefined : () => { setIntent(null); setError(null); }}>
      <p className="text-sm">Вы состоите в группе. Чтобы {intent.label}, сначала выйдите из группы.</p>
      {intent.runId ? <p className="mt-2 text-sm">Вы покинете начатое событие и не получите награду за его завершение.</p>
        : overview?.party?.leaderPlayerId === player?.id && <p className="mt-2 text-sm">Вы — лидер. Выход распустит группу.</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex gap-2"><button className="top-glass-button flex-1" disabled={busy} onClick={() => { setIntent(null); setError(null); }}>Остаться в группе</button>
        <button className="top-glass-button flex-1" disabled={busy} onClick={() => void confirmLeave()}>{busy ? 'Выходим…' : 'Выйти и продолжить'}</button></div>
    </CenterModal>}
    {!intent && error && <CenterModal title="Сообщение" onClose={() => setError(null)}><p role="alert">{error}</p></CenterModal>}
  </Context.Provider>;
}
