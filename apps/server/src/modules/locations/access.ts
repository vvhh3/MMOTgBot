import { getLocationAccess,type LocationDto } from "@mmobot/shared";
import type { Response } from "express";
import { config } from "../../config/env.js";

type LocationPlayer = { id: number; level: number };

export function canBypassLocationRestrictions(player: Pick<LocationPlayer, "id">): boolean {
  return config.devBypassAuth || config.adminIds.includes(player.id);
}

export function checkLocationAccess(
  player: LocationPlayer,
  location: Pick<LocationDto, "isOpen" | "minLevel">,
  res: Response,
): boolean {
  const access = getLocationAccess(location, player.level, canBypassLocationRestrictions(player));
  if (access === "available") return true;
  res.status(403).json({
    code: access === "coming_soon" ? "LOCATION_IN_DEVELOPMENT" : "LOCATION_LEVEL_REQUIRED",
    error: access === "coming_soon"
      ? "Локация находится в разработке. Скоро появится!"
      : `Локация доступна с ${location.minLevel} уровня. Ваш уровень: ${player.level}.`,
    minLevel: location.minLevel,
  });
  return false;
}
