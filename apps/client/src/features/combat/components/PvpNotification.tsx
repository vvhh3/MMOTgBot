import { useGroupEvent } from '../../group-events/GroupEventProvider';
import { PvpStateDto } from "@mmobot/shared";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { acceptPvp,cancelPvp } from "../api";

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
  const { runSolo } = useGroupEvent();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  const handleAccept = async () => {
    if (!token || !pvpState || pending) return;
    setPending(true);
    try {
      await runSolo('принять бой один на один', async () => { await acceptPvp(token, pvpState.id); navigate('/Fight'); });
    } catch (e) {
      onError(e instanceof Error ? e.message : "Ошибка принятия боя");
    } finally {
      setPending(false);
    }
  };

  const handleDecline = async () => {
    if (!token || !pvpState || pending) return;
    setPending(true);
    try {
      await cancelPvp(token, pvpState.id);
      await setPvpState(null)
    } catch (e) {
      onError(e instanceof Error ? e.message : "Ошибка отклонения боя");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
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
        <p className="text-xs leading-relaxed text-[#594F43]">{pvpState?.partnerName} вызывает вас на бой!</p>
      </div>
      <div className="flex gap-2">
        <button
          disabled={pending || !token}
          onClick={handleAccept}
          className="game-button flex-1 px-4 text-[11px]"
        >
          Принять
        </button>
        <button
          disabled={pending || !token}
          onClick={handleDecline}
          className="game-button game-button--danger flex-1 px-4 text-[11px]"
        >
          Отменить
        </button>
      </div>
    </div>
  );
}
