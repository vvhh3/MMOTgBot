import LevelBadge from "../../../shared/ui/LevelBadge";
import { useGroupEvent } from '../../group-events/GroupEventProvider';
import { PlayerDto,PvpStateDto } from "@mmobot/shared";
import { Button,Card,Text } from "@radix-ui/themes";
import { useEffect,useState } from "react";
import { useNavigate } from "react-router-dom";
import LowerModal from "../../../shared/ui/modal/LowerModal";
import { getOnlinePlayer } from "../../players/api";
import { cancelPvp,createPvp } from "../api";

type ModalFightProps = {
  showIsModal: boolean;
  token: string | null;
  pvpState?: PvpStateDto | null;
  setShowModal: (value: boolean) => void;
};

export default function LowerModalFight({
  showIsModal,
  token,
  pvpState,
  setShowModal,
}: ModalFightProps) {
  const [onlinePlayers, setOnlinePlayers] = useState<PlayerDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { runSolo } = useGroupEvent();
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
    if (showIsModal && pvpState?.status === "active") {
      navigate("/Fight");
    }
  }, [showIsModal, pvpState, navigate]);

  if (!showIsModal) return null;

  const handlePvp = async (playerId: number) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await runSolo('сразиться один на один', () => createPvp(token, playerId));
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
    pvpState?.status === "pending" && pvpState.direction === "outgoing";

  return (
    <LowerModal
      title={"Выберите своего противника"}
      error={error}
      onClose={() => setShowModal(false)}
    >
      {isWaiting && pvpState ? (
        <>
          <p className="px-2 text-xs leading-relaxed text-[#756B5C]">Ожидаем ответ соперника.....</p>
          <button
            onClick={() => handleCancel(pvpState.id)}
            className="game-button game-button--danger w-full px-4 text-xs"
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
              className="game-card flex flex-row flex-wrap items-center justify-between gap-2"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Text size="2" weight="bold">
                  {player.name}
                </Text>
                <LevelBadge level={player.level} />
              </div>
              <div className="pt-1">
                <Button
                  disabled={loading}
                  onClick={() => handlePvp(player.id)}
                  className="game-button px-4 text-[11px]"
                >
                  {"Вызвать на бой"}
                </Button>
              </div>
            </Card>
          ))}
        </>
      ) : null}
    </LowerModal>
  );
}
