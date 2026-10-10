import { useState } from "react";
import type { PlayerDto } from "@mmobot/shared";
import { createCharacter } from "../api";

// Список аватаров для карусели. Чтобы добавить нового персонажа,
// достаточно положить картинку в public и дописать её сюда.
const AVATARS = ["/playerM.svg", "/playerG.svg","/monstr.svg"];

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
      <h1 className="text-2xl font-bold text-[#8A7A60]">Создание персонажа</h1>

      <div className="w-full max-w-sm rounded-2xl border-2 p-5 bg-white/70">
        <div className="flex flex-col items-center gap-4">
          <div className="flex justify-between w-full items-center gap-4">
            <button
              type="button"
              onClick={prevAvatar}
              className="h-10 w-10 rounded-full border-2 text-[#E8603C] disabled:opacity-30"
            >
              {"<"}
            </button>
            <img src={avatar} alt="Аватар" className="object-contain h-48 w-full" />
            <button
              type="button"
              onClick={nextAvatar}
              className="h-10 w-10 rounded-full border-2 text-[#E8603C] disabled:opacity-30"
            >
              {">"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-xs">
        <label className="text-sm font-bold text-[#8A7A60]">Имя</label>
        <input
          type="text"
          placeholder="Введите имя"
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border-2 px-3 py-2 outline-none focus:border-[#E8603C]"
        />
      </div>

      <div className="flex flex-col gap-2 w-full">
        <span className="text-sm font-bold text-[#8A7A60]">Раса</span>
        <div className="flex flex-wrap gap-2">
          {RACES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRace(r)}
              className={`rounded-lg px-3 py-1.5 border-2 transition-colors ${
                r === race
                  ? "bg-[#E8603C] text-white border-[#E8603C]"
                  : "bg-transparent text-[#8A7A60] border-[#8A7A60]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={name.trim().length < 2 || saving}
        className="rounded-lg bg-[#E8603C] px-6 py-3 font-bold text-white disabled:opacity-50"
      >
        {saving ? "Сохранение..." : "Создать персонажа"}
      </button>
    </div>
  );
}
