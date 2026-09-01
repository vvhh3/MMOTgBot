import { ItemDto } from "@mmobot/shared";

type ModalSelectOfItemProps = {
  token: string | null;
  isShow: boolean;
  onShow: (value: boolean) => void;
  inventoryItem: {
    item: ItemDto | undefined;
    quantity: number;
    equiped: boolean;
  }[];
  onSelect: (itemType: number, quantity: number) => void;
};

export default function ModalSelectOfItem({
  isShow,
  onShow,
  inventoryItem,
  onSelect,
}: ModalSelectOfItemProps) {
  if (!isShow) return null;

  const handleSelect = (itemType: number, maxQty: number) => {
    onSelect(itemType, maxQty);
    onShow(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={() => onShow(false)}
    >
      <div className="absolute inset-0 bg-black/50" />

      <div
        className="relative w-full max-h-[70vh] bg-white rounded-t-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-bold text-sm">Выберите предмет</p>
          <button
            onClick={() => onShow(false)}
            className="text-gray-400 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {inventoryItem.filter((e) => e.item).length === 0 && (
            <p className="text-center text-gray-400 text-sm py-6">
              Инвентарь пуст
            </p>
          )}

          <div className="grid grid-cols-4 gap-2">
            {inventoryItem
              .filter((e) => e.item)
              .map((entry) => (
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
        </div>
      </div>
    </div>
  );
}
