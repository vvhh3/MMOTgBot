import { getCharacterImage, getSkins } from "../utils/skins";
import { Text } from "@radix-ui/themes"
import { useNavigate } from "react-router-dom"
import { CombatStateResponse, InventoryItemDto, PlayerDto,LocationStateResponse } from "@mmobot/shared"
import { useEffect, useRef, useState } from "react"
import { combatAction } from "../api"
import { getLocationImage } from "../utils/getLocationImage"
import Modal, { TypeModal } from "./ui/Modal/Modal"
import { HIT_ANIMATION_MS, MOB_COUNTERATTACK_DELAY_MS } from "./animations/DamageEffect"
import BattleScreen from "./BattleScreen"
import CombatInventoryDialog from "./CombatInventoryDialog"

type PveFightProps = {
    token: string | null
    player: PlayerDto | null
    inventory: InventoryItemDto[]
    onPlayer: (state: PlayerDto) => void
    onInventory: (state: InventoryItemDto[]) => void
    locationState: LocationStateResponse|null
    onError:(value:string)=>void
    onState:(state: CombatStateResponse) => void
    state:CombatStateResponse | undefined
    error:string | null
}

export default function PveFight({ token, player,inventory,onPlayer,onInventory,locationState,onState,state,onError,error}: PveFightProps) {
    const location = locationState?.location
    const [showResult, setShowResult] = useState(state?.status === "victory" || state?.status === "defeat")
    const [displayedPlayerHp, setDisplayedPlayerHp] = useState(state?.playerHp)
    const previousHealth = useRef({ mobId: state?.mob.id, hp: state?.playerHp })
    const [turnPending, setTurnPending] = useState(false)
    const turnLocked = useRef(false)
    const unlockTimer = useRef<number | null>(null)
    const mounted = useRef(true)
    const [showInventory, setShowInventory] = useState(false)

    useEffect(() => {
        if (state?.status !== "active") {
            setShowInventory(false)
            return
        }
    }, [state?.status])

    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
            if (unlockTimer.current !== null) window.clearTimeout(unlockTimer.current)
        }
    }, [])

    useEffect(() => {
        const previous = previousHealth.current
        const hp = state?.playerHp
        previousHealth.current = { mobId: state?.mob.id, hp }
        if (previous.mobId === state?.mob.id && previous.hp !== undefined && hp !== undefined && hp < previous.hp) {
            // Оба удара приходят вместе; показываем ответ моба с задержкой после удара игрока.
            const timeout = window.setTimeout(() => setDisplayedPlayerHp(hp), MOB_COUNTERATTACK_DELAY_MS)
            return () => window.clearTimeout(timeout)
        }
        setDisplayedPlayerHp(hp)
    }, [state?.playerHp, state?.mob.id])

    const playerHp = displayedPlayerHp ?? state?.playerHp ?? 0
    const counterattackPending = state !== undefined && playerHp > state.playerHp

    const navigate = useNavigate()
    useEffect(() => {
        if (!state) navigate("/", { replace: true })
    }, [state, navigate])

    useEffect(() => {
        if (state?.status !== "victory" && state?.status !== "defeat") {
            setShowResult(false)
            return
        }
        // При поражении ждём ответного удара моба и завершения анимации урона.
        if (counterattackPending) return
        const timeout = window.setTimeout(() => setShowResult(true), HIT_ANIMATION_MS)
        return () => window.clearTimeout(timeout)
    }, [state?.status, counterattackPending])

    const actionCombat = async (action: "attack" | "flee" | "use", itemType?: number): Promise<boolean> => {
        if (!token || !state || state.status !== "active" || turnLocked.current || counterattackPending) return false
        if (action === "use" && state.playerHp >= state.playerMaxHp) return false
        turnLocked.current = true
        setTurnPending(true)
        onError("")
        let animationDuration = 0
        try {
            const res = await combatAction(token, action, itemType)
            if (!mounted.current) return false
            const receivedDamage = res.state.playerHp < state.playerHp
            const dealtDamage = res.state.mobHp < state.mobHp
            animationDuration = receivedDamage
                ? MOB_COUNTERATTACK_DELAY_MS + HIT_ANIMATION_MS
                : dealtDamage ? HIT_ANIMATION_MS : 0
            onState(res.state)
            onPlayer(res.player)
            onInventory(res.inventory)
            if (action === "use") setShowInventory(false)
            if (res.state.status === "fled")navigate("/")
            return true
        } catch (e) {
            if (mounted.current) onError(e instanceof Error ? e.message : 'Ошибка запроса, попробуйте попозже')
            // Ошибку использования показываем прямо в открытой карточке зелья.
            if (action === "use") throw e
            return false
        } finally {
            if (mounted.current) {
                unlockTimer.current = window.setTimeout(() => {
                    turnLocked.current = false
                    setTurnPending(false)
                    unlockTimer.current = null
                }, animationDuration)
            }
        }
    }
    if (!state) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Text size="3">Нет активного боя</Text>
            </div>
        )
    }
    const actionsDisabled = turnPending || counterattackPending;

    return (
        <BattleScreen
            battleId={`pve-${state.mob.id}`}
            background={getLocationImage(location?.fightImg ?? "fonNetralitet.svg")}
            player={{ name: player?.name ?? "", hp: playerHp, maxHp: state.playerMaxHp, image: getSkins(player?.avatar), mirrored: true, maxImageWidth: 180 }}
            opponent={{ name: state.mob.name, hp: state.mobHp, maxHp: state.mobMaxHp, image: getCharacterImage("/character-images/monstr.svg") }}
            error={error}
            actions={state.status === "active" ? {
                attack: { label: counterattackPending ? "Ответный удар…" : turnPending ? "Ход…" : "Битва", disabled: actionsDisabled, onClick: () => { void actionCombat("attack"); } },
                inventory: { label: "Инвентарь", disabled: actionsDisabled, onClick: () => setShowInventory(true) },
                leave: { label: "Сбежать", disabled: actionsDisabled, onClick: () => { void actionCombat("flee"); } },
            } : null}
        >
            {showResult && (state.status === "victory" || state.status === "defeat") && (
                <Modal typeModal={TypeModal.ResultFight} state={state} />
            )}
            {showInventory && state.status === "active" && (
                <CombatInventoryDialog
                    title="Инвентарь в бою"
                    token={token}
                    player={player ? { ...player, health: playerHp, maxHp: state.playerMaxHp } : null}
                    inventory={inventory}
                    onPlayer={onPlayer}
                    onInventory={onInventory}
                    onClose={() => { if (!turnLocked.current) setShowInventory(false); }}
                    closeDisabled={turnPending}
                    error={error}
                    combat={{ onUsePotion: (itemType) => actionCombat("use", itemType), busy: actionsDisabled, healthFull: state.playerHp >= state.playerMaxHp }}
                />
            )}
        </BattleScreen>
    );
}
