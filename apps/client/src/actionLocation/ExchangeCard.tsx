import { Card,Text} from "@radix-ui/themes"
import { Link } from "react-router-dom"
type ExchangeProps = {
    setShowModalTrade: (value: boolean) => void
    showModalTrade: boolean
}
export default function ExchangeCard({showModalTrade,setShowModalTrade}:ExchangeProps){
    return(
       <Card>
          <div
            onClick={() => setShowModalTrade(showModalTrade ? false : true)}
          >
            <div className="flex flex-row justify-between">
              <div className="max-w-60">
                <Text as="div" size="2" weight="bold">
                  <div className="flex-row flex gap-2">
                    Обмен
                    <svg
                      height="20px"
                      width="20px"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                      <g
                        id="SVGRepo_tracerCarrier"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      ></g>
                      <g id="SVGRepo_iconCarrier">
                        {" "}
                        <path
                          d="M19.9381 13C19.979 12.6724 20 12.3387 20 12C20 7.58172 16.4183 4 12 4C9.49942 4 7.26681 5.14727 5.7998 6.94416M4.06189 11C4.02104 11.3276 4 11.6613 4 12C4 16.4183 7.58172 20 12 20C14.3894 20 16.5341 18.9525 18 17.2916M15 17H18V17.2916M5.7998 4V6.94416M5.7998 6.94416V6.99993L8.7998 7M18 20V17.2916"
                          stroke="#E85D2F"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        ></path>{" "}
                      </g>
                    </svg>
                  </div>
                </Text>
                <Text as="div" color="gray" size="1">
                  Можете обменяться с другими игроками на локации
                </Text>
              </div>
            </div>
          </div>
        </Card>
    )
}