import { Card,Grid,Progress,Text } from "@radix-ui/themes";
import type { ReactNode } from "react";
import DamageEffect from "./DamageEffect";
import type { BattleStatusView } from '@mmobot/shared';
import BattleStatusBadges from './BattleStatusBadges';

type Fighter = {
    name: string;
    hp: number;
    maxHp: number;
    image: string;
    mirrored?: boolean;
    maxImageWidth?: number;
    statuses?: BattleStatusView[];
};

type BattleAction = {
    highlight?: boolean;
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
    controls?: ReactNode;
    round?: number;
    remainingSeconds?: number;
};

// Общая сцена и панель боя. Запросы и состояние режимов остаются в PveFight и Fight.
export default function BattleScreen({
    battleId,
    background,
    player,
    opponent,
    error,
    status,
    actions,
    children,
    controls,
    round,
    remainingSeconds,
}: BattleScreenProps) {
    const fighters = [player, opponent];
    const showTimer = remainingSeconds !== undefined && remainingSeconds <= 30;
    const healthPercent = (fighter: Fighter) => fighter.maxHp > 0
        ? Math.max(0, Math.min(100, fighter.hp / fighter.maxHp * 100))
        : 0;

    const renderAction = (action: BattleAction) => (
        <Card className={action.highlight ? "tutorial-target" : undefined}>
            <button
                className="flex h-full w-full items-center justify-center rounded-lg disabled:opacity-50"
                disabled={action.disabled}
                onClick={action.onClick}
            >
                <Text size="3">{action.label}</Text>
            </button>
        </Card>
    );

    return (
        <div className="flex">
            <div
                className="flex w-full flex-col justify-between"
                style={{
                    backgroundImage: `url(${background})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                    height: "100vh",
                }}
            >
                {round !== undefined && (
                    <div className="flex justify-center items-center">
                        <div className="flex justify-center items-center border-3 rounded-4xl  w-12 h-12 bg-white border-[#D94E2B] " aria-label={`Раунд ${round}`}>
                            <strong className="text-[#D94E2B]"> {round}</strong>
                        </div>
                        {showTimer && (
                            <span className="battle-last-seconds" role="status">
                                {remainingSeconds} сек.
                            </span>
                        )}
                    </div>
                )}
                <div>
                    <div className="grid w-full grid-cols-2 items-start gap-x-2 px-2">
                        {error && (
                            <Card className="col-span-2" role="alert">
                                <Text size="2" color="red">{error}</Text>
                            </Card>
                        )}
                        {fighters.map((fighter, index) => (
                            <Card key={index} className="w-full min-w-0">
                                <div className="flex min-w-0 items-start justify-between gap-1.5">
                                    <Text className="min-w-0 flex-1 whitespace-normal break-words">
                                        {fighter.name}
                                    </Text>
                                    <Text size="1" className="shrink-0">
                                        {fighter.hp}/{fighter.maxHp}
                                    </Text>
                                </div>
                                <Progress
                                    color={fighter.hp <= 0 ? "red" : "green"}
                                    value={healthPercent(fighter)}
                                />
                                <BattleStatusBadges statuses={fighter.statuses ?? []} fighterName={fighter.name} />
                            </Card>
                        ))}
                        {fighters.map((fighter, index) => (
                            <DamageEffect key={`${battleId}-${index}`} health={fighter.hp}>
                                <img
                                    className="h-45 w-full object-contain"
                                    src={fighter.image}
                                    alt={fighter.name}
                                    style={{
                                        transform: fighter.mirrored ? "scaleX(-1)" : undefined,
                                        maxWidth: fighter.maxImageWidth,
                                    }}
                                />
                            </DamageEffect>
                        ))}
                    </div>
                    {status && (
                        <div className="mb-2 px-2">
                            <Card>
                                <Text as="p" size="2" align="center" role="status">{status}</Text>
                            </Card>
                        </div>
                    )}
                    {/* Одна рамка и одинаковая высота для действий, приёмов и сообщений. */}
                    <div className="h-32.5">
                        {(controls || actions) && (
                            <Card className="h-full">
                                {controls ?? (actions && (
                                    <Grid rows="2" columns="2" gap="2" className="h-full">
                                        {renderAction(actions.attack)}
                                        {renderAction(actions.inventory)}
                                        {actions.extra
                                            ? renderAction(actions.extra)
                                            : <Card aria-hidden="true" />}
                                        {renderAction(actions.leave)}
                                    </Grid>
                                ))}
                            </Card>
                        )}
                    </div>
                </div>
                {children}
            </div>
        </div>
    );
}
