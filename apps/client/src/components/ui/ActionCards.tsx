import ExchangeCard from "../../actionLocation/ExchangeCard";
import FightCard from "../../actionLocation/FightCard";
import MoneyCard from "../../actionLocation/MoneyCard";
import WalkCard from "../../actionLocation/WalkCard";
import { LocationDto, LocationStateResponse, PlayerDto } from "@mmobot/shared";
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
}
export default function ActionCards({token,player,location,locationState}: CardProps){
  return(
    <>
      {location?.actions.map((action) => {
        const CardComponent = cards[action as keyof typeof cards];

        if (!CardComponent) {
          return null;
        }

        return <CardComponent key={action} token={token} locationState={locationState} player={player}/>;
      })}
    </>
  )
}