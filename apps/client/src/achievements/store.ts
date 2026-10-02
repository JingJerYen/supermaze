import { ACHIEVEMENT_IDS, type AchievementId } from "@supermaze/sim";

/**
 * Achievements unlocked in this browser (CLAUDE.md section 4.3), with when:
 * `supermaze.achievements` holds { id: epoch ms }. Ids no longer in the list
 * are ignored, so renaming or dropping one never breaks the page.
 */
const KEY = "supermaze.achievements";

export function loadAchievements(): Partial<Record<AchievementId, number>> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>;
    const out: Partial<Record<AchievementId, number>> = {};
    for (const id of ACHIEVEMENT_IDS) if (typeof raw[id] === "number") out[id] = raw[id] as number;
    return out;
  } catch {
    return {};
  }
}

/** Record `ids` as unlocked now; returns the ones that were not unlocked before. */
export function unlockAchievements(ids: readonly AchievementId[]): AchievementId[] {
  // Called every tick of a floor, nearly always with nothing: skip the storage read.
  if (ids.length === 0) return [];
  const have = loadAchievements();
  const fresh = ids.filter((id) => have[id] === undefined);
  if (fresh.length === 0) return [];
  const now = Date.now();
  for (const id of fresh) have[id] = now;
  try {
    localStorage.setItem(KEY, JSON.stringify(have));
  } catch {
    /* storage unavailable: shown this once, not kept */
  }
  return fresh;
}

/**
 * When the achievements page was last opened. Anything unlocked after it is
 * new: tagged NEW on the page, and the home button shows a dot.
 */
const SEEN_KEY = "supermaze.achievementsSeenAt";

export function loadSeenAt(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function markSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, String(Date.now()));
  } catch {
    /* storage unavailable */
  }
}

/** Unlocked since the page was last opened. */
export function unseenAchievements(): AchievementId[] {
  const have = loadAchievements();
  const seen = loadSeenAt();
  return (Object.keys(have) as AchievementId[]).filter((id) => (have[id] ?? 0) > seen);
}

