import { Card, Text } from '@radix-ui/themes';
import { useGroupEvent } from '../../../group-events/GroupEventProvider';

export default function SpecialWalkCard() {
  const { overview, available, openLobby } = useGroupEvent();
  return <Card className="h-full w-full"><button className="h-full w-full text-left" onClick={openLobby}>
    <Text as="div" size="2" weight="bold">Особая прогулка с компанией</Text>
    <Text as="div" size="1" color="gray">{available ? `Зачистка втроём · ${overview?.party?.members.filter(m => m.status === 'joined').length ?? 0}/3` : 'Сейчас недоступно'}</Text>
  </button></Card>;
}
