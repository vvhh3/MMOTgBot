import { PvpStateDto,TradeStateDto } from "@mmobot/shared";
import { AnimatePresence } from "motion/react";
import React from "react";
import TopModal from "../../../shared/ui/modal/TopModal";
import PvpNotification from "../../combat/components/PvpNotification";
import TradeNotification from "../../trades/components/TradeNotification";

type ModalNotificationProps = {
  token: string | null;
  onError: (error: string) => void;
  pvpState: PvpStateDto | null;
  tradeState: TradeStateDto | null;
  notifRef: React.RefObject<HTMLDivElement | null>;
  incomingTrade: boolean;
  incomingPvp: boolean;
  showIsModal: boolean;
  setTradeState:(value: TradeStateDto | null) => void;
  setPvpState:(value: PvpStateDto | null) => void;
};

export function ModalNotification({
  token,
  pvpState,
  tradeState,
  onError,
  notifRef,
  showIsModal,
  incomingTrade,
  incomingPvp,
  setPvpState,
  setTradeState
}: ModalNotificationProps) {
  return (
    <AnimatePresence>
    {showIsModal && (
    <TopModal
      key="notifications"
      notifRef={notifRef}
      isEmpty={!incomingPvp && !incomingTrade}
    >
      {incomingPvp && (
        <PvpNotification key="pvp" setPvpState={setPvpState} token={token} pvpState={pvpState} onError={onError} />
      )}
      {incomingTrade && (
        <TradeNotification
          key="trade"
          setTradeState={setTradeState}
          token={token}
          tradeState={tradeState}
          onError={onError}
        />
      )}
    </TopModal>
    )}
    </AnimatePresence>
  );
}
