import { PlayerDto } from "@mmobot/shared"
import { Card, Text } from "@radix-ui/themes"
import { useEffect, useRef } from "react"
import { spendStatPoint } from "../../../api"

type SkillPointsProps = {
  showIsModal: boolean
  onShowModal: (value: boolean) => void
  player: PlayerDto | null
  token: string | null
  onPlayer: (player: PlayerDto) => void
}

const STAT_CONFIG = {
  strength: {
    label: "ATK",
    sub: "Сила",
    color: "#E8603C",
    icon: (
      <svg width="22" height="22" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="m2.75 9.25 1.5 2.5 2 1.5m-4.5 0 1 1m1.5-2.5-1.5 1.5m3-1 8.5-8.5v-2h-2l-8.5 8.5" stroke="#E8603C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="m10.25 12.25-2.25-2.25m2-2 2.25 2.25m1-1-1.5 2.5-2 1.5m4.5 0-1 1m-1.5-2.5 1.5 1.5m-7.25-5.25-4.25-4.25v-2h2l4.25 4.25" stroke="#E8603C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  maxHealth: {
    label: "HP",
    sub: "Здоровье",
    color: "#22c55e",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M11.302 21.615c.221.129.332.193.488.227a1 1 0 0 0 .42.001c.156-.034.267-.098.488-.227C14.646 20.478 20 16.908 20 12V6.6c0-.558 0-.837-.107-1.05a1.5 1.5 0 0 0-.4-1.09 1.5 1.5 0 0 0-1.09-.4c-.568-.007-.852-.01-1.42-.017C14.5 3.947 12.786 3.702 11 2c-1.714 1.714-3.428 1.96-6.3 1.994-.568.007-.852.01-1.42.017a1.5 1.5 0 0 0-1.09.4 1.5 1.5 0 0 0-.4 1.09C3 5.763 3 6.042 3 6.6V12c0 4.908 5.354 8.478 7.302 9.615Z" fill="#22c55e"/>
      </svg>
    ),
  },
  defense: {
    label: "DEF",
    sub: "Защита",
    color: "#60a5fa",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 21.5s8.5-3.585 8.5-9.5v-5.4c0-.558 0-.837-.107-1.05a1.5 1.5 0 0 0-.4-1.09 1.5 1.5 0 0 0-1.09-.4c-.568-.007-.852-.01-1.42-.017C15.5 3.947 13.786 3.702 12 2c-1.714 1.714-3.428 1.96-6.3 1.994-.568.007-.852.01-1.42.017a1.5 1.5 0 0 0-1.09.4 1.5 1.5 0 0 0-.4 1.09C2.683 5.763 2.683 6.042 2.683 6.6V12c0 5.915 8.5 9.5 8.5 9.5Z" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
} as const

type StatKey = keyof typeof STAT_CONFIG

export default function SkillPoints({ showIsModal, onShowModal, player, token, onPlayer }: SkillPointsProps) {
  const cardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!showIsModal) return
    const handleClickOutside = (e: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onShowModal(false)
      }
    }
    document.addEventListener("pointerdown", handleClickOutside)
    return () => document.removeEventListener("pointerdown", handleClickOutside)
  }, [showIsModal])

  const handleSpend = async (stat: StatKey) => {
    if (!token || (player?.statPoints ?? 0) <= 0) return
    try {
      const { player: updated } = await spendStatPoint(token, stat)
      onPlayer(updated)
    } catch {  }
  }

  const available = player?.statPoints ?? 0

  return (
    <>
      {showIsModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/30" />
          <Card ref={cardRef} className="relative w-full max-w-sm">
            <button
              onClick={() => onShowModal(false)}
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#E8603C] text-lg leading-none text-[#E8603C] transition-transform hover:scale-110 active:scale-95"
            >
              ×
            </button>

            <div className="mb-4 text-center">
              <Text as="div" size="5" weight="bold" className="mb-1">Характеристики</Text>
              <Text as="div" size="2" color="gray">
                Доступно очков:{" "}
                <span className={available > 0 ? "font-bold text-[#E8603C]" : "text-gray-400"}>
                  {available}
                </span>
              </Text>
            </div>

            <div className="flex flex-col gap-2">
              {(Object.keys(STAT_CONFIG) as StatKey[]).map((key) => {
                const cfg = STAT_CONFIG[key]
                const value = key === "maxHealth" ? player?.maxHp : key === "strength" ? player?.strength : player?.defense 
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${cfg.color}15` }}
                      >
                        {cfg.icon}
                      </div>
                      <div className="flex flex-col">
                        <Text size="2" weight="bold" style={{ color: cfg.color }}>{cfg.label}</Text>
                        <Text size="1" color="gray">{cfg.sub}</Text>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Text size="4" weight="bold">{value}</Text>
                      <button
                        onClick={() => handleSpend(key)}
                        disabled={available <= 0}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border-2 text-lg font-bold leading-none transition-all active:scale-90 disabled:cursor-not-allowed disabled:opacity-30"
                        style={{
                          borderColor: cfg.color,
                          color: cfg.color,
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
