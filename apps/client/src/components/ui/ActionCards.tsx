import ExchangeCard from "../../actionLocation/ExchangeCard";
import WalkCard from "../../actionLocation/WalkCard";
import MoneyCard from "../../actionLocation/MoneyCard";
import FightCard from "../../actionLocation/FightCard";
import ShopCard from "../../actionLocation/ShopCard";
import { LocationDto, LocationStateResponse, PlayerDto ,CombatStateResponse} from "@mmobot/shared";
import { TypeModal } from "./Modal/Modal";
const cards = {
  exchange: ExchangeCard,
  fight: FightCard,
  money: MoneyCard,
  walk: WalkCard,
  shop: ShopCard,
};
type CardProps = {
  token: string| null
  player: PlayerDto| null
  onPlayer: (player: PlayerDto) => void
  location?: LocationDto|null
  locationState: LocationStateResponse|null
  setShowModal: (value: boolean) => void
  showIsModal: boolean
  onError:(value:string)=>void
  onState:(state: CombatStateResponse) => void
  setTypeShowIsModal:(value: TypeModal | null) => void
  setInfoMessages:(value:{title: string; info: string }) => void;
}
export default function ActionCards({setInfoMessages,token,player,onPlayer,location,locationState,setShowModal,showIsModal,onError,onState,setTypeShowIsModal}: CardProps){
  return(
    <>
      {location?.actions.map((action) => {
        const CardComponent = cards[action as keyof typeof cards];

        if (!CardComponent) {
          return null;
        }

        return (
          <div key={action} className="h-23 w-full">
            <CardComponent setInfoMessages={setInfoMessages} setTypeShowIsModal={setTypeShowIsModal} location={location} onPlayer={onPlayer} onError={onError} onState={onState} showIsModal={showIsModal} setShowModal={setShowModal} token={token} locationState={locationState} player={player}/>
          </div>
        );
      })}
    </>
  )
}
