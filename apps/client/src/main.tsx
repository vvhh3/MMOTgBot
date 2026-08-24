import { StrictMode, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import "@radix-ui/themes/styles.css"
import "./styles.css"
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import type { CombatStateResponse, InventoryItemDto, LocationStateResponse, PlayerDto } from "@mmobot/shared";
import Loading from './components/Loading'
import { auth, getMe } from "./api";

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
  const [inventory, setInventory] = useState<InventoryItemDto[]>([]);
  const [locationState, setLocationState] = useState<LocationStateResponse | null>(null);
  const [combat, setCombat] = useState<CombatStateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        const [meData] = await Promise.all([getMe(authData.token)]);
        setPlayer(meData.player);
        setInventory(meData.inventory);
        connectSocket(authData.token);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Не удалось войти"));
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
    };
    const onLocationState = (nextState: LocationStateResponse) => setLocationState(nextState);
    const onPlayer = (nextPlayer: PlayerDto) => setPlayer(nextPlayer);
    const onInventory = (nextInventory: InventoryItemDto[]) => setInventory(nextInventory);
    const onCombatState = (combatState: CombatStateResponse) => setCombat(combatState);

    socket.on("connect_error", onConnectError);
    socket.on("locationState", onLocationState);
    socket.on("player", onPlayer);
    socket.on("inventory", onInventory);
    socket.on("combatState", onCombatState)
    
    return () => {
      socket.off("connect_error", onConnectError)
      socket.off("locationState", onLocationState)
      socket.off("player", onPlayer)
      socket.off("inventory", onInventory)
      socket.off("combatState", onCombatState)
    }
  }, [player])


  return (
    <>
      <Theme>
        <ScrollToTop />
        <Routes>
          <Route path="" element={<MainLayout player={player} />}>
            <Route path="/" element={<Home token={token} player={player} locationState={locationState} />} />
            <Route path="Map" element={<Map token={token} onLocationState={setLocationState} onPlayer={setPlayer} />} />
            <Route path="Profile" element={<Profile player={player} />} />
            <Route path="Tasks" element={<Tasks token={token} onPlayer={setPlayer} />} />
            <Route path="Team" element={<Team token={token} player={player}/>} />
            <Route path="Inventory" element={<Inventory token={token} player={player} inventory={inventory}/>} />
            <Route path="Exchange" element={<Exchange />} />
            <Route path="AdminPanel" element={<Admin token={token}/>}/>
          </Route>
          <Route path="/TakeAWalk" element={<TakeAWalk token={token} player={player} onPlayer={setPlayer} onInventory={setInventory} locationState={locationState}/>} />
          <Route path="/Fight" element={<Fight token={token} player={player}  locationState={locationState} />} />
        </Routes>
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
