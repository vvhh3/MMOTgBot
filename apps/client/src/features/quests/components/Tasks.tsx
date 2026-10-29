import type { PlayerDto,PlayerQuestDto,QuestsDifficulty,QuestsObjectiveType } from "@mmobot/shared";
import { Box,Button,Card,Grid,Progress,Tabs,Text } from "@radix-ui/themes";
import { useEffect,useRef,useState } from "react";
import { claimQuest,getDailyQuests } from "../api";

import EnterAnimation from "../../../shared/ui/animations/EnterAnimation";
import { useQuestClaimAnimation } from "../hooks/useQuestClaimAnimation";

const DIFFICULTY_LABEL: Record<QuestsDifficulty, string> = {
  easy: "Лёгкий",
  medium: "Средний",
  hard: "Тяжёлый"
};

const OBJECTIVE_LABEL: Record<QuestsObjectiveType, string> = {
  kill: "убийств",
  walk: "прогулок",
  collect: "предметов",
  visit: "посещений",
  loot: "трофеев с монстров",
  casino_win: "монет прибыли"
};

type TasksProps = {
  token: string | null
  onPlayer?: (player: PlayerDto) => void
}

export default function Tasks({ token, onPlayer }: TasksProps) {
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

  const { scope, completedTabRef, flyToCompleted } = useQuestClaimAnimation();
  const claimInFlight = useRef(false);
  const [claimingId, setClaimingId] = useState<number | null>(null);

  const onClaim = async (id: number, card: HTMLDivElement) => {
    if (!token || claimInFlight.current) return;
    claimInFlight.current = true;
    setClaimingId(id);
    setError(null);
    try {
      const res = await claimQuest(token, id);
      if (res.player) onPlayer?.(res.player);
      try {
        await flyToCompleted(card);
      } finally {
        // Сохраняем результат даже при прерывании анимации.
        setQuests((current) => current.map((q) => q.id === id ? { ...q, status: "claimed" } : q));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Не удалось забрать награду");
    } finally {
      claimInFlight.current = false;
      setClaimingId(null);
    }
  };

  return (
    <div ref={scope} className="h-full">
      {error && (
        <div className="mx-auto mb-4 rounded-lg border border-error-border bg-error-bg p-3 text-error-text">
          {error}
        </div>
      )}
      <Tabs.Root defaultValue="active" className="flex flex-col items-center">
        <Tabs.List color="orange" size="2" className="flex w-full max-w-150 justify-center" style={{ justifyContent: "center" }}>
          <Tabs.Trigger className="w-1/2" value="active">Активные</Tabs.Trigger>
          <Tabs.Trigger ref={completedTabRef} className="w-1/2" value="claimed">Выполненные</Tabs.Trigger>
        </Tabs.List>
        <Box pt="3">
          <Tabs.Content value="active">
            <Grid columns="1" rows="1" gap="3" className="flex flex-col px-5 pb-5">
              {active.length === 0 && <Text color="gray">Сегодня квестов нет</Text>}
              {active.map((q) => <QuestCard key={q.id} quest={q} claiming={claimingId === q.id || !token} onClaim={onClaim} />)}
            </Grid>
          </Tabs.Content>
          <Tabs.Content value="claimed">
            <Grid columns="1" rows="1" gap="3" className="flex flex-col px-5 pb-5">
              {claimed.length === 0 && <Text color="gray">Выполненных квестов нет</Text>}
              {claimed.map((q) => <QuestCard key={q.id} quest={q} claiming={claimingId === q.id || !token} onClaim={onClaim} />)}
            </Grid>
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </div>
  );
}

export function QuestCard({ quest, claiming, onClaim }: {
  quest: PlayerQuestDto;
  claiming: boolean;
  onClaim: (id: number, card: HTMLDivElement) => Promise<void>;
}) {
    const cardRef = useRef<HTMLDivElement>(null);
    const percent = Math.round((quest.progress / quest.quest.targetCount) * 100);
    const completed = quest.status === "completed";
    return (
      <EnterAnimation>
        <Card ref={cardRef} className="game-card quest-card">
        <div className="flex flex-col gap-1.5">
          <div className="quest-card-header flex items-start justify-between gap-2.5">
            <Text as="div" size="3" weight="bold">
              {quest.quest.title}
            </Text>
            <div data-difficulty={quest.quest.difficulty} className="quest-difficulty">
              <p>{DIFFICULTY_LABEL[quest.quest.difficulty]}</p>
            </div>
          </div>
          <Text as="div" color="gray" size="2">
            {quest.quest.description}
          </Text>
          <div className="flex flex-wrap items-center justify-between gap-2 ">
            <Text as="div" color="gray" size="1">
              {OBJECTIVE_LABEL[quest.quest.objectiveType]} {quest.progress}/{quest.quest.targetCount} · +{quest.quest.targetXp} опыта · +{quest.quest.targetPoints} очков · +{quest.quest.targetCoins} монет
            </Text>

          </div>
          <Box>
            <Progress color={completed ? "green" : "orange"} value={percent} />
          </Box>
          <div className="w-full flex justify-end">
            {completed && (
              <Button className="game-button game-button--xs quest-claim-button"  size="1" disabled={claiming} onClick={() => { if (cardRef.current) void onClaim(quest.id, cardRef.current); }}>
                Забрать награду
              </Button>
            )}
          </div>
        </div>
      </Card>
      </EnterAnimation>

    );
  };

