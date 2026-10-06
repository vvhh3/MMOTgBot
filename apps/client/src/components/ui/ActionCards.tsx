import ExchangeCard from "../../actionLocation/ExchangeCard";
import WalkCard from "../../actionLocation/WalkCard";
import MoneyCard from "../../actionLocation/MoneyCard";
import FightCard from "../../actionLocation/FightCard";
import { LocationDto, LocationStateResponse, PlayerDto ,CombatStateResponse} from "@mmobot/shared";
import { TypeModal } from "./Modal/Modal";
const cards = {
  exchange: ExchangeCard,
  fight: FightCard,
  money: MoneyCard,
  walk: WalkCard,
};
type CardProps = {
  token: string| null
  player: PlayerDto| null
  location?: LocationDto|null
  locationState: LocationStateResponse|null
  setShowModal: (value: boolean) => void
  showIsModal: boolean
  onError:(value:string)=>void
  onState:(state: CombatStateResponse) => void
  setTypeShowIsModal:(value: TypeModal | null) => void
  setInfoMessages:(value:{title: string; info: string }) => void;
}
export default function ActionCards({setInfoMessages,token,player,location,locationState,setShowModal,showIsModal,onError,onState,setTypeShowIsModal}: CardProps){
  return(
    <>
      {location?.actions.map((action) => {
        const CardComponent = cards[action as keyof typeof cards];

        if (!CardComponent) {
          return null;
        }

        return <CardComponent setInfoMessages={setInfoMessages} setTypeShowIsModal={setTypeShowIsModal} location={location}  onError={onError} onState={onState} showIsModal={showIsModal} setShowModal={setShowModal} key={action} token={token} locationState={locationState} player={player}/>;
      })}
    </>
  )
}