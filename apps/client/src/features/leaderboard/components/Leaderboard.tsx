import type { FactionId, LeaderBoardToDto } from "@mmobot/shared";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getLeaderboard } from "../api";
import { playerRanking, type LeaderboardMode } from "../ranking";
import FactionLeaderboard from "./FactionLeaderboard";
import LeaderboardPanel from "./LeaderboardPanel";

type LeaderboardProps = {
  token: string | null;
  playerId: number | null;
  playerPoints: number;
  factionId: FactionId | null;
};

function PlayerLeaderboard({ token, playerId, playerPoints, onModeChange }: LeaderboardProps & { onModeChange: (mode: LeaderboardMode) => void }) {
  const [entries, setEntries] = useState<LeaderBoardToDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!token);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let current = true;
    setError(null);
    if (!token) { setEntries([]); setLoading(false); return; }
    setLoading(true);
    getLeaderboard(token)
      .then(result => { if (current) setEntries(result.entries); })
      .catch((err: unknown) => { if (current) setError(err instanceof Error ? err.message : "Не удалось загрузить рейтинг"); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [token, revision]);

  return <LeaderboardPanel
    mode="players"
    onModeChange={onModeChange}
    entries={playerRanking(entries, playerId)}
    hasIdentity={playerId !== null}
    playerPoints={playerId === null ? null : playerPoints}
    loading={loading}
    error={error}
    onRefresh={() => setRevision(value => value + 1)}
    refreshDisabled={!token}
  />;
}

export default function Leaderboard(props: LeaderboardProps) {
  const [params, setParams] = useSearchParams();
  const mode = params.get("tab") === "factions" ? "factions" : "players";
  const root = useRef<HTMLElement>(null);
  const previousMode = useRef(mode);
  useEffect(() => {
    if (previousMode.current === mode) return;
    previousMode.current = mode;
    root.current?.querySelector<HTMLButtonElement>('[aria-label="Вид рейтинга"] button[aria-pressed="true"]')?.focus({ preventScroll: true });
  }, [mode]);
  const changeMode = (value: LeaderboardMode) => setParams(previous => {
    const next = new URLSearchParams(previous);
    next.set("tab", value);
    return next;
  }, { replace: true });

  return <main ref={root} className="mx-auto w-full max-w-[600px] px-3 pb-3">
    {mode === "players" ? <PlayerLeaderboard {...props} onModeChange={changeMode} />
      : <FactionLeaderboard token={props.token} factionId={props.factionId} onModeChange={changeMode} />}
  </main>;
}
