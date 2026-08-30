import { Card,Text} from "@radix-ui/themes"
import { getLocationState, startCombat } from "../api";
import { LocationDto, LocationStateResponse, PlayerDto } from "@mmobot/shared";
import { useNavigate } from "react-router-dom";
type FightProps = {
  setShowModalPvp: (value: boolean) => void
  showModalPvp: boolean
}
export default function FightCard({setShowModalPvp,showModalPvp}:FightProps){
    return(
         <Card>
          <div onClick={() => setShowModalPvp(showModalPvp ? false : true)}>
            <div className="flex flex-col">
                <Text size="2" weight="bold">
                  <div className="flex-row flex gap-2">
                    Сражение
                    <svg
                      height="20px"
                      width="20px"
                      viewBox="0 0 16 16"
                      xmlns="http://www.w3.org/2000/svg"
                      version="1.1"
                      fill="none"
                      stroke="#E85D2F"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                    >
                      <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                      <g
                        id="SVGRepo_tracerCarrier"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      ></g>
                      <g id="SVGRepo_iconCarrier">
                        {" "}
                        <path d="m2.75 9.25 1.5 2.5 2 1.5m-4.5 0 1 1m1.5-2.5-1.5 1.5m3-1 8.5-8.5v-2h-2l-8.5 8.5"></path>{" "}
                        <path d="m10.25 12.25-2.25-2.25m2-2 2.25 2.25m1-1-1.5 2.5-2 1.5m4.5 0-1 1m-1.5-2.5 1.5 1.5m-7.25-5.25-4.25-4.25v-2h2l4.25 4.25"></path>{" "}
                      </g>
                    </svg>
                  </div>
                </Text>
                <Text color="gray" size="1">
                  Сражение с игроками на локации
                </Text>
              </div>
          </div>
        </Card>
    )
}