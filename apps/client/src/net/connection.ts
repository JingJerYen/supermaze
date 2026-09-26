import { Client, type Room } from "@colyseus/sdk";
import {
  C2S,
  ROOM_NAME,
  S2C,
  type FullStateMessage,
  type LobbyMessage,
  type MatchStartedMessage,
  type PingMessage,
  type SnapshotMessage,
  type WelcomeMessage,
} from "@supermaze/protocol";
import type { PlayerInput } from "@supermaze/sim";

const TOKEN_KEY = "supermaze.reconnectionToken";

export interface ConnectionEvents {
  onWelcome(msg: WelcomeMessage): void;
  onLobby(msg: LobbyMessage): void;
  onMatchStarted(msg: MatchStartedMessage): void;
  onFull(msg: FullStateMessage, receivedAt: number): void;
  onSnapshot(msg: SnapshotMessage, receivedAt: number): void;
  onPong(msg: PingMessage, receivedAt: number): void;
  onLeave(code: number): void;
}

export type JoinRequest =
  | { kind: "quick"; name: string }
  | { kind: "create"; name: string }
  | { kind: "join"; name: string; code: string };

/**
 * Thin wrapper over the Colyseus SDK. A stored reconnection token is tried
 * first (a refresh mid-match resumes the same player); otherwise the requested
 * room is joined or created.
 */
export class Connection {
  private room: Room | null = null;

  constructor(private readonly endpoint: string, private readonly events: ConnectionEvents) {}

  /** True when a stored token got us back into a room. */
  async tryReconnect(): Promise<boolean> {
    const token = safeGet(TOKEN_KEY);
    if (!token) return false;
    try {
      this.attach(await new Client(this.endpoint).reconnect(token));
      return true;
    } catch {
      safeRemove(TOKEN_KEY);
      return false;
    }
  }

  async connect(req: JoinRequest): Promise<void> {
    const client = new Client(this.endpoint);
    const opts = { name: req.name };
    let room: Room;
    if (req.kind === "quick") room = await client.joinOrCreate(ROOM_NAME, { ...opts, mode: "quick" });
    else if (req.kind === "create") room = await client.create(ROOM_NAME, { ...opts, mode: "private" });
    else room = await client.join(ROOM_NAME, { ...opts, mode: "private", code: req.code.toUpperCase() });
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

  sendInput(input: PlayerInput): void {
    this.room?.send(C2S.input, input);
  }
  setReady(ready: boolean): void {
    this.room?.send(C2S.ready, { ready });
  }
  switchTeam(): void {
    this.room?.send(C2S.switchTeam, {});
  }
  requestStart(): void {
    this.room?.send(C2S.start, {});
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
