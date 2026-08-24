import { Avatar, Badge, Button, Card, Flex, Grid, Text, TextField } from "@radix-ui/themes"
import { useEffect, useState } from "react"
import type { FriendDto, FriendRequestDto, FriendsOverviewResponse, PlayerDto } from "@mmobot/shared";
import { getFriends, removeFriend, respondFriendRequest, searchFriends, sendFriendRequest } from "../api";

type TeamProps = {
  token: string | null
  player: PlayerDto | null
  liveOverview?: FriendsOverviewResponse | null
}

export default function Team({ token, player,liveOverview }: TeamProps) {
  const [overview, setOverview] = useState<{ friends: FriendDto[]; requests: FriendRequestDto[] }>({ friends: [], requests: [] })
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<FriendDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const reload = () => {
    if (!token) return
    getFriends(token)
      .then((data) => setOverview(data))
      .catch((e) => setError(e.message))
  }

  useEffect(() => {
    reload()
  }, [token])

  useEffect(() => {
    if(liveOverview) setOverview(liveOverview)
  },[liveOverview])

  const doSearch = async () => {
    if (!token || !query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const data = await searchFriends(token, query.trim())
      setResults(data.players)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка поиска")
    } finally {
      setLoading(false)
    }
  }

  const addFriend = async (friendId: number) => {
    if (!token) return
    try {
      await sendFriendRequest(token, friendId)
      setResults([])
      setQuery("")
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отправить заявку")
    }
  }

  const accept = async (id: number) => {
    if (!token) return
    await respondFriendRequest(token, id, true).catch((e) => setError(e.message))
    reload()
  }
  const decline = async (id: number) => {
    if (!token) return
    await respondFriendRequest(token, id, false).catch((e) => setError(e.message))
    reload()
  }
  const remove = async (id: number) => {
    if (!token) return
    await removeFriend(token, id).catch((e) => setError(e.message))
    reload()
  }

  const incoming = overview.requests.filter((r) => r.direction === "incoming")
  const outgoing = overview.requests.filter((r) => r.direction === "outgoing")

  return (
    <div className="flex flex-col h-full">
      <div>
        <p> Ваш индефикатор дружбы: {player?.friendId}</p>
      </div>
      <div className="flex justify-center items-center px-2.5 gap-1 pt-4">
        <div className="relative w-full max-w-150">
          <svg width="16" height="16" viewBox="0 0 24 24"  fill="none" xmlns="http://www.w3.org/2000/svg"
            className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
            <path d="M14.9536 14.9458L21 21M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z"stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <input
            placeholder="Введите код друга..."
            className="w-full border-2 rounded-lg p-1 pr-8 border-black focus:outline-none duration-300 focus:border-[#E85D2F]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}/>
        </div>
        <button className="h-9 w-25 p-1 flex justify-center items-center text-white  bg-[#E85D2F] rounded-lg" onClick={doSearch} disabled={loading}>
          Найти
        </button>
      </div>

      {error && <Text color="red" size="1" className="px-4 pt-2">{error}</Text>}

      {results.length > 0 && (
        <div className="px-4 pt-3">
          <Text size="2" weight="bold">Результаты поиска</Text>
          <Grid columns="1" gap="2" className="mt-2">
            {results.map((p) => (
              <Card key={p.id}>
                <Flex justify="between" align="center">
                  <Flex gap="3" align="center">
                    <Avatar radius="full" fallback={p.name[0] ?? "A"} color="green" size="2" />
                    <div className="flex flex-col">
                      <Text size="2">{p.name}</Text>
                      <Badge color="orange">Lv.{p.level}</Badge>
                    </div>
                  </Flex>
                  <button className="h-9 w-25 p-1 flex justify-center items-center text-white  bg-[#E85D2F] rounded-lg" onClick={() => addFriend(p.id)}>Добавить</button>
                </Flex>
              </Card>
            ))}
          </Grid>
        </div>
      )}

      <div className="px-4 pt-4">
        {incoming.length > 0 && (
          <>
            <Text size="2" weight="bold">Входящие заявки</Text>
            <Grid columns="1" gap="2" className="mt-2">
              {incoming.map((r) => (
                <Card key={r.id}>
                  <Flex justify="between" align="center">
                    <Flex gap="3" align="center">
                      <Avatar radius="full" fallback={r.name[0] ?? "A"} color="green" size="2" />
                      <div className="flex flex-col">
                        <Text size="2">{r.name}</Text>
                        <Badge color="orange">Lv.{r.level}</Badge>
                      </div>
                    </Flex>
                    <Flex gap="2">
                      <button className="h-9 w-25 p-1 flex justify-center items-center text-white  bg-green-600 rounded-lg"  onClick={() => accept(r.id)}>Принять</button>
                      <button className="h-9 w-25 p-1 flex justify-center items-center text-white  bg-red-600 rounded-lg"  onClick={() => decline(r.id)}>Отклонить</button>
                    </Flex>
                  </Flex>
                </Card>
              ))}
            </Grid>
          </>
        )}

        {outgoing.length > 0 && (
          <>
            <Text size="2" weight="bold" className="block mt-4">Исходящие заявки</Text>
            <Grid columns="1" gap="2" className="mt-2">
              {outgoing.map((r) => (
                <Card key={r.id}>
                  <Flex justify="between" align="center">
                    <Flex gap="3" align="center">
                      <Avatar radius="full" fallback={r.name[0] ?? "A"} color="green" size="2" />
                      <Text size="2">{r.name}</Text>
                    </Flex>
                    <button className="h-9 w-25 p-1 flex justify-center items-center text-white  bg-[#E85D2F] rounded-lg" onClick={() => remove(r.id)}>Отменить</button>
                  </Flex>
                </Card>
              ))}
            </Grid>
          </>
        )}

        <Text size="2" weight="bold" className="block mt-4">Друзья ({overview.friends.length})</Text>
        <Grid columns="1" gap="2" className="mt-2">
          {overview.friends.length === 0 && (
            <Text size="1" color="gray">Пока нет друзей. Найдите игрока по коду выше</Text>
          )}
          {/* Поправить тут проверку онлайн */}
          {overview.friends.map((f) => (
            <Card key={f.id}>
              <Flex justify="between" align="center">
                <Flex gap="3" align="center">
                  <div className="relative inline-block">
                    <Avatar radius="full" fallback={f.name[0] ?? "A"} color="green" size="2" />
                    <span className={`absolute right-0 bottom-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white ${f.online ? "bg-green-500" : "bg-gray-400"}`} />
                  </div>
                  <div className="flex flex-col">
                    <Flex gap="3" align="center">
                      <Text size="2">{f.name}</Text>
                      <Badge color="orange">Lv.{f.level}</Badge>
                    </Flex>
                    <Text size="1" color={f.online ? "green" : "gray"}>{f.online ? "В сети" : "Не в сети"}</Text>
                  </div>
                </Flex>
                <button className="h-9 w-25 p-1 flex justify-center items-center text-white  bg-red-600 rounded-lg" onClick={() => remove(f.id)}>Удалить</button>
              </Flex>
            </Card>
          ))}
        </Grid>
      </div>
    </div>
  )
}
