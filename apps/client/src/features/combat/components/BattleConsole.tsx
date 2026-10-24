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
        <Flex direction="column" gap="2" className="h-full" aria-label="Сообщения боя">
            <button
                className="min-h-0 flex-1 overflow-y-auto text-left"
                onClick={onNext}
                aria-label={`${message.text}. Следующее сообщение`}
            >
                <Text as="p" size="2" className="whitespace-normal break-words" role="status">
                    {message.text}
                </Text>
            </button>
            <Grid columns="2" gap="2">
                <Card>
                    <button
                        className="flex h-full w-full items-center justify-center"
                        onClick={onNext}
                    >
                        <Text size="2">Далее ▸</Text>
                    </button>
                </Card>
                <Card>
                    <button
                        className="flex h-full w-full items-center justify-center"
                        onClick={onSkip}
                    >
                        <Text size="2">
                            Пропустить{remainingMessages > 1 && ` (${remainingMessages})`}
                        </Text>
                    </button>
                </Card>
            </Grid>
        </Flex>
    );
}
