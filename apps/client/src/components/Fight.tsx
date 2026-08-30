import player2 from "../avatarPlayer/playerM.svg"
import { Button, Card, Progress, Text, Grid } from "@radix-ui/themes"
import { LocationDto, LocationStateResponse, PlayerDto, PvpStateDto } from "@mmobot/shared";
import { getLocationState, pvpAction } from "../api";
import { useState, useEffect } from "react";
import { getLocationImage } from "../utils/getLocationImage";

type FightProps = {
    token: string | null
    player: PlayerDto | null
    locationState: LocationStateResponse | null
    pvpState: PvpStateDto | null
}

export default function Fight({ token, player, pvpState,locationState}: FightProps) { // Сделать задний фон
    const [location,setLocation] = useState<LocationDto>();
    useEffect(()=>{
        if(locationState){
            setLocation(locationState?.location)
        }
        
    },[])
    const doAction = async (action: "attack" | "flee") => {
        if (!token || !pvpState) return
        try {
            await pvpAction(token, pvpState.id, action)
        } catch (e) {
            alert(e instanceof Error ? e.message : "Ошибка действия")
        }
    }

    // Нет активного PvP — нечего показывать на этой странице
    if (!pvpState) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Text size="3">Нет активного боя</Text>
            </div>
        )
    }

    const isMyTurn = pvpState.myTurn
    const finished = pvpState.finished

    return (
        <div className="flex">
            <div className="flex w-full flex-col justify-end" style={{
                backgroundImage:`url(${location ? getLocationImage(location.fightImg): "none"})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                height: "100vh"
            }}>
                <div className="flex justify-around flex-row">
                    <div className="flex flex-col">
                        <div>
                            <Card>
                                <div>
                                    <div className="flex flex-row justify-between gap-1.5">
                                        <Text>{player?.name}</Text>
                                        <div>
                                            <Text size="1">{pvpState.myHp}/{pvpState.myMaxHp}</Text>
                                        </div>
                                    </div>
                                    <Progress color={pvpState.myHp <= 0 ? "red" : "green"} value={pvpState.myMaxHp > 0 ? (pvpState.myHp / pvpState.myMaxHp) * 100 : 0}></Progress>
                                </div>
                            </Card>
                        </div>
                        <img className="h-45" style={{ transform: 'scaleX(-1)' }} src={player2} />
                    </div>
                    <div>
                        <div>
                            <Card>
                                <div>
                                    <div className="flex flex-row justify-between gap-1.5">
                                        <Text>{pvpState.partnerName}</Text>
                                        <div>
                                            <Text size="1">{pvpState.partnerHp}/{pvpState.partnerMaxHp}</Text>
                                        </div>
                                    </div>
                                    <Progress color={pvpState.partnerHp <= 0 ? "red" : "green"} value={pvpState.partnerMaxHp > 0 ? (pvpState.partnerHp / pvpState.partnerMaxHp) * 100 : 0}></Progress>
                                </div>
                            </Card>
                        </div>
                        <img className="h-45 " src={player2} />
                    </div>
                </div>

                <div className="mb-4 text-center">
                    {finished && pvpState.isWon !== null ? (
                        <Text size="4" weight="bold" style={{ color: pvpState.isWon ? "#22c55e" : "#ef4444" }}>
                            {pvpState.isWon ? "Победа!" : "Поражение"}
                        </Text>
                    ) : finished ? (
                        <Text size="4" weight="bold">Ничья</Text>
                    ) : (
                        <Text size="3" weight="bold">{isMyTurn ? "Ваш ход" : `Ход ${pvpState.partnerName}`}</Text>
                    )}
                </div>

                <div>
                    <Card className="h-32.5">
                        <Grid rows="2" columns="2" gap="2">
                            <Card>
                                <button className="w-full h-full flex justify-center items-center" disabled={!isMyTurn || finished} onClick={() => doAction("attack")}>
                                    <Text size="3">Битва</Text>
                                </button>
                            </Card>
                            <Card>
                                <div className="flex justify-center items-center">
                                    <Text size="3">Инвентарь</Text>
                                </div>
                            </Card>
                            <Card>
                                <div className="flex justify-center items-center">
                                    <Text size="3">хз</Text>
                                </div>
                            </Card>
                            <Card>
                                <button className="w-full h-full flex justify-center items-center" disabled={finished} onClick={() => doAction("flee")}>
                                    <Text size="3">Сбежать</Text>
                                </button>
                            </Card>
                        </Grid>
                    </Card>
                </div>
            </div>
        </div>
    )
}
