import { useState, useRef } from "react";
import {
  TransformWrapper,
  TransformComponent
} from "react-zoom-pan-pinch";

// import map from "./map3.png";
import map from "./mapMat.png"


const locations = [
  {
    id: 1,
    name: "Площадь",
    description: "Тут происходит нечто странное",
    x: 31,
    y: 40,
    zoom: 2
  }
];


export default function GameMap() {

  const mapRef = useRef<any>(null);

  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [activeLocation, setActiveLocation] = useState<any>(null);
  const [scale, setScale] = useState(1.5);

  const goToLocation = (loc:any) => {

    mapRef.current.setTransform(
      -loc.x * 3.7,
      -loc.y * 6.4 ,
      loc.zoom,
      600
    );

    setSelectedLocation(loc);
    setActiveLocation(loc.id);
  };


  const closeLocation = () => {
    setSelectedLocation(null);
    setActiveLocation(null);
  };


  return (
    <>

      <TransformWrapper
        ref={mapRef}
        minScale={1.5}
        maxScale={3}
        onTransform={(ref) => {
          setScale(ref.state.scale);
        }}
      >

        <TransformComponent>

          <div style={{position:"relative"}}>

            <img
              src={map}
              style={{
                width:"3000px",
                height:"470px",
                display:"block"
                
                
              }}
            />


            {locations.map(loc => (
            <div key={loc.id} >
                <button
                  onClick={() => goToLocation(loc)}
                  style={{
                    position: "absolute",
                    left: `${loc.x}%`,
                    top: `${loc.y}%`,
                    transform: `translate(-50%, -50%) scale(${1 / scale})`,
                    transformOrigin: "center"
                  }}
                  className={`
                    rounded-full
                    w-3
                    h-3
                    transition-colors
                    duration-300
                    ${
                      activeLocation === loc.id
                        ? "bg-[#E8603C]"
                        : "bg-white"
                    }
                  `}
                />
               <p
                style={{
                  position: "absolute",
                  left: `${loc.x}%`,
                  top: `${loc.y + 1}%`,
                  transform: `translateX(-50%) scale(${1 / scale})`,
                  transformOrigin: "top center"
                }}
                className="
                  text-black
                  text-[10px]
                  font-bold
                  whitespace-nowrap
              "
              >
                {loc.name}
              </p>

            </div>
            ))}


          </div>

        </TransformComponent>

      </TransformWrapper>



      {selectedLocation && (

        <div
          style={{
            position:"fixed",
            top:"50%",
            left:"50%",
            transform:"translate(-50%, -50%)",
            background:"white",
            padding:30,
            borderRadius:20,
            zIndex:1000,
            width:300
          }}
        >

          <h2 className="text-xl font-bold">
            {selectedLocation.name}
          </h2>


          <p>
            {selectedLocation.description}
          </p>


          <div className="flex flex-row gap-2">

            <button
              onClick={closeLocation}
              className="
                mt-4
                bg-red-500
                text-white
                px-4
                py-2
                rounded
              "
            >
              Закрыть
            </button>


            <button
              onClick={closeLocation}
              className="
                mt-4
                bg-green-500
                text-white
                px-4
                py-2
                rounded
              "
            >
              Выбрать
            </button>

          </div>

        </div>

      )}

    </>
  );
}