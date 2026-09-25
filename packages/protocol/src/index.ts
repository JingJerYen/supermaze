import type { PlayerInput, SimulationState } from "@supermaze/sim";

/**
 * Wire messages between client and server. Phase-0 sketch.
 * Encoding (JSON vs binary) and the transport framework (Colyseus vs raw ws)
 * are decided at the end of phase 0; only the shapes live here.
 */
export const PROTOCOL_VERSION = 1;

export type ClientToServer =
  | { type: "hello"; protocolVersion: number; playerName: string }
  | { type: "input"; tick: number; input: PlayerInput };

export type ServerToClient =
  | { type: "welcome"; playerId: string; seed: number; tickRate: number }
  | { type: "snapshot"; state: SimulationState }
  | { type: "error"; message: string };
