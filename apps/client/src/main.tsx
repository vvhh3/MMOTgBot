import { StrictMode, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import "@radix-ui/themes/styles.css"
import "./styles.css"
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import type { CombatStateResponse, FriendsOverviewResponse, InventoryItemDto, LocationStateResponse, PlayerDto, PvpStateDto, TradeStateDto } from "@mmobot/shared";
import Loading from './components/Loading'
import { auth, getMe,getLocations, getPvpOverview, getTradesOverview } from "./api";
import { getLocationImage } from "./utils/getLocationImage";

import { getTelegramInitData } from "./telegram";
import { Theme } from "@radix-ui/themes";
import MainLayout from "./components/MainLayout";
import Profile from "./components/Profile";
import Map from "./components/ui/Maps/Maps";
import { connectSocket, getSocket } from "./socket";
import Home from "./components/Home";
import Tasks from "./components/Tasks";
import { useLocation } from "react-router-dom";
import Team from "./components/Team";
import TakeAWalk from "./components/TakeAWalk";
import Inventory from "./components/Inventory";
import Fight from "./components/Fight";
import Exchange from "./components/Exchange"
import { MobAdmin } from "./admin/adminComponents/MobAdmin";
import { ItemAdmin } from "./admin/adminComponents/ItemAdmin";
import Admin from "./admin/Admin";

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function App() {
  const [player, setPlayer] = useState<PlayerDto | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [inventory, setInventory] = useState<InventoryItemDto[]>([])
  const [locationState, setLocationState] = useState<LocationStateResponse | null>(null)
  const [combat, setCombat] = useState<CombatStateResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [friendsOverview, setFriendsOverview] = useState<FriendsOverviewResponse | null>(null)
  const [pvpState,setPvpState] = useState<PvpStateDto | null>(null)
  const [tradeState,setTradeState]  = useState<TradeStateDto | null>(null)

  //Загрузилис ли все данные
  const [ready,setReady] = useState(false)
  const [loadingProgress,setLoadingProgress] = useState(0)


  const preloadImage = (url: string): Promise<void> => {
    return new Promise ((r) => {
      const img = new Image()
      img.onload = () => r()
      img.onerror = () => r()
      img.src = url
    })
  }

  async function preloadLocationImages(token: string, onProgress: (p: number) => void): Promise<void> {
  let urls: string[] = [];
  try {
    const { locations } = await getLocations(token);
    for (const l of locations) {
      urls.push(getLocationImage(l.homeImg));
      urls.push(getLocationImage(l.fightImg));
    }
  } catch {
    urls = []
  }
  if (urls.length === 0) {
    onProgress(100)
    return
  }
  let done = 0;
  await Promise.all(urls.map(async (url) => {
    await preloadImage(url);
    done += 1;
    onProgress((done / urls.length) * 100);
  }));
}
  useEffect(() => {
    const initData = getTelegramInitData();
    if (!initData) {
      setError("Откройте приложение внутри Telegram: для входа нужен настоящий initData.");
      return;
    }

    auth(initData)
      .then(async (authData) => {
        setPlayer(authData.player);
        setToken(authData.token);
        const [meData, pvpOverview, tradesOverview] = await Promise.all([
          getMe(authData.token),
          getPvpOverview(authData.token).catch(() => null),
          getTradesOverview(authData.token).catch(() => null)
        ]);
        setPlayer(meData.player);
        setInventory(meData.inventory);

        const incomingPvp = pvpOverview?.invites.find((i) => i.direction === "incoming");
        if (incomingPvp) {
          setPvpState({
            id: incomingPvp.id,
            status: "pending",
            direction: "incoming",
            myName: meData.player.name,
            partnerName: incomingPvp.partnerName,
            myHp: 0,
            myMaxHp: 0,
            partnerHp: 0,
            partnerMaxHp: 0,
            myTurn: false,
            finished: false,
            isWon: null
          });
        }
        const incomingTrade = tradesOverview?.invites.find((i) => i.direction === "incoming" && i.status === "pending");
        if (incomingTrade) {
          setTradeState({
            id: incomingTrade.id,
            status: "pending",
            myOffer: [],
            partnerOffer: [],
            iAmReady: false,
            partnerIsReady: false,
            partnerName: incomingTrade.partnerName,
            direction: "incoming"
          });
        }

        connectSocket(authData.token);
        await preloadLocationImages(authData.token, setLoadingProgress)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Не удалось войти"))
      .finally(() => setReady(true))
  }, []);

  useEffect(() => {
    if (!player) return;
    const socket = getSocket();
    if (!socket) return;

    // Фатальные ошибки авторизации: токен протух или игрока нет в БД
    // (например, после пересоздания базы на сервере). Бесконечно ретраить
    // бессмысленно — отключаемся и один раз пробуем получить новый токен.
    let lastReauthAt = 0;
    const onConnectError = (err: Error) => {
      if (err.message === "Invalid auth token" || err.message === "Player not found") {
        if (Date.now() - lastReauthAt < 10000) return;
        lastReauthAt = Date.now();
        const s = getSocket();
        s?.disconnect();
        const initData = getTelegramInitData();
        if (!initData) return;
        auth(initData)
          .then((d) => {
            setPlayer(d.player);
            setToken(d.token);
            connectSocket(d.token);
          })
          .catch(() => setError("Сессия истекла, перезапустите приложение"));
        return;
      }
      setError(err.message);
      console.log("error",err)
    };
    const onLocationState = (nextState: LocationStateResponse) => setLocationState(nextState);
    const onPlayer = (nextPlayer: PlayerDto) => setPlayer(nextPlayer);
    const onInventory = (nextInventory: InventoryItemDto[]) => setInventory(nextInventory);
    const onCombatState = (combatState: CombatStateResponse) => setCombat(combatState);
    const onFriendsUpdate = (friendState: FriendsOverviewResponse) => setFriendsOverview(friendState)
    const onPvpState = (pvpStateValue: PvpStateDto | null) => setPvpState(pvpStateValue)
    const onTradeState = (tradeState: TradeStateDto | null) => setTradeState(tradeState)

    socket.on("connect_error", onConnectError);
    socket.on("locationState", onLocationState);
    socket.on("player", onPlayer);
    socket.on("inventory", onInventory);
    socket.on("combatState", onCombatState)
    socket.on("friendsUpdate",onFriendsUpdate)
    socket.on("pvpState", onPvpState)
    socket.on("tradeUpdate",onTradeState)

    return () => {
      socket.off("connect_error", onConnectError)
      socket.off("locationState", onLocationState)
      socket.off("player", onPlayer)
      socket.off("inventory", onInventory)
      socket.off("combatState", onCombatState)
      socket.off("friendsUpdate",onFriendsUpdate)
      socket.off("pvpState",onPvpState)
      socket.off("tradeUpdate",onTradeState)
    }
  }, [player])

  return (
    <>
      <Theme>
        <ScrollToTop />
        {ready ? (

          <Routes>
          <Route path="" element={<MainLayout player={player} token={token} error={error} onError={setError} pvpState={pvpState} tradeState={tradeState}/>}>
            <Route path="/" element={<Home token={token} player={player} locationState={locationState} friendsOverview={friendsOverview} pvpState={pvpState} tradeState={tradeState}/>} />
            <Route path="Map" element={<Map token={token} onLocationState={setLocationState} onPlayer={setPlayer} />} />
            <Route path="Profile" element={<Profile player={player} locationState={locationState}/>} />
            <Route path="Tasks" element={<Tasks token={token} onPlayer={setPlayer} />} />
            <Route path="Team" element={<Team token={token} player={player} liveOverview={friendsOverview}/>} />
            <Route path="Inventory" element={<Inventory token={token} player={player} inventory={inventory} />} />
            <Route path="Exchange" element={<Exchange token={token} player={player} tradeState={tradeState} inventory={inventory}/>} />
            <Route path="AdminPanel" element={<Admin token={token} />} />
          </Route>
          <Route path="/TakeAWalk" element={<TakeAWalk token={token} player={player} onPlayer={setPlayer} onInventory={setInventory} locationState={locationState} />} />
          <Route path="/Fight" element={<Fight token={token} player={player} locationState={locationState} pvpState={pvpState} />} />
        </Routes>
        ) : (
            <Loading progress={loadingProgress}/>
        )}
      </Theme>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
