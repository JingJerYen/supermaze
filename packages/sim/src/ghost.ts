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
  /** Team that was the ghosts most recently; passed over while another candidate is otherwise tied. */
  lastTeamId: TeamId | null;
  /** Wait between the end of one event and the next warning, ticks; fixed when the round starts. */
  intervalTicks: Tick;
}

/**
 * The schedule for a round of `roundTicks`. By default it follows the round
 * length (section 13): the first warning after `firstWarningShare` of it, then
 * `intervalShare` of it between events, so short and long maps both see a few
 * events. `intervalSec`, when set, fixes both waits in seconds instead.
 */
export function initialGhostState(startTick: Tick, tuning: Tuning, roundTicks: number): GhostState {
  const g = tuning.ghostEvent;
  const fixed = g.intervalSec === null ? null : sec(g.intervalSec, tuning);
  return {
    phase: "idle",
    teamId: null,
    phaseEndsAtTick: startTick + (fixed ?? Math.max(1, Math.round(roundTicks * g.firstWarningShare))),
    counts: {},
    lastTeamId: null,
    intervalTicks: fixed ?? Math.max(1, Math.round(roundTicks * g.intervalShare)),
  };
}

export function isGhost(ghost: GhostState, p: PlayerState): boolean {
  return ghost.phase === "active" && ghost.teamId === p.teamId && p.phase === "maze";
}

/**
 * Advance the schedule by one tick. Returns the new state and any events.
 * Fair rotation, fully deterministic, no dice: the team with the fewest turns
 * as ghosts goes next; among ties the team holding fewer keys (as a share of
 * its members) goes first, which hands the chance to steal a key to whoever is
 * behind; then the most recent ghost team is passed over; then the first team
 * id in sorted order. Turns never differ by more than one. Teams with nobody
 * left in the maze are skipped; with fewer than two eligible teams the event
 * waits another interval.
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
    return beginWarning(ghost, players, tick, tuning, sec(tuning.ghostEvent.warningSec, tuning));
  }

  if (ghost.phase === "warning") {
    const teamId = ghost.teamId as TeamId;
    if (!eligibleTeams(players).includes(teamId) || eligibleTeams(players).length < 2) {
      // The announced team climbed out (or everyone else did): skip this round of tag.
      return { ghost: { ...ghost, phase: "idle", teamId: null, phaseEndsAtTick: tick + ghost.intervalTicks }, events };
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
  return { ghost: { ...ghost, phase: "idle", teamId: null, phaseEndsAtTick: tick + ghost.intervalTicks }, events };
}

/** Next ghost team by the fair-rotation rule, or null when fewer than two teams are in the maze. */
export function chooseGhostTeam(ghost: GhostState, players: Record<PlayerId, PlayerState>): TeamId | null {
  const teams = eligibleTeams(players);
  if (teams.length < 2) return null;
  const fewest = Math.min(...teams.map((t) => ghost.counts[t] ?? 0));
  let candidates = teams.filter((t) => (ghost.counts[t] ?? 0) === fewest).sort();
  if (candidates.length > 1) {
    const share = new Map(candidates.map((t) => [t, keyShare(players, t)]));
    const least = Math.min(...share.values());
    candidates = candidates.filter((t) => (share.get(t) as number) <= least + 1e-9);
  }
  if (candidates.length > 1 && ghost.lastTeamId !== null) candidates = candidates.filter((t) => t !== ghost.lastTeamId);
  return candidates[0] ?? null;
}

/** Share of a team's members who hold a key (those on the tower used theirs to get there). */
function keyShare(players: Record<PlayerId, PlayerState>, teamId: TeamId): number {
  const members = Object.values(players).filter((p) => p.teamId === teamId);
  return members.length === 0 ? 0 : members.filter((p) => p.keyId !== null).length / members.length;
}

/**
 * Enter the warning phase with a countdown of `warningTicks`. Used by the
 * schedule and by the developer shortcut that forces an event immediately.
 */
export function beginWarning(
  ghost: GhostState,
  players: Record<PlayerId, PlayerState>,
  tick: Tick,
  tuning: Tuning,
  warningTicks: number,
): { ghost: GhostState; events: SimEvent[] } {
  const teamId = chooseGhostTeam(ghost, players);
  if (!teamId) return { ghost: { ...ghost, phaseEndsAtTick: tick + ghost.intervalTicks }, events: [] };
  const startsAtTick = tick + Math.max(1, warningTicks);
  return {
    ghost: { ...ghost, phase: "warning", teamId, phaseEndsAtTick: startsAtTick },
    events: [{ type: "ghostWarning", tick, teamId, startsAtTick }],
  };
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
