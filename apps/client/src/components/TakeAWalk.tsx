import { getSkins } from "../utils/skins";

import monstr from "/monstr.svg"
import { Button, Card, Progress, Text, Grid, Flex } from "@radix-ui/themes"
import { Link, useNavigate } from "react-router-dom"
import { CombatStateResponse, InventoryItemDto, PlayerDto,LocationDto,LocationStateResponse } from "@mmobot/shared"
import { useEffect, useState } from "react"
import { combatAction,getLocationState} from "../api"
import { getLocationImage } from "../utils/getLocationImage"

type TakeAWalkProps = {
    token: string | null
    player: PlayerDto | null
    onPlayer: (state: PlayerDto) => void
    onInventory: (state: InventoryItemDto[]) => void
    locationState: LocationStateResponse|null
    onError:(value:string)=>void
    onState:(state: CombatStateResponse) => void
    state:CombatStateResponse | undefined
    error:string | null
}

export default function TakeAWalk({ token, player,onPlayer,onInventory,locationState,onState,state,onError,error}: TakeAWalkProps) {
    const [location,setLocation] = useState<LocationDto>()

    const navigate = useNavigate()
    useEffect(() => {
        if(locationState){
            setLocation(locationState.location)
            return
        }

        if(!token || !player?.currentLocationId) return
        getLocationState(token, player.currentLocationId)
        .then((res) => {setLocation(res.location)})
        .catch((error) => alert(error ?? "Ошибка"))

    },[token,locationState,player?.currentLocationId])

    const actionCombat = async (action: "attack" | "flee") => {
        try {
            if (!token) return
            const res = await combatAction(token, action)
            onState(res.state)
            onPlayer(res.player)
            onInventory(res.inventory)
            if (res.state.status === "fled")navigate("/")
        } catch (e) {
            onError(e instanceof Error ? e.message : 'Ошибка запроса, попробуйте попозже')
        }
    }
    if (!state) {
        useEffect(()=>{
            navigate("/",{replace:true})
        },[state])
        return (
            <div className="flex items-center justify-center h-screen">
                <Text size="3">Нет активного боя</Text>
            </div>
        )
    }
    return (
        <div className="flex ">
            <div className="flex w-full flex-col justify-end" style={{
                backgroundImage:`url(${location ? getLocationImage(location.fightImg): getLocationImage('fonNetralitet.svg')})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                height: "100vh"
            }}>
                <div className="grid w-full grid-cols-2 items-start gap-x-2 px-2">
                    {error && (<p className="col-span-2 text-red-500 text-2xl">{error}</p>)}
                    <Card className="w-full min-w-0">
                        <div className="min-w-0">
                            <div className="flex min-w-0 flex-row items-start justify-between gap-1.5">
                                <Text className="min-w-0 flex-1 whitespace-normal break-words">
                                    {player?.name}
                                </Text>
                                <div className="shrink-0">
                                    <Text size="1">{state?.playerHp}/{state?.playerMaxHp}</Text>
                                </div>
                            </div>
                            <Progress color="green" value={state?.playerHp}></Progress>
                        </div>
                    </Card>
                    <Card className="w-full min-w-0">
                        <div className="min-w-0">
                            <div className="flex min-w-0 flex-row items-start justify-between gap-1.5">
                                <Text className="min-w-0 flex-1 whitespace-normal break-words">
                                    {state?.mob.name}
                                </Text>
                                <div className="shrink-0">
                                    <Text size="1">{state?.mobHp}/{state?.mobMaxHp}</Text>
                                </div>
                            </div>
                            <Progress color="green" value={state?.mobHp}></Progress>
                        </div>
                    </Card>
                    <div className="flex justify-center items-center">
                        <img className="h-45 w-full max-w-[180px] object-contain" style={{ transform: 'scaleX(-1)' }} src={getSkins(player?.avatar)} />
                    </div>
                    <div className="flex justify-center items-center">
                        <img className="h-45 w-full object-contain" src={monstr} />
                    </div>
                </div>
                <div>
                    {state?.status === "active" && (
                        <Card className="h-32.5" >
                            <Grid rows="2" columns="2" gap="2"  >

                                <button onClick={() => actionCombat("attack")}>
                                    <Card>
                                        <div className="flex justify-center items-center">
                                            <Text size="3">Битва</Text>
                                        </div>
                                    </Card>
                                </button>

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
                                <button onClick={() => actionCombat("flee")}>
                                    <Card>
                                        <div className="flex justify-center items-center">
                                            <Text size="3">Cбежать</Text>
                                        </div>
                                    </Card>
                                </button>
                            </Grid>
                        </Card>
                    )}

                    {state && state.status !== "active" && (
                        <Card className="mb-2">
                            <Flex direction="column" gap="2" align="center">
                                <Text size="4" weight="bold" color={
                                    state.status === "victory" ? "green" : "red"
                                }>
                                    {state.status === "victory" && "Победа!"}
                                    {state.status === "defeat" && "Вы проиграли"}
                                    {state.status === "fled" && "Вы сбежали"}
                                </Text>
                                {/* последние записи лога — там же про лут и опыт */}
                                <Text size="1" color="gray">
                                    {state.log.slice(-3).map((l) => l.text).join(" · ")}
                                </Text>
                                <Button onClick={() => { navigate("/") }}>
                                    Вернуться в город
                                </Button>
                            </Flex>
                        </Card>
                    )}

                </div>
            </div>
        </div>
    )
}
