import type { BattleStatusView } from '@mmobot/shared';
import { Badge, Popover, Text } from '@radix-ui/themes';

type BattleStatusBadgesProps = {
    statuses: BattleStatusView[];
    fighterName: string;
};

export default function BattleStatusBadges({ statuses, fighterName }: BattleStatusBadgesProps) {
    if (statuses.length === 0) return null;

    return (
        <ul className="battle-status-list mt-2 flex flex-wrap gap-1" aria-label={`Эффекты: ${fighterName}`}>
            {statuses.map((status, index) => {
                const duration = status.remainingRounds === null
                    ? status.kind === 'psychic_charge' ? 'до промаха или снятия эффекта' : 'до следующей атаки'
                    : `${status.remainingRounds} раунд(а)`;
                const detail = status.kind === 'shield'
                    ? `${status.value} HP · ${duration}`
                    : `${status.stacks ? `×${status.stacks} · ` : ''}${duration}`;
                const displayValue = status.kind === 'shield' ? status.value
                    : status.stacks ? `×${status.stacks}`
                    : status.remainingRounds !== null ? status.remainingRounds : undefined;

                return (
                    <li key={`${status.kind}-${index}`} className="max-w-full">
                        <Popover.Root>
                            <Popover.Trigger>
                                <button type="button" className="battle-status-trigger max-w-full" aria-label={`${status.name}: ${detail}. ${status.description}`}>
                                    <Badge size="1" variant="soft" className="battle-status-badge max-w-full whitespace-normal text-left" data-kind={status.kind} data-positive={status.positive} color={status.positive ? 'green' : status.kind === 'wet' ? 'blue' : 'orange'}>
                                        <span className="battle-status-icon" aria-hidden="true">{status.icon}</span>
                                        <span className="battle-status-label">
                                            <span className="battle-status-name">{status.name}</span>
                                            {displayValue !== undefined && <span className="battle-status-value" data-unit={status.kind === 'shield' ? ' HP' : status.stacks ? undefined : ' р.'}><span className="battle-status-separator"> · </span>{displayValue}</span>}
                                        </span>
                                    </Badge>
                                </button>
                            </Popover.Trigger>
                            <Popover.Content size="1" maxWidth="260px">
                                <Text as="p" size="2" weight="bold">{status.name} · {detail}</Text>
                                <Text as="p" size="1" mt="1">{status.description}</Text>
                            </Popover.Content>
                        </Popover.Root>
                    </li>
                );
            })}
        </ul>
    );
}
