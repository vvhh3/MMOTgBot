import type { BattleEvent } from "@mmobot/shared";
import { Text } from "@radix-ui/themes";

type BattleConsoleProps = {
    message: Pick<BattleEvent, 'text'>;
    remainingMessages: number;
    onNext: () => void;
    onSkip: () => void;
};

export default function BattleConsole({
    message,
    remainingMessages,
    onNext,
    onSkip,
}: BattleConsoleProps) {
    return (
    <div className="battle-console flex h-full flex-col"><button
        className="battle-console-next flex h-full w-full justify-end flex-col"
        onClick={onNext}
    >
        <Text size="2" className="battle-console-message">{message.text}</Text>
        <div className="battle-console-next-hint flex w-full justify-end-safe h-[40%] items-end">
            <Text size="2" className="battle-console-next-label">Далее ▸</Text>
        </div>
    </button>
    {remainingMessages > 1 && <button className="battle-console-skip text-xs underline" onClick={onSkip}>Пропустить все ({remainingMessages})</button>}
    </div>
    );
}
