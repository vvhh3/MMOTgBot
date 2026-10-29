import type { FactionId, FactionLeaderboardEntry } from "@mmobot/shared";
import { useEffect, useState } from "react";
import { getFactionLeaderboard } from "../api";
import { factionRanking, type LeaderboardMetric, type LeaderboardMode } from "../ranking";
import LeaderboardPanel from "./LeaderboardPanel";

type FactionLeaderboardProps = {
  token: string | null;
  factionId: FactionId | null;
  onModeChange: (mode: LeaderboardMode) => void;
};

export default function FactionLeaderboard({ token, factionId, onModeChange }: FactionLeaderboardProps) {
  const [entries, setEntries] = useState<FactionLeaderboardEntry[]>([]);
  const [metric, setMetric] = useState<LeaderboardMetric>("members");
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let current = true;
    setError(null);
    if (!token) { setEntries([]); setLoading(false); return; }
    setLoading(true);
    getFactionLeaderboard(token)
      .then(result => { if (current) setEntries(result.entries); })
      .catch((err: unknown) => { if (current) setError(err instanceof Error ? err.message : "Не удалось загрузить группировки"); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [token, factionId, revision]);

  return <LeaderboardPanel
    mode="factions"
    onModeChange={onModeChange}
    entries={factionRanking(entries, metric, factionId)}
    hasIdentity={factionId !== null}
    metric={metric}
    onMetricChange={setMetric}
    loading={loading}
    error={error}
    onRefresh={() => setRevision(value => value + 1)}
    refreshDisabled={!token}
  />;
}
