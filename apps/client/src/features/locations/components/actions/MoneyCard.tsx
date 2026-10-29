import { ActionIcon } from "../../../../shared/ui/ActionIcon";
import { LocationDto,PlayerDto } from "@mmobot/shared";
import { Card,Text } from "@radix-ui/themes";
import { useEffect,useState } from "react";
import { TypeModal } from "../../../../shared/ui/modal/types";
import { dailyActivities } from "../../api";
type MoneyCardProps={
    location?: LocationDto|null
    player: PlayerDto| null,
    onPlayer: (player: PlayerDto) => void,
    token:string |null
    setInfoMessages: (value: { title: string; info: string }) => void;
    setShowModal: (value: boolean) => void;
    setTypeShowIsModal:(value: TypeModal | null) => void
}
export default function MoneyCard({setTypeShowIsModal,setShowModal,setInfoMessages,location,player,onPlayer,token}:MoneyCardProps){
    const [now, setNow] = useState(Date.now);
    const [loading, setLoading] = useState(false);
    const [serverCooldown, setServerCooldown] = useState<{ playerId: number; locationName: string; until: number } | null>(null);
    const savedUntil = Date.parse(player?.cooldowns?.[location?.name ?? ""] ?? "") || 0;
    const responseUntil = serverCooldown?.playerId === player?.id && serverCooldown?.locationName === location?.name
        ? serverCooldown?.until ?? 0 : 0;
    const secondsLeft = Math.max(0, Math.ceil((Math.max(savedUntil, responseUntil) - now) / 1000));
    const timer = [Math.floor(secondsLeft / 3600), Math.floor(secondsLeft / 60) % 60, secondsLeft % 60]
        .map(value => String(value).padStart(2, "0")).join(":");

    const showCooldown = () => {
        setInfoMessages({ title: "До следующего купания", info: `Осталось: ${timer}` });
        setTypeShowIsModal(TypeModal.Information);
        setShowModal(true);
    };

    useEffect(() => {
        const refresh = () => setNow(Date.now());
        const interval = window.setInterval(refresh, 1000);
        document.addEventListener("visibilitychange", refresh);
        return () => {
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", refresh);
        };
    }, []);

    const activities = async () => {
        if (!token || !player || !location || loading || secondsLeft > 0) return
        setLoading(true)
        try {
            const message = await dailyActivities(token, location.name)
            if (message.nextAvailableAt) {
                setServerCooldown({ playerId: player.id, locationName: location.name, until: Date.parse(message.nextAvailableAt) || 0 });
                setNow(Date.now());
            }
            if (message.code == "COOLDOWN") {
                setInfoMessages({
                    title: "Ещё не время",
                    info: message.text,
                });
                setShowModal(true)
                setTypeShowIsModal(TypeModal.Information)

            }else if(message.code == "SUCCESS"){
                onPlayer(message.player)
                setInfoMessages({title:message.title,info:message.text})
                setShowModal(true)
                setTypeShowIsModal(TypeModal.Information)
            }
        } catch (e) {
            console.error(e)
            setInfoMessages({
                title: "Ошибка",
                info: "Что-то пошло не так, попробуйте позже",
            });
            setShowModal(true)
            setTypeShowIsModal(TypeModal.Information)
        } finally {
            setLoading(false)
        }

    }
    return(
        <Card className="game-card h-full w-full">
            <button type="button" className="flex w-full flex-row justify-between text-left disabled:cursor-default" disabled={!token || !player || !location || loading} onClick={secondsLeft > 0 ? showCooldown : activities}>
                <div className="max-w-60">
                    <Text className="flex items-center gap-2" as="div" size="2" weight="bold">
                        <div className="flex-row flex gap-2">
                            Фонтан
                            <ActionIcon name="fountain" />                                </div>
                    </Text>
                    <Text as="div" color="gray" size="1">
                        Можете нырнуть и достать со дна монеты
                    </Text>
                </div>
            </button>
        </Card>
    )
}
