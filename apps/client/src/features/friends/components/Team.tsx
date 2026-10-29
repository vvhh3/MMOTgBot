import type { FriendDto, FriendRequestDto, FriendsOverviewResponse, PlayerDto } from "@mmobot/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { getFriends, removeFriend, respondFriendRequest, searchFriends, sendFriendRequest } from "../api";
import FriendsPanel from "./FriendsPanel";

type TeamProps = {
  token: string | null;
  player: PlayerDto | null;
  liveOverview?: FriendsOverviewResponse | null;
};

const emptyOverview: FriendsOverviewResponse = { friends: [], requests: [] };

export default function Team({ token, player, liveOverview }: TeamProps) {
  const [overview, setOverview] = useState(liveOverview ?? emptyOverview);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FriendDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(!liveOverview && !!token);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const overviewVersion = useRef(0);
  const searchVersion = useRef(0);
  const sessionVersion = useRef(0);
  const actionPending = useRef(false);

  const reload = useCallback(async () => {
    const version = ++overviewVersion.current;
    if (!token) { setOverview(emptyOverview); setLoading(false); return; }
    setLoading(true);
    try {
      const data = await getFriends(token);
      if (version === overviewVersion.current) setOverview(data);
    } catch (e) {
      if (version === overviewVersion.current) setError(e instanceof Error ? e.message : "Не удалось загрузить друзей");
    } finally {
      if (version === overviewVersion.current) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!liveOverview) return;
    overviewVersion.current++;
    setOverview(liveOverview);
    setLoading(false);
  }, [liveOverview]);

  useEffect(() => {
    setQuery(""); setResults(null); setError(null); setSearchError(null); setNotice(""); setSearching(false);
    actionPending.current = false; setBusy(false);
    void reload();
    return () => { overviewVersion.current++; searchVersion.current++; sessionVersion.current++; };
  }, [reload]);

  const changeQuery = (value: string) => {
    searchVersion.current++;
    setQuery(value); setResults(null); setSearchError(null); setSearching(false);
  };

  const doSearch = async () => {
    if (!token) return;
    const version = ++searchVersion.current;
    const code = query.trim().replace(/^#/, "");
    setResults(null); setSearchError(null); setSearching(false);
    if (!/^\d+$/.test(code)) { setSearchError("Введите цифровой код друга."); return; }
    if (Number(code) === player?.friendId) { setSearchError("Это ваш код. Введите код друга."); return; }
    setSearching(true);
    try {
      const data = await searchFriends(token, code);
      if (version === searchVersion.current) setResults(data.players);
    } catch (e) {
      if (version === searchVersion.current) setSearchError(e instanceof Error ? e.message : "Ошибка поиска");
    } finally {
      if (version === searchVersion.current) setSearching(false);
    }
  };

  const perform = async (action: () => Promise<unknown>, message: string, onSuccess?: () => void) => {
    if (!token || actionPending.current) return;
    const session = sessionVersion.current;
    actionPending.current = true;
    setBusy(true); setError(null); setNotice("");
    try {
      await action();
      if (session !== sessionVersion.current) return;
      onSuccess?.();
      setNotice(message);
      await reload();
    } catch (e) {
      if (session === sessionVersion.current) setError(e instanceof Error ? e.message : "Не удалось выполнить действие");
    } finally {
      if (session === sessionVersion.current) { actionPending.current = false; setBusy(false); }
    }
  };

  const add = (person: FriendDto) => {
    if (!token) return;
    void perform(() => sendFriendRequest(token, person.friendId), "Заявка отправлена", () => changeQuery(""));
  };
  const respond = (request: FriendRequestDto, accept: boolean) => {
    if (!token) return;
    void perform(() => respondFriendRequest(token, request.id, accept), accept ? `${request.name} теперь в друзьях` : "Заявка отклонена");
  };
  const remove = (person: FriendDto) => {
    if (!token) return;
    void perform(() => removeFriend(token, person.id), `${person.name} удалён из друзей`);
  };
  const cancel = (request: FriendRequestDto) => {
    if (!token) return;
    void perform(() => removeFriend(token, request.playerId), "Заявка отменена");
  };
  const copyCode = async () => {
    if (player?.friendId == null) return;
    try { await navigator.clipboard.writeText(String(player.friendId)); setNotice("Код дружбы скопирован"); }
    catch { setNotice(`Ваш код дружбы: ${player.friendId}`); }
  };

  return <div className="mx-auto w-full max-w-[600px] px-3 pb-3">
    <FriendsPanel
      friendCode={player?.friendId ?? null}
      overview={overview}
      loading={loading}
      busy={busy}
      disabled={!token}
      error={error}
      notice={notice}
      search={{ query, results, loading: searching, error: searchError, onChange: changeQuery, onSubmit: () => void doSearch() }}
      onCopy={() => void copyCode()}
      onAdd={add}
      onRespond={respond}
      onRemove={remove}
      onCancel={cancel}
    />
  </div>;
}
