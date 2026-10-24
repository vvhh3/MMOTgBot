import type { ReactNode } from "react";
import { Card, Grid, Progress, Text } from "@radix-ui/themes";
import DamageEffect from "./animations/DamageEffect";

type Fighter = {
  name: string;
  hp: number;
  maxHp: number;
  image: string;
  mirrored?: boolean;
  maxImageWidth?: number;
};

type BattleAction = {
  label: string;
  disabled: boolean;
  onClick: () => void;
};

type BattleScreenProps = {
  battleId: string;
  background: string;
  player: Fighter;
  opponent: Fighter;
  error?: string | null;
  status?: ReactNode;
  actions: {
    attack: BattleAction;
    inventory: BattleAction;
    leave: BattleAction;
    extra?: BattleAction;
  } | null;
  children?: ReactNode;
};

// Общая разметка боя. Очерёдность ходов и запросы остаются в компонентах PvE и PvP.
export default function BattleScreen({ battleId, background, player, opponent, error, status, actions, children }: BattleScreenProps) {
  const fighters = [player, opponent];
  const healthPercent = (fighter: Fighter) => fighter.maxHp > 0
    ? Math.max(0, Math.min(100, (fighter.hp / fighter.maxHp) * 100))
    : 0;

  const actionButton = (action: BattleAction) => (
    <Card>
      <button
        className="flex h-full w-full items-center justify-center disabled:opacity-50"
        disabled={action.disabled}
        onClick={action.onClick}
      >
        <Text size="3">{action.label}</Text>
      </button>
    </Card>
  );

  return (
    <div className="flex">
      <div className="flex w-full flex-col justify-end" style={{
        backgroundImage: `url(${background})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        height: "100vh",
      }}>
        <div className="grid w-full grid-cols-2 items-start gap-x-2 px-2">
          {error && <p role="alert" className="col-span-2 text-red-500">{error}</p>}
          {fighters.map((fighter, index) => (
            <Card key={index} className="w-full min-w-0">
              <div className="flex min-w-0 items-start justify-between gap-1.5">
                <Text className="min-w-0 flex-1 whitespace-normal break-words">{fighter.name}</Text>
                <Text size="1" className="shrink-0">{fighter.hp}/{fighter.maxHp}</Text>
              </div>
              <Progress color={fighter.hp <= 0 ? "red" : "green"} value={healthPercent(fighter)} />
            </Card>
          ))}
          {fighters.map((fighter, index) => (
            <DamageEffect key={`${battleId}-${index}`} health={fighter.hp}>
              <img
                className="h-45 w-full object-contain"
                src={fighter.image}
                alt={fighter.name}
                style={{ transform: fighter.mirrored ? "scaleX(-1)" : undefined, maxWidth: fighter.maxImageWidth }}
              />
            </DamageEffect>
          ))}
        </div>
        {status && <div className="mb-4 text-center">{status}</div>}
        {/* Сохраняем место панели, чтобы персонажи не смещались после последнего удара. */}
        <div className="h-32.5">
          {actions && (
            <Card className="h-32.5">
              <Grid rows="2" columns="2" gap="2">
                {actionButton(actions.attack)}
                {actionButton(actions.inventory)}
                {actions.extra ? actionButton(actions.extra) : <Card><div className="flex items-center justify-center"><Text size="3">хз</Text></div></Card>}
                {actionButton(actions.leave)}
              </Grid>
            </Card>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
