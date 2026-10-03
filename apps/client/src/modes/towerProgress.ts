/**
 * Tower run records kept in this browser: the best run total (runs from floor
 * 1 only) and the highest floor played.
 */
const BEST_KEY = "supermaze.towerBest";

export interface TowerBest {
  /** Highest run total so far. */
  score: number;
  /** Floor that run had reached. */
  floor: number;
}

/** Best run in this browser, or null (none yet, or storage unavailable). */
export function loadTowerBest(): TowerBest | null {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    const v = raw ? (JSON.parse(raw) as TowerBest) : null;
    return v && typeof v.floor === "number" && typeof v.score === "number" ? v : null;
  } catch {
    return null;
  }
}

export function saveBest(best: TowerBest): void {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    /* storage unavailable */
  }
}

/**
 * The highest tower run floor played in this browser. The full version lets a
 * run start on any floor up to it (CLAUDE.md section 4.1).
 */
const REACHED_KEY = "supermaze.towerReached";

export function loadReachedFloor(): number {
  try {
    const n = Number(localStorage.getItem(REACHED_KEY));
    return Number.isInteger(n) && n > 0 ? n : 1;
  } catch {
    return 1;
  }
}

/** Note that `floor` has been played; the record only ever goes up. */
export function noteReachedFloor(floor: number): void {
  if (floor <= loadReachedFloor()) return;
  try {
    localStorage.setItem(REACHED_KEY, String(floor));
  } catch {
    /* storage unavailable */
  }
}

/** Set once the rules have been on screen in this browser. */
const RULES_SEEN_KEY = "supermaze.rulesSeen";

export function markRulesSeen(): void {
  try {
    localStorage.setItem(RULES_SEEN_KEY, "1");
  } catch {
    /* storage unavailable */
  }
}

/**
 * A brand-new player: never seen the rules and no tower record yet. Their
 * first press of the tower run button opens the rules instead (CLAUDE.md 4.1).
 * Storage that cannot be read counts as not new, so nobody is shown the rules
 * on every press.
 */
export function isNewPlayer(): boolean {
  try {
    if (localStorage.getItem(RULES_SEEN_KEY)) return false;
  } catch {
    return false;
  }
  return loadTowerBest() === null && loadReachedFloor() <= 1;
}
