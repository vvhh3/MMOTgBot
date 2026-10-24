




export type TradeItem = {
  itemType: number
  quantity: number
  inventoryItemId?: number
  // Снимок уровня заполняет сервер; клиент не может назначать уровень.
  weaponLevel?: number
}


// Что видит игрок в окне трейда: свою выкладку и выкладку партнёра
export type TradeStateDto = {
  id: number;
  status: "pending" | "open" | "accepted" | "declined" | "cancelled";
  myOffer: TradeItem[];
  partnerOffer: TradeItem[];
  iAmReady: boolean;
  partnerIsReady: boolean;
  partnerName: string;
  direction: "incoming" | "outcoming"
}


export type TradeListItemDto = {
  id: number
  partnerName: string
  status: "pending" | "open"
  direction: "incoming" | "outgoing" // входящее приглашение или исходящее
};


export type TradesOverviewResponse = {
  invites: TradeListItemDto[]   // приглашения, ждущие ответа
  active: TradeStateDto | null  // мой открытый трейд, если есть
};
