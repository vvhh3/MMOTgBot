import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { BattleRequest, InventoryItemDto, PlayerDto, PvpStateDto } from "@mmobot/shared";
import { getMe, getPvpState, pvpAction, requestPvpExit } from "../api";
import { useBattlePlayback } from "../hooks/useBattlePlayback";
import { getSkins } from "../utils/skins";
import { getLocationImage } from "../utils/getLocationImage";
import BattleScreen from "./BattleScreen";
import CombatInventoryDialog from "./CombatInventoryDialog";
import BattleConsole from "./ui/BattleConsole";
import MovePanel from "./ui/MovePanel";

type FightProps = {
    token: string | null;
    player: PlayerDto | null;
    pvpState: PvpStateDto | null;
    inventory: InventoryItemDto[];
    onPlayer: (player: PlayerDto) => void;
    onInventory: (inventory: InventoryItemDto[]) => void;
    onPvpState: (state: PvpStateDto | null) => void;
};

type PendingPvpRequest = {
    key: string;
    request: BattleRequest;
};

export default function Fight({
    token,
    player,
    pvpState,
    inventory,
    onPlayer,
    onInventory,
    onPvpState,
}: FightProps) {
    const navigate = useNavigate();
    const [pending, setPending] = useState(false);
    const [showMoves, setShowMoves] = useState(false);
    const [showInventory, setShowInventory] = useState(false);
    const [inventoryLoading, setInventoryLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(Date.now());
    const actionLocked = useRef(false);
    const retryRequest = useRef<PendingPvpRequest | null>(null);
    const currentState = useRef(pvpState);
    currentState.current = pvpState;

    const side = pvpState?.direction === "outgoing" ? 0 : 1;
    const lastEventSequence = pvpState?.events.at(-1)?.sequence;
    const playback = useBattlePlayback(
        `pvp-${pvpState?.id}`,
        side === 0
            ? [pvpState?.myHp ?? 0, pvpState?.partnerHp ?? 0]
            : [pvpState?.partnerHp ?? 0, pvpState?.myHp ?? 0],
        pvpState?.events ?? [],
    );

    useEffect(() => {
        if (!pvpState) navigate("/", { replace: true });
    }, [pvpState, navigate]);

    useEffect(() => {
        if (!token || !pvpState || pvpState.finished) return;

        let cancelled = false;
        const sessionId = pvpState.id;
        const refresh = async () => {
            try {
                const updated = await getPvpState(token, sessionId);
                if (!cancelled) onPvpState(updated);
            } catch {
                // После временной ошибки сети следующий запрос повторит чтение.
            }
        };

        const refreshTimer = window.setInterval(() => { void refresh(); }, 10000);
        const clockTimer = window.setInterval(() => setCurrentTime(Date.now()), 1000);
        void refresh();
        window.addEventListener("focus", refresh);
        window.addEventListener("online", refresh);

        return () => {
            cancelled = true;
            window.clearInterval(refreshTimer);
            window.clearInterval(clockTimer);
            window.removeEventListener("focus", refresh);
            window.removeEventListener("online", refresh);
        };
    }, [token, pvpState?.id, pvpState?.finished, onPvpState]);

    useEffect(() => {
        if (!token || !pvpState?.finished) return;

        let cancelled = false;
        getMe(token)
            .then((me) => {
                if (cancelled) return;
                onPlayer(me.player);
                onInventory(me.inventory);
            })
            .catch(() => undefined);

        return () => { cancelled = true; };
    }, [token, pvpState?.id, pvpState?.finished]);

    useEffect(() => {
        setShowMoves(false);
        if (pvpState?.finished || pvpState?.actionSubmitted) setShowInventory(false);
    }, [lastEventSequence, pvpState?.finished, pvpState?.actionSubmitted]);

    useEffect(() => {
        if (!token || !pvpState?.events.some((event) => event.type === "heal" && event.side === side)) return;

        let cancelled = false;
        getMe(token)
            .then((me) => { if (!cancelled) onInventory(me.inventory); })
            .catch(() => undefined);

        return () => { cancelled = true; };
    }, [token, lastEventSequence, side]);

    const handleOpenInventory = async () => {
        if (!token) return;

        setShowInventory(true);
        setInventoryLoading(true);
        try {
            const me = await getMe(token);
            onInventory(me.inventory);
        } catch {
            setError("Не удалось обновить инвентарь");
        } finally {
            setInventoryLoading(false);
        }
    };

    const handleCloseInventory = () => {
        if (!actionLocked.current) setShowInventory(false);
    };

    const handleAction = async (
        moveId?: string,
        exitRequested?: boolean,
        itemType?: number,
    ): Promise<boolean> => {
        if (!token || !pvpState || pvpState.finished || actionLocked.current) return false;
        if (exitRequested === undefined && (pvpState.actionSubmitted || playback.busy)) return false;

        actionLocked.current = true;
        setPending(true);
        setError(null);

        const command = itemType !== undefined ? `use:${itemType}` : moveId ?? `exit:${exitRequested}`;
        const key = `${pvpState.id}:${pvpState.round}:${command}`;
        const request = retryRequest.current?.key === key
            ? retryRequest.current.request
            : {
                sessionId: pvpState.id,
                round: pvpState.round,
                expectedVersion: pvpState.stateVersion,
                requestId: crypto.randomUUID(),
                moveId,
                itemType,
            };
        retryRequest.current = { key, request };

        try {
            const result = exitRequested === undefined
                ? await pvpAction(token, pvpState.id, itemType === undefined ? "attack" : "use", request)
                : await requestPvpExit(token, pvpState.id, request, exitRequested);

            if (currentState.current?.id === pvpState.id) onPvpState(result.state);
            retryRequest.current = null;
            setShowMoves(false);
            if (itemType !== undefined) setShowInventory(false);
            return true;
        } catch (error) {
            setError(error instanceof Error ? error.message : "Ошибка действия");
            try {
                onPvpState(await getPvpState(token, pvpState.id));
            } catch {
                // Сохраняем ID команды, чтобы повтор не выполнил действие второй раз.
            }
            if (currentState.current
                && currentState.current.stateVersion !== request.expectedVersion
                && !currentState.current.actionSubmitted) {
                retryRequest.current = null;
            }
            if (itemType !== undefined) throw error;
            return false;
        } finally {
            actionLocked.current = false;
            setPending(false);
        }
    };

    if (!pvpState) return null;

    // Сервер сохраняет игровые даты со смещением UTC+4.
    const remainingSeconds = pvpState.roundStartedAt
        ? Math.max(0, Math.ceil((Date.parse(pvpState.roundStartedAt) - 4 * 3600000 + 5 * 60000 - currentTime) / 1000))
        : 0;

    let statusMessage = `Что предпримет ${player?.name ?? pvpState.myName}?`;
    if (pvpState.actionSubmitted) statusMessage = "Действие выбрано. Ждём соперника…";
    if (pending) statusMessage = "Подтверждаем выбор…";
    if (pvpState.finished) {
        if (pvpState.isWon === null) {
            statusMessage = pvpState.finishReason === "mutual_exit"
                ? "Бой завершён по согласию обоих"
                : "Бой завершён без победителя";
        } else {
            statusMessage = pvpState.isWon ? "Победа!" : "Поражение";
        }
    }

    let leaveLabel = "Сбежать";
    if (pvpState.partnerExitRequested) leaveLabel = "Принять выход";
    if (pvpState.exitRequested) leaveLabel = "Отменить выход";
    if (pvpState.finished) leaveLabel = "Выйти";

    const inventoryMessage = pvpState.actionSubmitted
        ? "Действие уже выбрано. Предмет можно использовать в следующем раунде."
        : "Лечебный предмет занимает действие текущего раунда.";

    const renderControls = () => {
        if (playback.message) {
            return (
                <BattleConsole
                    message={playback.message}
                    remainingMessages={playback.remainingMessages}
                    onNext={playback.next}
                    onSkip={playback.skip}
                />
            );
        }
        if (showMoves && !pvpState.finished) {
            return (
                <MovePanel
                    state={pvpState}
                    disabled={pending}
                    onMove={(moveId) => { void handleAction(moveId); }}
                    onBack={() => setShowMoves(false)}
                />
            );
        }
        return undefined;
    };

    return (
        <BattleScreen
            battleId={`pvp-${pvpState.id}`}
            background={getLocationImage("fonNetralitet.svg")}
            player={{
                name: player?.name ?? pvpState.myName,
                hp: playback.hp[side],
                maxHp: pvpState.myMaxHp,
                image: getSkins(player?.avatar),
                mirrored: true,
                maxImageWidth: 180,
            }}
            opponent={{
                name: pvpState.partnerName,
                hp: playback.hp[side === 0 ? 1 : 0],
                maxHp: pvpState.partnerMaxHp,
                image: getSkins(pvpState.partnerAvatar),
                maxImageWidth: 180,
            }}
            error={error}
            round={pvpState.round}
            remainingSeconds={pvpState.status === "active" && pvpState.roundStartedAt ? remainingSeconds : undefined}
            status={playback.busy ? undefined : statusMessage}
            actions={{
                attack: {
                    label: "Битва",
                    disabled: pvpState.finished || pending || pvpState.actionSubmitted,
                    onClick: () => setShowMoves(true),
                },
                inventory: {
                    label: "Инвентарь",
                    disabled: pvpState.finished || pending || inventoryLoading,
                    onClick: () => { void handleOpenInventory(); },
                },
                leave: {
                    label: leaveLabel,
                    disabled: pending,
                    onClick: () => pvpState.finished
                        ? navigate("/")
                        : void handleAction(undefined, !pvpState.exitRequested),
                },
            }}
            controls={renderControls()}
        >
            {showInventory && !pvpState.finished && (
                <CombatInventoryDialog
                    title="Инвентарь в дуэли"
                    token={token}
                    player={player ? { ...player, health: pvpState.myHp, maxHp: pvpState.myMaxHp } : null}
                    inventory={inventory}
                    onPlayer={onPlayer}
                    onInventory={onInventory}
                    onClose={handleCloseInventory}
                    closeDisabled={pending}
                    loading={inventoryLoading}
                    error={error}
                    message={inventoryMessage}
                    combat={{
                        onUsePotion: (itemType) => handleAction(undefined, undefined, itemType),
                        busy: pending || inventoryLoading || pvpState.actionSubmitted || playback.busy,
                        healthFull: pvpState.myHp >= pvpState.myMaxHp,
                    }}
                />
            )}
        </BattleScreen>
    );
}
