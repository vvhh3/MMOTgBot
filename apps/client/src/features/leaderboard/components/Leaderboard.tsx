import type { FactionId,LeaderBoardToDto } from "@mmobot/shared";
import { Badge,Card,Heading,Table,Tabs,Text } from "@radix-ui/themes";
import { useEffect,useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getLeaderboard } from "../api";
import FactionLeaderboard from "./FactionLeaderboard";

type LeaderboardProps = {
  token: string | null;
  playerId: number | null;
  playerPoints: number;
  factionId: FactionId | null;
};

function PlayerLeaderboard({ token, playerId, playerPoints }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderBoardToDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    getLeaderboard(token)
      .then((result) => setEntries(result.entries))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Не удалось загрузить рейтинг"))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <main className="mx-auto w-full max-w-xl p-3">
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Heading size="4">Таблица лидеров</Heading>
          <Badge color="orange" size="1">Топ 10</Badge>
        </div>
        <Text as="p" size="2" className="mb-3">Ваши очки: <Text weight="bold" color="orange">{playerPoints}</Text></Text>
        {error && <Text color="red">{error}</Text>}
        {loading ? <Text color="gray">Загружаю рейтинг…</Text> : entries.length === 0 ? <Text color="gray">Пока нет игроков в рейтинге.</Text> : (
          <Table.Root size="1" layout="fixed">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell className="w-16 whitespace-nowrap">Место</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell className="min-w-0">Игрок</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell className="w-12 whitespace-nowrap">Ур.</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell className="w-16 whitespace-nowrap" justify="end">Очки</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {entries.map(({ player, points }, index) => (
                <Table.Row key={player.id} className={player.id === playerId ? "bg-orange-50" : undefined}>
                  <Table.RowHeaderCell className="w-16 whitespace-nowrap">{index + 1}</Table.RowHeaderCell>
                  <Table.Cell className="min-w-0 whitespace-normal break-words">{player.name}{player.id === playerId && <Text size="1" color="orange"> (вы)</Text>}</Table.Cell>
                  <Table.Cell className="w-12 whitespace-nowrap">{player.level}</Table.Cell>
                  <Table.Cell className="w-16 whitespace-nowrap" justify="end">{points}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </Card>
    </main>
  );
}

export default function Leaderboard(props: LeaderboardProps) {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "factions" ? "factions" : "players";
  return <Tabs.Root value={tab} onValueChange={(value) => setParams((previous) => {
    const next = new URLSearchParams(previous);
    next.set("tab", value);
    return next;
  }, { replace: true })}>
    <Tabs.List color="orange" className="justify-center" aria-label="Вид рейтинга">
      <Tabs.Trigger value="players">Игроки</Tabs.Trigger>
      <Tabs.Trigger value="factions">Группировки</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content value="players"><PlayerLeaderboard {...props} /></Tabs.Content>
    <Tabs.Content value="factions"><FactionLeaderboard token={props.token} factionId={props.factionId} /></Tabs.Content>
  </Tabs.Root>;
}
