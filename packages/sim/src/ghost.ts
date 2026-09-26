import type { SimEvent } from "./events.js";
import type { PlayerState } from "./simulation.js";
import type { Tuning } from "./tuning/index.js";
import type { PlayerId, TeamId, Tick } from "./types.js";

/**
 * Periodic ghost-tag event (CLAUDE.md section 13). idle -> warning (the next
 * ghost team is announced with a countdown) -> active (chase) -> idle.
 */
export type GhostPhase = "idle" | "warning" | "active";

export interface GhostState {
  phase: GhostPhase;
  /** Team that is (or is about to be) the ghosts; null while idle. */
  teamId: TeamId | null;
  /** Tick at which the current phase ends. */
  phaseEndsAtTick: Tick;
  /** How many times each team has been the ghosts, for fair rotation. */
  counts: Record<TeamId, number>;
  /** Team that was the ghosts most recently; never picked again while another candidate is tied. */
  lastTeamId: TeamId | null;
}

export function initialGhostState(startTick: Tick, tuning: Tuning): GhostState {
  return {
    phase: "idle",
    teamId: null,
    phaseEndsAtTick: startTick + sec(tuning.ghostEvent.intervalSec, tuning),
    counts: {},
    lastTeamId: null,
  };
}

export function isGhost(ghost: GhostState, p: PlayerState): boolean {
  return ghost.phase === "active" && ghost.teamId === p.teamId && p.phase === "maze";
}

/**
 * Advance the schedule by one tick. Returns the new state and any events.
 * Fair rotation, fully deterministic: the team with the fewest turns as ghosts
 * goes next; among ties the most recent ghost team is skipped and the first
 * team id in sorted order wins, so the very first ghosts are always the first
 * team alphabetically and two teams alternate strictly. Teams with nobody left
 * in the maze are skipped; with fewer than two eligible teams the event waits
 * another interval.
 */
export function stepGhost(
  ghost: GhostState,
  players: Record<PlayerId, PlayerState>,
  tick: Tick,
  tuning: Tuning,
): { ghost: GhostState; events: SimEvent[] } {
  if (tick < ghost.phaseEndsAtTick) return { ghost, events: [] };
  const events: SimEvent[] = [];

  if (ghost.phase === "idle") {
    const teams = eligibleTeams(players);
    if (teams.length < 2) {
      return { ghost: { ...ghost, phaseEndsAtTick: tick + sec(tuning.ghostEvent.intervalSec, tuning) }, events };
    }
    const fewest = Math.min(...teams.map((t) => ghost.counts[t] ?? 0));
    let candidates = teams.filter((t) => (ghost.counts[t] ?? 0) === fewest).sort();
    if (candidates.length > 1 && ghost.lastTeamId !== null) candidates = candidates.filter((t) => t !== ghost.lastTeamId);
    const teamId = candidates[0] as TeamId;
    const startsAtTick = tick + sec(tuning.ghostEvent.warningSec, tuning);
    events.push({ type: "ghostWarning", tick, teamId, startsAtTick });
    return { ghost: { ...ghost, phase: "warning", teamId, phaseEndsAtTick: startsAtTick }, events };
  }

  if (ghost.phase === "warning") {
    const teamId = ghost.teamId as TeamId;
    if (!eligibleTeams(players).includes(teamId) || eligibleTeams(players).length < 2) {
      // The announced team climbed out (or everyone else did): skip this round of tag.
      return { ghost: { ...ghost, phase: "idle", teamId: null, phaseEndsAtTick: tick + sec(tuning.ghostEvent.intervalSec, tuning) }, events };
    }
    const endsAtTick = tick + sec(tuning.ghostEvent.durationSec, tuning);
    events.push({ type: "ghostStarted", tick, teamId, endsAtTick });
    return {
      ghost: {
        ...ghost,
        phase: "active",
        phaseEndsAtTick: endsAtTick,
        counts: { ...ghost.counts, [teamId]: (ghost.counts[teamId] ?? 0) + 1 },
        lastTeamId: teamId,
      },
      events,
    };
  }

  // active -> idle
  events.push({ type: "ghostEnded", tick, teamId: ghost.teamId as TeamId });
  return { ghost: { ...ghost, phase: "idle", teamId: null, phaseEndsAtTick: tick + sec(tuning.ghostEvent.intervalSec, tuning) }, events };
}

/** Teams that still have someone in the maze. */
export function eligibleTeams(players: Record<PlayerId, PlayerState>): TeamId[] {
  const set = new Set<TeamId>();
  for (const p of Object.values(players)) if (p.phase === "maze") set.add(p.teamId);
  return [...set].sort();
}

function sec(seconds: number, tuning: Tuning): number {
  return Math.max(1, Math.round(seconds * tuning.tickRate));
}
