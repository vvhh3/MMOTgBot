import React from "react";
import { AnimatePresence } from "motion/react";
import { PvpStateDto, TradeStateDto } from "@mmobot/shared";
import TopModal from "../TopModal";
import PvpNotification from "./PvpNotification";
import TradeNotification from "./TradeNotification";

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
