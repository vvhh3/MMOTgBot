import playerM from '../public/playerM.svg'
import map from '../components/ui/Maps/mapMat.png'
import bag from '../public/bag.svg'
import { Flex, Card, Text, Button, Box, Progress, Inset, Strong, Grid } from "@radix-ui/themes";
import { Link } from 'react-router-dom'
import { PlayerDto } from '@mmobot/shared';


type ProfileProps = {
    player: PlayerDto | null
}

export default function Profile({ player }: ProfileProps) {

    return (
        <div className='flex flex-col items-center h-full ' >
            <div className='flex flex-col justify-center items-center '>
                <p className='font-bold'>{player?.name}</p>
                <img className='h-50' src={playerM} />
            </div>
            <Grid columns="2" gap="3" style={{ padding: "20px" }}>
                <button>
                    <Card variant="surface"  >
                        <Text as="div" size="2" weight="bold">
                            Здоровье
                            {import.meta.env.VITE_ADMIN_IDS && (
                                <div className="fixed top-16 left-2 z-50 bg-black text-white text-xs p-1">
                                    env=[{import.meta.env.VITE_ADMIN_IDS}] player={player?.id}
                                </div>
                            )}
                        </Text>
                        <Box maxWidth="300px">
                            <Progress color='green' value={100} />
                        </Box>
                        <Text as="div" color="gray" size="2">
                            {player?.health}/{player?.maxHp}
                        </Text>
                        <Text as="div" color="gray" size="1">
                            Нажми чтоб восстановить здоровье
                        </Text>
                    </Card>
                </button>

                <Card variant="classic">
                    <Text as="div" size="2" weight="bold">
                        Уровень 4
                    </Text>
                    <Box maxWidth="300px">
                        <Progress color='orange' value={player?.xp} />
                    </Box>
                    <Text as="div" color="gray" size="2">
                        {player?.xp}/400
                    </Text>
                    <Text as="div" color="gray" size="1">
                        Нажми чтоб узнать больше
                    </Text>
                </Card>
                <Box >
                    <Link to="/Map">
                        <Card size="2">
                            <Inset clip="padding-box" side="top" pb="current" style={{ borderBottom: "solid 2px" }} >
                                <img
                                    src={map}
                                    alt="Bold typography"
                                    style={{
                                        display: "block",
                                        objectFit: "cover",
                                        width: "100%",
                                        height: 140,
                                        backgroundColor: "var(--gray-5)",
                                        objectPosition: "40% 31%",
                                        transformOrigin: `${31}% ${40}%`,
                                        transform: "scale(6)",

                                    }}
                                />
                            </Inset>
                            <Text as="div" size="2" weight="bold">
                                Площадь
                            </Text>
                            <Text as="div" color="gray" size="1">
                                Нажми чтоб посмотреть карту
                            </Text>
                        </Card>
                    </Link>
                </Box>
                <Link to="/Inventory">
                    <Card variant="classic" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%" }}>
                        <Grid>
                            <Text as="div" size="2" weight="bold">
                                Инвентарь
                            </Text>
                            <Text as="div" color="gray" size="2" >
                                Нажми чтоб открыть инвентарь
                            </Text>
                        </Grid>
                        <Grid rows="1" columns="2">
                            <div className='flex items-end'>
                                <p>500</p>
                                <svg className="h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <circle cx="12" cy="12" r="10" stroke="#ff7b00" stroke-width="2"></circle> <path d="M15 9.94728C14.5 9.3 13.8 8.5 12 8.5C10.2 8.5 9 9.51393 9 9.94728C9 10.3806 9.06786 10.9277 10 11.5C10.7522 11.9618 12.6684 12.0439 13.5 12.5C14.679 13.1467 14.8497 13.8202 14.8497 14.0522C14.8497 14.6837 13.4175 15.4852 12 15.5C10.536 15.5153 9.5 14.7 9 14.0522" stroke="#ff7b00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M12 7V17" stroke="#ff7b00" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
                            </div>
                            <div className='flex items-end flex-col'>
                                <img src={bag} style={{
                                    height: 70,
                                    backgroundSize: "cover",
                                    backgroundPosition: "center",
                                    backgroundRepeat: "no-repeat"
                                }} />
                            </div>
                        </Grid>
                    </Card>
                </Link>
            </Grid>
        </div>
    )
}