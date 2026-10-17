import { Badge, Button, Card, Text, TextField } from "@radix-ui/themes";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { getLocationImage } from "../../utils/getLocationImage";

type Props = { title: string; subtitle: string; money: number; error?: string; children: ReactNode };

export default function CasinoFrame({ title, subtitle, money, error, children }: Props) {
  return <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-8">
    <Card className="overflow-hidden p-0!">
      <div className="relative min-h-35 bg-cover bg-center" style={{ backgroundImage: `url(${getLocationImage("market-fight.svg")})` }}>
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/45 to-transparent" />
        <div className="relative flex min-h-35 flex-col justify-between p-4 text-white">
          <div className="flex items-start justify-between gap-2">
            <Button asChild size="1" variant="soft" color="orange"><Link to="/">← Сити парк</Link></Button>
            <Badge color="orange" size="2" variant="solid">Монеты: {money}</Badge>
          </div>
          <div><h1 className="text-xl font-bold">{title}</h1><p className="mt-1 text-xs text-white/80">{subtitle}</p></div>
        </div>
      </div>
    </Card>
    {error && <Card role="alert" className="border-red-400! bg-red-50! text-red-700!">{error}</Card>}
    {children}
  </main>;
}


export function BetInput({ value, max, onChange }: { value: number; max: number; onChange: (value: number) => void }) {
  return <label className="flex flex-col gap-2">
    <Text size="2" weight="bold">Ставка в монетах</Text>
    <TextField.Root type="number" min="1" max={String(max)} value={String(value)} onChange={(event) => onChange(Number(event.target.value))} />
    <Text size="1" color="gray">Доступно: {max}</Text>
  </label>;
}

