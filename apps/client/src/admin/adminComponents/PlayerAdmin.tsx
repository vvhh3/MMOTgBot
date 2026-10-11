import { useEffect, useState } from "react";
import { Button, Callout, Card, Flex, Heading, Select, Table, Text, TextField } from "@radix-ui/themes";
import type { PlayerDto } from "@mmobot/shared";
import { getAdminPlayers, updateAdminPlayer } from "../../api";
import { SKINS } from "../../utils/skins";

type PlayerAdminProps = {
  token: string | null;
  player: PlayerDto | null;
  onPlayer: (player: PlayerDto) => void;
};

export function PlayerAdmin({ token, player, onPlayer }: PlayerAdminProps) {
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<PlayerDto[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerDto | null>(null);
  const [money, setMoney] = useState("0");
  const [xp, setXp] = useState("0");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(SKINS[0]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const search = async (searchQuery = query) => {
    if (!token) return;
    setError(null);
    try {
      const result = await getAdminPlayers(token, searchQuery.trim());
      setPlayers(result.players);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить игроков");
    }
  };

  const selectPlayer = (target: PlayerDto) => {
    setSelectedPlayer(target);
    setName(target.name);
    setAvatar(target.avatar ?? SKINS[0]);
    setMoney("0");
    setXp("0");
    setSaved(false);
  };

  useEffect(() => {
    void search("");
  }, [token]);

  const save = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await updateAdminPlayer(token, {
        playerId: selectedPlayer?.id,
        money: Number(money),
        xp: Number(xp),
        name: name.trim(),
        avatar,
      });
      setSelectedPlayer(result.player);
      setPlayers((current) => current.map((item) => item.id === result.player.id ? result.player : item));
      if (result.player.id === player?.id) onPlayer(result.player);
      setMoney("0");
      setXp("0");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить персонажа");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="m-4">
      <Flex direction="column" gap="4">
        <div>
          <Heading size="4">Управление игроками</Heading>
          <Text color="gray">Найди игрока по имени или ID, затем выбери его для редактирования.</Text>
        </div>

        <Flex gap="2">
          <TextField.Root className="flex-1" placeholder="Имя или ID игрока" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void search(); }} />
          <Button color="orange" variant="soft" onClick={() => void search()}>Найти</Button>
        </Flex>

        <div className="max-h-56 overflow-auto">
          <Table.Root size="1">
            <Table.Header>
              <Table.Row><Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Имя</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Уровень</Table.ColumnHeaderCell><Table.ColumnHeaderCell /></Table.Row>
            </Table.Header>
            <Table.Body>
              {players.map((item) => (
                <Table.Row key={item.id} align="center">
                  <Table.Cell>{item.id}</Table.Cell>
                  <Table.Cell>{item.name}</Table.Cell>
                  <Table.Cell>{item.level}</Table.Cell>
                  <Table.Cell><Button size="1" color="orange" variant={selectedPlayer?.id === item.id ? "solid" : "soft"} onClick={() => selectPlayer(item)}>Выбрать</Button></Table.Cell>
                </Table.Row>
              ))}
              {players.length === 0 && <Table.Row><Table.Cell colSpan={4}>Игроки не найдены</Table.Cell></Table.Row>}
            </Table.Body>
          </Table.Root>
        </div>

        {selectedPlayer && <Text weight="bold">Редактирование: {selectedPlayer.name} (ID {selectedPlayer.id}) · {selectedPlayer.money} монет · {selectedPlayer.xp} XP</Text>}

        <Flex gap="3" wrap="wrap">
          <label className="min-w-40 flex-1">
            <Text as="div" size="2" mb="1">Добавить монеты</Text>
            <TextField.Root type="number" min="0" step="1" value={money} onChange={(event) => setMoney(event.target.value)} />
          </label>
          <label className="min-w-40 flex-1">
            <Text as="div" size="2" mb="1">Добавить опыт</Text>
            <TextField.Root type="number" min="0" step="1" value={xp} onChange={(event) => setXp(event.target.value)} />
          </label>
        </Flex>

        <label>
          <Text as="div" size="2" mb="1">Имя</Text>
          <TextField.Root value={name} maxLength={20} onChange={(event) => setName(event.target.value)} />
        </label>

        <label>
          <Text as="div" size="2" mb="1">Скин</Text>
          <Select.Root value={avatar} onValueChange={setAvatar}>
            <Select.Trigger />
            <Select.Content>
              {SKINS.map((skin, index) => <Select.Item key={skin} value={skin}>Скин {index + 1}</Select.Item>)}
              <Select.Item value="/monstr.svg">Монстр</Select.Item>
            </Select.Content>
          </Select.Root>
          <img src={avatar} alt="Выбранный скин" className="mt-3 h-32 w-32 object-contain" />
        </label>

        {error && <Callout.Root color="red"><Callout.Text>{error}</Callout.Text></Callout.Root>}
        {saved && <Callout.Root color="green"><Callout.Text>Данные персонажа обновлены.</Callout.Text></Callout.Root>}
        <Button color="orange" onClick={save} disabled={!token || !selectedPlayer || saving || name.trim().length < 2}>
          {saving ? "Сохраняю…" : "Применить изменения"}
        </Button>
      </Flex>
    </Card>
  );
}
