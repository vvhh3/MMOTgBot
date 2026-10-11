import { useState } from "react";
import { Button, Callout, Card, Flex, Heading, Select, Text, TextField } from "@radix-ui/themes";
import type { PlayerDto } from "@mmobot/shared";
import { updateAdminPlayer } from "../../api";
import { SKINS } from "../../utils/skins";

type PlayerAdminProps = {
  token: string | null;
  player: PlayerDto | null;
  onPlayer: (player: PlayerDto) => void;
};

export function PlayerAdmin({ token, player, onPlayer }: PlayerAdminProps) {
  const [money, setMoney] = useState("0");
  const [xp, setXp] = useState("0");
  const [name, setName] = useState(player?.name ?? "");
  const [avatar, setAvatar] = useState(player?.avatar ?? SKINS[0]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await updateAdminPlayer(token, {
        money: Number(money),
        xp: Number(xp),
        name: name.trim(),
        avatar,
      });
      onPlayer(result.player);
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
          <Heading size="4">Мой персонаж</Heading>
          <Text color="gray">Сейчас: {player?.money ?? 0} монет, {player?.xp ?? 0} опыта</Text>
        </div>

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
        <Button color="orange" onClick={save} disabled={!token || saving || name.trim().length < 2}>
          {saving ? "Сохраняю…" : "Применить изменения"}
        </Button>
      </Flex>
    </Card>
  );
}
