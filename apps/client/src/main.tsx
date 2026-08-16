import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@radix-ui/themes/styles.css";
import "./styles.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import type { CombatStateResponse, InventoryItemDto, LocationStateResponse, PlayerDto } from "@mmobot/shared";
import Loading from './components/Loading'
import { auth, getMe } from "./api";

import { getTelegramInitData } from "./telegram";
import { Theme } from "@radix-ui/themes";
import Home from "./components/Home";

import { connectSocket, getSocket } from "./socket";

function App() {
  const [player, setPlayer] = useState<PlayerDto | null>(null);
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

    const onConnectError = (err: Error) => setError(err.message);
    const onLocationState = (nextState: LocationStateResponse) => setLocationState(nextState);
    const onPlayer = (nextPlayer: PlayerDto) => setPlayer(nextPlayer);
    const onInventory = (nextInventory: InventoryItemDto[]) => setInventory(nextInventory);
    const onCombatState = (combatState: CombatStateResponse) => setCombat(combatState);

    socket.on("connect_error", onConnectError);
    socket.on("locationState", onLocationState);
    socket.on("player", onPlayer);
    socket.on("inventory", onInventory);
    socket.on("combatState", onCombatState);
    
    return () => {
      socket.off("connect_error", onConnectError);
      socket.off("locationState", onLocationState);
      socket.off("player", onPlayer);
      socket.off("inventory", onInventory);
      socket.off("combatState", onCombatState);
    };
  }, [player]);


  return (
    <Theme>
      <BrowserRouter>
        <Routes>
          <Route path='/' element={<Loading />}></Route>
          <Route path="/Home" element={<Home />}></Route>
        </Routes>
      </BrowserRouter>
    </Theme>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
