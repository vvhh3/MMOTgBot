import { FACTIONS,type FactionId } from "@mmobot/shared";

export default function FactionPicker({ value, onChange, disabled = false }: {
  value: FactionId | null;
  onChange: (id: FactionId) => void;
  disabled?: boolean;
}) {
  return <fieldset disabled={disabled} className="w-full min-w-0 max-w-sm">
    <legend className="mb-1 text-sm font-bold text-[#8A7A60]">Группировка</legend>
    <p className="mb-3 text-sm text-gray-600">Выбирай по духу — характеристики одинаковые. После сохранения смена группировки недоступна</p>
    <div className="grid grid-cols-2 gap-2 mt-4">
      {FACTIONS.map((faction) => <label key={faction.id} className="relative cursor-pointer">
        <input type="radio" name="faction" value={faction.id} checked={value === faction.id} onChange={() => onChange(faction.id)} className="peer sr-only" />
        <div className="flex h-full flex-col gap-2 rounded-xl border-2 p-3 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-disabled:opacity-60" style={{ borderColor: value === faction.id ? faction.color : "#d1d5db", backgroundColor: value === faction.id ? `${faction.color}12` : "transparent" }}>
          <span className="text-sm font-bold" style={{ color: faction.color }}>{faction.name}</span>
        </div>
      </label>)}
    </div>
  </fieldset>;
}
