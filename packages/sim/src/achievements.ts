import type { SimEvent } from "./events.js";
import { isGhost } from "./ghost.js";
import type { SimulationState } from "./simulation.js";
import type { Tuning } from "./tuning/index.js";
import type { PlayerId } from "./types.js";

/**
 * Achievements (CLAUDE.md section 4.3): badges for things done in a tower run.
 * Collection only; they change nothing in play. The ids are stable (a store's
 * achievement list may map onto them later) and the order here is the order
 * on the achievements page.
 */
export const ACHIEVEMENT_IDS = [
  "firstClimb",
  "champion",
  "speedClimb",
  "lastSecond",
  "darkClimb",
  "fullBag",
  "perfectRound",
  "keyThief",
  "multiCatch",
  "trapGhost",
  "packSurvivor",
  "lightsMaster",
  "teleport",
  "breaker",
  "halfway",
  "summit",
  "flawless",
] as const;
export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

/** The bars to clear; pages quote them in the descriptions. */
export const ACHIEVEMENT_GOALS = {
  /** perfectRound: final score of a floor, at least. */
  perfectScore: 170,
  /** speedClimb: seconds from "go" to climbing, at most. */
  speedClimbSec: 60,
  /** lastSecond: seconds left on the clock when climbing, at most. */
  lastSecondSec: 10,
  /** multiCatch: catches in one ghost event. */
  multiCatch: 3,
  /** halfway: floor passed, at least. */
  halfwayFloor: 10,
} as const;

/** What one round has seen so far, for the achievements that need more than a single moment. */
export interface RoundTracker {
  earned: Set<AchievementId>;
  /** Switches flipped by the player. */
  switches: number;
  /** Catches by the player in the ghost event under way. */
  catchesThisEvent: number;
  /** Ghost events in which everyone else hunted the player (ghost pack). */
  packEvents: number;
  /** The player was caught by a ghost this round. */
  caught: boolean;
}

export function newRoundTracker(): RoundTracker {
  return { earned: new Set(), switches: 0, catchesThisEvent: 0, packEvents: 0, caught: false };
}

/**
 * Feed one tick (the states either side of it and its events) for player `me`.
 * Returns the achievements earned on this tick, each at most once a round.
 */
export function trackRound(
  tr: RoundTracker,
  prev: SimulationState,
  next: SimulationState,
  events: readonly SimEvent[],
  me: PlayerId,
  tuning: Tuning,
): AchievementId[] {
  const found: AchievementId[] = [];
  const sec = (s: number) => s * tuning.tickRate;
  const self = next.players[me];
  for (const e of events) {
    switch (e.type) {
      case "towerClimbed":
        if (e.playerId !== me) break;
        found.push("firstClimb");
        if (e.arrival === 0) found.push("champion");
        if (e.tick - next.freezeUntilTick <= sec(ACHIEVEMENT_GOALS.speedClimbSec)) found.push("speedClimb");
        if (next.endsAtTick - e.tick <= sec(ACHIEVEMENT_GOALS.lastSecondSec)) found.push("lastSecond");
        if (!next.lightsOn) found.push("darkClimb");
        if ((prev.players[me]?.items.length ?? 0) >= tuning.inventory.capacity) found.push("fullBag");
        break;
      case "ghostStarted":
        tr.catchesThisEvent = 0;
        if (self && next.ghost.huntedTeamId === self.teamId) tr.packEvents++;
        break;
      case "playerCaught":
        if (e.runnerId === me) tr.caught = true;
        if (e.ghostId !== me) break;
        if (e.stolenKeyId !== null) found.push("keyThief");
        if (++tr.catchesThisEvent >= ACHIEVEMENT_GOALS.multiCatch) found.push("multiCatch");
        break;
      case "trapTriggered": {
        const victim = next.players[e.playerId];
        if (e.ownerId === me && e.playerId !== me && victim && isGhost(next.ghost, victim)) found.push("trapGhost");
        break;
      }
      case "lightsToggled":
        if (e.playerId === me && ++tr.switches >= Object.keys(next.switches).length) found.push("lightsMaster");
        break;
      case "teleported":
        if (e.playerId === me) found.push("teleport");
        break;
      case "placeableDestroyed":
        if (e.playerId === me && prev.placeables[e.placeableId]?.permanent) found.push("breaker");
        break;
    }
  }
  if (prev.status === "running" && next.status === "finished") {
    if ((next.result?.finalScores[me] ?? 0) >= ACHIEVEMENT_GOALS.perfectScore) found.push("perfectRound");
    if (tr.packEvents > 0 && !tr.caught) found.push("packSurvivor");
  }
  const fresh = [...new Set(found)].filter((id) => !tr.earned.has(id));
  for (const id of fresh) tr.earned.add(id);
  return fresh;
}
