import { getSkins } from "../utils/skins";
import { Text } from "@radix-ui/themes"
import { InventoryItemDto, PlayerDto, PvpStateDto } from "@mmobot/shared";
import { cancelPvp, getMe, getPvpState, pvpAction } from "../api";
import { useState, useEffect, useRef } from "react";
import { getLocationImage } from "../utils/getLocationImage";
import { useNavigate } from "react-router-dom";
import BattleScreen from "./BattleScreen";
import CombatInventoryDialog from "./CombatInventoryDialog";

type FightProps = {
    token: string | null
    player: PlayerDto | null
    pvpState: PvpStateDto | null
    inventory: InventoryItemDto[]
    onPlayer: (player: PlayerDto) => void
    onInventory: (inventory: InventoryItemDto[]) => void
    onPvpState: (state: PvpStateDto | null) => void
}

export default function Fight({ token, player, pvpState, inventory, onPlayer, onInventory, onPvpState }: FightProps) {
    const [showInventory, setShowInventory] = useState(false);
    const [pending, setPending] = useState(false);
    const [inventoryLoading, setInventoryLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const actionLocked = useRef(false);
    const currentState = useRef(pvpState);
    currentState.current = pvpState;
    const navigate= useNavigate()

    useEffect(() => {
        if (!token || !pvpState || pvpState.finished) return;
        const id = pvpState.id;
        let cancelled = false;
        let refreshing = false;
        const refresh = async () => {
            if (refreshing) return;
            refreshing = true;
            const snapshot = currentState.current;
            try {
                const state = await getPvpState(token, id);
                // Запоздалый HTTP-ответ не должен отменять более новое событие сокета.
                if (!cancelled && currentState.current === snapshot) onPvpState(state);
            } catch {
                // При временной потере сети следующая проверка повторит чтение.
            } finally {
                refreshing = false;
            }
        };
        void refresh();
        const timer = window.setInterval(() => { void refresh(); }, 10000);
        window.addEventListener("focus", refresh);
        window.addEventListener("online", refresh);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
            window.removeEventListener("focus", refresh);
            window.removeEventListener("online", refresh);
        };
    }, [token, pvpState?.id, pvpState?.finished, onPvpState]);
    useEffect(() => {
        if (!pvpState || pvpState.finished) {
            setShowInventory(false);
            return;
        }
    }, [pvpState?.finished]);

    const doAction = async (action: "attack" | "flee" | "use", itemType?: number): Promise<boolean> => {
        if (!token || !pvpState || actionLocked.current) return false;
        if (pvpState.finished) {
            navigate("/", { replace: true });
            return false;
        }
        if (!pvpState.myTurn || pvpState.status !== "active") return false;
        if (action === "use" && (inventoryLoading || pvpState.myHp >= pvpState.myMaxHp)) return false;
        actionLocked.current = true;
        setPending(true);
        setError(null);
        try {
            const result = await pvpAction(token, pvpState.id, action, itemType);
            if (currentState.current === pvpState) onPvpState(result.state);
            if (action === "use") {
                setShowInventory(false);
                // HP дуэли приходит через сокет, остаток зелий перечитываем после списания.
                try {
                    const updated = await getMe(token);
                    onInventory(updated.inventory);
                } catch {
                    setError("Зелье использовано, но не удалось обновить инвентарь. Откройте его ещё раз.");
                }
            }
            return true;
        } catch (e) {
            setError(e instanceof Error ? e.message : "Ошибка действия");
            const snapshot = currentState.current;
            void getPvpState(token, pvpState.id).then((state) => {
                if (currentState.current === snapshot) onPvpState(state);
            }).catch(() => undefined);
            if (action === "use") throw e;
            return false;
        } finally {
            actionLocked.current = false;
            setPending(false);
        }
    }

    const endDuel = async () => {
        if (!token || !pvpState || actionLocked.current) return;
        actionLocked.current = true;
        setPending(true);
        setError(null);
        try {
            // Сдаться можно в любой ход; соперник получает победу.
            const result = await cancelPvp(token, pvpState.id);
            onPvpState(result.state);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось завершить бой");
        } finally {
            actionLocked.current = false;
            setPending(false);
        }
    };

    const openInventory = async () => {
        if (!token || pending || inventoryLoading || !pvpState || pvpState.finished) return;
        setInventoryLoading(true);
        setError(null);
        setShowInventory(true);
        // Повторное открытие восстанавливает актуальные остатки после ошибки сети.
        try {
            const updated = await getMe(token);
            onInventory(updated.inventory);
        } catch {
            setError("Не удалось обновить инвентарь. Попробуйте открыть его ещё раз.");
        } finally {
            setInventoryLoading(false);
        }
    };

    useEffect(() => {
        if (!pvpState) navigate("/", { replace: true });
    }, [pvpState, navigate]);

    // Нет активного PvP — нечего показывать на этой странице
    if (!pvpState) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Text size="3">Нет активного боя</Text>
            </div>
        )
    }

    const isMyTurn = pvpState.myTurn;
    const finished = pvpState.finished;

    return (
        <BattleScreen
            battleId={`pvp-${pvpState.id}`}
            background={getLocationImage("fonNetralitet.svg")}
            player={{ name: player?.name ?? pvpState.myName, hp: pvpState.myHp, maxHp: pvpState.myMaxHp, image: getSkins(player?.avatar), mirrored: true, maxImageWidth: 180 }}
            opponent={{ name: pvpState.partnerName, hp: pvpState.partnerHp, maxHp: pvpState.partnerMaxHp, image: getSkins(pvpState.partnerAvatar), mirrored: true, maxImageWidth: 180 }}
            error={error}
            status={finished ? (
                <Text size="4" weight="bold" style={{ color: pvpState.isWon === null ? undefined : pvpState.isWon ? "#22c55e" : "#ef4444" }}>
                    {pvpState.isWon === null ? "Бой отменён" : pvpState.isWon ? "Победа!" : "Поражение"}
                </Text>
            ) : (
                <Text size="3" weight="bold">{isMyTurn ? "Ваш ход" : `Ход ${pvpState.partnerName}`}</Text>
            )}
            actions={{
                attack: { label: "Битва", disabled: !isMyTurn || finished || pending, onClick: () => { void doAction("attack"); } },
                inventory: { label: "Инвентарь", disabled: finished || pending, onClick: () => { void openInventory(); } },
                leave: { label: finished ? "Выйти" : "Сбежать", disabled: pending || (!finished && !isMyTurn), onClick: () => { void doAction("flee"); } },
                extra: { label: "Сдаться", disabled: finished || pending, onClick: () => { void endDuel(); } },
            }}
        >
            {showInventory && !finished && (
                <CombatInventoryDialog
                    title="Инвентарь в дуэли"
                    token={token}
                    player={player ? { ...player, health: pvpState.myHp, maxHp: pvpState.myMaxHp } : null}
                    inventory={inventory}
                    onPlayer={onPlayer}
                    onInventory={onInventory}
                    onClose={() => { if (!actionLocked.current) setShowInventory(false); }}
                    closeDisabled={pending}
                    loading={inventoryLoading}
                    error={error}
                    message={isMyTurn ? "Использование зелья передаёт ход сопернику." : "Сейчас ход соперника. Зелье можно использовать в свой ход."}
                    combat={{ onUsePotion: (itemType) => doAction("use", itemType), busy: pending || inventoryLoading || !isMyTurn, healthFull: pvpState.myHp >= pvpState.myMaxHp }}
                />
            )}
        </BattleScreen>
    );
}
