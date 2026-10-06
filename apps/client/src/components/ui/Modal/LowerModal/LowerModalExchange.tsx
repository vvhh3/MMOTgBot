import React, { useEffect, useState } from "react";
import { Card, Text, Button, Badge } from "@radix-ui/themes";
import { PlayerDto, TradeStateDto } from "@mmobot/shared";
import { cancelPvp, createPvp, getOnlinePlayer } from "../../../../api";
import { useNavigate } from "react-router-dom";
import LowerModal from "./LowerModal";

type ModalFightProps = {
  showIsModal: boolean;
  token: string | null;
  tradeState?: TradeStateDto | null;
  setShowModal: (value: boolean) => void;
};

export default function LowerModalExchange({
  showIsModal,
  token,
  tradeState,
  setShowModal,
}: ModalFightProps) {
  const [onlinePlayers, setOnlinePlayers] = useState<PlayerDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  // Онлайн-игроков запрашиваем один раз при открытии модалки
  // (список — моментальный срез, поллинг не нужен)
  useEffect(() => {
    if (!showIsModal || !token) return;
    getOnlinePlayer(token)
      .then((data) =>
        setOnlinePlayers(Array.isArray(data.players) ? data.players : []),
      )
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "Не удалось загрузить игроков",
        ),
      );
  }, [showIsModal, token]);

  // Бой принят → обоих участников перекидывает на страницу боя
  useEffect(() => {
    if (showIsModal && tradeState?.status === "open") {
      navigate("/Fight");
    }
  }, [showIsModal, tradeState, navigate]);

  if (!showIsModal) return null;

  const handlePvp = async (playerId: number) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await createPvp(token, playerId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось вызвать соперника");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: number) => {
    if (!token) return;
    try {
      await cancelPvp(token, id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка отмены");
    }
  };

  const isWaiting =
    tradeState?.status === "pending" && tradeState.direction === "outcoming";

  return (
    <LowerModal
      title={"Выберите друга для обмена"}
      error={error}
      onClose={() => setShowModal(false)}
    >
      {isWaiting && tradeState ? (
        <>
          <p className="text-black text-lg">Ожидаем ответ соперника.....</p>
          <button
            onClick={() => handleCancel(tradeState.id)}
            className="w-full p-3 bg-red-500 text-2xl text-white rounded-2xl"
          >
            Отмена
          </button>
        </>
      ) : null}

      {!tradeState || tradeState.status !== "pending" ? (
        <>
          {onlinePlayers.length === 0 && !error && (
            <Text color="gray" size="1" className="block mt-3">
              Нету онлайн игроков
            </Text>
          )}
          {onlinePlayers.map((player) => (
            <Card
              key={player.id}
              className="flex flex-row items-center justify-between"
            >
              <div className="flex flex-row gap-1 ml-1">
                <Text size="2" weight="bold">
                  {player.name}
                </Text>
                <Badge size="1" color="orange" style={{ maxWidth: "50px" }}>
                  Lv {player.level}
                </Badge>
              </div>
              <div className="pt-1">
                <Button
                  disabled={loading}
                  onClick={() => handlePvp(player.id)}
                  style={{ background: "#E8603C", borderRadius: "16px" }}
                >
                  {"Обмен"}
                </Button>
              </div>
            </Card>
          ))}
        </>
      ) : null}
    </LowerModal>
  );
}