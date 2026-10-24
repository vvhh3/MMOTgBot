import { ItemDto,RARITY_COLORS,RARITY_LABELS } from "@mmobot/shared";
import CenterModal from "../../../shared/ui/modal/CenterModal";

type CenterModalSelectOfItemProps = {
  token: string | null;
  showIsModal: boolean;
  setShowModal: (value: boolean) => void;
  inventoryItem: {
    item: ItemDto | undefined;
    id: number;
    weaponLevel: number | null;
    quantity: number;
    equiped: boolean;
  }[];
  onSelect: (inventoryItemId: number) => void;
};

export default function CenterModalSelectOfItem({
  showIsModal,
  setShowModal,
  inventoryItem,
  onSelect,
}: CenterModalSelectOfItemProps) {
  if (!showIsModal) return null;

  const entries = inventoryItem.filter((e) => e.item && !e.equiped);

  const handleSelect = (inventoryItemId: number) => {
    onSelect(inventoryItemId);
    setShowModal(false);
  };

  return (
    <CenterModal title="Выберите предмет" onClose={() => setShowModal(false)}>
      {entries.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-6">Нет доступных предметов. Экипированные вещи сначала нужно снять.</p>
      )}

      <div className="grid grid-cols-4 gap-2">
        {entries.map((entry) => (
          <button
            key={entry.id}
            style={{ borderColor: RARITY_COLORS[entry.item!.rarity] }}
            title={RARITY_LABELS[entry.item!.rarity]}
            onClick={() => handleSelect(entry.id)}
            className="flex flex-col items-center justify-between border rounded-lg p-2 h-20 hover:border-[#E85D2F] hover:bg-orange-50 transition-colors"
          >
            <p className="text-xs text-center leading-tight line-clamp-2">
              {entry.item!.name}
            </p>
            <p className="text-xs text-gray-500">{entry.weaponLevel != null ? `Ур. ${entry.weaponLevel}` : `×${entry.quantity}`}</p>
          </button>
        ))}
      </div>
    </CenterModal>
  );
}
