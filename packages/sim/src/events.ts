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
  | { type: "placeablePlaced"; tick: Tick; playerId: PlayerId; placeableId: string; kind: PlaceableKind | "hammer"; placeholder: boolean }
  | { type: "placeableExpired"; tick: Tick; placeableId: string; kind: PlaceableKind | "hammer" }
  | { type: "placeableDestroyed"; tick: Tick; playerId: PlayerId; placeableId: string; kind: PlaceableKind | "hammer" }
  | { type: "nodeDestroyed"; tick: Tick; playerId: PlayerId; nodeId: string; teamId: TeamId }
  | { type: "trapTriggered"; tick: Tick; playerId: PlayerId; placeableId: string; frozenUntilTick: Tick }
  | { type: "nodePlaced"; tick: Tick; playerId: PlayerId; nodeId: string; pairedWith: string | null }
  | { type: "nodePickedUp"; tick: Tick; playerId: PlayerId; nodeId: string }
  | { type: "teleported"; tick: Tick; playerId: PlayerId; fromNodeId: string; toNodeId: string }
  | { type: "ghostWarning"; tick: Tick; teamId: TeamId; startsAtTick: Tick }
  | { type: "ghostStarted"; tick: Tick; teamId: TeamId; endsAtTick: Tick }
  | { type: "ghostEnded"; tick: Tick; teamId: TeamId }
  | { type: "playerCaught"; tick: Tick; ghostId: PlayerId; runnerId: PlayerId; frozenUntilTick: Tick }
  | { type: "teamCompleted"; tick: Tick; teamId: TeamId; isWinner: boolean }
  | { type: "roundEnded"; tick: Tick; winnerTeamId: TeamId | null; reason: RoundEndReason };

export type RoundEndReason =
  | "allClimbed"
  | "timeout:climbed"
  | "timeout:score"
  | "timeout:earlier"
  | "timeout:draw";
