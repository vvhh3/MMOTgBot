import { CombatStateResponse,InventoryItemDto,ItemDto,PlayerDto,PvpStateDto,TradeStateDto } from "@mmobot/shared";
import CenterModalSkillPoints from "../../features/character/components/SkillPointsModal";
import CenterResultFight from "../../features/combat/components/FightResultModal";
import LowerModalFight from "../../features/combat/components/SelectPvpPlayerModal";
import CenterModalItem,{ type CombatInventoryActions } from "../../features/inventory/components/ItemModal";
import { ModalNotification } from "../../features/notifications/components/ModalNotification";
import CenterModalSelectOfItem from "../../features/trades/components/SelectItemModal";
import LowerModalExchange from "../../features/trades/components/SelectTradePlayerModal";
import { TypeModal } from "../../shared/ui/modal/types";
import InformationModal from "./InformationModal";



type CardProps = {
  combat?: CombatInventoryActions;
  token?: string | null;
  typeModal: TypeModal | null;
  showIsModal?: boolean;
  item?: ItemDto | null;
  equiped?: boolean;
  inventoryEntry?: InventoryItemDto | null;
  onItem?: (value: { item: ItemDto; equiped: boolean; inventoryEntry: InventoryItemDto } | null) => void;
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
    id: number;
    weaponLevel: number | null;
    quantity: number;
    equiped: boolean;
  }[];
  onSelect?: (inventoryItemId: number) => void;
  setShowModal?: (value: boolean) => void;
  player?: PlayerDto | null;
  // для Notification
  onError?: (error: string) => void;
  notifRef?: React.RefObject<HTMLDivElement | null>;
  tradeIncoiming?: boolean;
  pvpIncoiming?: boolean;
  setTradeState?:(value: TradeStateDto | null) => void;
  setPvpState?:(value: PvpStateDto | null) => void;
  state?:CombatStateResponse
};

export default function Modal({
  combat,
  token,
  typeModal,
  showIsModal,
  item,
  equiped,
  inventoryEntry,
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
  infoMessages,
  state
}: CardProps) {
    if (showIsModal == false && typeModal !== TypeModal.Notification){
        
        return null;
    }
  switch (typeModal) {
    case TypeModal.Item:
      return (
        <CenterModalItem
          combat={combat}
          token={token ?? null}
          item={item ?? null}
          equiped={equiped ?? false}
          inventoryEntry={inventoryEntry ?? null}
          onItem={onItem!}
          onPlayer={onPlayer!}
          onInventory={onInventory!}
        />
      );

    case TypeModal.SelectOfFriendExchange:
      return (
        <LowerModalExchange
          showIsModal={showIsModal!}
          token={token ?? null}
          setShowModal={setShowModal!}
          tradeState={tradeState}
        />
      );

      case TypeModal.SelectOfFriendFight:
      return (
        <LowerModalFight
          showIsModal={showIsModal!}
          token={token ?? null}
          setShowModal={setShowModal!}
          pvpState={pvpState}
        />
      );

    case TypeModal.SelectOfItem:
      return (
        <CenterModalSelectOfItem
          token={token ?? null}
          showIsModal={showIsModal!}
          setShowModal={setShowModal!}
          inventoryItem={inventoryItem ?? []}
          onSelect={onSelect!}
        />
      );

    case TypeModal.SkillPoints:
      return (
        <CenterModalSkillPoints
          showIsModal={showIsModal!}
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
          showIsModal={showIsModal!}
        />
      );
      case TypeModal.Information:
      return (
        <InformationModal
        infoMessages={infoMessages!}
        setShowModal={setShowModal!}
        />
      )
      case TypeModal.ResultFight:
      return (
        <CenterResultFight 
        state={state!}
        />
      )

    default:
      return null;
  }
}
