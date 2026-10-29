import { getLocationAccess,type LocationDto,type LocationStateResponse,type PlayerDto } from "@mmobot/shared";
import { Card,Inset } from "@radix-ui/themes";
import { useEffect,useLayoutEffect,useRef,useState } from "react";
import { useNavigate } from "react-router-dom";
import {
TransformComponent,
TransformWrapper
} from "react-zoom-pan-pinch";
import { preloadImage } from "../../../shared/lib/preloadImage";
import EnterAnimation from "../../../shared/ui/animations/EnterAnimation";
import { enterLocation,getLocations } from "../api";
import { getLocationImage } from "../lib/getLocationImage";
import map from "/mapMat.png";
const IMG_W = 1622;
const IMG_H = 970;


type MapeProps = {
  token: string |null
  player: PlayerDto | null
  onLocationState: (state: LocationStateResponse) => void
  onPlayer: (state: PlayerDto) => void
}

export default function GameMap({ token,player,onLocationState,onPlayer }:MapeProps) {


  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });

  const [moving, setMoving] = useState(false)
  const [locations, setLocations] = useState<LocationDto[]>([])
  const [canBypassRestrictions, setCanBypassRestrictions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const selectedLocation = locations.find((loc) => loc.id === selectedLocationId) ?? null
  const accessFor = (loc: LocationDto) => getLocationAccess(loc, player?.level ?? 0, canBypassRestrictions)
  const selectedAccess = selectedLocation ? accessFor(selectedLocation) : null
  const statusLabel = (loc: LocationDto) => {
    if (!loc.isOpen) return "Скоро появится"
    if (loc.minLevel > 1) return `С ${loc.minLevel} уровня`
    return "Доступна"
  }

  const navigate = useNavigate()

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    setCanBypassRestrictions(false)
    setError(null)
    getLocations(token).then((res) => {
      if (cancelled) return
      setLocations(res.locations)
      setCanBypassRestrictions(res.canBypassRestrictions)
    }).catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : "Не удалось загрузить локации")
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [token, player?.level, loadAttempt])

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;

      if (cw === 0 || ch === 0) return;

      const cover = Math.max(cw / IMG_W, ch / IMG_H);

      const x = (IMG_W * cover - cw) / 2;
      const y = (IMG_H * cover - ch) / 2;

      const next = {
        scale: cover,
        x: -x,
        y: -y,
      };

      setView(next);
      setScale(cover);
      setReady(true);

      if (mapRef.current) {
        mapRef.current.setTransform(
          next.x,
          next.y,
          next.scale,
          0
        );
      }
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  const goToLocation = (loc: LocationDto) => {
    if (moving) return;
    const el = containerRef.current;
    if (!el || !mapRef.current) return;

    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const targetScale = view.scale;
    const tx = (loc.x / 100) * IMG_W * targetScale - cw / 2;
    const ty = (loc.y / 100) * IMG_H * targetScale - ch / 2;

    mapRef.current.setTransform(-tx, -ty, targetScale, 600);

    setSelectedLocationId(loc.id);
    setError(null);
  };

  const closeLocation = () => {
    setSelectedLocationId(null);
  };


  const travelTo = async (loc: LocationDto) => {
    if (!token || !player || moving || loading || accessFor(loc) !== "available") return
    setMoving(true)
    setError(null)
    try {
      // Prepare the destination before changing server state or navigating away.
      await preloadImage(getLocationImage(loc.homeImg))
      const res = await enterLocation(token, loc.id)
      onLocationState?.(res.state)
      onPlayer(res.player)
      navigate("/", { state: { transition: "location" } })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось перейти");
      // Правила могли измениться после загрузки карты.
      try {
        const fresh = await getLocations(token)
        setLocations(fresh.locations)
        setCanBypassRestrictions(fresh.canBypassRestrictions)
      } catch { /* Сохраняем исходную ошибку перехода. */ }
    } finally {
      setMoving(false)
    }
  }

  return (
    <div ref={containerRef}
      className="relative w-full h-full min-h-0 overflow-hidden">



      {ready && (
        <TransformWrapper
          ref={mapRef}
          initialScale={view.scale}
          initialPositionX={view.x}
          initialPositionY={view.y}
          minScale={view.scale}
          maxScale={view.scale * 5}
          limitToBounds
          onTransform={(ref) => {
            setScale(ref.state.scale);
          }}
        >
          <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>

            <div className="relative" style={{ width: IMG_W, height: IMG_H }}>

              <img
                src={map}
                alt="Карта"
                className="block h-full w-full" />

              {locations.map(loc => (
                <div key={loc.id} >
                  <button
                    type="button"
                    aria-label={`${loc.name}. ${statusLabel(loc)}${canBypassRestrictions && (!loc.isOpen || (player?.level ?? 0) < loc.minLevel) ? ". Доступна для тестирования" : ""}`}
                    onClick={() =>goToLocation(loc)}
                    style={{
                      position: "absolute",
                      left: `${loc.x}%`,
                      top: `${loc.y}%`,
                      transform: `translate(-50%, -50%) scale(${1 / scale})`,
                      transformOrigin: "center"
                    }}
                    className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-xs shadow-md transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2
                      ${selectedLocationId === loc.id ? "bg-[#E8603C]" : !loc.isOpen ? "bg-slate-600" : accessFor(loc) === "level_required" ? "bg-amber-400" : "bg-white"}`}>
                    {(!loc.isOpen || accessFor(loc) === "level_required") && <span aria-hidden="true">🔒</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => goToLocation(loc)}
                    style={{
                      position: "absolute",
                      left: `${loc.x}%`,
                      top: `${loc.y }%`,
                      transform: `translateX(-50%) scale(${1 / scale})`,
                      transformOrigin: "top center"
                    }}
                    className="mt-2 rounded-md bg-white/90 px-2 py-1 text-center text-[10px] font-bold text-slate-900 shadow-sm whitespace-nowrap">
                    {loc.name}
                    <span className={`block text-[9px] ${!loc.isOpen ? "text-slate-600" : accessFor(loc) === "level_required" ? "text-amber-800" : "text-emerald-700"}`}>{statusLabel(loc)}</span>
                  </button>

                </div>
              ))}

            </div>

          </TransformComponent>

        </TransformWrapper>
      )}

      {selectedLocation && (
        <EnterAnimation       className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-[20px] rounded-[20px] z-[1000] w-[min(340px,calc(100vw-24px))] max-h-[calc(100dvh-32px)] overflow-y-auto">
            <Card className="modal-surface relative"
            role="dialog"
            aria-label={selectedLocation.name}>
            <button className="modal-close-button absolute right-3 top-3 z-10" aria-label="Закрыть локацию" disabled={moving} onClick={closeLocation}>×</button>
            <Inset>
              <img src={getLocationImage(selectedLocation.homeImg)} alt={selectedLocation.name} style={{ padding: "10px", borderRadius: "16px", filter: selectedAccess === "available" ? undefined : "grayscale(1)" }}
              />
            </Inset>

            <h2 className="text-xl font-bold">
              {selectedLocation.name}
            </h2>


            <p>
              {selectedLocation.description}
            </p>

            <div className={`mt-3 rounded-lg p-3 text-sm ${selectedAccess === "level_required" ? "bg-amber-100 text-amber-950" : "bg-slate-100 text-slate-800"}`}>
              <p className="font-semibold">{statusLabel(selectedLocation)}</p>
              {!selectedLocation.isOpen && <p className="mt-1">Локация ещё в разработке. Она появится в одном из следующих обновлений.</p>}
              {selectedLocation.minLevel > 1 && <p className="mt-1">{!selectedLocation.isOpen ? `После открытия — с ${selectedLocation.minLevel} уровня. ` : ""}Ваш уровень: {player?.level ?? "—"}.</p>}
              {canBypassRestrictions && (!selectedLocation.isOpen || (player?.level ?? 0) < selectedLocation.minLevel) && (
                <p className="mt-2 font-medium text-indigo-700">Доступна для тестирования: ограничения сняты для администраторов и dev-стенда.</p>
              )}
            </div>
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}


            <div className="flex flex-row gap-2">

              <button
                onClick={() => travelTo(selectedLocation)}
                disabled={moving || loading || !player || selectedAccess !== "available"}
                className="game-button mt-4 px-4 py-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">
                {moving ? "Переход..." : selectedAccess === "coming_soon" ? "Скоро появится" : selectedAccess === "level_required" ? `С ${selectedLocation.minLevel} уровня` : "Перейти"}
              </button>

            </div>

          </Card>
        </EnterAnimation>


      )}

    </div>
  );
}
