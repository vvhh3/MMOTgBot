import fightImage from "../public/fight.svg"
import playerM from "../public/playerM.svg"
import monstr from "../public/monstr.svg"
import { Button, Card, Progress, Text, Grid, Flex } from "@radix-ui/themes"
import { Link, useNavigate } from "react-router-dom"
import { CombatStateResponse, PlayerDto } from "@mmobot/shared"
import { useEffect, useState } from "react"
import { combatAction, getCombatState } from "../api"

type TakeAWalkProps = {
    token: string | null
    player: PlayerDto | null
    combat: CombatStateResponse | null
    onCombat: (combat: CombatStateResponse | null) => void
}

export default function TakeAWalk({ token, player, combat, onCombat }: TakeAWalkProps) {

    const [error, setError] = useState<string | null>(null)
    const [state,setState] = useState<CombatStateResponse>()

    const navigate = useNavigate()

    const getState = () => {
        if(!token) return
        getCombatState(token)
        .then((res) => setState(res))
        .catch(e => setError(e)) 
    }

    useEffect(() => {
        getState()
    },[token])

    const actionCombat = async (action: "attack" | "flee") => {
        try {
            if (!token) return
            const res = await combatAction(token, action)
            // onCombat(res.state)
            setState(res.state)
            getState()
            if (res.state.status === "fled") {
                navigate("/")
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Ошибка запроса, попробуйте попозже')
        }
    }
    return (
        <div className="flex ">
            <div className="flex w-full flex-col justify-end" style={{
                backgroundImage: `url(${fightImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                height: "100vh"
            }}>
                <div className="flex justify-around flex-row" >
                    {error && (<p className="text-red-500 text-2xl">{error}</p>)}
                    <div className="flex flex-col">
                        <div>
                            <Card>
                                <div>
                                    <div className="flex flex-row justify-between gap-1.5">
                                        <Text>
                                            {player?.name}
                                        </Text>
                                        <div >
                                            <Text size="1">{state?.playerHp}/{state?.playerMaxHp}</Text>
                                        </div>
                                    </div>
                                    <Progress color="green" value={state?.playerHp}></Progress>
                                </div>
                            </Card>
                        </div>
                        <img className="h-45" style={{ transform: 'scaleX(-1)' }} src={playerM} />
                    </div>
                    <div>
                        <div>
                            <Card>
                                <div>
                                    <div className="flex flex-row justify-between gap-1.5">
                                        <Text>
                                            {state?.mob.name}
                                        </Text>
                                        <div >
                                            <Text size="1">{state?.mobHp}/{state?.mobMaxHp}</Text>
                                        </div>
                                    </div>
                                    <Progress color="green" value={state?.mobHp}></Progress>
                                </div>
                            </Card>
                        </div>
                        <img className="h-45 " src={monstr} />
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
                                <Button onClick={() => { onCombat(null); navigate("/") }}>
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