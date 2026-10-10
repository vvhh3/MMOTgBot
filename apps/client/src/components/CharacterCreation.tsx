import { useState } from "react";
import { Button, Card, Flex, Text, TextField } from "@radix-ui/themes";
import type { PlayerDto } from "@mmobot/shared";
import { createCharacter } from "../api";

// Список аватаров для карусели. Чтобы добавить нового персонажа,
// достаточно положить картинку в public и дописать её сюда.
const AVATARS = ["/playerM.svg", "/playerG.svg"];

const RACES = ["Человек", "Эльф", "Орк", "Гном"];

type CharacterCreationProps = {
  token: string | null;
  player: PlayerDto | null;
  onCreated: (player: PlayerDto) => void;
};

export default function CharacterCreation({ token, player, onCreated }: CharacterCreationProps) {
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [name, setName] = useState(player?.name ?? "");
  const [race, setRace] = useState(RACES[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avatar = AVATARS[avatarIndex];

  const prevAvatar = () => setAvatarIndex((i) => (i - 1 + AVATARS.length) % AVATARS.length);
  const nextAvatar = () => setAvatarIndex((i) => (i + 1) % AVATARS.length);

  const submit = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const { player: updated } = await createCharacter(token, { name, race, avatar });
      onCreated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать персонажа");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-6">
      <Text size="7" weight="bold">Создание персонажа</Text>

      <Card style={{ padding: "20px" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-4">
            <Button variant="soft" onClick={prevAvatar} disabled={AVATARS.length < 2}>{"<"}</Button>
            <img src={avatar} alt="Аватар" className="h-50 w-auto" />
            <Button variant="soft" onClick={nextAvatar} disabled={AVATARS.length < 2}>{">"}</Button>
          </div>
          <div className="flex gap-2">
            {AVATARS.map((a, i) => (
              <button
                key={a}
                onClick={() => setAvatarIndex(i)}
                className={`h-12 w-12 rounded border-2 ${i === avatarIndex ? "border-orange-500" : "border-transparent"}`}
              >
                <img src={a} alt="" className="h-full w-full object-contain" />
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Flex direction="column" gap="2" width="320px">
        <Text size="2" weight="bold">Имя</Text>
        <TextField.Root
          placeholder="Введите имя"
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
        />
      </Flex>

      <Flex direction="column" gap="2" width="320px">
        <Text size="2" weight="bold">Раса</Text>
        <div className="flex flex-wrap gap-2">
          {RACES.map((r) => (
            <Button
              key={r}
              variant={r === race ? "solid" : "soft"}
              onClick={() => setRace(r)}
            >
              {r}
            </Button>
          ))}
        </div>
      </Flex>

      {error && <Text color="red" size="2">{error}</Text>}

      <Button
        size="3"
        onClick={submit}
        loading={saving}
        disabled={name.trim().length < 2 || saving}
      >
        Создать персонажа
      </Button>
    </div>
  );
}
