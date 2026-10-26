import type { CombatStateResponse,FriendsOverviewResponse,InventoryItemDto,LocationStateResponse,PlayerDto,PvpStateDto,TradeStateDto } from "@mmobot/shared";
import { Theme } from "@radix-ui/themes";
import { useCallback,useEffect,useRef,useState } from "react";
import { Route,Routes,useLocation,useNavigate } from "react-router-dom";
import Admin from "../features/admin/Admin";
import { auth } from "../features/auth/api";
import BlackjackGame from "../features/casino/components/BlackjackGame";
import LadderGame from "../features/casino/components/LadderGame";
import MinesGame from "../features/casino/components/MinesGame";
import { getMe } from "../features/character/api";
import CharacterCreation from "../features/character/components/CharacterCreation";
import Profile from "../features/character/components/Profile";
import { getPvpOverview } from "../features/combat/api";
import Fight from "../features/combat/components/Fight";
import PveFight from "../features/combat/components/PveFight";
import Team from "../features/friends/components/Team";
import Inventory from "../features/inventory/components/Inventory";
import Leaderboard from "../features/leaderboard/components/Leaderboard";
import Map from "../features/locations/components/GameMap";
import Home from "../features/locations/components/Home";
import { useCurrentLocation } from "../features/locations/hooks/useCurrentLocation";
import { getLocationImage } from "../features/locations/lib/getLocationImage";
import { theLastAction } from "../features/players/api";
import Tasks from "../features/quests/components/Tasks";
import Shop from "../features/shop/components/Shop";
import { getTradesOverview } from "../features/trades/api";
import Exchange from "../features/trades/components/Exchange";
import { connectSocket } from "../shared/api/socket";
import { usePreloadedImage } from "../shared/hooks/usePreloadedImage";
import { preloadImage } from "../shared/lib/preloadImage";
import { getTelegramInitData } from "../shared/lib/telegram";
import PageCurtain from "../shared/ui/animations/PageCurtain";
import { TypeModal } from "../shared/ui/modal/types";
import MainLayout from "./layout/MainLayout";
import Loading from './ui/Loading';
import mapImage from "/mapMat.png";

function ScrollToTop({ pathname }: { pathname: string }) {

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default function App() {
  const routeLocation = useLocation()
  const { pathname } = routeLocation
  const [displayedLocation, setDisplayedLocation] = useState(routeLocation)
  const [player, setPlayer] = useState<PlayerDto | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [inventory, setInventory] = useState<InventoryItemDto[]>([])
  const currentLocation = useCurrentLocation(token, player?.currentLocationId ?? null)
  const { state: locationState, onState: setLocationState } = currentLocation
  const [error, setError] = useState<string | null>(null)
  const [friendsOverview, setFriendsOverview] = useState<FriendsOverviewResponse | null>(null)
  const [pvpState, setPvpState] = useState<PvpStateDto | null>(null)
  const pvpUpdateVersion = useRef(0)
  const updatePvpState = useCallback((next: PvpStateDto | null) => {
    pvpUpdateVersion.current += 1
    setPvpState(previous => previous && next && (previous.id > next.id ||
      (previous.id === next.id && previous.stateVersion > next.stateVersion)) ? previous : next)
  }, [])
  const [tradeState, setTradeState] = useState<TradeStateDto | null>(null)
  const [showIsModal, setShowModal] = useState(false)
  const [typeShowIsModal, setTypeShowIsModal] = useState<TypeModal | null>(null)
  const [state, setState] = useState<CombatStateResponse>()
  const updateCombatState = useCallback((next: CombatStateResponse) => {
    setState(previous => previous && (previous.id > next.id || (previous.id === next.id && previous.stateVersion > next.stateVersion)) ? previous : next);
  }, []);
  // Session data, location data and the visible background must all be ready.
  const [ready, setReady] = useState(false)
  const [startupError, setStartupError] = useState<string | null>(null)
  const [startupAttempt, setStartupAttempt] = useState(0)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [infoMessages, setInfoMessages] = useState({ title: "", info: "" })
  const navigate = useNavigate()
  const screenPath = displayedLocation.pathname.toLowerCase().replace(/\/+$/, "") || "/"

  const backgroundUrl = !player?.isCreated || !currentLocation.ready ? null
    : screenPath === "/" ? (locationState ? getLocationImage(locationState.location.homeImg) : mapImage)
    : screenPath === "/takeawalk" ? getLocationImage(locationState?.location.fightImg ?? "fonNetralitet.svg")
    : screenPath === "/fight" ? getLocationImage("fonNetralitet.svg")
    : screenPath === "/profile" || screenPath === "/map" ? mapImage
    : null
  const background = usePreloadedImage(backgroundUrl)
  const screenReady = ready && currentLocation.ready && background.ready
  const loadingError = startupError ?? currentLocation.error ?? background.error
  const retryLoading = () => {
    if (startupError) {
      setStartupError(null)
      setStartupAttempt((value) => value + 1)
    } else {
      currentLocation.retry()
      background.retry()
    }
  }

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setStartupError(null);
    setLoadingProgress(0);
    const initData = getTelegramInitData();
    if (!initData) {
      setStartupError("Откройте приложение внутри Telegram: для входа нужен настоящий initData.");
      return;
    }
    auth(initData)
      .then(async (authData) => {
        if (cancelled) return;
        setLoadingProgress(20);
        const [meData, pvpOverview, tradesOverview] = await Promise.all([
          getMe(authData.token),
          getPvpOverview(authData.token).catch(() => null),
          getTradesOverview(authData.token).catch(() => null)
        ]);
        if (cancelled) return;
        setPlayer(meData.player);
        setToken(authData.token);
        setInventory(meData.inventory);
        setLoadingProgress(60);
        const incomingPvp = pvpOverview?.invites.find((i) => i.direction === "incoming");
        if (incomingPvp) {
          setPvpState({
            round: 1, stateVersion: 0, roundStartedAt: null, events: [], moves: [], actionSubmitted: false, healingAvailable: true,
            exitRequested: false, partnerExitRequested: false,
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

        setReady(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) setStartupError(err instanceof Error ? err.message : "Не удалось войти");
      });
    return () => { cancelled = true; };
  }, [startupAttempt]);

  // Only warm backgrounds for the current location after the visible screen is ready.
  useEffect(() => {
    if (!screenReady || !locationState) return;
    void Promise.allSettled([
      preloadImage(getLocationImage(locationState.location.homeImg)),
      preloadImage(getLocationImage(locationState.location.fightImg)),
    ]);
  }, [screenReady, locationState?.location.homeImg, locationState?.location.fightImg]);

  useEffect(() => {
    if (!token) return;
    const socket = connectSocket(token, false);
    let cancelled = false;

    // Фатальные ошибки авторизации: токен протух или игрока нет в БД
    // (например, после пересоздания базы на сервере). Бесконечно ретраить
    // бессмысленно — отключаемся и один раз пробуем получить новый токен.
    let lastReauthAt = 0;
    const onConnectError = (err: Error) => {
      if (err.message === "Invalid auth token" || err.message === "Player not found") {
        if (Date.now() - lastReauthAt < 10000) return;
        lastReauthAt = Date.now();
        socket.disconnect();
        const initData = getTelegramInitData();
        if (!initData) return;
        auth(initData)
          .then((d) => {
            if (cancelled) return;
            setPlayer(d.player);
            setToken(d.token);
            // A renewed token normally reruns this effect; identical tokens need reconnecting here.
            if (d.token === token) socket.connect();
          })
          .catch(() => { if (!cancelled) setError("Сессия истекла, перезапустите приложение"); });
        return;
      }
      setError(err.message);
      console.log("error", err)
    };
    const onLocationState = (nextState: LocationStateResponse) => setLocationState(nextState);
    const onPlayer = (nextPlayer: PlayerDto) => setPlayer(nextPlayer);
    const onInventory = (nextInventory: InventoryItemDto[]) => setInventory(nextInventory);
    const onCombatState = (combatState: CombatStateResponse) => updateCombatState(combatState);
    const onFriendsUpdate = (friendState: FriendsOverviewResponse) => setFriendsOverview(friendState)
    const onPvpState = updatePvpState
    const onTradeState = (tradeState: TradeStateDto | null) => setTradeState(tradeState)

    socket.on("connect_error", onConnectError);
    socket.on("locationState", onLocationState);
    socket.on("player", onPlayer);
    socket.on("inventory", onInventory);
    socket.on("combatState", onCombatState)
    socket.on("friendsUpdate", onFriendsUpdate)
    socket.on("pvpState", onPvpState)
    socket.on("tradeUpdate", onTradeState)
    socket.connect();

    return () => {
      cancelled = true;
      socket.off("connect_error", onConnectError)
      socket.off("locationState", onLocationState)
      socket.off("player", onPlayer)
      socket.off("inventory", onInventory)
      socket.off("combatState", onCombatState)
      socket.off("friendsUpdate", onFriendsUpdate)
      socket.off("pvpState", onPvpState)
      socket.off("tradeUpdate", onTradeState)
    }

  }, [token, setLocationState, updatePvpState, updateCombatState])
  useEffect(() => {
    if (!player) return
    if (player.idTheLastAction == null) return
    if (player.idTheLastAction.type == "Fight") {
      if (!token) return;
      let cancelled = false;
      const version = pvpUpdateVersion.current;
      const sessionId = player.idTheLastAction.id;
      const loadPvp = async () => {
        const session = await theLastAction(token, player.id);
        // Восстановление не перезаписывает ход, уже полученный через сокет или действие.
        if (cancelled || version !== pvpUpdateVersion.current) return;
        updatePvpState(session.info);
        if (!session.info || session.info.finished) {
          setPlayer((current) => current?.idTheLastAction?.type === "Fight" && current.idTheLastAction.id === sessionId
            ? { ...current, idTheLastAction: null }
            : current);
          return;
        }
        navigate("/Fight", { replace: true });
      };
      loadPvp().catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Не удалось восстановить дуэль");
      });
      return () => { cancelled = true; };
    }
    else if (player.idTheLastAction.type == "TakeAWalk") {
      if (!token) return
      const loadTakeAWalk = async () => {
        const session = await theLastAction(token, player.id)
        if (!session.info) return;
        updateCombatState(session.info);
        navigate("/TakeAWalk", { replace: true })

      }
      loadTakeAWalk()
    }
    else if (player.idTheLastAction.type == "Trade") {
      if (!token) return
      const loadTakeAWalk = async () => {
        const session = await theLastAction(token, player.id)
        setTradeState({
          id: session.info.id,
          status: session.info.status,
          myOffer: session.info.myOffer,
          partnerOffer: session.info.partnerOffer,
          iAmReady: session.info.iAmReady,
          partnerIsReady: session.info.partnerIsReady,
          partnerName: session.info.partnerName,
          direction: session.info.direction
        })
        navigate("/Exchange", { replace: true })

      }
      loadTakeAWalk()
    }
    else if (["Mines", "Blackjack", "Ladder"].includes(player.idTheLastAction.type)) {
      const routes = { Mines: "/Casino/Mines", Blackjack: "/Casino/Blackjack", Ladder: "/Casino/Ladder" } as const
      const activeGameRoute = routes[player.idTheLastAction.type as keyof typeof routes]
      if (!token || pathname === activeGameRoute) return

      const loadCasinoSession = async () => {
        await theLastAction(token, player.id)
        navigate(activeGameRoute, { replace: true })
      }
      loadCasinoSession().catch(() => undefined)
    }

  }, [player?.id, player?.idTheLastAction?.id, player?.idTheLastAction?.type, pathname, token, navigate, updatePvpState])
  return (
    <>
      <Theme>
        <ScrollToTop pathname={displayedLocation.pathname} />
        {screenReady ? (
          player && !player.isCreated ? (
            <CharacterCreation token={token} player={player} onCreated={setPlayer} />
          ) :
          <Routes location={displayedLocation}>
            <Route path="" element={<MainLayout onCombatState={updateCombatState} infoMessages={infoMessages} setPvpState={setPvpState} setTradeState={setTradeState} setTypeShowIsModal={setTypeShowIsModal} setShowModal={setShowModal} showIsModal={showIsModal} typeShowIsModal={typeShowIsModal} player={player} token={token} error={error} onError={setError} onPlayer={setPlayer} pvpState={pvpState} tradeState={tradeState} />}>
              <Route path="/" element={<Home setInfoMessages={setInfoMessages} typeShowIsModal={typeShowIsModal} setTypeShowIsModal={setTypeShowIsModal} setShowModal={setShowModal} showIsModal={showIsModal} onError={setError} onState={updateCombatState} onPlayer={setPlayer} token={token} player={player} locationState={locationState} friendsOverview={friendsOverview} pvpState={pvpState} tradeState={tradeState} />} />
              <Route path="Map" element={<Map token={token} player={player} onLocationState={setLocationState} onPlayer={setPlayer} />} />
              <Route path="Profile" element={<Profile setTypeShowIsModal={setTypeShowIsModal} setShowModal={setShowModal} player={player} locationState={locationState} />} />
              <Route path="Tasks" element={<Tasks token={token} onPlayer={setPlayer} />} />
              <Route path="Leaderboard" element={<Leaderboard token={token} playerId={player?.id ?? null} playerPoints={player?.points ?? 0} factionId={player?.factionId ?? null} />} />
              <Route path="Team" element={<Team token={token} player={player} liveOverview={friendsOverview} />} />
              <Route path="Inventory" element={<Inventory token={token} player={player} inventory={inventory} onPlayer={setPlayer} onInventory={setInventory} />} />
              <Route path="Shop" element={<Shop token={token} player={player} inventory={inventory} onPlayer={setPlayer} onInventory={setInventory} />} />
              <Route path="Exchange" element={<Exchange token={token} player={player} tradeState={tradeState} inventory={inventory} />} />
              <Route path="AdminPanel" element={<Admin token={token} player={player} onPlayer={setPlayer} />} />
              <Route path="Casino/Mines" element={<MinesGame token={token} player={player} onPlayer={setPlayer} />} />
              <Route path="Casino/Blackjack" element={<BlackjackGame token={token} player={player} onPlayer={setPlayer} />} />
              <Route path="Casino/Ladder" element={<LadderGame token={token} player={player} onPlayer={setPlayer} />} />
            </Route>
            <Route path="/TakeAWalk" element={<PveFight token={token} player={player} inventory={inventory} onPlayer={setPlayer} onInventory={setInventory} locationState={locationState} onError={setError} error={error} onState={updateCombatState} state={state} />} />
            <Route path="/Fight" element={<Fight token={token} player={player} inventory={inventory} onPlayer={setPlayer} onInventory={setInventory} pvpState={pvpState} onPvpState={updatePvpState} />} />
          </Routes>
        ) : (
          <Loading
            progress={ready ? (currentLocation.ready ? 90 : 70) : loadingProgress}
            error={loadingError}
            onRetry={retryLoading}
          />
        )}
      </Theme>
      <PageCurtain target={routeLocation} displayed={displayedLocation} onCovered={setDisplayedLocation} ready={screenReady || !!loadingError} />
    </>
  );
}

