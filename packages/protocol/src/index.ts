import type { PlayerInput, PlayerState, SimulationState } from "@supermaze/sim";

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
  /** Complete state; sent on join and after a reconnection. */
  full: "full",
  /** Per-tick update: players always, other sections only when they changed. */
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

export interface FullStateMessage {
  serverTime: number;
  state: SimulationState;
}

/** Everything in the state except the per-tick fields; each is sent only on change. */
export type StateSection = Exclude<keyof SimulationState, "tick" | "players">;

/**
 * Per-tick message. `players` and `tick` are always present because they change
 * every tick; every other section appears only when its content differs from
 * what this room last broadcast. Clients merge it into their copy of the state.
 */
export interface SnapshotMessage extends Partial<Pick<SimulationState, StateSection>> {
  serverTime: number;
  tick: number;
  players: Record<string, PlayerState>;
}

/** Apply a per-tick message to the previous full state. */
export function applySnapshot(prev: SimulationState, msg: SnapshotMessage): SimulationState {
  const { serverTime: _t, ...rest } = msg;
  return { ...prev, ...rest };
}

export type PongMessage = PingMessage;
