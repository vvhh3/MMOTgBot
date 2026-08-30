import {
  Flex,
  Card,
  Text,
  Button,
  Box,
  Progress,
  Inset,
  Strong,
  Grid,
} from "@radix-ui/themes";
import { Link, useNavigate } from "react-router-dom";
import playerM from "../avatarPlayer/playerM.svg";
import playerG from "../avatarPlayer/playerG.svg";
import { useEffect, useState } from "react";
import {
  LocationDto,
  LocationStateResponse,
  PlayerDto,
  FriendsOverviewResponse,
  PvpStateDto,
} from "@mmobot/shared";
import { getLocationState, startCombat } from "../api";
import { getLocationImage } from "../utils/getLocationImage";
import ModalSelectOfFriend from "./ui/Modal/ModalSelectOfFriend";
import ActionCards from "./ui/ActionCards.tsx";
import map from '../components/ui/Maps/mapMat.png'
type HomeProps = {
  token: string | null;
  player: PlayerDto | null;
  locationState: LocationStateResponse | null;
  friendsOverview: FriendsOverviewResponse | null;
  pvpState: PvpStateDto | null
};

export default function Home({
  token,
  player,
  locationState,
  friendsOverview,
  pvpState
}: HomeProps) {
  const [showModalTrade, setShowModalTrade] = useState(false);
  const [showModalPvp, setShowModalPvp] = useState(false);

  const [location, setLocation] = useState<LocationDto>();
  useEffect(() => {
    if (locationState) {
      setLocation(locationState.location);
      return;
    }

    if (!token || !player?.currentLocationId) return;
    getLocationState(token, player.currentLocationId)
      .then((res) => {
        setLocation(res.location);
      })
      .catch((error) => alert(error ?? "Ошибка"));
  }, [token, locationState, player?.currentLocationId]);

  
  return (
    <div className="flex flex-col justify-center items-center ">
      <div
        className="flex flex-col justify-center items-center w-full h-full object-contain bg-bottom border-b-2"
        style={{
          backgroundImage: `url(${location ? getLocationImage(location.homeImg) : "none"})`,
        }}
      >
        <div className="bg-[#00000074] rounded-2xl px-2.5 m-0.75">
          <header className="text-[#E85D2F] font-[800px]">
            {location?.name}
          </header>
        </div>
        <Grid columns="3" rows="1">
          <div className="flex flex-col justify-center items-center ">
            <button className="flex justify-center items-center rounded-4xl h-4 w-4 bg-[#E85D2F] text-amber-50 ">
              +
            </button>
          </div>
          <div className="flex flex-col justify-center items-center px-1.25">
            <div className="bg-[#00000074] rounded-2xl px-2.5 m-0.75">
              <p className="font-medium text-[#ffffff65]  ">{player?.name}</p>
            </div>
            <Box width="100%" maxWidth="120px" height="9px">
              <Progress
                style={{ background: "white" }}
                size="1"
                color="green"
                value={10}
              />
            </Box>
            <img className="h-37.5 min-w-35" src={playerM} />
          </div>
          <div className="flex flex-col justify-center items-center ">
            <button className="flex justify-center items-center rounded-4xl h-4 w-4 bg-[#E85D2F] text-amber-50 ">
              +
            </button>
          </div>
          {/* <div className='flex flex-col justify-center items-center pr-[5px] pl-[5px]'>
                     <div className="bg-[#00000074] rounded-[16px] pr-[10px] pl-[10px] m-[3px]"> 
                        <p className='font-medium text-[#ffffff65]  '>Xz</p>
                    </div>
                    <Box width="100%" maxWidth="120px" height="9px" >
                        <Progress style={{background:"white"}} size="1" color='green' value={69}/>
                    </Box>
                    <img className='h-[150px] min-w-[140px]' src={player2} />
                </div> */}
        </Grid>
      </div>
      {location ? 
        <Grid
          columns="2"
          rows="2"
          maxWidth="700px"
          gap="2"
          style={{ padding: "20px" }}
        >
          <ActionCards showModalPvp={showModalPvp} setShowModalPvp={setShowModalPvp} setShowModalTrade={setShowModalTrade} showModalTrade={showModalTrade} token={token} locationState={locationState} player={player} location={location}/>
        </Grid>
        :
        <Box className="w-[70%] p-2.5">
          <Link to="/Map">
              <Card size="2" >
                  <Inset  side="top" pb="current" style={{ borderBottom: "solid 2px",paddingBottom:"0px" }} >
                      <img
                          src={map}
                          alt="Bold typography"
                          style={{
                              display: "block",
                              objectFit: "cover",
                              width: "100%",
                              height: 140,
                              backgroundColor: "var(--gray-5)",
                              objectPosition: "46% 60%",
                              transformOrigin: `${35}% ${45}%`,
                          }}
                      />
                  </Inset>
                  <Text as="div" size="2" weight="bold">
                      Выбери локацию
                  </Text>
                  <Text as="div" color="gray" size="1">
                      Нажми чтоб посмотреть карту
                  </Text>
              </Card>
          </Link>
        </Box>
      }

      <ModalSelectOfFriend
        isShow={showModalTrade}
        token={token}
        onClose={() => setShowModalTrade(false)}
        title="Выберите друга для обмена"
        textOnButton="Обмен"
        type="trade"
        player={player}
        />

      <ModalSelectOfFriend
        isShow={showModalPvp}
        token={token}
        onClose={() => setShowModalPvp(false)}
        title="Выберите своего противника"
        textOnButton="Вызвть на бой"
        type="figth"
        pvpState={pvpState}
        player={player}
      />
    </div>
  );
}
