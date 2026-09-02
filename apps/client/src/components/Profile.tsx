import playerM from '../avatarPlayer/playerM.svg'
import map from '../components/ui/Maps/mapMat.png'
import { Flex, Card, Text, Button, Box, Progress, Inset, Strong, Grid } from "@radix-ui/themes";
import { Link } from 'react-router-dom'
import { PlayerDto,LocationStateResponse,LocationDto} from '@mmobot/shared';
import { useEffect, useState } from 'react';

type ProfileProps = {
    player: PlayerDto | null
    locationState:LocationStateResponse|null
    setWindowSkillPoints: React.Dispatch<React.SetStateAction<boolean>>;
}
export default function Profile({ player,locationState,setWindowSkillPoints }: ProfileProps) {
    const [location, setLocation] = useState<LocationDto>();
    useEffect(() => {
        if (locationState) {
          setLocation(locationState.location);
          return;
        }
    },[])
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
                        </Text>
                        <Box maxWidth="300px">
                            <Progress color='green' value={player && ((player?.health * 100)/player?.maxHp)} />
                        </Box>
                        <Text as="div" color="gray" size="2">
                            {player?.health}/{player?.maxHp}
                        </Text>
                        <Text as="div" color="gray" size="1">
                            Нажми чтоб восстановить здоровье
                        </Text>
                    </Card>
                </button>
                <button onClick={()=>setWindowSkillPoints(true)}>
                    <Card variant="classic">
                        <Text as="div" size="2" weight="bold">
                            Уровень {player?.level}
                        </Text>
                        <Box maxWidth="300px">
                            <Progress
                                color='orange'
                                value={(player?.xp ?? 0) - (player?.xpLevelStart ?? 0)}
                                max={player?.xpNextLevel != null ? player.xpNextLevel - player.xpLevelStart : 1}
                            />
                        </Box>
                        <Text as="div" color="gray" size="2">
                            {player?.xpNextLevel != null
                                ? `${player.xp}/${player.xpNextLevel} (ещё ${player.xpNextLevel - player.xp})`
                                : `${player?.xp} — максимальный уровень`}
                        </Text>
                        <Text as="div" color="gray" size="1">
                            Нажми чтоб узнать больше
                        </Text>
                    </Card>
                </button>
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
                                        objectPosition: `${location?.x}% ${location?.y}%`,
                                        transformOrigin: `${location?.x}% ${location?.y}%`,
                                        transform: "scale(6)",

                                    }}
                                />
                            </Inset>
                            <Text as="div" size="2" weight="bold">
                                {location ? 
                                    location?.name
                                :
                                    "Выберите локацию"
                                }
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
                                <p>{player?.points}</p>
                                <svg className="h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <circle cx="12" cy="12" r="10" stroke="#ff7b00" stroke-width="2"></circle> <path d="M15 9.94728C14.5 9.3 13.8 8.5 12 8.5C10.2 8.5 9 9.51393 9 9.94728C9 10.3806 9.06786 10.9277 10 11.5C10.7522 11.9618 12.6684 12.0439 13.5 12.5C14.679 13.1467 14.8497 13.8202 14.8497 14.0522C14.8497 14.6837 13.4175 15.4852 12 15.5C10.536 15.5153 9.5 14.7 9 14.0522" stroke="#ff7b00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M12 7V17" stroke="#ff7b00" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
                            </div>
                            <div className='flex items-end flex-col'>
                                <svg style={{
                                    height: 70,
                                    backgroundSize: "cover",
                                    backgroundPosition: "center",
                                    backgroundRepeat: "no-repeat"
                                }} fill="#000000" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" id="memory-bag-personal"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M17 15H9V17H7V15H5V19H17V15M17 9H16V8H15V7H7V8H6V9H5V13H17V9M13 11H9V10H10V9H12V10H13V11M3 8H4V6H6V5H7V2H8V1H14V2H15V5H16V6H18V8H19V20H18V21H4V20H3V8M9 3V5H13V3H9Z"></path></g></svg>
                            </div>
                        </Grid>
                    </Card>
                </Link>
            </Grid>
        </div>
    )
}