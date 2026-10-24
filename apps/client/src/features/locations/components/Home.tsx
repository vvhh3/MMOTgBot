import {
CombatStateResponse,
FriendsOverviewResponse,
LocationStateResponse,
PlayerDto,
PvpStateDto,
TradeStateDto
} from "@mmobot/shared";
import {
Box,
Card,
Grid,
Inset,
Progress,
Text
} from "@radix-ui/themes";
import { Link } from "react-router-dom";
import EnterAnimation from "../../../shared/ui/animations/EnterAnimation.tsx";
import { TypeModal } from "../../../shared/ui/modal/types";
import { getSkins } from "../../character/lib/skins";
import { getLocationImage } from "../lib/getLocationImage";
import ActionCards from "./ActionCards.tsx";
import map from '/mapMat.png';

type HomeProps = {
  token: string | null;
  player: PlayerDto | null;
  onPlayer: (player: PlayerDto) => void;
  locationState: LocationStateResponse | null;
  friendsOverview: FriendsOverviewResponse | null;
  pvpState: PvpStateDto | null
  tradeState: TradeStateDto | null
  onError:(value:string)=>void
  onState:(state: CombatStateResponse) => void
  showIsModal:boolean
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  setTypeShowIsModal:(value: TypeModal | null) => void
  typeShowIsModal:TypeModal | null
  setInfoMessages: (value: { title: string; info: string }) => void;
};

export default function Home({
  token,
  player,
  onPlayer,
  locationState,
  friendsOverview,
  pvpState,
  tradeState,
  onError,
  onState,
  showIsModal,
  setShowModal,
  setTypeShowIsModal,
  typeShowIsModal,
  setInfoMessages
}: HomeProps) {

  const location = locationState?.location;

  
  return (
    <div className="flex flex-col justify-center items-center ">
      <div
        className="flex flex-col justify-center items-center w-full h-full object-contain bg-bottom border-b-2"
        style={{
          backgroundImage: location ? `url(${getLocationImage(location.homeImg)})` : "none",
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
                value={player && ((player?.health * 100)/player?.maxHp)}
              />
            </Box>
            <img className="h-50 min-w-35 object-cover" src={getSkins(player?.avatar)} />
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
          <ActionCards setInfoMessages={setInfoMessages} setTypeShowIsModal={setTypeShowIsModal} onPlayer={onPlayer} onError={onError} onState={onState} showIsModal={showIsModal} setShowModal={setShowModal}  token={token} locationState={locationState} player={player} location={location}/>
        </Grid>
        :
        <EnterAnimation className="w-full flex justify-center items-center">
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
        </EnterAnimation>
      }
    </div>
  );
}
