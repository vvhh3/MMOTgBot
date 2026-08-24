import fightImage from "../location/square-fight.svg"
import player2 from "../avatarPlayer/playerM.svg"
import { Button, Card,Progress,Text,Grid } from "@radix-ui/themes"
import { Link } from "react-router-dom"
import { LocationDto, LocationStateResponse, PlayerDto } from "@mmobot/shared";
import { getLocationState, startCombat } from "../api";
import { useState ,useEffect} from "react";

type FightProps = {
    token: string| null
    player: PlayerDto| null
    locationState: LocationStateResponse|null
}

export default function Fight({token,player,locationState}: FightProps){
    const [location,setLocation] = useState<LocationDto>()
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
    return(
        <div className="flex ">
            <div className="flex w-full flex-col justify-end"  style={{
                backgroundImage: `url(${location?.fightImg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                height:"100vh"
            }}>
                <div className="flex justify-around flex-row" >
                    <div className="flex flex-col">
                        <div>
                            <Card>
                                <div>
                                    <div className="flex flex-row justify-between gap-1.5">
                                        <Text>
                                            Mirbll
                                        </Text>
                                        <div >
                                            <Text size="1">70/100</Text>
                                        </div>
                                    </div>
                                    <Progress color="green" value={70}></Progress>
                                </div>
                            </Card>
                        </div>
                        <img className="h-[180px]" style={{transform: 'scaleX(-1)' }} src={player2}/>
                    </div>
                    <div>
                        <div>
                            <Card>
                                <div>
                                    <div className="flex flex-row justify-between gap-1.5">
                                        <Text>
                                            vvhh
                                        </Text>
                                        <div >
                                            <Text size="1">30/100</Text>
                                        </div>
                                    </div>
                                    <Progress color="green" value={30}></Progress>
                                </div>
                            </Card>
                        </div>
                        <img className="h-[180px] " src={player2}/>
                    </div>
                </div>
                <div>
                <Card className="h-[130px]" >
                    <Grid rows="2" columns="2" gap="2"  >
                        <Card>
                            <div className="flex justify-center items-center">
                                <Text size="3">Битва</Text>
                            </div>
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
                        <Link to="/">
                            <Card>
                                <div className="flex justify-center items-center">
                                    <Text size="3">Cбежать</Text>
                                </div>
                            </Card>
                        </Link>
                    </Grid>
                        
                        
                    
                </Card>
                </div>
            </div>
        </div>
    )
}