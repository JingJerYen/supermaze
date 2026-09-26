import { Client, type Room } from "@colyseus/sdk";
import { C2S, ROOM_NAME, S2C, applySnapshot, type FullStateMessage, type PingMessage, type SnapshotMessage, type WelcomeMessage } from "@supermaze/protocol";
import type { PlayerInput, SimulationState } from "@supermaze/sim";

/**
 * One scripted client: joins, random-walks at the tick rate, records snapshot
 * arrival gaps, approximate snapshot size and ping round trips.
 */
export class Bot {
  room: Room | null = null;
  welcome: WelcomeMessage | null = null;
  /** Merged authoritative state, kept the same way the real client does. */
  state: SimulationState | null = null;
  /** Bytes of the last full-state message, JSON-equivalent, for the report. */
  fullBytes = 0;
  readonly snapshotGapsMs: number[] = [];
  readonly snapshotBytes: number[] = [];
  readonly rttMs: number[] = [];
  private lastSnapshotAt = 0;
  private timers: NodeJS.Timeout[] = [];
  private dir: PlayerInput = { moveX: 1, moveY: 0 };

  constructor(readonly name: string, private readonly client: Client) {}

  /** Create a fresh room (so the test never shares one with real players). */
  async create(): Promise<string> {
    this.room = await this.client.create(ROOM_NAME);
    this.attach(this.room);
    return this.room.roomId;
  }

  async join(roomId: string): Promise<void> {
    this.room = await this.client.joinById(roomId);
    this.attach(this.room);
  }

  async reconnect(token: string): Promise<void> {
    this.room = await this.client.reconnect(token);
    this.attach(this.room);
  }

  private attach(room: Room): void {
    room.onMessage<WelcomeMessage>(S2C.welcome, (m) => {
      this.welcome = m;
    });
    room.onMessage<FullStateMessage>(S2C.full, (m) => {
      this.state = m.state;
      this.fullBytes = JSON.stringify(m).length;
    });
    room.onMessage<SnapshotMessage>(S2C.snapshot, (m) => {
      const now = performance.now();
      if (this.lastSnapshotAt) this.snapshotGapsMs.push(now - this.lastSnapshotAt);
      this.lastSnapshotAt = now;
      if (this.state) this.state = applySnapshot(this.state, m);
      // Approximation: Colyseus encodes with msgpackr, so the wire size is roughly a third of JSON.
      this.snapshotBytes.push(JSON.stringify(m).length);
    });
    room.onMessage<PingMessage>(S2C.pong, (m) => this.rttMs.push(performance.now() - m.t));
  }

  /** Start sending inputs at `tickRate` Hz and pings every 500 ms. */
  start(tickRate: number): void {
    this.timers.push(
      setInterval(() => {
        if (Math.random() < 0.05) this.turn();
        this.room?.send(C2S.input, this.dir);
      }, 1000 / tickRate),
      setInterval(() => this.room?.send(C2S.ping, { t: performance.now() } satisfies PingMessage), 500),
    );
  }

  stop(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }

  /**
   * Drop the socket without telling the server, as a real disconnect would.
   * With `autoReconnect` false the SDK's built-in retry is disabled so the test
   * can exercise the manual `client.reconnect(token)` path.
   */
  async dropConnection(autoReconnect: boolean): Promise<void> {
    this.stop();
    if (!this.room) return;
    if (!autoReconnect) this.room.reconnection.enabled = false;
    this.room.connection.close();
    await new Promise((r) => setTimeout(r, 200));
  }

  /** Ticks seen since the last call; >0 means snapshots are still arriving. */
  private lastSeenTick = 0;
  snapshotsAdvanced(): boolean {
    const t = this.state?.tick ?? 0;
    const advanced = t > this.lastSeenTick;
    this.lastSeenTick = t;
    return advanced;
  }

  async leave(): Promise<void> {
    this.stop();
    await this.room?.leave(true);
  }

  private turn(): void {
    const dirs: PlayerInput[] = [
      { moveX: 1, moveY: 0 },
      { moveX: -1, moveY: 0 },
      { moveX: 0, moveY: 1 },
      { moveX: 0, moveY: -1 },
    ];
    this.dir = dirs[Math.floor(Math.random() * dirs.length)] as PlayerInput;
  }
}
