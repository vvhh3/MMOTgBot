import { InventoryItemDto,ItemDto,PlayerDto } from "@mmobot/shared";
import { useState } from "react";
import CenterModal from "../../../shared/ui/modal/CenterModal";
import ItemDetails from "../../items/components/ItemDetails";
import { inventoryEquipedItem,inventoryUnEquipedItem,inventoryUsePotion } from "../api";

export type CombatInventoryActions = {
  onUsePotion: (itemType: number) => Promise<boolean>;
  busy: boolean;
  healthFull: boolean;
  healingAvailable: boolean;
};

type CenterModalItemProps = {
  combat?: CombatInventoryActions;
  playerLevel: number;
  token: string | null;
  item: ItemDto | null;
  equiped: boolean;
  inventoryEntry: InventoryItemDto | null;
  inventoryEntries?: InventoryItemDto[];
  quantity?: number;
  onItem: (value: { item: ItemDto; equiped: boolean; inventoryEntry: InventoryItemDto } | null) => void;
  onPlayer: (value: PlayerDto) => void;
  onInventory: (value: InventoryItemDto[]) => void;
};

const TYPE_LABEL = {
  weapon: "Оружие",
  armor: "Броня",
  potion: "Расходник",
  material: "Материал",
  other: "Прочее",
};

export default function CenterModalItem({
  token,
  item,
  equiped,
  inventoryEntry,
  inventoryEntries,
  quantity,
  onItem,
  onPlayer,
  onInventory,
  combat,
  playerLevel,
}: CenterModalItemProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (item === null) return null;
  const levelLocked = playerLevel < item.minLevel;

  const close = () => {
    onItem(null);
    setError(null);
  };

  const handleUse = async () => {
    if (!token || !inventoryEntry || busy || combat?.busy) return;
    if (levelLocked && !equiped) return;
    if (combat && (item.type !== "potion" || combat.healthFull || !combat.healingAvailable)) return;
    setBusy(true);
    try {
      let res;
      if (item.type === "potion") {
        // В бою лечим HP боевой сессии через обработчик экрана боя.
        if (combat) {
          if (await combat.onUsePotion(item.id)) onItem(null);
          return;
        }
        res = await inventoryUsePotion(token, item.id);
      } else if (item.type === "armor" || item.type === "weapon") {
        res = equiped
          ? await inventoryUnEquipedItem(token, inventoryEntry.id)
          : await inventoryEquipedItem(token, inventoryEntry.id);
      }
      if (!res) return;
      onPlayer(res.player);
      onInventory(res.inventory);
      onItem(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка использования предмета");
    } finally { setBusy(false); }
  };

  return (
    <CenterModal onClose={close}>
      <div className="flex flex-col items-center pt-2">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-[#E85D2F]/30 bg-orange-50 [&_svg]:h-12 [&_svg]:w-12 [&_svg]:max-h-full [&_svg]:max-w-full">
          {item.icon ? (
            <div dangerouslySetInnerHTML={{ __html: item.icon }} />
          ) : (
            <span className="text-3xl text-gray-400">{item.name.slice(0, 1)}</span>
          )}
        </div>

        <p className="mt-3 text-center text-lg font-bold">{item.name}</p>
        <p className="mt-0.5 text-xs text-gray-500">{TYPE_LABEL[item.type]}</p>
        {(quantity !== undefined || inventoryEntry) && (
          <p className="mt-1 text-xs text-gray-500">В инвентаре: {quantity ?? inventoryEntry?.quantity} шт.</p>
        )}
        {equiped && (
          <span className="mt-1 rounded-full border border-[#E85D2F] bg-orange-50 px-2 py-0.5 text-xs font-bold text-[#E85D2F]">
            Надето
          </span>
        )}
        <p className="mt-2 text-center text-sm text-gray-500">{item.description}</p>
      </div>

      {item.type === 'weapon' && inventoryEntries && inventoryEntries.length > 1 && (
        <label className="mt-3 flex flex-col gap-1 text-xs">
          Выберите экземпляр
          <select
            className="rounded-lg border p-2"
            value={inventoryEntry?.id}
            disabled={busy || combat?.busy}
            onChange={(event) => {
              const entry = inventoryEntries.find(value => value.id === Number(event.target.value));
              if (!entry) return;
              setError(null);
              onItem({ item, equiped: entry.equiped, inventoryEntry: entry });
            }}
          >
            {inventoryEntries.map((entry, index) => (
              <option key={entry.id} value={entry.id}>
                Экземпляр {index + 1} · Уровень {entry.weaponLevel ?? 1}{entry.equiped ? ' · Надет' : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      <ItemDetails item={item} level={inventoryEntry?.weaponLevel} />

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-500">
          {error}
        </p>
      )}

      {(item.damage > 0 || item.defense > 0 || item.healAmount > 0) && (
        <div className="flex justify-center gap-2">
          {item.damage > 0 && (
            <div className="flex flex-col items-center rounded-lg border border-[#E85D2F]/30 bg-orange-50 py-2 w-full">
              <p className="text-xs text-gray-500">Сила оружия</p>
              <p className="text-base font-bold text-[#E85D2F]">+{item.damage}</p>
            </div>
          )}
          {item.defense > 0 && (
            <div className="flex flex-col items-center rounded-lg border border-[#60a5fa]/30 bg-blue-50 py-2 w-full">
              <p className="text-xs text-gray-500">DEF</p>
              <p className="text-base font-bold text-[#60a5fa]">+{item.defense}</p>
            </div>
          )}
          {item.healAmount > 0 && (
            <div className="flex flex-col items-center rounded-lg border border-green-500/30 bg-green-50 py-2 w-full">
              <p className="text-xs text-gray-500">HP</p>
              <p className="text-base font-bold text-green-500">+{item.healAmount}</p>
            </div>
          )}
        </div>
      )}

      {item.type === "potion" && (
        <div className="flex justify-center">
          <button
            className="p-3 bg-green-500 rounded-2xl m-4 text-white disabled:opacity-50"
            disabled={busy || levelLocked || combat?.busy || combat?.healthFull || combat?.healingAvailable === false || item.healAmount <= 0}
            onClick={handleUse}
          >
            {levelLocked ? `Требуется уровень ${item.minLevel}` : combat?.healingAvailable === false ? "Лечение уже использовано" : item.healAmount <= 0 ? "Эффект появится позже" : combat?.healthFull ? "Здоровье полное" : busy ? "Использование…" : "Использовать"}
          </button>
        </div>
      )}

      {(item.type === "armor" || item.type === "weapon") && (
        <div className="flex justify-center">
          <button
            className="p-3 rounded-2xl m-4 text-white disabled:opacity-50"
            style={{ backgroundColor: equiped ? "#E85D2F" : "#22c55e" }}
            disabled={busy || !!combat || (levelLocked && !equiped)}
            onClick={handleUse}
          >
            {combat ? "Смена экипировки доступна вне боя" : equiped ? "Снять" : levelLocked ? `Требуется уровень ${item.minLevel}` : "Надеть"}
          </button>
        </div>
      )}

      {item.price > 0 && (
        <p className="text-center text-xs text-gray-500">Цена: {item.price}</p>
      )}
    </CenterModal>
  );
}
