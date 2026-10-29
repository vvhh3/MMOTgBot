import { Table } from "@radix-ui/themes";
import LevelBadge from "../../shared/ui/LevelBadge";
import Specimen from "./Specimen";
import "./table-layouts.css";

const players = [
  { place: 1, name: "Артём", level: 12, points: 480, current: false },
  { place: 2, name: "Тестовый герой", level: 8, points: 125, current: true },
  { place: 3, name: "Саша", level: 6, points: 80, current: false },
];

export default function TableLayoutSamples() {
  return <Specimen preserveStyle title="Таблица" usage="Жидкое стекло · Рейтинг · Админка" wide>
    <div className="ui-table-option">
      <div className="ui-table-stage"><div>
        <Table.Root className="game-table ui-table" variant="ghost" size="2">
          <caption className="sr-only">Рейтинг игроков</caption>
          <Table.Header><Table.Row>
            <Table.ColumnHeaderCell>Место</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Игрок</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell className="text-center!">Уровень</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell justify="end">Очки</Table.ColumnHeaderCell>
          </Table.Row></Table.Header>
          <Table.Body>{players.map(player => <Table.Row key={player.place} data-current={player.current || undefined}>
            <Table.Cell><span className="rank-badge">{player.place}</span></Table.Cell>
            <Table.RowHeaderCell><div className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{player.name}</span>
              {player.current && <span className="game-badge px-1! py-0! text-[9px]!">Вы</span>}
            </div></Table.RowHeaderCell>
            <Table.Cell className="text-center!"><LevelBadge level={player.level} /></Table.Cell>
            <Table.Cell justify="end"><strong className="text-[13px] font-extrabold text-[#9a3412]">{player.points}</strong></Table.Cell>
          </Table.Row>)}</Table.Body>
        </Table.Root>
      </div></div>
    </div>
  </Specimen>;
}
