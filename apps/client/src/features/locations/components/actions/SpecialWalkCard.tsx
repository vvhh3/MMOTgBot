import { ActionIcon } from "../../../../shared/ui/ActionIcon";
import { Card, Text } from '@radix-ui/themes';
import { useGroupEvent } from '../../../group-events/GroupEventProvider';

export default function SpecialWalkCard() {
  const { overview, available, openLobby } = useGroupEvent();
  return <Card className="game-card h-full w-full"><button className="h-full w-full text-left" onClick={openLobby}>
    <Text className="flex items-center gap-2" as="div" size="2" weight="bold">Особая прогулка с компанией<ActionIcon name="group" /></Text>
    <Text as="div" size="1" color="gray">{available ? `Зачистка втроём · ${overview?.party?.members.filter(m => m.status === 'joined').length ?? 0}/3` : 'Сейчас недоступно'}</Text>
  </button></Card>;
}
