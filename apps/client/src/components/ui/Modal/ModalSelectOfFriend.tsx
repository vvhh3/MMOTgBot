import React, { useEffect, useState } from "react";
import { Card, Text, Button } from "@radix-ui/themes";
import { FriendDto, PlayerDto } from "@mmobot/shared";
import { createPvp, createTrade, getFriends, getOnlinePlayer } from "../../../api";
import { useNavigate } from "react-router-dom";

type ModalSelectOfFriendProps = {
  isShow: boolean;
  token: string | null;
  onClose: () => void;
  title: string;
  textOnButton: string;
  type: "figth" | "trade";
};

export default function ModalSelectOfFriend({
  isShow,
  token,
  onClose,
  title,
  textOnButton,
  type,
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
      getOnlinePlayer(token)
        .then((data) => setOnlinePlayers(data.players))
        .catch((e) =>
          setError(
            e instanceof Error ? e.message : "Не удалось загрузить игроков",
          ),
        );
    }
  }, [isShow, token]);

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
    setError(null)
    try{
        await createPvp(token,playerId)
        onClose()
        navigate("/Fight")
    }catch(e){
        setError(e instanceof Error ? e.message : "Не удалось вызвать соперника" )
    }finally {
        setLoading(false)
    }
  };
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
        {friends.length === 0 && !error && (
          <Text color="gray" size="1" className="block mt-3">
            У вас пока нет друзей
          </Text>
        )}
        <div className="flex flex-col gap-2 mt-3">
          {type === "trade" ? (
            <>
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
                    onClick={() => handleTrade(player.id)}
                    style={{ background: "#E8603C", border: "solid 2px black" }}
                  >
                    {textOnButton}
                  </Button>
                </Card>
              ))}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
