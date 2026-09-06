import { ItemDto } from "@mmobot/shared";
import { useEffect, useRef } from "react";

type ModalItemProps = {
  token: string | null;
  item: ItemDto | null;
  onItem: (value: ItemDto | null) => void
};

const TYPE_LABEL = {
  weapon: "Оружие",
  armor: "Броня",
  potion: "Зелье",
  material: "Материал",
  other: "Прочее",
};

export default function ModalItem({
  item,
  onItem,
}: ModalItemProps) {
  const cardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!item) return
    const handleClose = (e: Event) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onItem(null)
      }
    }
    document.addEventListener("pointerdown", handleClose)
    return () => document.removeEventListener("pointerdown", handleClose)
  }, [item, onItem])

  if (item === null) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
      <div className="absolute inset-0 bg-black/40" />
      <div
        ref={cardRef}
        className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
      >
        <button
          onClick={() => onItem(null)}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#E85D2F] text-lg leading-none text-[#E85D2F] transition-transform hover:scale-110 active:scale-95"
        >
          ×
        </button>

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
          <p className="mt-2 text-center text-sm text-gray-500">{item.description}</p>
        </div>

        {(item.damage > 0 || item.defense > 0 || item.healAmount > 0) && (
          <div className="my-4 grid grid-cols-3 gap-2">
            {item.damage > 0 && (
              <div className="flex flex-col items-center rounded-lg border border-[#E85D2F]/30 bg-orange-50 py-2">
                <p className="text-xs text-gray-500">ATK</p>
                <p className="text-base font-bold text-[#E85D2F]">+{item.damage}</p>
              </div>
            )}
            {item.defense > 0 && (
              <div className="flex flex-col items-center rounded-lg border border-[#60a5fa]/30 bg-blue-50 py-2">
                <p className="text-xs text-gray-500">DEF</p>
                <p className="text-base font-bold text-[#60a5fa]">+{item.defense}</p>
              </div>
            )}
            {item.healAmount > 0 && (
              <div className="flex flex-col items-center rounded-lg border border-green-500/30 bg-green-50 py-2">
                <p className="text-xs text-gray-500">HP</p>
                <p className="text-base font-bold text-green-500">+{item.healAmount}</p>
              </div>
            )}
          </div>
        )}

        {item.price > 0 && (
          <p className="text-center text-xs text-gray-500">Цена: {item.price}</p>
        )}
      </div>
    </div>
  )
}
