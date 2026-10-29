import { ActionIcon } from "../../../../shared/ui/ActionIcon";
import { Card,Text } from "@radix-ui/themes";
import { TypeModal } from "../../../../shared/ui/modal/types";
type ExchangeProps = {
  setShowModal: (value: boolean) => void
  showIsModal: boolean
  setTypeShowIsModal:(value: TypeModal | null) => void
}
export default function ExchangeCard({showIsModal,setShowModal,setTypeShowIsModal}:ExchangeProps){
    return(
       <Card className="game-card h-full w-full">
          <div
            onClick={() => {setTypeShowIsModal(TypeModal.SelectOfFriendExchange),setShowModal(showIsModal ? false : true)}}
          >
            <div className="flex flex-row justify-between">
              <div className="max-w-60">
                <Text className="flex items-center gap-2" as="div" size="2" weight="bold">
                  <div className="flex-row flex gap-2">
                    Обмен
                    <ActionIcon name="exchange" />
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
