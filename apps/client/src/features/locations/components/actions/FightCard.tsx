import { ActionIcon } from "../../../../shared/ui/ActionIcon";
import { useGroupEvent } from '../../../group-events/GroupEventProvider';
import { Card,Text } from "@radix-ui/themes";
import { TypeModal } from "../../../../shared/ui/modal/types";
type FightProps = {
  setShowModal: (value: boolean) => void
  showIsModal: boolean
  setTypeShowIsModal:(value: TypeModal | null) => void
}
export default function FightCard({setShowModal,showIsModal,setTypeShowIsModal}:FightProps){
    const { runSolo } = useGroupEvent();
    return(
        <Card className="game-card h-full w-full">
          <div onClick={() => { void runSolo('сразиться один на один', async () => { setTypeShowIsModal(TypeModal.SelectOfFriendFight); setShowModal(!showIsModal); }); }}>
            <div className="flex flex-col">
                <Text className="flex items-center gap-2" size="2" weight="bold">
                  <div className="flex-row flex gap-2">
                    Сражение
                    <ActionIcon name="fight" />
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
