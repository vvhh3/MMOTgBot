import { ActionIcon } from "../../../../shared/ui/ActionIcon";
import { Card,Text } from "@radix-ui/themes";
import { Link } from "react-router-dom";

export default function MinesCard() {
  return <Link to="/Casino/Mines" className="h-full w-full"><Card className="game-card h-full w-full">
    <Text as="div" size="2" weight="bold" className="flex items-center gap-2">Мины <ActionIcon name="mines" /></Text>
    <Text as="div" color="gray" size="1">Открывайте безопасные клетки и забирайте выигрыш</Text>
  </Card></Link>;
}
