import { applySnapshot, type SnapshotMessage } from "@supermaze/protocol";
import { DEFAULT_TUNING, MapGrid, availableAction, type MapData, type PlayerInput, type SimulationState } from "@supermaze/sim";
import { SnapshotBuffer } from "../net/snapshots.js";
import { formatSeconds } from "./roundHud.js";
import type { GameMode } from "./mode.js";

/**
 * One online match as seen by the renderer: the session feeds it full states
 * and per-tick messages, it interpolates and forwards inputs. It knows nothing
 * about rooms or lobbies.
 */
export class OnlineMatchMode implements GameMode {
  readonly label = "online";
  readonly grid: MapGrid;
  private buffer: SnapshotBuffer;
  private current: SimulationState | null = null;
  rttMs = 0;
  /** Set by the session from the lobby message while the room is in its results phase. */
  resultsEndAt: number | null = null;
  onLeaveRoom: (() => void) | null = null;

  constructor(
    map: MapData,
    readonly tickRate: number,
    private readonly meId: string,
    private readonly send: (input: PlayerInput) => void,
  ) {
    this.grid = MapGrid.fromMapData(map);
    this.buffer = new SnapshotBuffer(1000 / tickRate);
  }

  applyFull(state: SimulationState, at: number): void {
    this.current = state;
    this.buffer.push(state, at);
  }

  applyDelta(msg: SnapshotMessage, at: number): void {
    if (!this.current) return; // baseline not yet received
    this.current = applySnapshot(this.current, msg);
    this.buffer.push(this.current, at);
  }

  localPlayerId(): string | null {
    return this.meId;
  }

  tick(input: PlayerInput): void {
    if (this.current && this.current.status === "running") this.send(input);
  }

  sample(now: number) {
    return this.buffer.sample(now);
  }

  hud(): Record<string, string | number> {
    const st = this.buffer.latest();
    const me = st?.players[this.meId];
    return {
      status: st?.status ?? "-",
      time: st ? formatSeconds(Math.max(0, st.endsAtTick - st.tick) / this.tickRate) : "-",
      players: Object.keys(st?.players ?? {}).length,
      rtt: `${this.rttMs.toFixed(0)}ms`,
      key: me?.keyId ? "yes" : "no",
      score: me?.score ?? 0,
      tower: st?.towerArrivals.length ?? 0,
      lights: st ? (st.lightsOn ? "on" : "OFF") : "-",
      items: me ? `${me.items.length}/${DEFAULT_TUNING.inventory.capacity} ${me.items.join(",")}` : "-",
      action: (me && st && availableAction(this.grid, st, me, DEFAULT_TUNING.inventory.capacity)) ?? "-",
    };
  }

  results() {
    return {
      endsAt: this.resultsEndAt,
      buttons: this.onLeaveRoom ? [{ label: "離開房間", run: this.onLeaveRoom }] : [],
    };
  }
}
