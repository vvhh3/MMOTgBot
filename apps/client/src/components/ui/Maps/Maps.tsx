import { useState, useRef, useLayoutEffect, useEffect } from "react";
import {
  TransformWrapper,
  TransformComponent
} from "react-zoom-pan-pinch";
import { Card, Inset } from "@radix-ui/themes";
import map from "./mapMat.png"
import fon from "../../../public/Home.svg"
import { LocationDto, PlayerDto } from "@mmobot/shared";
import { enterLocation, getLocations } from "../../../api";

const IMG_W = 1622;
const IMG_H = 970;

const locations = [
  {
    id: 1,
    name: "Площадь",
    description: "Тут происходит нечто странное",
    x: 31,
    y: 40,
    zoom: 1.5
  }
];


export default function GameMap({ token }:{token: string | null}) {


  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [activeLocation, setActiveLocation] = useState<any>(null);
  const [scale, setScale] = useState(1);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });

  const [moving, setMoving] = useState(false)
  const [lcoations, setLocations] = useState<LocationDto[]>([])

  useEffect(() => {
    if (!token) return
    getLocations(token).then((res) => setLocations(res.locations)).catch(() => alert("error"))
  }, [token])

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

  const goToLocation = (loc: any) => {
    const el = containerRef.current;
    if (!el || !mapRef.current) return;

    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const targetScale = view.scale * (loc.zoom ?? 1);
    const tx = (loc.x / 100) * IMG_W * targetScale - cw / 2;
    const ty = (loc.y / 100) * IMG_H * targetScale - ch / 2;

    mapRef.current.setTransform(-tx, -ty, targetScale, 600);

    setSelectedLocation(loc);
    setActiveLocation(loc.id);
  };

  const closeLocation = () => {
    setSelectedLocation(null);
    setActiveLocation(null);
  };


  const travelTo = async (loc: LocationDto) => {
    if (!token || moving) return
    setMoving(true)
    try {
      const res = await enterLocation(token, loc.id)
      closeLocation()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось перейти");
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
                    disabled={moving}
                    onClick={() => travelTo(selectedLocation)}
                    style={{
                      position: "absolute",
                      left: `${loc.x}%`,
                      top: `${loc.y}%`,
                      transform: `translate(-50%, -50%) scale(${1 / scale})`,
                      transformOrigin: "center"
                    }}
                    className={`rounded-full w-3 h-3 transition-colors duration-300
                      ${activeLocation === loc.id ? "bg-[#E8603C]" : "bg-white"}`} />
                  <p
                    style={{
                      position: "absolute",
                      left: `${loc.x}%`,
                      top: `${loc.y + 1}%`,
                      transform: `translateX(-50%) scale(${1 / scale})`,
                      transformOrigin: "top center"
                    }}
                    className="ext-black text-[10px] font-bold  whitespace-nowrap">
                    {loc.name}
                  </p>

                </div>
              ))}

            </div>

          </TransformComponent>

        </TransformWrapper>
      )}

      {selectedLocation && (

        <Card
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            padding: 30,
            borderRadius: 20,
            zIndex: 1000,
            width: 300
          }}
        >
          <Inset>
            <img src={fon} style={{ padding: "10px", borderRadius: "16px" }}
            />
          </Inset>

          <h2 className="text-xl font-bold">
            {selectedLocation.name}
          </h2>


          <p>
            {selectedLocation.description}
          </p>


          <div className="flex flex-row gap-2">

            <button
              onClick={closeLocation}
              className=" mt-4 bg-red-400 text-white px-4 py-2 rounded">
              Закрыть
            </button>


            <button
              onClick={closeLocation}
              className="mt-4 bg-green-500 text-white px-4 py-2 rounded">
              Выбрать
            </button>

          </div>

        </Card>

      )}

    </div>
  );
}