import { Card, Text } from "@radix-ui/themes";
import { Link } from "react-router-dom";

export default function LadderCard() {
  return <Link to="/Casino/Ladder" className="h-full w-full"><Card className="h-full w-full">
    <Text as="div" size="2" weight="bold" className="flex items-center gap-2">Лестница <span aria-hidden className="text-[#3b304f]">↟</span></Text>
    <Text as="div" color="gray" size="1">Найдите верную ступень и поднимитесь выше</Text>
  </Card></Link>;
}
