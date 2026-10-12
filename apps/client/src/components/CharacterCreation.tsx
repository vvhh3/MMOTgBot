import { useEffect, useState } from "react";
import type { CharacterSkinDto, PlayerDto } from "@mmobot/shared";
import { createCharacter, getCharacterSkins } from "../api";
import { getCharacterImage } from "../utils/skins";

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
  const [skins, setSkins] = useState<CharacterSkinDto[]>([]);
  const [loadingSkins, setLoadingSkins] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avatar = skins[avatarIndex]?.imageUrl;

  useEffect(() => {
    if (!token) return;
    setLoadingSkins(true);
    getCharacterSkins(token)
      .then(({ skins: loadedSkins }) => {
        setSkins(loadedSkins);
        setAvatarIndex(0);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить персонажей"))
      .finally(() => setLoadingSkins(false));
  }, [token]);

  useEffect(() => {
    if (skins.length === 0) return;
    // Держим рядом с текущим аватаром небольшое окно изображений вместо
    // одновременной загрузки всех скинов. При переключении браузер догружает
    // только новый крайний элемент, остальные берёт из HTTP-кэша.
    const preloadRadius = 2;
    const indexes = Array.from(
      { length: preloadRadius * 2 + 1 },
      (_, offset) =>
        (avatarIndex + offset - preloadRadius + skins.length) % skins.length,
    );

    const images = [...new Set(indexes)].map((index) => {
      const image = new Image();
      image.decoding = "async";
      image.src = getCharacterImage(skins[index].imageUrl);
      return image;
    });

    return () => {
      images.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
    };
  }, [avatarIndex, skins]);

  const prevAvatar = () => setAvatarIndex((i) => (i - 1 + skins.length) % skins.length);
  const nextAvatar = () => setAvatarIndex((i) => (i + 1) % skins.length);

  const submit = async () => {
    if (!token || !avatar) return;
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
              disabled={skins.length < 2}
              className="h-10 w-10 rounded-full border-2 text-[#E8603C] disabled:opacity-30"
            >
              {"<"}
            </button>
            {avatar ? (
              <img
                src={getCharacterImage(avatar)}
                alt={skins[avatarIndex]?.name ?? `Аватар ${avatarIndex + 1}`}
                decoding="async"
                fetchPriority="high"
                className="object-contain h-48 w-full"
              />
            ) : (
              <div className="flex h-48 w-full items-center justify-center text-sm text-gray-500">
                {loadingSkins ? "Загрузка персонажей…" : "Персонажи недоступны"}
              </div>
            )}
            <button
              type="button"
              onClick={nextAvatar}
              disabled={skins.length < 2}
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

      <div className="flex flex-col gap-2 w-full max-w-xs">
        <span className="text-sm font-bold text-[#8A7A60]">Раса</span>
        <div className="flex flex-wrap gap-2 ">
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
        disabled={name.trim().length < 2 || saving || !avatar}
        className="rounded-lg bg-[#E8603C] px-6 py-3 font-bold text-white disabled:opacity-50"
      >
        {saving ? "Сохранение..." : "Создать персонажа"}
      </button>
    </div>
  );
}
