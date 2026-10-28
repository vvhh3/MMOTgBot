import type { MultiBattleEvent, BattleStatusView } from "@mmobot/shared";
import { useEffect,useState } from "react";

type BattleMessageCursor = {
    battleId: string;
    readThrough: number;
};

// После восстановления показываем текущие HP, а новые сообщения читаются по нажатию.
export function useBattlePlayback(
    battleId: string,
    health: number[],
    events: MultiBattleEvent[],
    statuses: BattleStatusView[][] = [[], []],
) {
    const latestSequence = events.at(-1)?.sequence ?? 0;
    const [cursor, setCursor] = useState<BattleMessageCursor>({
        battleId,
        readThrough: latestSequence,
    });

    useEffect(() => {
        setCursor((previous) => previous.battleId === battleId
            ? previous
            : { battleId, readThrough: latestSequence });
    }, [battleId, latestSequence]);

    const unreadMessages = cursor.battleId === battleId
        ? events.filter((event) => event.sequence > cursor.readThrough)
        : [];
    const message = unreadMessages[0] ?? null;

    const next = () => {
        if (!message) return;

        setCursor((previous) => previous.battleId === battleId
            ? { battleId, readThrough: Math.max(previous.readThrough, message.sequence) }
            : previous);
    };

    const skip = () => {
        setCursor({ battleId, readThrough: latestSequence });
    };

    return {
        hp: message?.hp ?? health,
        statuses: message ? message.statuses ?? [[], []] : statuses,
        busy: message !== null,
        message,
        remainingMessages: unreadMessages.length,
        next,
        skip,
    };
}
