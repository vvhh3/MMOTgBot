import { useEffect, useState } from "react";
import { Tabs, Text, Box, Grid, Card, Progress, Flex, Button } from "@radix-ui/themes";
import type { PlayerQuestDto, QuestsDifficulty } from "@mmobot/shared";
import { claimQuest, getDailyQuests } from "../api";

const DIFFICULTY_LABEL: Record<QuestsDifficulty, string> = {
  easy: "Лёгкий",
  medium: "Средний",
  hard: "Тяжёлый"
};

const OBJECTIVE_LABEL: Record<string, string> = {
  kill: "убийств",
  walk: "прогулок",
  collect: "предметов",
  visit: "посещений"
};

export default function Tasks({ token }: { token: string | null }) {
  const [quests, setQuests] = useState<PlayerQuestDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!token) return;
    getDailyQuests(token)
      .then((data) => setQuests(data.quests))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Не удалось загрузить квесты"));
  };

  useEffect(load, [token]);

  const active = quests.filter((q) => q.status !== "claimed");
  const claimed = quests.filter((q) => q.status === "claimed");

  const onClaim = async (id: number) => {
    if (!token) return;
    try {
      await claimQuest(token, id);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Не удалось забрать награду");
    }
  };

  const QuestCard = ({ quest }: { quest: PlayerQuestDto }) => {
    const percent = Math.round((quest.progress / quest.quest.targetCount) * 100);
    const completed = quest.status === "completed";
    return (
      <Card>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-row justify-between">
            <Text as="div" size="3" weight="bold">
              {quest.quest.title}
            </Text>
            <div className="pl-1 pr-1 bg-[#E8603C] text-[#ffff] h-[21px] min-w-[80px] text-[8px] flex justify-center items-center font-extrabold rounded-[10px]">
              <p>{DIFFICULTY_LABEL[quest.quest.difficulty]}</p>
            </div>
          </div>
          <Text as="div" color="gray" size="2">
            {quest.quest.description}
          </Text>
          <div className="flex flex-row justify-between">
            <Text as="div" color="gray" size="1">
              {OBJECTIVE_LABEL[quest.quest.objectiveType]} {quest.progress}/{quest.quest.targetCount} · +{quest.quest.targetXp} опыта · +{quest.quest.targetPoints} очков
            </Text>
            {completed && (
              <Button size="1" color="orange" onClick={() => onClaim(quest.id)}>
                Забрать награду
              </Button>
            )}
          </div>
          <Box>
            <Progress color={completed ? "green" : "orange"} value={percent} />
          </Box>
        </div>
      </Card>
    );
  };

  return (
    <div className="h-full">
      {error && (
        <div className="mx-auto mb-4 rounded-lg border border-error-border bg-error-bg p-3 text-error-text">
          {error}
        </div>
      )}
      <Tabs.Root defaultValue="active" className="flex flex-col items-center">
        <Tabs.List color="orange" size="2" className="flex w-full max-w-[600px] justify-center" style={{ justifyContent: "center" }}>
          <Tabs.Trigger className="w-1/2" value="active">Активные</Tabs.Trigger>
          <Tabs.Trigger className="w-1/2" value="claimed">Выполненные</Tabs.Trigger>
        </Tabs.List>
        <Box pt="3">
          <Tabs.Content value="active">
            <Grid columns="1" rows="1" gap="3" style={{ padding: "20px", paddingTop: "0px", display: "flex", flexDirection: "column" }}>
              {active.length === 0 && <Text color="gray">Сегодня квестов нет</Text>}
              {active.map((q) => <QuestCard key={q.id} quest={q} />)}
            </Grid>
          </Tabs.Content>
          <Tabs.Content value="claimed">
            <Grid columns="1" rows="1" gap="3" style={{ padding: "20px", paddingTop: "0px", display: "flex", flexDirection: "column" }}>
              {claimed.length === 0 && <Text color="gray">Выполненных квестов нет</Text>}
              {claimed.map((q) => <QuestCard key={q.id} quest={q} />)}
            </Grid>
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </div>
  );
}