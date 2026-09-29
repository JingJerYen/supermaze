import type { Layer, MoverState, PlayerInput, PlayerState, SimulationState, TeamMode } from "@supermaze/sim";

export type { TeamMode };

/**
 * Wire messages between client and server, carried as Colyseus room messages.
 * Message *names* are the constants below; payload shapes are the interfaces.
 * Only the shapes matter to the simulation; the transport can change.
 */
/**
 * 2: per-tick messages carry packed movers and only the players whose other data changed.
 * 3: inputs are numbered and applied in order, one per tick; the server acknowledges them.
 */
export const PROTOCOL_VERSION = 3;

export const ROOM_NAME = "maze";

/** Longest display name, in characters; the client input and the server both cap it. */
export const NAME_MAX_CHARS = 6;

/** Cut a display name to NAME_MAX_CHARS characters (not UTF-16 units, so emoji stay whole). */
export function capName(s: string): string {
  return Array.from(s).slice(0, NAME_MAX_CHARS).join("");
}

/** Client -> server message names. */
export const C2S = {
  input: "input",
  ping: "ping",
  /** Toggle ready in the lobby. */
  ready: "ready",
  /** Teams mode: move to the other team if it has room. */
  switchTeam: "switchTeam",
  /** Host of a private room: choose two teams or everyone for themselves. */
  setTeamMode: "setTeamMode",
  /** Host of a private room: start now (min players and team balance still apply). */
  start: "start",
  /** Developer-only commands; the server ignores them unless debugging is enabled. */
  debug: "debug",
} as const;

export interface SetTeamModeMessage {
  teamMode: TeamMode;
}

export type DebugCommand = "ghost";
export interface DebugMessage {
  cmd: DebugCommand;
}

/** Server -> client message names. */
export const S2C = {
  welcome: "welcome",
  /** Lobby/room state; sent on every change and when the match ends. */
  lobby: "lobby",
  /** The match begins: which map and orientation to build; a `full` state follows. */
  matchStarted: "matchStarted",
  /** Complete state; sent on join and after a reconnection. */
  full: "full",
  /** Per-tick update: players always, other sections only when they changed. */
  snapshot: "snapshot",
  /** To one client: which of its inputs the snapshot just sent includes. */
  ack: "ack",
  pong: "pong",
} as const;

/**
 * One tick of intent. `seq` numbers the inputs of a client from 1; the server
 * applies them in order, one per tick, and reports the last one applied, which
 * lets the client predict its own movement and check it (section 17.3).
 */
export interface InputMessage extends PlayerInput {
  seq?: number;
}

/** Sent to one client after a tick that applied one of its inputs. */
export interface AckMessage {
  /** The last input of this client that the state just broadcast includes. */
  seq: number;
}

export interface PingMessage {
  /** Client clock at send time, ms. Echoed back untouched. */
  t: number;
}

export interface WelcomeMessage {
  protocolVersion: number;
  playerId: string;
}

export type RoomMode = "quick" | "private";
export type LobbyPhase = "lobby" | "countdown" | "playing" | "results";

export interface LobbyPlayer {
  id: string;
  name: string;
  teamId: string;
  ready: boolean;
  connected: boolean;
}

export interface LobbyMessage {
  mode: RoomMode;
  /** Quick rooms are always `solo` (two players, no multiplier); a private room's host chooses. */
  teamMode: TeamMode;
  /** Four-letter join code for private rooms. */
  code: string | null;
  phase: LobbyPhase;
  hostId: string;
  players: LobbyPlayer[];
  minPlayers: number;
  maxPlayers: number;
  /** Server clock (ms since epoch) when the countdown ends, while phase is "countdown". */
  countdownEndsAt: number | null;
  /** Server clock when results give way to the lobby, while phase is "results". */
  resultsEndAt: number | null;
  /** One-line notice for everyone, e.g. the quick-match wait timed out. */
  notice: string | null;
}

export interface MatchStartedMessage {
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

/** A player's state without the part that changes while walking. */
export type PlayerRest = Omit<PlayerState, "mover">;

/**
 * A mover packed as numbers, a tenth the size of the object with its field
 * names: [fromX, fromY, fromLayer, targetX, targetY, targetLayer, progress in
 * thousandths, facingDx, facingDy, turnHold]. No target is targetX -1. Layers
 * are indices into `LAYERS`.
 */
export type MoverWire = [number, number, number, number, number, number, number, number, number, number];

const LAYERS: readonly Layer[] = ["road", "wallTop", "towerTop"];

export function encodeMover(m: MoverState): MoverWire {
  const t = m.target;
  return [
    m.from.x,
    m.from.y,
    LAYERS.indexOf(m.from.layer),
    t ? t.x : -1,
    t ? t.y : 0,
    t ? LAYERS.indexOf(t.layer) : 0,
    Math.round(m.progress * 1000),
    m.facing.dx,
    m.facing.dy,
    m.turnHold,
  ];
}

export function decodeMover(w: MoverWire): MoverState {
  const [fx, fy, fl, tx, ty, tl, progress, dx, dy, turnHold] = w;
  return {
    from: { x: fx, y: fy, layer: LAYERS[fl] ?? "road" },
    target: tx < 0 ? null : { x: tx, y: ty, layer: LAYERS[tl] ?? "road" },
    progress: progress / 1000,
    facing: { dx, dy },
    turnHold,
  };
}

/**
 * Per-tick message: only what differs from what the room last broadcast.
 * `movers` carries the players who moved or turned, packed; `players` carries
 * everything else about the players whose name, score, key, bag or status
 * changed, which is rare. Every other section of the state appears whole when
 * its content changed. Clients merge the message into their copy of the state.
 */
export interface SnapshotMessage extends Partial<Pick<SimulationState, StateSection>> {
  serverTime: number;
  tick: number;
  movers?: Record<string, MoverWire>;
  players?: Record<string, PlayerRest>;
}

/** Apply a per-tick message to the previous state. */
export function applySnapshot(prev: SimulationState, msg: SnapshotMessage): SimulationState {
  const { serverTime: _t, movers, players: rests, ...sections } = msg;
  if (!movers && !rests) return { ...prev, ...sections };
  const players = { ...prev.players };
  for (const [id, rest] of Object.entries(rests ?? {})) {
    const wire = movers?.[id];
    const mover = wire ? decodeMover(wire) : players[id]?.mover;
    if (mover) players[id] = { ...rest, mover };
  }
  for (const [id, wire] of Object.entries(movers ?? {})) {
    const p = players[id];
    if (p) players[id] = { ...p, mover: decodeMover(wire) };
  }
  return { ...prev, ...sections, players };
}

const SECTIONS: readonly StateSection[] = [
  "status",
  "teamMode",
  "startTick",
  "endsAtTick",
  "freezeUntilTick",
  "keys",
  "towerArrivals",
  "lightsOn",
  "switches",
  "boxes",
  "placeables",
  "nodes",
  "ghost",
  "teamClimbTicks",
  "winnerTeamId",
  "result",
];

/**
 * Builds the per-tick messages of one match on the server: remembers what was
 * last broadcast and sends only what changed since. One instance per match.
 * Comparing serialised forms costs microseconds for a state of a few kilobytes.
 */
export class SnapshotDelta {
  private readonly sections = new Map<StateSection, string>();
  private readonly rests = new Map<string, string>();
  private readonly movers = new Map<string, string>();

  next(state: SimulationState, serverTime: number): SnapshotMessage {
    const msg: SnapshotMessage = { serverTime, tick: state.tick };
    for (const section of SECTIONS) {
      const now = JSON.stringify(state[section]);
      if (this.sections.get(section) === now) continue;
      this.sections.set(section, now);
      (msg as unknown as Record<string, unknown>)[section] = state[section];
    }
    for (const [id, p] of Object.entries(state.players)) {
      const { mover, ...rest } = p;
      const wire = encodeMover(mover);
      const moverNow = wire.join(",");
      if (this.movers.get(id) !== moverNow) {
        this.movers.set(id, moverNow);
        (msg.movers ??= {})[id] = wire;
      }
      const restNow = JSON.stringify(rest);
      if (this.rests.get(id) !== restNow) {
        this.rests.set(id, restNow);
        (msg.players ??= {})[id] = rest;
      }
    }
    return msg;
  }
}

export type PongMessage = PingMessage;

export * from "./inputQueue.js";
