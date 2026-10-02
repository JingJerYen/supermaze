import { ACHIEVEMENT_GOALS, DEFAULT_TUNING, type AchievementId } from "@supermaze/sim";
import { t, type MessageKey } from "../i18n/index.js";

/**
 * Badge per achievement; a designer may swap these for drawn icons. Only
 * emoji old phones already have (nothing newer than Unicode 12).
 */
export const ACHIEVEMENT_ICONS: Record<AchievementId, string> = {
  firstClimb: "🏰",
  champion: "🥇",
  speedClimb: "⚡",
  lastSecond: "⏱️",
  darkClimb: "🌑",
  fullBag: "🎒",
  perfectRound: "💯",
  keyThief: "🗝️",
  multiCatch: "👻",
  trapGhost: "🕸️",
  packSurvivor: "🏃",
  lightsMaster: "💡",
  teleport: "🌀",
  breaker: "🔨",
  halfway: "🏔️",
  summit: "👑",
  flawless: "🌟",
};

/** The numbers the descriptions quote, so the text follows the goals. */
const PARAMS = {
  sec: 0,
  score: ACHIEVEMENT_GOALS.perfectScore,
  n: ACHIEVEMENT_GOALS.multiCatch,
  floor: ACHIEVEMENT_GOALS.halfwayFloor,
  floors: DEFAULT_TUNING.towerRun.floors.length,
};

export function achievementName(id: AchievementId): string {
  return t(`ach.${id}.name` as MessageKey);
}

export function achievementDesc(id: AchievementId): string {
  const sec = id === "speedClimb" ? ACHIEVEMENT_GOALS.speedClimbSec : ACHIEVEMENT_GOALS.lastSecondSec;
  return t(`ach.${id}.desc` as MessageKey, { ...PARAMS, sec });
}
