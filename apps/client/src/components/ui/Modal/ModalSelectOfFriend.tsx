import React, { useEffect, useState } from "react";
import { Card, Text, Button } from "@radix-ui/themes";
import { FriendDto, PlayerDto, PvpStateDto } from "@mmobot/shared";
import {
  acceptPvp,
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
  pvpState?: PvpStateDto| null
  player: PlayerDto | null
};

export default function ModalSelectOfFriend({
  isShow,
  token,
  onClose,
  title,
  textOnButton,
  type,
  pvpState,
  player
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
      // (список — это моментальный срез, поэтому поллинг не нужен).
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

  if (!isShow) return null;

  const handleTrade = async (friendId: number) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await createTrade(token, friendId);
      onClose();
      navigate("/Exchange");
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
      // модалка не закрывается — ждём ответа соперника (pvpState)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось вызвать соперника");
    } finally {
      setLoading(false);
    }
  }
  const handleAccept = async () => {
    if (!token || !pvpState) return;
    setLoading(true);
    setError(null);
    try {
      await acceptPvp(token, pvpState.id);
      // после accept сервер пришлёт pvpState active → эффект выше уведёт на /Fight
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось принять бой");
    } finally {
      setLoading(false);
    }
  }
  const handleCancle = async (id:number) => {
    if(!token) return

    try{
      cancelPvp( token,id)
    }catch(e){
      setError(e instanceof Error ? e.message : "Ошибка отмены")
    }
  }
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40">
      <div className="relative w-full max-h-[80%] overflow-y-auto rounded-t-2xl bg-white p-4">
        <button
          onClick={onClose}
          aria-label="Закрыть"
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
                  <Button
                    disabled={loading}
                    onClick={() => handleTrade(f.id)}
                    style={{ background: "#E8603C", border: "solid 2px black" }}
                  >
                    {textOnButton}
                  </Button>
                </Card>
              ))}
            </>
          ) : null}

          {type === "figth" ? (
            <>
              {pvpState?.status === "pending" && pvpState.direction === "outgoing" ? (
                <>
                  <p className="text-black text-lg">Ожидаем ответ соперника.....</p>
                  <button
                    onClick={() => handleCancle(pvpState.id)}
                    className="w-full p-3 bg-red-500 text-2xl text-white"
                  >
                    Отмена
                  </button>
                </>
              ) : null}
              {pvpState?.status === "pending" && pvpState.direction === "incoming" ? (
                <>
                  <p className="text-black text-lg">{pvpState.partnerName} вызывает вас на бой!</p>
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={handleAccept}
                      disabled={loading}
                      className="flex-1 p-3 bg-green-600 text-2xl text-white rounded-lg"
                    >
                      Принять
                    </button>
                    <button
                      onClick={() => handleCancle(pvpState.id)}
                      disabled={loading}
                      className="flex-1 p-3 bg-red-500 text-2xl text-white rounded-lg"
                    >
                      Отклонить
                    </button>
                  </div>
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
                      className="flex flex-row items-center justify-between"
                    >
                      <div className="flex flex-col">
                        <Text size="2" weight="bold">
                          {player.name}
                        </Text>
                        <Text size="1" color="gray">
                          Lv {player.level}
                        </Text>
                      </div>
                      <Button
                        disabled={loading}
                        onClick={() => handlePvp(player.id)}
                        style={{
                          background: "#E8603C",
                          border: "solid 2px black",
                        }}
                      >
                        {textOnButton}
                      </Button>
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
