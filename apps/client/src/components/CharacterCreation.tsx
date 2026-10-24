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
  const [displayedAvatarIndex, setDisplayedAvatarIndex] = useState(0);
  const [name, setName] = useState(player?.name ?? "");
  const [race, setRace] = useState(RACES[0]);
  const [skins, setSkins] = useState<CharacterSkinDto[]>([]);
  const [loadingSkins, setLoadingSkins] = useState(true);
  const [loadingAvatar, setLoadingAvatar] = useState(true);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avatar = skins[avatarIndex]?.imageUrl;
  const displayedAvatar = skins[displayedAvatarIndex]?.imageUrl;
  const isChangingAvatar = avatarIndex !== displayedAvatarIndex;

  useEffect(() => {
    if (!token) return;
    setLoadingSkins(true);
    getCharacterSkins(token)
      .then(({ skins: loadedSkins }) => {
        setSkins(loadedSkins);
        setAvatarIndex(0);
        setDisplayedAvatarIndex(0);
        setLoadingAvatar(true);
        setAvatarLoadError(false);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить персонажей"))
      .finally(() => setLoadingSkins(false));
  }, [token]);

  useEffect(() => {
    if (skins.length === 0) return;
    // При быстром листании не передаём каждый тяжёлый SVG на декодирование
    // Telegram WebView. Загружаем только тот скин, на котором пользователь
    // остановился. Новый клик отменяет предыдущий таймер.
    setLoadingAvatar(true);
    setAvatarLoadError(false);
    const timer = window.setTimeout(() => setDisplayedAvatarIndex(avatarIndex), 500);
    return () => window.clearTimeout(timer);
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
      <h1 className="text-xl font-bold  uppercase text-[#8A7A60]">Создание персонажа</h1>

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
            <div className="relative flex h-48 w-full items-center justify-center overflow-hidden bg-white">
              {displayedAvatar && !isChangingAvatar && (
                <img
                  key={displayedAvatar}
                  src={getCharacterImage(displayedAvatar)}
                  alt={skins[displayedAvatarIndex]?.name ?? `Аватар ${displayedAvatarIndex + 1}`}
                  decoding="async"
                  fetchPriority="high"
                  onLoad={() => setLoadingAvatar(false)}
                  onError={() => {
                    setLoadingAvatar(false);
                    setAvatarLoadError(true);
                  }}
                  className={`h-48 w-full object-contain transition-opacity duration-150 ${loadingAvatar ? "opacity-0" : "opacity-100"}`}
                />
              )}

              {(loadingSkins || isChangingAvatar || loadingAvatar) && !avatarLoadError && (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-white"
                  role="status"
                  aria-label="Загрузка аватара"
                >
                  <span className="h-9 w-9 animate-spin rounded-full border-4 border-gray-200 border-t-[#E8603C]" />
                </div>
              )}

              {avatarLoadError && !isChangingAvatar && (
                <p className="absolute inset-0 flex items-center justify-center bg-white px-4 text-center text-sm text-red-500">
                  Не удалось загрузить аватар
                </p>
              )}

              {!loadingSkins && skins.length === 0 && (
                <p className="absolute inset-0 flex items-center justify-center bg-white text-sm text-gray-500">
                  Персонажи недоступны
                </p>
              )}
            </div>
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
        disabled={name.trim().length < 2 || saving || !avatar || isChangingAvatar || loadingAvatar || avatarLoadError}
        className="rounded-lg bg-[#E8603C] px-6 py-3 font-bold text-white disabled:opacity-50"
      >
        {saving ? "Сохранение..." : "Создать персонажа"}
      </button>
    </div>
  );
}
