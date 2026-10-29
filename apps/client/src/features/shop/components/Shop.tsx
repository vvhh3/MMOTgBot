import type { InventoryItemDto,ItemDto,PlayerDto } from "@mmobot/shared";
import { Button,Card,Tabs,Text } from "@radix-ui/themes";
import { useEffect,useMemo,useState } from "react";
import ItemDetails from "../../items/components/ItemDetails";
import { buyShopItem,getShop,sellShopItem } from "../api";

type ShopProps = {
  token: string | null;
  player: PlayerDto | null;
  inventory: InventoryItemDto[];
  onPlayer: (player: PlayerDto) => void;
  onInventory: (inventory: InventoryItemDto[]) => void;
};

export default function Shop({ token, player, inventory, onPlayer, onInventory }: ShopProps) {
  const [catalog, setCatalog] = useState<ItemDto[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyItem, setBusyItem] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getShop(token).then((result) => setCatalog(result.items))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Не удалось загрузить магазин"));
  }, [token]);

  const catalogById = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);
  const ownedForSale = inventory.flatMap((entry) => {
    const item = catalogById.get(entry.itemType);
    return item && item.sellPrice > 0 ? [{ ...entry, item }] : [];
  });

  const transact = async (item: ItemDto, action: "buy" | "sell", entry?: InventoryItemDto) => {
    if (!token || busyItem) return;
    const key = `${action}-${entry?.id ?? item.id}`;
    const quantity = entry?.weaponLevel != null ? 1 : Math.max(1, Math.min(99, entry?.quantity ?? 99, Math.floor(quantities[key] ?? 1)));
    setBusyItem(key);
    setError(null);
    setNotice(null);
    try {
      const result = action === "buy"
        ? await buyShopItem(token, item.id, quantity)
        : await sellShopItem(token, item.id, quantity, entry?.id);
      onPlayer(result.player);
      onInventory(result.inventory);
      setNotice(action === "buy"
        ? `Куплено: ${item.name} ×${quantity}. Списано ${result.total} монет.`
        : `Продано: ${item.name} ×${quantity}. Получено ${result.total} монет.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось выполнить операцию");
    } finally {
      setBusyItem(null);
    }
  };

  const quantityPicker = (itemId: string, max?: number) => (
    <label className="flex items-center gap-2 text-sm">
      Количество
      <input
        aria-label="Количество предметов"
        type="number"
        min={1}
        max={Math.min(99, max ?? 99)}
        value={quantities[itemId] ?? 1}
        onChange={(event) => {
          const value = Number(event.target.value);
          setQuantities((current) => ({ ...current, [itemId]: Number.isFinite(value) ? value : 1 }));
        }}
        className="w-16 rounded border px-2 py-1"
      />
    </label>
  );

  const itemCard = (item: ItemDto, action: "buy" | "sell", entry?: InventoryItemDto) => {
    const unitPrice = action === "buy" ? item.price : item.sellPrice;
    const key = `${action}-${entry?.id ?? item.id}`;
    const busy = busyItem === key;
    return (
      <Card key={key} className="game-card w-full">
        <div className="flex items-start gap-3">
          {item.icon && <div className="h-10 w-10 shrink-0 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: item.icon }} />}
          <div className="min-w-0 flex-1">
            <Text as="div" weight="bold">{item.name}</Text>
            <Text as="div" size="2" color="gray">{item.description}</Text>
            <Text as="div" size="1" color="gray">
              {item.damage > 0 && `Сила оружия +${item.damage} · `}
              {item.defense > 0 && `Защита +${item.defense} · `}
              {item.healAmount > 0 && `Лечение ${item.healAmount} HP · `}
              {action === "buy" ? `Цена ${unitPrice} за шт.` : `Продажа ${unitPrice} за шт.`}
            </Text>
            <ItemDetails item={item} level={action === "buy" && item.type === "weapon" ? 1 : entry?.weaponLevel} compact />
            {action === "sell" && entry?.weaponLevel == null && <Text as="div" size="1">В инвентаре: {entry?.quantity}</Text>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {entry?.weaponLevel != null ? <Text size="1">Один экземпляр</Text> : quantityPicker(key, entry?.quantity)}
          <Button className="game-button"
            color={action === "buy" ? "orange" : "green"}
            disabled={busyItem !== null || Boolean(entry?.equiped) || (action === "buy" && (player?.money ?? 0) < item.price)}
            onClick={() => transact(item, action, entry)}
          >
            {busy ? "Подождите…" : action === "buy" ? "Купить" : entry?.equiped ? "Сначала снимите" : "Продать"}
          </Button>
        </div>
      </Card>
    );
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Магазин</h1>
        <Text weight="bold" color="orange">Монеты: {player?.money ?? 0}</Text>
      </div>
      {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-green-300 bg-green-50 p-3 text-green-700">{notice}</div>}
      <Tabs.Root defaultValue="buy">
        <Tabs.List color="orange" className="w-full">
          <Tabs.Trigger value="buy" className="flex-1">Купить</Tabs.Trigger>
          <Tabs.Trigger value="sell" className="flex-1">Продать</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="buy" className="mt-3 flex flex-col gap-3">
          {catalog.length === 0
            ? <Text color="gray">В магазине пока нет товаров.</Text>
            : catalog.map((item) => itemCard(item, "buy"))}
        </Tabs.Content>
        <Tabs.Content value="sell" className="mt-3 flex flex-col gap-3">
          {ownedForSale.length === 0
            ? <Text color="gray">У вас нет предметов, которые принимает магазин.</Text>
            : ownedForSale.map((entry) => itemCard(entry.item, "sell", entry))}
          <Text size="1" color="gray">Цена выкупа указана у каждого предмета.</Text>
        </Tabs.Content>
      </Tabs.Root>
    </main>
  );
}
