import type { PlayerInput, SimulationState } from "@supermaze/sim";

/**
 * Wire messages between client and server, carried as Colyseus room messages.
 * Message *names* are the constants below; payload shapes are the interfaces.
 * Only the shapes matter to the simulation; the transport can change.
 */
export const PROTOCOL_VERSION = 1;

export const ROOM_NAME = "maze";

/** Client -> server message names. */
export const C2S = {
  input: "input",
  ping: "ping",
} as const;

/** Server -> client message names. */
export const S2C = {
  welcome: "welcome",
  snapshot: "snapshot",
  pong: "pong",
} as const;

export type InputMessage = PlayerInput;

export interface PingMessage {
  /** Client clock at send time, ms. Echoed back untouched. */
  t: number;
}

export interface WelcomeMessage {
  protocolVersion: number;
  playerId: string;
  mapId: string;
  /** Quarter turns clockwise the server applied to the authored map. */
  rotation: 0 | 1 | 2 | 3;
  tickRate: number;
}

export interface SnapshotMessage {
  /** Server clock when the snapshot was produced, ms since epoch. */
  serverTime: number;
  /** Full authoritative state. Delta encoding is a phase-2 optimisation. */
  state: SimulationState;
}

export type PongMessage = PingMessage;
