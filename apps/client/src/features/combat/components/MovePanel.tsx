import type { BattlePublicState } from "@mmobot/shared";
import { Card,Grid,Text } from "@radix-ui/themes";

type MovePanelProps = {
    tutorial?: boolean;
    state: BattlePublicState;
    disabled: boolean;
    onMove: (moveId: string) => void;
    onBack: () => void;
};

export default function MovePanel({ state, disabled, onMove, onBack, tutorial = false }: MovePanelProps) {
    return (
        <Grid columns="2" rows="2" gap="2" className="h-full min-h-0 overflow-y-auto" aria-label="Выбор приёма">
            {state.moves.map((move) => {
                const cooldown = Math.max(0, move.availableFromRound - state.round);
                const moveDisabled = disabled || state.actionSubmitted || cooldown > 0;

                return (
                    <Card key={move.id}>
                        <button
                            className={`flex h-full w-full flex-col items-center justify-center rounded-lg disabled:opacity-50 ${tutorial ? "tutorial-target" : ""}`}
                            disabled={moveDisabled}
                            onClick={() => onMove(move.id)}
                        >
                            <Text size="2" className="whitespace-normal break-words">{move.name}</Text>
                            <Text size="1" color="gray">
                                {cooldown > 0
                                    ? `Через ${cooldown} раунд(а)`
                                    : `Точность ${move.accuracy}%`}
                            </Text>
                        </button>
                    </Card>
                );
            })}
            {Array.from({ length: Math.max(0, 3 - state.moves.length) }, (_, index) => (
                <Card key={`empty-${index}`} aria-hidden="true" />
            ))}
            <Card>
                <button
                    className="flex h-full w-full items-center justify-center disabled:opacity-50"
                    disabled={disabled}
                    onClick={onBack}
                >
                    <Text size="2">Назад</Text>
                </button>
            </Card>
        </Grid>
    );
}
