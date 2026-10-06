import { useNavigate } from "react-router-dom";
import { PvpStateDto } from "@mmobot/shared";
import { acceptPvp, cancelPvp } from "../../../../../api";

type PvpNotificationProps = {
  token: string | null;
  pvpState: PvpStateDto | null;
  setPvpState:(value: PvpStateDto | null) => void;
  onError: (error: string) => void;
};

export default function PvpNotification({
  token,
  pvpState,
  onError,
  setPvpState
}: PvpNotificationProps) {
  const navigate = useNavigate();

  const handleAccept = async () => {
    if (!token || !pvpState) return;
    try {
      await acceptPvp(token, pvpState.id);
      navigate("/Fight");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Ошибка принятия боя");
    }
  };

  const handleDecline = async () => {
    if (!token || !pvpState) return;
    try {
      await cancelPvp(token, pvpState.id);
      await setPvpState(null)
    } catch (e) {
      onError(e instanceof Error ? e.message : "Ошибка отклонения боя");
    }
  };

  return (
    <div className="flex flex-col gap-2 border-b pb-2">
      <div className="flex w-full items-center gap-2">
        <svg
          height="20"
          width="20"
          viewBox="0 0 16 16"
          fill="none"
          stroke="#E85D2F"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        >
          <path d="m2.75 9.25 1.5 2.5 2 1.5m-4.5 0 1 1m1.5-2.5-1.5 1.5m3-1 8.5-8.5v-2h-2l-8.5 8.5" />
          <path d="m10.25 12.25-2.25-2.25m2-2 2.25 2.25m1-1-1.5 2.5-2 1.5m4.5 0-1 1m-1.5-2.5 1.5 1.5m-7.25-5.25-4.25-4.25v-2h2l4.25 4.25" />
        </svg>
        <p className="text-sm">{pvpState?.partnerName} вызывает вас на бой!</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleAccept}
          className="flex-1 p-2 bg-green-600 text-white rounded-lg"
        >
          Принять
        </button>
        <button
          onClick={handleDecline}
          className="flex-1 p-2 bg-red-500 text-white rounded-lg"
        >
          Отклонить
        </button>
      </div>
    </div>
  );
}
