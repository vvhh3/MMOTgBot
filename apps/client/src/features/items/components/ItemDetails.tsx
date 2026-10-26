import {
DAMAGE_CATEGORY_LABELS,DAMAGE_TYPE_LABELS,RARITY_COLORS,RARITY_LABELS,
WEAPON_FAMILY_LABELS,getPassiveDefinition,type ItemDto,
ITEM_ATTACK_NAMES,ITEM_BALANCE,
getItemMinLevel,
resolvePassiveParams,
} from "@mmobot/shared";

export default function ItemDetails({ item, level, compact = false }: { item: ItemDto; level?: number | null; compact?: boolean }) {
  const passive = item.passiveId ? getPassiveDefinition(item.passiveId) : null;
  const profile = ITEM_BALANCE[item.rarity];
  const attackNames = ITEM_ATTACK_NAMES[item.catalogKey ?? ''] ?? ['Обычная атака', 'Сильная атака'];
  return (
    <div className="mt-2 space-y-1 text-xs">
      <p className="font-semibold" style={{ color: RARITY_COLORS[item.rarity] }}>
        {RARITY_LABELS[item.rarity]}{item.type === "weapon" && level != null && ` · Уровень оружия: ${level}`}
      </p>
      {['weapon', 'armor', 'potion'].includes(item.type) && <p>Требуется уровень персонажа: {item.minLevel ?? getItemMinLevel(item)}</p>}
      {item.type === "weapon" && (
        <>
          <p><span className="font-semibold">Обычная атака «{attackNames[0]}»:</span> стандартная мощность, точность 95%, без перезарядки.</p>
          <p><span className="font-semibold">Сильный удар «{attackNames[1]}»:</span> мощность атаки ×{profile.strongPower.toLocaleString('ru-RU')} до вычитания защиты противника. Точность {profile.strongAccuracy}%. После применения недоступен два полных раунда.</p>
          {!compact && <p className="text-gray-500">Может промахнуться. Промах тоже запускает перезарядку. Если применить в раунде 1, следующий сильный удар доступен в раунде 4.</p>}
        </>
      )}
      {item.type === "armor" && <p>Защитный приём: полный блок {profile.fullBlockChance}%, половина урона {profile.partialBlockChance}%. Отражение при успешном блоке: шанс {profile.reflectChance}%, возврат 50% удара. Перезарядка 1 раунд.</p>}
      {item.type === "weapon" && <p className="text-gray-600">
        {item.damageCategory && DAMAGE_CATEGORY_LABELS[item.damageCategory]}
        {item.damageType && ` · ${DAMAGE_TYPE_LABELS[item.damageType]}`}
        {!compact && item.weaponFamily && ` · ${WEAPON_FAMILY_LABELS[item.weaponFamily]}`}
      </p>}
      {passive && <p><span className="font-semibold">Способность «{passive.name}»:</span> {passive.describe(resolvePassiveParams(item.passiveId!, item.passiveParams))}</p>}
      {item.type === "weapon" && !compact && <p className="text-gray-500">Пассивка действует у надетого оружия. Ядовитый или тепловой тип сам по себе не накладывает статус. Прокачка оружия появится позже.</p>}
      {item.type === "potion" && <p className="text-gray-500">{item.healAmount > 0
        ? item.passiveId === 'primordial_dumpling'
          ? `Вне боя восстанавливает ${item.healAmount} HP. В бою действует процентное лечение способности, без добавления фиксированного. Одно использование лечебного предмета за бой.`
          : `Восстанавливает ${item.healAmount} HP сразу. В бою — одно использование лечебного предмета за бой.${item.passiveId === 'mothers_care' ? ' Дополнительное восстановление происходит в конце раундов.' : ''}`
        : item.passiveId === 'primordial_dumpling' || item.passiveId === 'mothers_care'
          ? 'Лечение способностью доступно только в бою. Одно использование лечебного предмета за бой.'
          : 'Предмет не восстанавливает здоровье.'}</p>}
    </div>
  );
}
