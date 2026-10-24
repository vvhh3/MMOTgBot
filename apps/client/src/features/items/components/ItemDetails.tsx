import {
DAMAGE_CATEGORY_LABELS,DAMAGE_TYPE_LABELS,RARITY_COLORS,RARITY_LABELS,
WEAPON_FAMILY_LABELS,getPassiveDefinition,type ItemDto,
} from "@mmobot/shared";

export default function ItemDetails({ item, level, compact = false }: { item: ItemDto; level?: number | null; compact?: boolean }) {
  const passive = item.passiveId ? getPassiveDefinition(item.passiveId) : null;
  return (
    <div className="mt-2 space-y-1 text-xs">
      <p className="font-semibold" style={{ color: RARITY_COLORS[item.rarity] }}>
        {RARITY_LABELS[item.rarity]}{item.type === "weapon" && level != null && ` · Уровень оружия: ${level}`}
      </p>
      {item.type === "weapon" && <p className="text-gray-600">
        {item.damageCategory && DAMAGE_CATEGORY_LABELS[item.damageCategory]}
        {item.damageType && ` · ${DAMAGE_TYPE_LABELS[item.damageType]}`}
        {!compact && item.weaponFamily && ` · ${WEAPON_FAMILY_LABELS[item.weaponFamily]}`}
      </p>}
      {passive && <p><span className="font-semibold">Будущий эффект «{passive.name}»:</span> {passive.describe(item.passiveParams)}</p>}
      {item.type === "weapon" && <p className="text-gray-500">Типы урона и пассивки пока не действуют в бою. Прокачка оружия появится позже.</p>}
      {item.type === "armor" && passive && <p className="text-gray-500">Сейчас действует только базовая защита. Пассивка появится позже.</p>}
      {item.type === "potion" && <p className="text-gray-500">{item.healAmount > 0
        ? `Сейчас восстанавливает ${item.healAmount} HP сразу.${passive ? " Особый эффект появится позже." : ""}`
        : "Использование станет доступно после добавления эффекта."}</p>}
    </div>
  );
}
