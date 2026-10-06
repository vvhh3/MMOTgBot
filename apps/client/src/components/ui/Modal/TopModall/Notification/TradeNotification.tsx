import { useNavigate } from "react-router-dom";
import { TradeStateDto } from "@mmobot/shared";
import { acceptTrade, cancelTrade } from "../../../../../api";

type TradeNotificationProps = {
  token: string | null;
  tradeState: TradeStateDto | null;
  setTradeState:(value: TradeStateDto | null) => void;
  onError: (error: string) => void;
};

export default function TradeNotification({
  token,
  tradeState,
  onError,
  setTradeState
}: TradeNotificationProps) {
  const navigate = useNavigate();

  const handleAccept = async () => {
    if (!token || !tradeState) return;
    try {
      await acceptTrade(token, tradeState.id);
      navigate("/Exchange");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Ошибка принятия обмена");
    }
  };

  const handleDecline = async () => {
    if (!token || !tradeState) return;
    try {
      await cancelTrade(token, tradeState.id);
      await setTradeState(null);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Ошибка отклонения обмена");
    }
  };

  return (
    <div className="flex flex-col gap-2 border-b pb-2">
      <div className="flex w-full items-center gap-2">
        <svg height="20" width="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M19.9381 13C19.979 12.6724 20 12.3387 20 12C20 7.58172 16.4183 4 12 4C9.49942 4 7.26681 5.14727 5.7998 6.94416M4.06189 11C4.02104 11.3276 4 11.6613 4 12C4 16.4183 7.58172 20 12 20C14.3894 20 16.5341 18.9525 18 17.2916M15 17H18V17.2916M5.7998 4V6.94416M5.7998 6.94416V6.99993L8.7998 7M18 20V17.2916"
            stroke="#E85D2F"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p className="text-sm">{tradeState?.partnerName} предлагает вам обмен</p>
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
