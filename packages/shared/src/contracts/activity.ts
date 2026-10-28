



type typeLastAction = "GroupEventLobby" | "GroupEvent" | "Fight" | "TakeAWalk" | "Trade" | "Mines" | "Blackjack" | "Ladder"


export type LastAction = {
  id:number
  type:typeLastAction
}
