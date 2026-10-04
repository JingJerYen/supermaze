import type { SkillKind } from "./skills.js";
import type { ItemKind, PlaceableKind } from "./tuning/index.js";
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
  | { type: "boxOpened"; tick: Tick; playerId: PlayerId; boxId: string; item: ItemKind }
  | { type: "boxSpawned"; tick: Tick; boxId: string }
  | { type: "itemUsed"; tick: Tick; playerId: PlayerId; item: ItemKind }
  | { type: "itemDiscarded"; tick: Tick; playerId: PlayerId; item: ItemKind }
  | { type: "placeablePlaced"; tick: Tick; playerId: PlayerId; placeableId: string; kind: PlaceableKind }
  | { type: "placeableExpired"; tick: Tick; placeableId: string; kind: PlaceableKind }
  | { type: "placeableDestroyed"; tick: Tick; playerId: PlayerId; placeableId: string; kind: PlaceableKind }
  | { type: "nodeDestroyed"; tick: Tick; playerId: PlayerId; nodeId: string; teamId: TeamId }
  | { type: "trapTriggered"; tick: Tick; playerId: PlayerId; placeableId: string; frozenUntilTick: Tick; ownerId: PlayerId | null; ownerScored: boolean }
  | { type: "nodePlaced"; tick: Tick; playerId: PlayerId; nodeId: string; pairedWith: string | null }
  | { type: "nodePickedUp"; tick: Tick; playerId: PlayerId; nodeId: string }
  | { type: "teleported"; tick: Tick; playerId: PlayerId; fromNodeId: string; toNodeId: string }
  | { type: "ghostWarning"; tick: Tick; teamId: TeamId | null; startsAtTick: Tick }
  | { type: "ghostStarted"; tick: Tick; teamId: TeamId | null; endsAtTick: Tick }
  | { type: "ghostEnded"; tick: Tick; teamId: TeamId | null }
  | { type: "playerCaught"; tick: Tick; ghostId: PlayerId; runnerId: PlayerId; frozenUntilTick: Tick; stolenKeyId: string | null }
  | { type: "teamCompleted"; tick: Tick; teamId: TeamId; isWinner: boolean }
  | { type: "skillUsed"; tick: Tick; playerId: PlayerId; skill: SkillKind }
  | { type: "shieldBlocked"; tick: Tick; playerId: PlayerId; by: "trap" | "ghost" }
  | { type: "roundEnded"; tick: Tick; winnerTeamId: TeamId | null; reason: RoundEndReason }
  /** Night parade: a ghost sprang a trap and is gone for good (set by `playerId`, null for a map fixture). */
  | { type: "ghostBanished"; tick: Tick; ghostId: PlayerId; by: "trap"; playerId: PlayerId | null }
  /** Night parade: the lights came on and every ghost is down until `untilTick`, when the lights go out again. */
  | { type: "ghostsStunned"; tick: Tick; untilTick: Tick; playerId: PlayerId }
  /** Night parade: the lights went out again by themselves. */
  | { type: "lightsOut"; tick: Tick };

export type RoundEndReason =
  /** Night parade: every ghost gone and the player climbed. */
  | "night:cleared"
  /** Night parade: the player was caught with no lives left. */
  | "night:caught"
  /** Night parade: time ran out before the player climbed. */
  | "night:timeout"
  | "allClimbed"
  /** Teams: all but one participant are on the tower, so the round stops; the first complete team won. */
  | "lastOneLeft"
  /** Solo: ended by climbs (all but one up); the highest score wins. */
  | "solo:score"
  /** Solo: the player named by `endWhenClimbed` climbed (tower run); the highest score wins. */
  | "solo:climbed"
  /** Solo: time ran out; the highest score wins. */
  | "solo:timeout"
  | "timeout:climbed"
  | "timeout:score"
  | "timeout:earlier"
  | "timeout:draw";
