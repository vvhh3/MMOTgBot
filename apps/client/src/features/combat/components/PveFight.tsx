import type {
BattleRequest,
CombatStateResponse,
InventoryItemDto,
LocationStateResponse,
PlayerDto,
} from "@mmobot/shared";
import { useEffect,useRef,useState } from "react";
import { TUTORIAL_MOB_ID } from "@mmobot/shared";
import { motion,useReducedMotion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../../character/api";
import { getCharacterImage,getSkins } from "../../character/lib/skins";
import { getLocationImage } from "../../locations/lib/getLocationImage";
import { combatAction,getCombatState } from "../api";
import { useBattlePlayback } from "../hooks/useBattlePlayback";
import BattleConsole from "./BattleConsole";
import BattleScreen from "./BattleScreen";
import CombatInventoryDialog from "./CombatInventoryDialog";
import FightResultModal from "./FightResultModal";
import MovePanel from "./MovePanel";

type PveFightProps = {
    token: string | null;
    player: PlayerDto | null;
    inventory: InventoryItemDto[];
    onPlayer: (player: PlayerDto) => void;
    onInventory: (inventory: InventoryItemDto[]) => void;
    locationState: LocationStateResponse | null;
    onError: (message: string) => void;
    onState: (state: CombatStateResponse) => void;
    state: CombatStateResponse | undefined;
    error: string | null;
};

type PendingCombatRequest = {
    key: string;
    request: BattleRequest;
};

export default function PveFight({
    token,
    player,
    inventory,
    onPlayer,
    onInventory,
    locationState,
    onError,
    onState,
    state,
    error,
}: PveFightProps) {
    const navigate = useNavigate();
    const reduced = useReducedMotion();
    const [pending, setPending] = useState(false);
    const [showMoves, setShowMoves] = useState(false);
    const [showInventory, setShowInventory] = useState(false);
    const actionLocked = useRef(false);
    const retryRequest = useRef<PendingCombatRequest | null>(null);
    const currentState = useRef(state);
    currentState.current = state;

    const lastEventSequence = state?.events.at(-1)?.sequence;
    const playback = useBattlePlayback(
        `pve-${state?.id}`,
        [state?.playerHp ?? 0, state?.mobHp ?? 0],
        state?.events ?? [],
    );

    useEffect(() => {
        if (!state) navigate("/", { replace: true });
    }, [state, navigate]);

    useEffect(() => {
        if (!token || !state || state.status !== "active") return;

        let cancelled = false;
        const sessionId = state.id;
        const refresh = async () => {
            try {
                const updated = await getCombatState(token, sessionId);
                if (!cancelled && updated.id === sessionId) onState(updated);
            } catch {
                // После временной ошибки сети следующий запрос повторит чтение.
            }
        };

        const timer = window.setInterval(() => { void refresh(); }, 10000);
        window.addEventListener("online", refresh);
        window.addEventListener("focus", refresh);

        return () => {
            cancelled = true;
            window.clearInterval(timer);
            window.removeEventListener("online", refresh);
            window.removeEventListener("focus", refresh);
        };
    }, [token, state?.id, state?.status, onState]);

    useEffect(() => {
        setShowMoves(false);
        if (state?.status !== "active") setShowInventory(false);
    }, [lastEventSequence, state?.status]);

    const handleAction = async (
        action: "attack" | "flee" | "use",
        moveId?: string,
        itemType?: number,
    ): Promise<boolean> => {
        if (!token || !state || state.status !== "active" || actionLocked.current || playback.busy) {
            return false;
        }

        actionLocked.current = true;
        setPending(true);
        onError("");

        const key = `${state.id}:${state.round}:${action}:${moveId ?? itemType ?? ""}`;
        const request = retryRequest.current?.key === key
            ? retryRequest.current.request
            : {
                sessionId: state.id,
                round: state.round,
                expectedVersion: state.stateVersion,
                requestId: crypto.randomUUID(),
                moveId,
                itemType,
            };
        retryRequest.current = { key, request };

        try {
            const result = await combatAction(token, action, request);
            if (currentState.current?.id === state.id) {
                onState(result.state);
                onPlayer(result.player);
                onInventory(result.inventory);
            }
            retryRequest.current = null;
            setShowMoves(false);
            if (action === "use") setShowInventory(false);
            return true;
        } catch (error) {
            onError(error instanceof Error ? error.message : "Не удалось выполнить действие");
            try {
                const updated = await getCombatState(token, state.id);
                if (updated.id === state.id) {
                    onState(updated);
                    if (updated.status !== "active") {
                        const me = await getMe(token);
                        onPlayer(me.player);
                        onInventory(me.inventory);
                    }
                }
            } catch {
                // Сохраняем ID команды, чтобы повтор не выполнил действие второй раз.
            }
            if (action === "use") throw error;
            return false;
        } finally {
            actionLocked.current = false;
            setPending(false);
        }
    };

    const handleCloseInventory = () => {
        if (!actionLocked.current) setShowInventory(false);
    };

    if (!state) return null;

    const finished = state.status !== "active";
    const tutorial = state.mob.id === TUTORIAL_MOB_ID;
    let statusMessage = `Что предпримет ${player?.name ?? "ваш персонаж"}?`;
    if (pending) statusMessage = "Действие…";
    if (finished) statusMessage = state.status === "fled" ? "Вы покинули поле боя" : "Бой завершён";

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
        if (showMoves && !finished) {
            return (
                <MovePanel
                    tutorial={tutorial}
                    state={state}
                    disabled={pending}
                    onMove={(moveId) => { void handleAction("attack", moveId); }}
                    onBack={() => setShowMoves(false)}
                />
            );
        }
        return undefined;
    };

    return (
        <BattleScreen
            battleId={`pve-${state.id}`}
            background={getLocationImage(locationState?.location.fightImg ?? "fonNetralitet.svg")}
            player={{
                name: player?.name ?? "",
                hp: playback.hp[0],
                maxHp: state.playerMaxHp,
                image: getSkins(player?.avatar),
                mirrored: true,
                maxImageWidth: 180,
            }}
            opponent={{
                name: state.mob.name,
                hp: playback.hp[1],
                maxHp: state.mobMaxHp,
                image: getCharacterImage("/character-images/monstr.svg"),
            }}
            error={error}
            round={state.round}
            status={playback.busy ? undefined : tutorial && !finished && !pending ? <motion.span key={showMoves ? "move" : "attack"} initial={{ opacity: 0, y: reduced ? 0 : 4 }} animate={{ opacity: 1, y: 0 }}>
                {showMoves ? "Выбери «Удар рукой» или атаку оружием. Затем противник ответит." : "Нажми «Битва», чтобы выбрать атаку. Зелёные полоски показывают здоровье."}
            </motion.span> : statusMessage}
            actions={{
                attack: {
                    highlight: tutorial,
                    label: "Битва",
                    disabled: finished || pending,
                    onClick: () => setShowMoves(true),
                },
                inventory: {
                    label: "Инвентарь",
                    disabled: finished || pending,
                    onClick: () => setShowInventory(true),
                },
                leave: {
                    label: finished ? "Выйти" : "Сбежать",
                    disabled: pending,
                    onClick: () => finished ? navigate("/") : void handleAction("flee"),
                },
            }}
            controls={renderControls()}
        >
            {showInventory && !finished && (
                <CombatInventoryDialog
                    title="Инвентарь в бою"
                    token={token}
                    player={player ? { ...player, health: state.playerHp, maxHp: state.playerMaxHp } : null}
                    inventory={inventory}
                    onPlayer={onPlayer}
                    onInventory={onInventory}
                    onClose={handleCloseInventory}
                    closeDisabled={pending}
                    error={error}
                    message="Лечебный предмет занимает действие текущего раунда."
                    combat={{
                        onUsePotion: (itemType) => handleAction("use", undefined, itemType),
                        busy: pending || playback.busy,
                        healthFull: state.playerHp >= state.playerMaxHp,
                    }}
                />
            )}
            {finished && !playback.busy && (state.status === "victory" || state.status === "defeat") && (
                <FightResultModal state={state} tutorial={tutorial} />
            )}
        </BattleScreen>
    );
}
