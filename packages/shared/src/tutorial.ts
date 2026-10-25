import type { CombatStateResponse } from "./contracts/combat-api.js";
import type { PlayerDto } from "./contracts/players.js";

export const TUTORIAL_MOB_ID = -1;
export const TUTORIAL_REWARD_KEY = "graduate_brick";
export const TUTORIAL_STEPS = ["welcome", "battle", "equip", "complete", "done"] as const;
export type TutorialStep = typeof TUTORIAL_STEPS[number];
export type TutorialStartResponse = { player: PlayerDto; state: CombatStateResponse };
