import { CloseCode, Room, type Client } from "@colyseus/core";
import {
  C2S,
  PROTOCOL_VERSION,
  S2C,
  type InputMessage,
  type PingMessage,
  type SnapshotMessage,
  type WelcomeMessage,
} from "@supermaze/protocol";
import { DEFAULT_TUNING, NO_INPUT, Simulation, type MapData, type PlayerInput } from "@supermaze/sim";
import { loadMap } from "./mapLoader.js";

/**
 * One match. Owns the authoritative Simulation; clients only send intents.
 * A dropped client is switched to CPU control in place (CLAUDE.md section 2)
 * and gets the same player back if it reconnects within the window.
 */
export class MazeRoom extends Room {
  override maxClients = DEFAULT_TUNING.round.maxParticipants;

  private sim!: Simulation;
  private map!: MapData;
  private readonly latestInputs = new Map<string, PlayerInput>();
  private nextTeam = 0;

  override async onCreate(options: { mapId?: string }): Promise<void> {
    this.map = await loadMap(options.mapId ?? "test-01");
    this.sim = new Simulation({ seed: Date.now() >>> 0, map: this.map, participants: [] });

    this.onMessage<InputMessage>(C2S.input, (client, msg) => {
      this.latestInputs.set(client.sessionId, sanitizeInput(msg));
    });
    this.onMessage<PingMessage>(C2S.ping, (client, msg) => {
      client.send(S2C.pong, msg);
    });

    this.setSimulationInterval(() => this.tick(), 1000 / this.sim.tuning.tickRate);
  }

  override onJoin(client: Client): void {
    // Dev behaviour until the lobby exists: alternate players between the two teams
    // and start the round as soon as the first player is in. Late joiners get a key
    // spawned for them so keys == participants still holds.
    this.sim.addPlayer({ id: client.sessionId, teamId: `t${this.nextTeam++ % 2}`, controller: "human" });
    if (this.sim.getState().status === "lobby") this.sim.start();
    const welcome: WelcomeMessage = {
      protocolVersion: PROTOCOL_VERSION,
      playerId: client.sessionId,
      mapId: this.map.id,
      tickRate: this.sim.tuning.tickRate,
    };
    client.send(S2C.welcome, welcome);
  }

  override async onLeave(client: Client, code?: number): Promise<void> {
    this.latestInputs.delete(client.sessionId);
    if (code === CloseCode.CONSENTED) {
      this.sim.removePlayer(client.sessionId);
      return;
    }
    this.sim.setController(client.sessionId, "cpu");
    try {
      await this.allowReconnection(client, this.sim.tuning.connection.reconnectWindowSec);
      this.sim.setController(client.sessionId, "human");
    } catch {
      // Window expired: the player stays CPU-controlled until the round ends.
    }
  }

  private tick(): void {
    // CPU-controlled players have no bot yet in phase 0; they simply stand still.
    const frame = new Map<string, PlayerInput>();
    for (const [id, p] of Object.entries(this.sim.getState().players)) {
      frame.set(id, p.controller === "human" ? (this.latestInputs.get(id) ?? NO_INPUT) : NO_INPUT);
    }
    this.sim.step(frame);

    const snapshot: SnapshotMessage = { serverTime: Date.now(), state: this.sim.getState() };
    this.broadcast(S2C.snapshot, snapshot);
  }
}

/** Never trust client numbers: clamp to the unit square and drop NaN. */
function sanitizeInput(msg: unknown): PlayerInput {
  const m = (msg ?? {}) as Partial<InputMessage>;
  const clamp = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
  const input: PlayerInput = { moveX: clamp(m.moveX), moveY: clamp(m.moveY) };
  if (m.climb === true) input.climb = true;
  return input;
}
