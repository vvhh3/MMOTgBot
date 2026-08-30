import React, { useEffect, useState } from "react";
import { Card, Text, } from "@radix-ui/themes";
import { FriendDto, PlayerDto, PvpStateDto, TradeStateDto } from "@mmobot/shared";
import {
  cancelPvp,
  createPvp,
  createTrade,
  getFriends,
  getOnlinePlayer,
} from "../../../api";
import { useNavigate } from "react-router-dom";

type ModalSelectOfFriendProps = {
  isShow: boolean;
  token: string | null;
  onClose: () => void;
  title: string;
  textOnButton: string;
  type: "figth" | "trade";
  pvpState?: PvpStateDto | null;
  tradeState?: TradeStateDto | null
};

export default function ModalSelectOfFriend({
  isShow,
  token,
  onClose,
  title,
  textOnButton,
  type,
  pvpState,
  tradeState
}: ModalSelectOfFriendProps) {
  const [friends, setFriends] = useState<FriendDto[]>([]);
  const [onlinePlayers, setOnlinePlayers] = useState<PlayerDto[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (!isShow || !token) return;
    if (type === "trade") {
      getFriends(token)
        .then((data) => setFriends(data.friends))
        .catch((e) =>
          setError(
            e instanceof Error ? e.message : "Не удалось загрузить друзей",
          ),
        );
    } else if (type === "figth") {
      // Онлайн-игроков запрашиваем один раз при открытии модалки
      // (список — это моментальный срез, поэтому поллинг не нужен)
      getOnlinePlayer(token)
        .then((data) =>
          setOnlinePlayers(Array.isArray(data.players) ? data.players : []),
        )
        .catch((e) =>
          setError(
            e instanceof Error ? e.message : "Не удалось загрузить игроков",
          ),
        );
    }
  }, [isShow, token, type]);

  // Бой принят → обоих участников перекидывает на страницу боя
  useEffect(() => {
    if (type === "figth" && isShow && pvpState?.status === "active") {
      navigate("/Fight");
    }
  }, [type, isShow, pvpState, navigate]);

  // Трейд открыт → перекидывает на страницу обмена
  useEffect(() => {
    if (type === "trade" && isShow && tradeState?.status === "open") {
      navigate("/Exchange");
    }
  }, [type, isShow, tradeState, navigate]);


  if (!isShow) return null;

  const handleTrade = async (friendId: number) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await createTrade(token, friendId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось предложить обмен");
    } finally {
      setLoading(false);
    }
  };

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
  } 

  const handleCancle = async (id: number) => {
    if (!token) return;

    try {
      cancelPvp(token, id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка отмены");
    }
  };
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40">
      <div className="relative w-full max-h-[80%] overflow-y-auto rounded-t-2xl bg-white p-4">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border-2 border-black text-lg leading-none"
        >
          ×
        </button>
        <Text size="3" weight="bold">
          {title}
        </Text>
        {error && (
          <Text color="red" size="1" className="block mt-2">
            {error}
          </Text>
        )}
        <div className="flex flex-col gap-2 mt-3">
          {type === "trade" ? (
            <>
              {friends.length === 0 && !error && (
                <Text color="gray" size="1" className="block mt-3">
                  У вас пока нет друзей
                </Text>
              )}
              {friends.map((f) => (
                <Card
                  key={f.id}
                  className="flex flex-row items-center justify-between"
                >
                  <div className="flex flex-col">
                    <Text size="2" weight="bold">
                      {f.name}
                    </Text>
                    <Text size="1" color="gray">
                      Lv {f.level} {f.online ? "• в сети" : ""}
                    </Text>
                  </div>
                  <button
                    disabled={loading}
                    onClick={() => handleTrade(f.id)}
                    className="bg-[#E8603C] border-2 border-black rounded-2xl"
                  >
                    {textOnButton}
                  </button>
                </Card>
              ))}
            </>
          ) : null}

          {type === "figth" ? (
            <>
              {pvpState?.status === "pending" &&
              pvpState.direction === "outgoing" ? (
                <>
                  <p className="text-black text-lg">
                    Ожидаем ответ соперника.....
                  </p>
                  <button
                    onClick={() => handleCancle(pvpState.id)}
                    className="w-full p-3 bg-red-500 text-2xl text-white rounded-2xl"
                  >
                    Отмена
                  </button>
                </>
              ) : null}
              {!pvpState || pvpState.status !== "pending" ? (
                <>
                  {onlinePlayers.length === 0 && !error && (
                    <Text color="gray" size="1" className="block mt-3">
                      Нету онлайн игроков
                    </Text>
                  )}
                  {onlinePlayers.map((player) => (
                    <Card
                      key={player.id}
                      className="flex flex-row items-center justify-between">
                      <div className="flex flex-col">
                        <Text size="2" weight="bold">
                          {player.name}
                        </Text>
                        <Text size="1" color="gray">
                          Lv {player.level}
                        </Text>
                      </div>
                      <button
                        disabled={loading}
                        onClick={() => handlePvp(player.id)}
                        className="bg-[#E8603C] border-2 border-black rounded-2xl">
                        {textOnButton}
                      </button>
                    </Card>
                  ))}
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
