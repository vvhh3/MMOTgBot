import ExchangeCard from "../../actionLocation/ExchangeCard";
import WalkCard from "../../actionLocation/WalkCard";
import MoneyCard from "../../actionLocation/MoneyCard";
import FightCard from "../../actionLocation/FightCard";
import { LocationDto, LocationStateResponse, PlayerDto ,CombatStateResponse} from "@mmobot/shared";
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
  setShowModalTrade: (value: boolean) => void
  showModalTrade: boolean
  setShowModalPvp: (value: boolean) => void
  showModalPvp: boolean
  onError:(value:string)=>void
  onState:(state: CombatStateResponse) => void
}
export default function ActionCards({token,player,location,locationState,showModalPvp,setShowModalPvp,showModalTrade,setShowModalTrade,onError,onState}: CardProps){
  return(
    <>
      {location?.actions.map((action) => {
        const CardComponent = cards[action as keyof typeof cards];

        if (!CardComponent) {
          return null;
        }

        return <CardComponent onError={onError} onState={onState} showModalPvp={showModalPvp} setShowModalPvp={setShowModalPvp} setShowModalTrade={setShowModalTrade} showModalTrade={showModalTrade} key={action} token={token} locationState={locationState} player={player}/>;
      })}
    </>
  )
}