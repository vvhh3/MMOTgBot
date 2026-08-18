import fightImage from "../public/fight.svg"
import player from "../public/playerM.svg"
import monstr from "../public/monstr.svg"
import { Button, Card,Progress,Text } from "@radix-ui/themes"
import { Link } from "react-router-dom"
export default function Fight(){
    return(
        <div className="flex "
            style={{
                backgroundImage: `url(${fightImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                height:"100vh"
            }}
            >
            <div className="flex w-full flex-col justify-end">
                <div className="flex justify-around flex-row">
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
                        <img className="h-[200px]" style={{transform: 'scaleX(-1)' }} src={player}/>
                    </div>
                    <div>
                        <div>
                            <Card>
                                <div>
                                    <div className="flex flex-row justify-between gap-1.5">
                                        <Text>
                                            Альтушка
                                        </Text>
                                        <div >
                                            <Text size="1">30/100</Text>
                                        </div>
                                    </div>
                                    <Progress color="green" value={30}></Progress>
                                </div>
                            </Card>
                        </div>
                        <img className="h-[200px] " src={monstr}/>
                    </div>
                </div>
                <div>
                <Card >
                    <div className=" flex flex-col gap-2">
                        <Button style={{width:"100%"}} color="orange">
                            Ударить
                        </Button>
                        <Link to="/">
                            <Button style={{width:"100%"}}>Выйти</Button>
                        </Link>
                    </div>
                </Card>
                </div>
            </div>
        </div>
    )
}