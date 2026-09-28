import type { RoundEndReason } from "./events.js";
import type { PlayerState } from "./simulation.js";
import type { Tuning } from "./tuning/index.js";
import type { PlayerId, TeamId, TeamMode, Tick } from "./types.js";

/** Per-team bookkeeping the end-of-round rules need. */
export interface TeamProgress {
  teamId: TeamId;
  size: number;
  climbed: number;
  /** Tick at which the team reached 1, 2, ... climbed members. */
  climbTicks: Tick[];
  /** Sum of member scores before any winner multiplier. */
  score: number;
}

export interface RoundResult {
  winnerTeamId: TeamId | null;
  reason: RoundEndReason;
  /** Scores after the winning-team multiplier, per player. */
  finalScores: Record<PlayerId, number>;
}

export function teamProgress(players: Record<PlayerId, PlayerState>, climbTicks: Record<TeamId, Tick[]>): TeamProgress[] {
  const byTeam = new Map<TeamId, TeamProgress>();
  for (const p of Object.values(players)) {
    let t = byTeam.get(p.teamId);
    if (!t) {
      t = { teamId: p.teamId, size: 0, climbed: 0, climbTicks: climbTicks[p.teamId] ?? [], score: 0 };
      byTeam.set(p.teamId, t);
    }
    t.size++;
    if (p.phase === "tower") t.climbed++;
    t.score += p.score;
  }
  return [...byTeam.values()].sort((a, b) => a.teamId.localeCompare(b.teamId));
}

/**
 * Timeout tie-break (CLAUDE.md section 3): most climbed members, then higher
 * pre-multiplier team score, then the team that reached its current climbed
 * count first. No overtime and no shared win; a full draw yields no winner.
 */
export function decideTimeoutWinner(teams: TeamProgress[], tuning: Tuning): { winnerTeamId: TeamId | null; reason: RoundEndReason } {
  if (teams.length === 0) return { winnerTeamId: null, reason: "timeout:draw" };
  const metric = (t: TeamProgress) =>
    tuning.round.timeoutClimbMetric === "ratio" ? (t.size ? t.climbed / t.size : 0) : t.climbed;

  const byClimb = leaders(teams, metric, "max");
  if (byClimb.length === 1) return { winnerTeamId: byClimb[0]!.teamId, reason: "timeout:climbed" };

  const byScore = leaders(byClimb, (t) => t.score, "max");
  if (byScore.length === 1) return { winnerTeamId: byScore[0]!.teamId, reason: "timeout:score" };

  // Earlier tick reaching the current climbed count wins; teams with zero climbs have no such tick.
  const withTime = byScore.filter((t) => t.climbed > 0);
  if (withTime.length > 0) {
    const byTime = leaders(withTime, (t) => t.climbTicks[t.climbed - 1] ?? Number.POSITIVE_INFINITY, "min");
    if (byTime.length === 1) return { winnerTeamId: byTime[0]!.teamId, reason: "timeout:earlier" };
  }
  return { winnerTeamId: null, reason: "timeout:draw" };
}

function leaders(teams: TeamProgress[], f: (t: TeamProgress) => number, mode: "max" | "min"): TeamProgress[] {
  const values = teams.map(f);
  const best = mode === "max" ? Math.max(...values) : Math.min(...values);
  return teams.filter((_, i) => values[i] === best);
}

/**
 * Apply the winning-team multiplier. Losers keep every point they earned.
 * Solo rounds have no multiplier: the final score is the score.
 */
export function finalScores(
  players: Record<PlayerId, PlayerState>,
  winnerTeamId: TeamId | null,
  tuning: Tuning,
  teamMode: TeamMode = "teams",
): Record<PlayerId, number> {
  const out: Record<PlayerId, number> = {};
  for (const p of Object.values(players)) {
    const boosted = teamMode === "teams" && p.teamId === winnerTeamId;
    out[p.id] = boosted ? Math.round(p.score * tuning.scoring.winningTeamMultiplier) : p.score;
  }
  return out;
}

/**
 * Solo ranking: the highest score wins; equal scores go to whoever climbed
 * earlier; a full tie has no winner. Returns the winner's team id (in solo
 * rounds that is the player's own id).
 */
export function decideSoloWinner(players: Record<PlayerId, PlayerState>): TeamId | null {
  const ranked = Object.values(players).sort(
    (a, b) => b.score - a.score || (a.towerArrival ?? Number.POSITIVE_INFINITY) - (b.towerArrival ?? Number.POSITIVE_INFINITY),
  );
  const [first, second] = ranked;
  if (!first) return null;
  if (second && second.score === first.score && second.towerArrival === first.towerArrival) return null;
  return first.teamId;
}
