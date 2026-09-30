import { Client, type Room } from "@colyseus/sdk";
import {
  type AckMessage,
  type InputMessage,
  C2S,
  ROOM_NAME,
  S2C,
  type DebugMessage,
  type FullStateMessage,
  type LobbyMessage,
  type MatchStartedMessage,
  type PingMessage,
  type SetTeamModeMessage,
  type SnapshotMessage,
  type TeamMode,
  type WelcomeMessage,
} from "@supermaze/protocol";
import type { PlayerInput } from "@supermaze/sim";

const TOKEN_KEY = "supermaze.reconnectionToken";
const CONNECT_TIMEOUT_MS = 6000;
const RECONNECT_TIMEOUT_MS = 4000;

/** Thrown by `connect` when the server did not answer in time. */
export class ConnectTimeout extends Error {
  constructor() {
    super("timeout");
  }
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ConnectTimeout()), ms);
    work.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export interface ConnectionEvents {
  onWelcome(msg: WelcomeMessage): void;
  onLobby(msg: LobbyMessage): void;
  onMatchStarted(msg: MatchStartedMessage): void;
  onFull(msg: FullStateMessage, receivedAt: number): void;
  onSnapshot(msg: SnapshotMessage, receivedAt: number): void;
  onAck(msg: AckMessage, receivedAt: number): void;
  onPong(msg: PingMessage, receivedAt: number): void;
  onLeave(code: number): void;
}

export type JoinRequest = (
  | { kind: "quick"; name: string }
  | { kind: "create"; name: string }
  | { kind: "join"; name: string; code: string }
) & {
  /** Picked character (character setup); null for the id-based default. */
  character?: string | null;
  /** Server typed on the home screen; empty keeps the current endpoint. */
  server?: string;
};

/**
 * Thin wrapper over the Colyseus SDK. A stored reconnection token is tried
 * first (a refresh mid-match resumes the same player); otherwise the requested
 * room is joined or created.
 */
export class Connection {
  private room: Room | null = null;

  constructor(
    private endpoint: string,
    private readonly events: ConnectionEvents,
  ) {}

  /** Server to use for the next connect; a stored reconnection also goes there. */
  setEndpoint(url: string): void {
    this.endpoint = url;
  }

  getEndpoint(): string {
    return this.endpoint;
  }

  /** True when a stored token got us back into a room. */
  async tryReconnect(): Promise<boolean> {
    const token = safeGet(TOKEN_KEY);
    if (!token) return false;
    try {
      this.attach(await withTimeout(new Client(this.endpoint).reconnect(token), RECONNECT_TIMEOUT_MS));
      return true;
    } catch {
      safeRemove(TOKEN_KEY);
      return false;
    }
  }

  async connect(req: JoinRequest): Promise<void> {
    const client = new Client(this.endpoint);
    const opts = { name: req.name, character: req.character ?? null };
    let room: Room;
    // A dead or mistyped server must not leave the player on "connecting" for ever.
    if (req.kind === "quick") room = await withTimeout(client.joinOrCreate(ROOM_NAME, { ...opts, mode: "quick" }), CONNECT_TIMEOUT_MS);
    else if (req.kind === "create") room = await withTimeout(client.create(ROOM_NAME, { ...opts, mode: "private" }), CONNECT_TIMEOUT_MS);
    else room = await withTimeout(client.join(ROOM_NAME, { ...opts, mode: "private", code: req.code.toUpperCase() }), CONNECT_TIMEOUT_MS);
    this.attach(room);
  }

  private attach(room: Room): void {
    this.room = room;
    safeSet(TOKEN_KEY, room.reconnectionToken);
    room.onMessage<WelcomeMessage>(S2C.welcome, (m) => this.events.onWelcome(m));
    room.onMessage<LobbyMessage>(S2C.lobby, (m) => this.events.onLobby(m));
    room.onMessage<MatchStartedMessage>(S2C.matchStarted, (m) => this.events.onMatchStarted(m));
    room.onMessage<FullStateMessage>(S2C.full, (m) => this.events.onFull(m, performance.now()));
    room.onMessage<SnapshotMessage>(S2C.snapshot, (m) => this.events.onSnapshot(m, performance.now()));
    room.onMessage<AckMessage>(S2C.ack, (m) => this.events.onAck(m, performance.now()));
    room.onMessage<PingMessage>(S2C.pong, (m) => this.events.onPong(m, performance.now()));
    room.onLeave((code) => {
      this.room = null;
      safeRemove(TOKEN_KEY);
      this.events.onLeave(code);
    });
  }

  get sessionId(): string | null {
    return this.room?.sessionId ?? null;
  }

  sendInput(input: InputMessage): void {
    this.room?.send(C2S.input, input);
  }
  setReady(ready: boolean): void {
    this.room?.send(C2S.ready, { ready });
  }
  switchTeam(): void {
    this.room?.send(C2S.switchTeam, {});
  }
  setTeamMode(teamMode: TeamMode): void {
    this.room?.send(C2S.setTeamMode, { teamMode } satisfies SetTeamModeMessage);
  }
  requestStart(): void {
    this.room?.send(C2S.start, {});
  }
  sendDebug(cmd: DebugMessage["cmd"]): void {
    this.room?.send(C2S.debug, { cmd } satisfies DebugMessage);
  }
  ping(): void {
    this.room?.send(C2S.ping, { t: performance.now() } satisfies PingMessage);
  }
  async leave(): Promise<void> {
    await this.room?.leave(true);
  }
}

function safeGet(k: string): string | null {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeSet(k: string, v: string): void {
  try {
    sessionStorage.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
}
function safeRemove(k: string): void {
  try {
    sessionStorage.removeItem(k);
  } catch {
    /* storage unavailable */
  }
}
