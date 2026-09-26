import { Client, type Room } from "@colyseus/sdk";
import { C2S, ROOM_NAME, S2C, type FullStateMessage, type PingMessage, type SnapshotMessage, type WelcomeMessage } from "@supermaze/protocol";
import type { PlayerInput } from "@supermaze/sim";

const TOKEN_KEY = "supermaze.reconnectionToken";

export interface ConnectionEvents {
  onWelcome(msg: WelcomeMessage): void;
  onFull(msg: FullStateMessage, receivedAt: number): void;
  onSnapshot(msg: SnapshotMessage, receivedAt: number): void;
  onPong(msg: PingMessage, receivedAt: number): void;
  onLeave(code: number): void;
}

/**
 * Thin wrapper over the Colyseus SDK. Tries to reconnect with a stored token
 * first (so a page refresh mid-round resumes the same player), then falls back
 * to joining fresh.
 */
export class Connection {
  private room: Room | null = null;

  constructor(
    private readonly endpoint: string,
    private readonly events: ConnectionEvents,
    private readonly name: string,
  ) {}

  async connect(): Promise<void> {
    const client = new Client(this.endpoint);
    const token = safeGet(TOKEN_KEY);
    if (token) {
      try {
        this.room = await client.reconnect(token);
      } catch {
        safeRemove(TOKEN_KEY);
      }
    }
    if (!this.room) this.room = await client.joinOrCreate(ROOM_NAME, { name: this.name });
    safeSet(TOKEN_KEY, this.room.reconnectionToken);

    this.room.onMessage<WelcomeMessage>(S2C.welcome, (m) => this.events.onWelcome(m));
    this.room.onMessage<FullStateMessage>(S2C.full, (m) => this.events.onFull(m, performance.now()));
    this.room.onMessage<SnapshotMessage>(S2C.snapshot, (m) => this.events.onSnapshot(m, performance.now()));
    this.room.onMessage<PingMessage>(S2C.pong, (m) => this.events.onPong(m, performance.now()));
    this.room.onLeave((code) => {
      this.room = null;
      this.events.onLeave(code);
    });
  }

  get sessionId(): string | null {
    return this.room?.sessionId ?? null;
  }

  sendInput(input: PlayerInput): void {
    this.room?.send(C2S.input, input);
  }

  ping(): void {
    this.room?.send(C2S.ping, { t: performance.now() } satisfies PingMessage);
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
