import type { BattleEvent } from "@mmobot/shared";
import { Card,Flex,Grid,Text } from "@radix-ui/themes";

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
    <div className="flex h-full flex-col"><button
        className="flex h-full w-full justify-end flex-col"
        onClick={onNext}
    >
        <Text size="2">{message.text}</Text>
        <div className="flex w-full justify-end-safe h-[40%] items-end">
            <Text size="2">Далее ▸</Text>
        </div>
    </button>
    {remainingMessages > 1 && <button className="text-xs underline" onClick={onSkip}>Пропустить все ({remainingMessages})</button>}
    </div>
    );
}
