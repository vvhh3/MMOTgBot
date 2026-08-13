import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { InventoryItemDto, LocationDto, LocationStateResponse, PlayerDto } from "@mmobot/shared";
import {
  auth,
  enterLocation,
  getLocationState,
  getLocations,
  getMe,
  performLocationAction
} from "./api";
import { getTelegramInitData } from "./telegram";
import "./styles.css";

type Screen = "map" | "location";

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [player, setPlayer] = useState<PlayerDto | null>(null);
  const [inventory, setInventory] = useState<InventoryItemDto[]>([]);
  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [state, setState] = useState<LocationStateResponse | null>(null);
  const [screen, setScreen] = useState<Screen>("map");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const initData = getTelegramInitData();
    if (!initData) {
      setError("Откройте приложение внутри Telegram: для входа нужен настоящий initData.");
      return;
    }

    auth(initData)
      .then(async (authData) => {
        setToken(authData.token);
        setPlayer(authData.player);
        const [meData, locationsData] = await Promise.all([getMe(authData.token), getLocations(authData.token)]);
        setPlayer(meData.player);
        setInventory(meData.inventory);
        setLocations(locationsData.locations);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Не удалось войти"));
  }, []);

  useEffect(() => {
    if (!token || !selectedLocationId || screen !== "location") {
      return;
    }

    let active = true;
    const load = () => {
      getLocationState(token, selectedLocationId)
        .then((nextState) => {
          if (active) {
            setState(nextState);
          }
        })
        .catch((err: unknown) => setError(err instanceof Error ? err.message : "Не удалось обновить локацию"));
    };

    load();
    const timer = window.setInterval(load, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [screen, selectedLocationId, token]);

  const currentLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) ?? null,
    [locations, selectedLocationId]
  );

  async function handleEnter(locationId: string) {
    if (!token) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await enterLocation(token, locationId);
      setPlayer(result.player);
      setSelectedLocationId(locationId);
      setState(result.state);
      setScreen("location");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти в локацию");
    } finally {
      setBusy(false);
    }
  }

  async function handleAction() {
    if (!token || !selectedLocationId) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await performLocationAction(token, selectedLocationId);
      setPlayer(result.player);
      setInventory(result.inventory);
      setState(await getLocationState(token, selectedLocationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Действие не выполнено");
    } finally {
      setBusy(false);
    }
  }

  if (error && !token) {
    return <Shell error={error} />;
  }

  return (
    <Shell error={error}>
      <header className="topbar">
        <div>
          <span className="muted">Игрок</span>
          <strong>{player?.name ?? "Вход..."}</strong>
        </div>
        <div className="stats">
          <span>Ур. {player?.level ?? 1}</span>
          <span>{player?.points ?? 0} очков</span>
          <span>{inventory.reduce((sum, item) => sum + item.quantity, 0)} предметов</span>
        </div>
      </header>

      {screen === "map" ? (
        <main className="layout">
          <section className="map">
            {locations.map((location) => (
              <button
                key={location.id}
                className="map-point"
                style={{ left: `${location.x}%`, top: `${location.y}%` }}
                onClick={() => void handleEnter(location.id)}
                disabled={busy}
                title={location.name}
              >
                <span />
              </button>
            ))}
          </section>
          <section className="panel">
            <h1>Карта города</h1>
            <div className="location-list">
              {locations.map((location) => (
                <button key={location.id} onClick={() => void handleEnter(location.id)} disabled={busy}>
                  <strong>{location.name}</strong>
                  <span>{location.description}</span>
                </button>
              ))}
            </div>
          </section>
        </main>
      ) : (
        <main className="location-view">
          <button className="ghost" onClick={() => setScreen("map")}>
            Вернуться к карте
          </button>
          <h1>{state?.location.name ?? currentLocation?.name}</h1>
          <p>{state?.location.description ?? currentLocation?.description}</p>

          <section>
            <h2>Сейчас здесь</h2>
            <ul className="players">
              {(state?.players ?? []).map((nearbyPlayer) => (
                <li key={nearbyPlayer.id}>
                  {nearbyPlayer.name}
                  {nearbyPlayer.id === player?.id ? " (вы)" : ""}
                </li>
              ))}
            </ul>
          </section>

          <button className="primary" onClick={() => void handleAction()} disabled={busy}>
            {busy ? "Подождите..." : "Выполнить действие"}
          </button>

          <section>
            <h2>Последние события</h2>
            <ul className="events">
              {(state?.recentEvents ?? []).map((event) => (
                <li key={event.id}>
                  {event.playerName}: {event.type}
                </li>
              ))}
            </ul>
          </section>
        </main>
      )}
    </Shell>
  );
}

function Shell({ children, error }: { children?: React.ReactNode; error: string | null }) {
  return (
    <div className="app">
      {error ? <div className="error">{error}</div> : null}
      {children ?? <div className="empty">Загрузка...</div>}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
