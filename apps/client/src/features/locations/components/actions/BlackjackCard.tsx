import { ActionIcon } from "../../../../shared/ui/ActionIcon";
import { Card,Text } from "@radix-ui/themes";
import { Link } from "react-router-dom";

export default function BlackjackCard() {
  return(
    <Link to="/Casino/Blackjack" className="h-full w-full">
      <Card className="game-card h-full w-full">
        <Text as="div" size="2" weight="bold" className="flex items-center gap-2">21 <ActionIcon name="blackjack" /></Text>
        <Text as="div" color="gray" size="1">Наберите 21 и обыграйте дилера</Text>
      </Card>
    </Link>
  )

}
