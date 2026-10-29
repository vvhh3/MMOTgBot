import {
InventoryItemDto,
ItemDto,
PlayerDto,
TradeItem,
TradeStateDto,
} from "@mmobot/shared";
import { Button,Card,Text } from "@radix-ui/themes";
import { useEffect,useState } from "react";
import { getCatalog } from "../../items/api";
import ItemDetails from "../../items/components/ItemDetails";
import { cancelTrade,submitOffer,submitReady } from "../api";
import CenterModalSelectOfItem from "./SelectItemModal";


type ExhangeType = {
  token: string | null;
  player: PlayerDto | null;
  tradeState: TradeStateDto | null;
  inventory: InventoryItemDto[] | null;
};

export default function Exchange({
  token,
  player,
  tradeState,
  inventory,
}: ExhangeType) {
  const [inventoryItems, setInventoryItems] = useState<ItemDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [myOffer, setMyOffer] = useState<TradeItem[]>([]);
  useEffect(() => {
    if (!token) return;
    getCatalog(token)
      .then((data) => setInventoryItems(data.items))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Ошибка загрузки инвентаря"),
      );
  }, [token]);

  useEffect(() => {
    if (tradeState) {
      setMyOffer(tradeState.myOffer);
    }
  }, [tradeState?.id, tradeState?.status]);

  if (!inventory || !tradeState) return null;

  const list = (inventory ?? []).map((inv) => ({
    id: inv.id,
    weaponLevel: inv.weaponLevel,
    item: inventoryItems.find((i) => i.id === inv.itemType),
    quantity: inv.quantity,
    equiped: inv.equiped,
  }));

  const offerKey = (offer: TradeItem) => offer.inventoryItemId != null ? `instance-${offer.inventoryItemId}` : `stack-${offer.itemType}`;
  const maxQuantity = (offer: TradeItem) => offer.inventoryItemId != null ? 1 : (inventory.find((entry) => entry.itemType === offer.itemType)?.quantity ?? 0);
  const handleSelectItem = (inventoryItemId: number) => {
    const entry = inventory.find((row) => row.id === inventoryItemId);
    if (!entry || entry.equiped) return;
    const next: TradeItem = entry.weaponLevel === null
      ? { itemType: entry.itemType, quantity: 1 }
      : { itemType: entry.itemType, quantity: 1, inventoryItemId: entry.id, weaponLevel: entry.weaponLevel };
    const existing = myOffer.find((offer) => offerKey(offer) === offerKey(next));
    setMyOffer(existing ? myOffer.map((offer) => offerKey(offer) === offerKey(next)
      ? { ...offer, quantity: Math.min(offer.quantity + 1, entry.quantity) } : offer) : [...myOffer, next]);
  };
  const handleRemoveItem = (key: string) => setMyOffer(myOffer.filter((offer) => offerKey(offer) !== key));
  const handleChangeQty = (key: string, delta: number) => setMyOffer(myOffer.map((offer) => offerKey(offer) === key
    ? { ...offer, quantity: Math.min(maxQuantity(offer), Math.max(0, offer.quantity + delta)) } : offer).filter((offer) => offer.quantity > 0));
  const offerDetails = (offer: TradeItem) => {
    const item = inventoryItems.find((entry) => entry.id === offer.itemType);
    return item ? <ItemDetails item={item} level={offer.weaponLevel} compact /> : null;
  };
  const offerDirty = JSON.stringify(myOffer) !== JSON.stringify(tradeState.myOffer);

  const handleSubmitOffer = async () => {
    if (!token || !tradeState) return;
    try {
      await submitOffer(token, tradeState.id, myOffer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка выкладки");
    }
  };

  const handleReady = async () => {
    if (!token || !tradeState) return;
    try {
      await submitReady(token, tradeState.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка подтверждения");
    }
  };

  const handleCancel = async () => {
    if (!token || !tradeState) return;
    try {
      await cancelTrade(token, tradeState.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка отмены");
    }
  };

  const findItemName = (itemType: number) => inventoryItems.find((i) => i.id === itemType)?.name ?? `#${itemType}`;
  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-row items-center gap-1.5 pl-5 h-7.5 border-b-2">
        <Text size="2">Обмен с {tradeState.partnerName}</Text>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-50 text-red-600 text-sm">{error}</div>
      )}

      {tradeState.status === "accepted" && (
        <div className="px-4 py-4 text-center">
          <Text size="4" weight="bold" color="green">
            Обмен завершён!
          </Text>
        </div>
      )}

      {tradeState.status === "open" && (
        <>
          <div className="flex flex-col p-5 gap-2">
            <Card className="game-card">
              <div className="flex flex-col gap-1">
                <Text color="red" size="2" weight="bold">
                  Вы отдаёте:
                </Text>
                <div className="flex flex-wrap gap-2 justify-center flex-col justify-center items-center">
                  {myOffer.length === 0 && (
                    <Text size="1" color="gray">
                      Нажмите + чтобы добавить
                    </Text>
                  )}
                  {myOffer.map((o) => (
                    <div
                      key={offerKey(o)}
                      className="flex flex-col items-center border rounded-lg px-2 py-1 min-w-17.5"
                    >
                      <p className="text-xs font-medium">
                        {findItemName(o.itemType)}
                      </p>
                      {offerDetails(o)}
                      <div className="flex items-center gap-1 mt-1">
                        <button
                          onClick={() => handleChangeQty(offerKey(o), -1)}
                          className="w-5 h-5 text-xs border rounded flex items-center justify-center"
                        >
                          −
                        </button>
                        <span className="text-xs w-5 text-center">
                          {o.quantity}
                        </span>
                        <button
                          onClick={() => handleChangeQty(offerKey(o), 1)}
                          className="w-5 h-5 text-xs border rounded flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => handleRemoveItem(offerKey(o))}
                        className="text-[10px] text-red-400 mt-0.5"
                      >
                        удалить
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center justify-center border-2 border-dashed rounded-lg w-17.5 h-15 text-2xl text-gray-400 hover:border-[#E85D2F] hover:text-[#E85D2F] transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            </Card>
          </div>

          <div className="flex justify-center">
            <svg
              height="20px"
              width="20px"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#E85D2F"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19,7 L5,7 M20,17 L5,17" />
              <path d="M16,3 L19.2929,6.29289 C19.6834,6.68342 19.6834,7.31658 19.2929,7.70711 L16,11" />
              <path d="M8,13 L4.70711,16.2929 C4.31658,16.6834 4.31658,17.3166 4.70711,17.7071 L8,21" />
            </svg>
          </div>

          <div className="flex flex-col p-5">
            <Card className="game-card">
              <div className="flex flex-col gap-1">
                <Text color="green" size="2" weight="bold">
                  Вы получаете:
                </Text>
                <div className="flex flex-wrap gap-2 justify-center">
                  {tradeState.partnerOffer.length === 0 && (
                    <Text size="1" color="gray">
                      Партнёр пока ничего не выложил
                    </Text>
                  )}
                  {tradeState.partnerOffer.map((o) => (
                    <div
                      key={offerKey(o)}
                      className="flex flex-col items-center border rounded-lg px-2 py-1 min-w-17.5 bg-gray-50"
                    >
                      <p className="text-xs font-medium">
                        {findItemName(o.itemType)}
                      </p>
                      {offerDetails(o)}
                      <p className="text-xs text-gray-500">×{o.quantity}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-2 p-5 items-center">
            <div className="flex gap-3 text-xs">
              <Text color={tradeState.iAmReady ? "green" : "gray"}>
                Вы: {tradeState.iAmReady ? "✓ Готовы" : "не готовы"}
              </Text>
              <Text color={tradeState.partnerIsReady ? "green" : "gray"}>
                Партнёр: {tradeState.partnerIsReady ? "✓ Готов" : "не готов"}
              </Text>
            </div>

            <div className="w-full flex flex-col gap-2">
              <Button className="game-button"
                onClick={handleSubmitOffer}

              >
                Выложить на стол
              </Button>
              <Button className="game-button"
                disabled={offerDirty}
                onClick={handleReady}

              >
                {offerDirty ? "Сначала выложите изменения на стол" : "Готово"}
              </Button>
              <Button className="game-button game-button--danger"
                onClick={handleCancel}

              >
                Отмена
              </Button>
            </div>
          </div>
        </>
      )}

      <CenterModalSelectOfItem
        token={token}
        showIsModal={showModal}
        setShowModal={setShowModal}
        inventoryItem={list}
        onSelect={handleSelectItem}
      />
    </div>
  );
}
