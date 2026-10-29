import { Card,Grid,Progress,Text } from "@radix-ui/themes";
import type { ReactNode } from "react";
import DamageEffect from "./DamageEffect";
import type { BattleStatusView } from '@mmobot/shared';
import BattleStatusBadges from './BattleStatusBadges';
import BattleRoundIndicator from './BattleRoundIndicator';
import LevelBadge from '../../../shared/ui/LevelBadge';

type Fighter = {
    id?: string; selected?: boolean; onSelect?: () => void;
    name: string;
    level?: number;
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
    teams?: { allies: Fighter[]; enemies: Fighter[] };
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
    teams,
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
    const healthPercent = (fighter: Fighter) => fighter.maxHp > 0
        ? Math.max(0, Math.min(100, fighter.hp / fighter.maxHp * 100))
        : 0;

    const renderAction = (action: BattleAction, kind: 'attack' | 'inventory' | 'extra' | 'leave') => (
        <Card className={`battle-action-cell${action.highlight ? " tutorial-target" : ""}`} data-action={kind}>
            <button
                className="battle-action-button flex h-full w-full items-center justify-center rounded-lg disabled:opacity-50"
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
                className="battle-scene flex w-full flex-col justify-between"
                style={{
                    backgroundImage: `url(${background})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                    height: "100vh",
                }}
            >
                {round !== undefined && (
                    <BattleRoundIndicator round={round} remainingSeconds={remainingSeconds} />
                )}
                <div>
                    {teams ? <div className="group-battle-scene">
                        {error && <Card className="game-card game-card--glass" role="alert"><Text color="red">{error}</Text></Card>}
                        {[teams.enemies, teams.allies].map((team, row) => <div className="group-battle-team" key={row} aria-label={row === 0 ? 'Противники — выберите цель' : 'Ваша группа'}>
                            {team.map((fighter, index) => <button type="button" key={fighter.id ?? index}
                                className={`game-card game-card--glass group-battle-fighter ${fighter.selected ? 'is-selected' : ''} ${fighter.hp <= 0 ? 'is-defeated' : ''}`}
                                aria-pressed={row === 0 ? !!fighter.selected : undefined} disabled={!fighter.onSelect || fighter.hp <= 0}
                                onClick={fighter.onSelect} aria-label={`${fighter.name}, ${fighter.hp} из ${fighter.maxHp} HP`}>
                                <span className="group-fighter-name">{fighter.name}</span>
                                <small>{fighter.hp}/{fighter.maxHp} HP</small>
                                <Progress color={fighter.hp <= 0 ? 'red' : 'green'} value={healthPercent(fighter)} />
                                <BattleStatusBadges statuses={fighter.statuses ?? []} fighterName={fighter.name} />
                                <DamageEffect health={fighter.hp}><img src={fighter.image} alt="" /></DamageEffect>
                            </button>)}
                        </div>)}
                    </div> : <>
                    <div className="battle-fighters-grid grid w-full grid-cols-2 items-start gap-x-2 px-2">
                        {error && (
                            <Card className="game-card game-card--glass col-span-2" role="alert">
                                <Text size="2" color="red">{error}</Text>
                            </Card>
                        )}
                        {fighters.map((fighter, index) => (
                            <Card key={index} className="battle-fighter-card w-full min-w-0">
                                <div className="flex min-w-0 items-start justify-between gap-1.5">
                                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                                        <Text className="min-w-0 whitespace-normal break-words">{fighter.name}</Text>
                                        {fighter.level !== undefined && <LevelBadge level={fighter.level} />}
                                    </div>
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
                                    className="battle-fighter-image h-45 w-full object-contain"
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
                    </>}
                    {status && (
                        <div className="mb-2 px-2">
                            <Card className="game-card game-card--glass">
                                <Text as="p" size="2" align="center" role="status">{status}</Text>
                            </Card>
                        </div>
                    )}
                    {/* Одна рамка и одинаковая высота для действий, приёмов и сообщений. */}
                    <div className="battle-controls h-41">
                        {(controls || actions) && (
                            <Card className="battle-controls-card h-full">
                                {controls ?? (actions && (
                                    <Grid rows="2" columns="2" gap="2" className="battle-actions-grid h-full">
                                        {renderAction(actions.attack, 'attack')}
                                        {renderAction(actions.inventory, 'inventory')}
                                        {actions.extra
                                            ? renderAction(actions.extra, 'extra')
                                            : <Card className="battle-action-cell battle-action-empty" aria-hidden="true" />}
                                        {renderAction(actions.leave, 'leave')}
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
