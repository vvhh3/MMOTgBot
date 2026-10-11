export const SKINS = Array.from({ length: 22 }, (_, index) => `/skins/skins${index + 1}.svg`);

export function getSkins(avatar?: string | null): string {
  if (!avatar || avatar === "/playerM.svg") return "/skins/skins21.svg";
  if (avatar === "/playerG.svg") return "/skins/skins22.svg";
  return avatar;
}
