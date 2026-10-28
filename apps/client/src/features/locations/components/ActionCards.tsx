import SpecialWalkCard from './actions/SpecialWalkCard';
import { CombatStateResponse,LocationDto,LocationStateResponse,PlayerDto } from "@mmobot/shared";
import ButtonAnimation from "../../../shared/ui/animations/ButtonAnimation";
import EnterAnimation from "../../../shared/ui/animations/EnterAnimation";
import { TypeModal } from "../../../shared/ui/modal/types";
import BlackjackCard from "./actions/BlackjackCard";
import ExchangeCard from "./actions/ExchangeCard";
import FightCard from "./actions/FightCard";
import LadderCard from "./actions/LadderCard";
import MinesCard from "./actions/MinesCard";
import MoneyCard from "./actions/MoneyCard";
import ShopCard from "./actions/ShopCard";
import WalkCard from "./actions/WalkCard";
const cards = {
  special_walk: SpecialWalkCard,
  exchange: ExchangeCard,
  fight: FightCard,
  money: MoneyCard,
  walk: WalkCard,
  shop: ShopCard,
  mines: MinesCard,
  blackjack: BlackjackCard,
  ladder: LadderCard,
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
          <EnterAnimation key={action} className="min-h-23 w-full md:max-h-24">
            <ButtonAnimation className="w-full h-full" >
              <CardComponent setInfoMessages={setInfoMessages} setTypeShowIsModal={setTypeShowIsModal} location={location} onPlayer={onPlayer} onError={onError} onState={onState} showIsModal={showIsModal} setShowModal={setShowModal} token={token} locationState={locationState} player={player}/>
            </ButtonAnimation>
          </EnterAnimation>
        );
      })}
    </>
  )
}
