import { ActionIcon } from "../../../../shared/ui/ActionIcon";
import { Card,Text } from "@radix-ui/themes";
import { Link } from "react-router-dom";

export default function LadderCard() {
  return <Link to="/Casino/Ladder" className="h-full w-full"><Card className="game-card h-full w-full">
    <Text as="div" size="2" weight="bold" className="flex items-center gap-2">Лестница <ActionIcon name="ladder" /></Text>
    <Text as="div" color="gray" size="1">Найдите верную ступень и поднимитесь выше</Text>
  </Card></Link>;
}
