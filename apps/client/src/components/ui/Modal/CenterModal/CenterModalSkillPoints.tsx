import { PlayerDto } from "@mmobot/shared";
import { Button, Text } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { spendStatPoint } from "../../../../api";
import CenterModal from "./CenterModal";

type SkillPointsProps = {
  showIsModal: boolean;
  setShowModal: (value: boolean) => void;
  player: PlayerDto | null;
  token: string | null;
  onPlayer: (player: PlayerDto) => void;
};

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
} as const;

type StatKey = keyof typeof STAT_CONFIG;

// Сколько единиц характеристики даёт одно очко
const STAT_STEP: Record<StatKey, number> = {
  maxHealth: 5,
  strength: 2,
  defense: 1,
};

const EMPTY_POINTS: Record<StatKey, number> = {
  maxHealth: 0,
  strength: 0,
  defense: 0,
};

export default function CenterModalSkillPoints({
  showIsModal,
  setShowModal,
  player,
  token,
  onPlayer,
}: SkillPointsProps) {
  const [available, setAvailable] = useState<number>(player?.statPoints ?? 0);
  const [points, setPoints] = useState<Record<StatKey, number>>(EMPTY_POINTS);

  // При открытии сбрасываем вложенные очки
  useEffect(() => {
    if (!showIsModal) return;
    setPoints(EMPTY_POINTS);
    setAvailable(player?.statPoints ?? 0);
  }, [showIsModal]);

  if (!showIsModal) return null;

  const baseValue: Record<StatKey, number> = {
    maxHealth: player?.maxHp ?? 0,
    strength: player?.strength ?? 0,
    defense: player?.defense ?? 0,
  };

  const changePoint = (key: StatKey, delta: 1 | -1) => {
    if (delta === 1 && available <= 0) return;
    if (delta === -1 && points[key] <= 0) return;
    setPoints((prev) => ({ ...prev, [key]: prev[key] + delta }));
    setAvailable((prev) => prev - delta);
  };

  const handleSpend = async () => {
    const total = points.maxHealth + points.strength + points.defense;
    if (!token || total === 0) return;
    try {
      const { player: updated } = await spendStatPoint(token, points);
      onPlayer(updated);
      // available уже равен оставшимся очкам, его трогать не нужно
      setPoints(EMPTY_POINTS);
    } catch {}
  };

  const buttonClass =
    "flex h-8 w-8 items-center justify-center rounded-lg border-2 text-lg font-bold leading-none transition-all active:scale-90 disabled:cursor-not-allowed disabled:opacity-30";

  return (
    <CenterModal onClose={() => setShowModal(false)}>
      <div className="mb-4 text-center">
        <Text as="div" size="5" weight="bold" className="mb-1">
          Характеристики
        </Text>
        <Text as="div" size="2" color="gray">
          Доступно очков:{" "}
          <span className={available > 0 ? "font-bold text-[#E8603C]" : "text-gray-400"}>
            {available}
          </span>
        </Text>
      </div>

      <div className="flex flex-col gap-2">
        {(Object.keys(STAT_CONFIG) as StatKey[]).map((key) => {
          const cfg = STAT_CONFIG[key];
          const buttonStyle = { borderColor: cfg.color, color: cfg.color };
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
                  <Text size="2" weight="bold" style={{ color: cfg.color }}>
                    {cfg.label}
                  </Text>
                  <Text size="1" color="gray">
                    {cfg.sub}
                  </Text>
                </div>
              </div>

              <div className="flex w-[120px] flex-row items-center justify-between gap-1">
                <button
                  onClick={() => changePoint(key, -1)}
                  disabled={points[key] < 1}
                  className={buttonClass}
                  style={buttonStyle}
                >
                  -
                </button>
                <Text size="4" weight="bold">
                  {baseValue[key] + points[key] * STAT_STEP[key]}
                </Text>
                <button
                  onClick={() => changePoint(key, 1)}
                  disabled={available <= 0}
                  className={buttonClass}
                  style={buttonStyle}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}

        <div className="flex flex-row justify-end">
          <Button
            onClick={handleSpend}
            style={{ background: "#E8603C", borderRadius: "16px" }}
          >
            Подтвердить
          </Button>
        </div>
      </div>
    </CenterModal>
  );
}
