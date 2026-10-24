import { Card,Text } from "@radix-ui/themes";
import { Link } from "react-router-dom";

export default function ShopCard() {
  return (
    <Link to="/Shop" className="h-full w-full">
      <Card className="h-full w-full">
        <Text as="div" size="2" weight="bold" className="flex items-center gap-2">
          Магазин
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E85D2F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9h18l-1.5-5h-15L3 9Z" />
            <path d="M4 9v11h16V9M9 20v-6h6v6M3 9c0 1.7 2.5 2.3 3.5 0 1 2.3 3.5 1.7 3.5 0 1 1.7 3.5 2.3 5 0 1.5 2.3 4 1.7 6 0" />
          </svg>
        </Text>
        <Text as="div" size="1" color="gray">Купить и продать предметы</Text>
      </Card>
    </Link>
  );
}
