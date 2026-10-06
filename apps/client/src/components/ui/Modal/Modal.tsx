import { TradeStateDto, PvpStateDto, PlayerDto, ItemDto, InventoryItemDto } from "@mmobot/shared";
import CenterModalSkillPoints from "./CenterModal/CenterModalSkillPoints";
import CenterModalItem from "./CenterModal/CenterModalItem";
import LowerModalExchange from "./LowerModal/LowerModalExchange";
import LowerModalFight  from "./LowerModal/LowerModalFight";
import CenterModalSelectOfItem from "./CenterModal/CenterModalSelectOfItem";
import СenterModalInformation from "./CenterModal/СenterModalInformation";
import { ModalNotification } from "./TopModall/Notification/ModalNotification"; // поправьте путь под ваш файл
import { useEffect } from "react";

export enum TypeModal {
    Item = "item",
    SelectOfFriendExchange = "selectOfFriendExchange",
    SelectOfFriendFight = "selectOfFriendFight",
    SelectOfItem = "selectOfItem",
    SkillPoints = "skillPoints",
    Notification = "notification",
    Information = "information"
  
}

type CardProps = {
  token?: string | null;
  typeModal: TypeModal | null;
  showIsModal: boolean;
  item?: ItemDto | null;
  equiped?: boolean;
  onItem?: (value: { item: ItemDto; equiped: boolean } | null) => void;
  onPlayer?: (value: PlayerDto) => void;
  onInventory?: (value: InventoryItemDto[]) => void;
  infoMessages?:{
    title:string;
    info:string;
  }
  textOnButton?: string;
  pvpState?: PvpStateDto | null;
  tradeState?: TradeStateDto | null;
  inventoryItem?: {
    item: ItemDto | undefined;
    quantity: number;
    equiped: boolean;
  }[];
  onSelect?: (itemType: number, quantity: number) => void;
  setShowModal?: (value: boolean) => void;
  player?: PlayerDto | null;
  // для Notification
  onError?: (error: string) => void;
  notifRef?: React.RefObject<HTMLDivElement | null>;
  tradeIncoiming?: boolean;
  pvpIncoiming?: boolean;
  setTradeState?:(value: TradeStateDto | null) => void;
  setPvpState?:(value: PvpStateDto | null) => void;
};

export default function Modal({
  token,
  typeModal,
  showIsModal,
  item,
  equiped,
  onItem,
  onPlayer,
  onInventory,
  pvpState,
  tradeState,
  inventoryItem,
  onSelect,
  setShowModal,
  player,
  onError,
  notifRef,
  tradeIncoiming,
  pvpIncoiming,
  setTradeState,
  setPvpState,
  infoMessages
}: CardProps) {
    if (showIsModal == false){
        
        return null;
    }
  switch (typeModal) {
    case TypeModal.Item:
      return (
        <CenterModalItem
          token={token ?? null}
          item={item ?? null}
          equiped={equiped ?? false}
          onItem={onItem!}
          onPlayer={onPlayer!}
          onInventory={onInventory!}
        />
      );

    case TypeModal.SelectOfFriendExchange:
      return (
        <LowerModalExchange
          showIsModal={showIsModal}
          token={token ?? null}
          setShowModal={setShowModal!}
          tradeState={tradeState}
        />
      );

      case TypeModal.SelectOfFriendFight:
      return (
        <LowerModalFight
          showIsModal={showIsModal}
          token={token ?? null}
          setShowModal={setShowModal!}
          pvpState={pvpState}
        />
      );

    case TypeModal.SelectOfItem:
      return (
        <CenterModalSelectOfItem
          token={token ?? null}
          showIsModal={showIsModal}
          setShowModal={setShowModal!}
          inventoryItem={inventoryItem ?? []}
          onSelect={onSelect!}
        />
      );

    case TypeModal.SkillPoints:
      return (
        <CenterModalSkillPoints
          showIsModal={showIsModal}
          setShowModal={setShowModal!}
          player={player ?? null}
          token={token ?? null}
          onPlayer={onPlayer!}
        />
      );

    case TypeModal.Notification:
      return (
        <ModalNotification
          setPvpState={setPvpState!} 
          setTradeState={setTradeState!}
          token={token ?? null}
          onError={onError!}
          pvpState={pvpState ?? null}
          tradeState={tradeState ?? null}
          notifRef={notifRef!}
          incomingTrade={tradeIncoiming ?? false}
          incomingPvp={pvpIncoiming ?? false}
          showIsModal={showIsModal}
        />
      );
      case TypeModal.Information:
      return (
        <СenterModalInformation
        infoMessages={infoMessages!}
        setShowModal={setShowModal!}
        />
      )

    default:
      return null;
  }
}