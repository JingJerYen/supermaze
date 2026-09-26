import type { PlayerId, TeamId, Tick } from "./types.js";

/**
 * Things that happened during one `step`. The authoritative simulation is the
 * only producer; clients, scoring audits and tests consume them.
 */
export type SimEvent =
  | { type: "roundStarted"; tick: Tick; keyCount: number }
  | { type: "keyPickedUp"; tick: Tick; playerId: PlayerId; keyId: string }
  | { type: "towerClimbed"; tick: Tick; playerId: PlayerId; arrival: number }
  | { type: "lightsToggled"; tick: Tick; playerId: PlayerId; switchId: string; lightsOn: boolean }
  | { type: "teamCompleted"; tick: Tick; teamId: TeamId; isWinner: boolean }
  | { type: "roundEnded"; tick: Tick; winnerTeamId: TeamId | null; reason: RoundEndReason };

export type RoundEndReason =
  | "allClimbed"
  | "timeout:climbed"
  | "timeout:score"
  | "timeout:earlier"
  | "timeout:draw";
