type BattleRoundIndicatorProps = {
    round: number;
    remainingSeconds?: number;
};

export default function BattleRoundIndicator({ round, remainingSeconds }: BattleRoundIndicatorProps) {
    const showTimer = remainingSeconds !== undefined && remainingSeconds <= 30;

    return (
        <div className="battle-round-indicator flex items-center justify-center">
            <div className="battle-round-number flex items-center justify-center" aria-label={`Раунд ${round}`}>
                <strong className="text-[#D94E2B]">{round}</strong>
            </div>
            {showTimer && (
                <span className="battle-last-seconds" data-urgent={remainingSeconds <= 10 || undefined} role="status">
                    {remainingSeconds} сек.
                </span>
            )}
        </div>
    );
}
