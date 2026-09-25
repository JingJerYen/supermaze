import type { PlayerId, Tick } from "./types.js";

/**
 * Things that happened during one `step`. The authoritative simulation is the
 * only producer; clients, scoring audits and tests consume them.
 */
export type SimEvent =
  | { type: "roundStarted"; tick: Tick; keyCount: number }
  | { type: "keyPickedUp"; tick: Tick; playerId: PlayerId; keyId: string }
  | { type: "towerClimbed"; tick: Tick; playerId: PlayerId; arrival: number };
