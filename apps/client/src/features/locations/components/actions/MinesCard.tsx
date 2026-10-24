import { Card,Text } from "@radix-ui/themes";
import { Link } from "react-router-dom";

export default function MinesCard() {
  return <Link to="/Casino/Mines" className="h-full w-full"><Card className="h-full w-full">
    <Text as="div" size="2" weight="bold" className="flex items-center gap-2">Мины <span aria-hidden className="text-[#3b304f]">✹</span></Text>
    <Text as="div" color="gray" size="1">Открывайте безопасные клетки и забирайте выигрыш</Text>
  </Card></Link>;
}
