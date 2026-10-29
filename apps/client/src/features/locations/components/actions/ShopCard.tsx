import { ActionIcon } from "../../../../shared/ui/ActionIcon";
import { Card,Text } from "@radix-ui/themes";
import { Link } from "react-router-dom";

export default function ShopCard() {
  return (
    <Link to="/Shop" className="h-full w-full">
      <Card className="game-card h-full w-full">
        <Text as="div" size="2" weight="bold" className="flex items-center gap-2">
          Магазин
          <ActionIcon name="shop" />
        </Text>
        <Text as="div" size="1" color="gray">Купить и продать предметы</Text>
      </Card>
    </Link>
  );
}
