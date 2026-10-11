import { useEffect, useMemo, useState } from "react";
import { Button, Card, Tabs, Text } from "@radix-ui/themes";
import type { InventoryItemDto, ItemDto, PlayerDto } from "@mmobot/shared";
import { buyShopItem, getShop, sellShopItem } from "../api";

type ShopProps = {
  token: string | null;
  player: PlayerDto | null;
  inventory: InventoryItemDto[];
  onPlayer: (player: PlayerDto) => void;
  onInventory: (inventory: InventoryItemDto[]) => void;
};

export default function Shop({ token, player, inventory, onPlayer, onInventory }: ShopProps) {
  const [catalog, setCatalog] = useState<ItemDto[]>([]);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyItem, setBusyItem] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    getShop(token).then((result) => setCatalog(result.items))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Не удалось загрузить магазин"));
  }, [token]);

  const catalogById = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);
  const ownedForSale = inventory.flatMap((entry) => {
    const item = catalogById.get(entry.itemType);
    return item ? [{ ...entry, item }] : [];
  });

  const transact = async (item: ItemDto, action: "buy" | "sell") => {
    if (!token) return;
    const quantity = Math.max(1, Math.min(99, Math.floor(quantities[item.id] ?? 1)));
    setBusyItem(item.id);
    setError(null);
    setNotice(null);
    try {
      const result = action === "buy"
        ? await buyShopItem(token, item.id, quantity)
        : await sellShopItem(token, item.id, quantity);
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

  const quantityPicker = (itemId: number, max?: number) => (
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

  const itemCard = (item: ItemDto, action: "buy" | "sell", ownedQuantity?: number, equipped?: boolean) => {
    const unitPrice = action === "buy" ? item.price : Math.max(1, Math.floor(item.price / 2));
    const busy = busyItem === item.id;
    return (
      <Card key={item.id} className="w-full">
        <div className="flex items-start gap-3">
          {item.icon && <div className="h-10 w-10 shrink-0" dangerouslySetInnerHTML={{ __html: item.icon }} />}
          <div className="min-w-0 flex-1">
            <Text as="div" weight="bold">{item.name}</Text>
            <Text as="div" size="2" color="gray">{item.description}</Text>
            <Text as="div" size="1" color="gray">
              {item.damage > 0 && `Урон +${item.damage} · `}
              {item.defense > 0 && `Защита +${item.defense} · `}
              {item.healAmount > 0 && `Лечение ${item.healAmount} HP · `}
              {action === "buy" ? `Цена ${unitPrice} за шт.` : `Продажа ${unitPrice} за шт.`}
            </Text>
            {action === "sell" && <Text as="div" size="1">В инвентаре: {ownedQuantity}</Text>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {quantityPicker(item.id, action === "sell" ? ownedQuantity : 99)}
          <Button
            color={action === "buy" ? "orange" : "green"}
            disabled={busy || Boolean(equipped) || (action === "buy" && (player?.money ?? 0) < item.price)}
            onClick={() => transact(item, action)}
          >
            {busy ? "Подождите…" : action === "buy" ? "Купить" : equipped ? "Сначала снимите" : "Продать"}
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
            : ownedForSale.map(({ item, quantity, equiped }) => itemCard(item, "sell", quantity, equiped))}
          <Text size="1" color="gray">Магазин покупает предметы за половину их цены.</Text>
        </Tabs.Content>
      </Tabs.Root>
    </main>
  );
}
