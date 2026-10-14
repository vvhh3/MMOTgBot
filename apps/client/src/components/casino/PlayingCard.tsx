import type { PlayingCardDto } from "@mmobot/shared";

const suitSymbols = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" } as const;

export default function PlayingCard({ card }: { card: PlayingCardDto | null }) {
  if (!card) return <div aria-label="Закрытая карта" className="flex h-24 w-16 items-center justify-center rounded-lg border-2 border-[#76678e] bg-[#3b304f] text-2xl text-[#ffb545] shadow">✦</div>;
  const red = card.suit === "hearts" || card.suit === "diamonds";
  return <div aria-label={`${card.rank} ${card.suit}`} className={`flex h-24 w-16 flex-col justify-between rounded-lg border-2 border-[#8A7A60] bg-[#F0E6D0] p-2 font-bold shadow ${red ? "text-[#C83F2A]" : "text-[#2B2A27]"}`}>
    <span>{card.rank}</span><span className="self-center text-3xl">{suitSymbols[card.suit]}</span><span className="rotate-180 self-end">{card.rank}</span>
  </div>;
}
