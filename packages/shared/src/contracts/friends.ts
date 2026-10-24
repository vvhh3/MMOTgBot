




// === Друзья ===

// Один друг или найденный игрок: id, имя, уровень и статус онлайна.
export type FriendDto = {
  id: number
  friendId: number
  name: string
  level: number
  online: boolean
}


// Входящая/исходящая заявка в друзья. id — id записи в таблице friendships.
export type FriendRequestDto = {
  id: number
  playerId: number
  name: string
  level: number
  direction: "incoming" | "outgoing"
}


// Что видит игрок на экране друзей.
export type FriendsOverviewResponse = {
  friends: FriendDto[]
  requests: FriendRequestDto[]
}


export type FriendSearchResponse = {
  players: FriendDto[]
}
