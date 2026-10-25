import { getFaction,type FactionId,type FactionLeaderboardEntry } from "@mmobot/shared";
import { Badge,Button,Card,Heading,Text } from "@radix-ui/themes";
import { useEffect,useState } from "react";
import { getFactionLeaderboard } from "../api";

export default function FactionLeaderboard({ token, factionId }: { token: string | null; factionId: FactionId | null }) {
  const [entries, setEntries] = useState<FactionLeaderboardEntry[]>([]);
  const [sort, setSort] = useState<"members" | "totalPoints">("members");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let current = true;
    if (!token) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    getFactionLeaderboard(token)
      .then((result) => { if (current) setEntries(result.entries); })
      .catch((err: unknown) => { if (current) setError(err instanceof Error ? err.message : "Не удалось загрузить группировки"); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [token, factionId, revision]);

  const ranked = [...entries].sort((a, b) => b[sort] - a[sort]
    || b[sort === "members" ? "totalPoints" : "members"] - a[sort === "members" ? "totalPoints" : "members"]
    || a.factionId.localeCompare(b.factionId));
  const total = entries.reduce((sum, entry) => sum + entry.members, 0);

  return <main className="mx-auto w-full max-w-xl p-3">
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Heading size="4">Группировки города</Heading>
        <Button variant="soft" color="orange" size="1" disabled={loading || !token} onClick={() => setRevision((value) => value + 1)}>Обновить</Button>
      </div>
      <Text as="p" size="2" color="gray" className="mb-3">Найди своих и следи за общим результатом.</Text>
      <label className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        Сортировка
        <select value={sort} onChange={(event) => setSort(event.target.value === "totalPoints" ? "totalPoints" : "members")} className="rounded-lg border border-gray-300 bg-transparent px-3 py-2">
          <option value="members">По численности</option>
          <option value="totalPoints">По общим очкам</option>
        </select>
      </label>
      {loading ? <p role="status" className="py-4 text-sm text-gray-500">Загружаю группировки…</p>
        : error ? <p role="alert" className="py-4 text-sm text-red-600">{error}</p>
        : <>
          {total === 0 && <Text as="p" size="2" className="mb-3">Пока никто не вступил. Группировки ждут первых участников</Text>}
          <ol className="flex flex-col gap-2">
            {ranked.map((entry, index) => {
              const faction = getFaction(entry.factionId)!;
              const own = entry.factionId === factionId;
              const previous = ranked[index - 1];
              const tied = previous?.[sort] === entry[sort];
              const rank = tied ? ranked.findIndex((other) => other[sort] === entry[sort]) + 1 : index + 1;
              return <li key={entry.factionId} className="rounded-xl border p-3" style={{ borderColor: own ? faction.color : "#d1d5db", backgroundColor: own ? `${faction.color}0d` : "transparent" }}>
                <div className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-center text-sm font-bold text-gray-500">{rank}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Text weight="bold" size="2">{faction.name}</Text>
                      {own && <Badge color="orange" size="1">Вы здесь</Badge>}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
                  <span className={sort === "members" ? "font-bold" : "text-gray-500"}>Участники: {entry.members}</span>
                  <span className={sort === "totalPoints" ? "font-bold" : "text-gray-500"}>Очки: {entry.totalPoints}</span>
                </div>
              </li>;
            })}
          </ol>
        </>}
    </Card>
  </main>;
}
