import { ACHIEVEMENT_GOALS, type AchievementId } from "../achievements.js";
import { DEFAULT_TUNING, type Tuning } from "../tuning/index.js";
import type { TowerRunState } from "./towerRun.js";

/**
 * The tower run's own achievements (section 4.3), judged after each floor is
 * recorded: how far up you got and how cleanly.
 */
export function runAchievements(run: TowerRunState, tuning: Tuning = DEFAULT_TUNING): AchievementId[] {
  const out: AchievementId[] = [];
  const last = run.history[run.history.length - 1];
  if (!last) return out;
  if (last.passed && last.floor >= ACHIEVEMENT_GOALS.halfwayFloor) out.push("halfway");
  const summit = last.passed && last.floor === tuning.towerRun.floors.length;
  if (summit) out.push("summit");
  if (summit && run.startFloor === 1 && run.continues === 0 && run.history.every((h) => h.passed)) out.push("flawless");
  return out;
}
