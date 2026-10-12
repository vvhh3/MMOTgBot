const API_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export function getCharacterImage(imageUrl: string): string {
  if (/^https?:\/\//.test(imageUrl)) return imageUrl;

  // Совместимость с игроками, созданными до переноса каталога на сервер.
  const normalized = imageUrl.startsWith("/skins/")
    ? `/character-images/${imageUrl.slice("/skins/".length)}`
    : imageUrl === "/monstr.svg"
      ? "/character-images/monstr.svg"
      : imageUrl;

  return `${API_URL}${normalized}`;
}

export function getSkins(avatar?: string | null): string {
  if (!avatar || avatar === "/playerM.svg") return getCharacterImage("/character-images/skins21.svg");
  if (avatar === "/playerG.svg") return getCharacterImage("/character-images/skins22.svg");
  return getCharacterImage(avatar);
}
