import { ItemDto } from "@mmobot/shared";
import CenterModal from "./CenterModal";

type CenterModalSelectOfItemProps = {
  token: string | null;
  showIsModal: boolean;
  setShowModal: (value: boolean) => void;
  inventoryItem: {
    item: ItemDto | undefined;
    quantity: number;
    equiped: boolean;
  }[];
  onSelect: (itemType: number, quantity: number) => void;
};

export default function CenterModalSelectOfItem({
  showIsModal,
  setShowModal,
  inventoryItem,
  onSelect,
}: CenterModalSelectOfItemProps) {
  if (!showIsModal) return null;

  const entries = inventoryItem.filter((e) => e.item);

  const handleSelect = (itemType: number, maxQty: number) => {
    onSelect(itemType, maxQty);
    setShowModal(false);
  };

  return (
    <CenterModal title="Выберите предмет" onClose={() => setShowModal(false)}>
      {entries.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-6">Инвентарь пуст</p>
      )}

      <div className="grid grid-cols-4 gap-2">
        {entries.map((entry) => (
          <button
            key={entry.item!.id}
            onClick={() => handleSelect(entry.item!.id, entry.quantity)}
            className="flex flex-col items-center justify-between border rounded-lg p-2 h-20 hover:border-[#E85D2F] hover:bg-orange-50 transition-colors"
          >
            <p className="text-xs text-center leading-tight line-clamp-2">
              {entry.item!.name}
            </p>
            <p className="text-xs text-gray-500">×{entry.quantity}</p>
          </button>
        ))}
      </div>
    </CenterModal>
  );
}
