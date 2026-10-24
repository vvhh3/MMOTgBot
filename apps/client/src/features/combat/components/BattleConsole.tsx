import type { BattleEvent } from "@mmobot/shared";
import { Card,Flex,Grid,Text } from "@radix-ui/themes";

type BattleConsoleProps = {
    message: BattleEvent;
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
    <button
        className="flex h-full w-full justify-end flex-col"
        onClick={onNext}
    >
        <Text size="2">{message.text}</Text>
        <div className="flex w-full justify-end-safe h-[40%] items-end">
            <Text size="2">Далее ▸</Text>
        </div>
    </button>
    );
}
