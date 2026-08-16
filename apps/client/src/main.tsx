import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@radix-ui/themes/styles.css";
import "./styles.css";
import { BrowserRouter, Routes, Route,Link} from "react-router-dom";
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



type Screen = "map" | "location";

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
    // <Shell error={error}>
    //   <header className="mx-auto mb-4 flex max-w-[960px] items-center justify-between gap-3 max-[760px]:flex-col max-[760px]:items-start">
    //     <div>
    //       <span className="block text-xs text-sage">Игрок</span>
    //       <strong className="block">{player?.name ?? "Вход..."}</strong>
    //     </div>
    //     <div className="flex flex-wrap justify-end gap-2 max-[760px]:justify-start">
    //       <span className="rounded-lg border border-mist bg-white px-2.5 py-1.5">
    //         Ур. {player?.level ?? 1}
    //       </span>
    //       <span className="rounded-lg border border-mist bg-white px-2.5 py-1.5">
    //         {player?.points ?? 0} очков
    //       </span>
    //       <span className="rounded-lg border border-mist bg-white px-2.5 py-1.5">
    //         {inventory.reduce((sum, item) => sum + item.quantity, 0)} предметов
    //       </span>
    //     </div>
    //   </header>

    //   {screen === "map" ? (
    //     <main className="mx-auto grid max-w-[960px] grid-cols-[minmax(260px,1fr)_320px] gap-4 max-[760px]:grid-cols-1">
    //       <section className="relative aspect-[4/3] min-h-[320px] rounded-lg border border-fog bg-moss [background-image:linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:52px_52px]">
    //         {locations.map((location) => (
    //           <button
    //             key={location.id}
    //             className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 border-forest bg-frost"
    //             style={{ left: `${location.x}%`, top: `${location.y}%` }}
    //             onClick={() => void handleEnter(location.id)}
    //             disabled={busy}
    //             title={location.name}
    //           >
    //             <span className="block h-2.5 w-2.5 rounded-full bg-forest" />
    //           </button>
    //         ))}
    //       </section>
    //       <section className="rounded-lg border border-mist bg-white p-[18px]">
    //         <h1 className="mb-3 text-[28px] leading-[1.15]">Карта города</h1>
    //         <div className="grid gap-2">
    //           {locations.map((location) => (
    //             <button
    //               key={location.id}
    //               onClick={() => void handleEnter(location.id)}
    //               disabled={busy}
    //               className="grid cursor-pointer gap-1 rounded-lg border border-mist bg-cream p-3 text-left"
    //             >
    //               <strong>{location.name}</strong>
    //               <span className="text-leaf">{location.description}</span>
    //             </button>
    //           ))}
    //         </div>
    //       </section>
    //     </main>
    //   ) : (
    //     <main className="mx-auto max-w-[720px] rounded-lg border border-mist bg-white p-[18px]">
    //       <button
    //         className="mb-4 cursor-pointer rounded-lg border border-fog bg-transparent px-3.5 py-2.5 text-forest"
    //         onClick={() => {
    //           if(selectedLocationId){
    //             getSocket()?.emit("leaveLocation",selectedLocationId)
    //           }
    //           setScreen("map")
    //         }}>
    //         Вернуться к карте
    //       </button>
    //       <h1 className="mb-3 text-[28px] leading-[1.15]">
    //         {state?.location.name ?? currentLocation?.name}
    //       </h1>
    //       <p className="text-leaf">{state?.location.description ?? currentLocation?.description}</p>

    //       <section>
    //         <h2 className="mb-2 mt-[22px] text-base">Сейчас здесь</h2>
    //         <ul className="m-0 list-disc pl-5">
    //           {(state?.players ?? []).map((nearbyPlayer) => (
    //             <li key={nearbyPlayer.id}>
    //               {nearbyPlayer.name}
    //               {nearbyPlayer.id === player?.id ? " (вы)" : ""}
    //             </li>
    //           ))}
    //         </ul>
    //       </section>

    //       <button
    //         className="cursor-pointer rounded-lg border border-forest bg-forest px-3.5 py-2.5 text-white"
    //         onClick={() => void handleAction()}
    //         disabled={busy}
    //       >
    //         {busy ? "Подождите..." : "Выполнить действие"}
    //       </button>

    //       <section>
    //         <h2 className="mb-2 mt-[22px] text-base">Последние события</h2>
    //         <ul className="m-0 list-disc pl-5">
    //           {(state?.recentEvents ?? []).map((event) => (
    //             <li key={event.id}>
    //               {event.playerName}: {event.type}
    //             </li>
    //           ))}
    //         </ul>
    //       </section>
    //     </main>
    //   )}
    // </Shell>
    <>
      <Theme>
          <Routes>
            <Route path="" element={<MainLayout />}>
              <Route path="/" element={<Home />}/>
              <Route path="Map" element={<Map />}/>
              <Route path="Profile" element={<Profile />}/>
            </Route>

          </Routes>
      </Theme>
    </>
  );
}

function Shell({ children, error }: { children?: React.ReactNode; error: string | null }) {
  return (
    <div className="min-h-screen bg-canvas p-4 font-sans text-ink">
      {error ? (
        <div className="mx-auto mb-4 max-w-[960px] rounded-lg border border-error-border bg-error-bg p-3 text-error-text">
          {error}
        </div>
      ) : null}
      {children ?? <Loading />}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
        <App />
    </BrowserRouter>
  </StrictMode>
);
