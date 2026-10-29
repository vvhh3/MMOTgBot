import { ActionIcon } from "../../../../shared/ui/ActionIcon";
import { useGroupEvent } from '../../../group-events/GroupEventProvider';
import { CombatStateResponse,LocationStateResponse,PlayerDto } from "@mmobot/shared";
import { Card,Text } from "@radix-ui/themes";
import { useNavigate } from "react-router-dom";
import { useRef,useState } from 'react';
import { performLocationAction } from '../../api';
type WalkProps = {
  token: string| null
  player: PlayerDto| null
  locationState: LocationStateResponse|null
  onError:(value:string)=>void
  onState:(state: CombatStateResponse) => void
  onPlayer:(player: PlayerDto) => void
}
export default function WalkCard({token,player,locationState,onError,onState,onPlayer}:WalkProps){
  const { runSolo } = useGroupEvent();
  const navigate = useNavigate()
  const [pending, setPending] = useState(false);
  const locked = useRef(false);
  const functionStartCombat = async () => {
    if (!token || !player?.currentLocationId || !locationState || locked.current) return;
    const locationId = player.currentLocationId;
    locked.current = true;
    setPending(true);
    try {
      await runSolo('прогуляться одному', async () => {
      const response = await performLocationAction(token, locationId, 'walk');
      if (response.combat) {
        onState(response.combat);
        navigate('/TakeAWalk');
      }
      onPlayer(response.player);
      });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Не удалось прогуляться');
    } finally {
      locked.current = false;
      setPending(false);
    }
  };
    return(
        <Card className="game-card h-full w-full">
          <div className="flex flex-row  justify-between">
            <button type="button" className="max-w-60 text-left disabled:opacity-50" disabled={pending} onClick={()=>void functionStartCombat()}>
              <Text className="flex items-center gap-2" as="div" size="2" weight="bold">
                <div className="flex-row flex gap-2">
                  {pending ? 'Прогулка…' : 'Пройтись'}
                  <ActionIcon name="walk" />
                </div>
              </Text>
              <Text as="div" color="gray" size="1">
                Пройтись по локации
              </Text>
            </button>
          </div>
        </Card>
    )
}
