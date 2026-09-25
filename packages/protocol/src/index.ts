import type { PlayerInput, PlayerState, Tick } from "@supermaze/sim";

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
  tickRate: number;
}

export interface SnapshotMessage {
  tick: Tick;
  /** Server clock when the snapshot was produced, ms since epoch. */
  serverTime: number;
  players: Record<string, PlayerState>;
}

export type PongMessage = PingMessage;
