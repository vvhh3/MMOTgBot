import { getFaction,type Faction,type FactionId } from "@mmobot/shared";


export default function FactionBadge({ factionId }: { factionId: FactionId | null | undefined }) {
  const faction = getFaction(factionId);
  if (!faction) return <span className="text-sm text-gray-500">Группировка не выбрана</span>;
  return <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold" style={{ color: faction.color, borderColor: `${faction.color}55`, backgroundColor: `${faction.color}0d` }}> 
  {faction.name}
  </span>;
}
