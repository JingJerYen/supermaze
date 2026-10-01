import { applySnapshot, type InputMessage, type SnapshotMessage } from "@supermaze/protocol";
import { DEFAULT_TUNING, MapGrid, availableAction, type MapData, type MoverState, type PlayerInput, type SimulationState } from "@supermaze/sim";
import { t } from "../i18n/index.js";
import { Predictor } from "../net/predictor.js";
import { SnapshotBuffer } from "../net/snapshots.js";
import { CLIENT_TUNING } from "../tuning.js";
import { formatSeconds } from "./roundHud.js";
import { switchTileSet, type GameMode, type Sample } from "./mode.js";

/**
 * One online match as seen by the renderer: the session feeds it full states
 * and per-tick messages, it interpolates and forwards inputs. It knows nothing
 * about rooms or lobbies. Everyone else is drawn one update behind, blended
 * between server states; the local player's own movement is predicted, so it
 * answers the keys at once (section 17.3).
 */
export class OnlineMatchMode implements GameMode {
  readonly label = "online";
  readonly grid: MapGrid;
  readonly theme: string | undefined;
  readonly plazaRadius: number;
  readonly switchTiles: ReadonlySet<string>;
  private buffer: SnapshotBuffer;
  private current: SimulationState | null = null;
  private readonly predictor: Predictor | null;
  /** What is left of the last correction, eased to nothing; tiles. */
  private readonly nudge = { x: 0, y: 0 };
  private nudgeAt = 0;
  /** Corrections that had to be shown, for the debug panel. */
  private corrections = 0;
  rttMs = 0;
  /** Set by the session from the lobby message while the room is in its results phase. */
  resultsEndAt: number | null = null;
  onLeaveRoom: (() => void) | null = null;
  onDebug: ((cmd: "ghost") => void) | null = null;

  constructor(
    map: MapData,
    readonly tickRate: number,
    private readonly meId: string,
    private readonly send: (input: InputMessage) => void,
    options: { predict?: boolean } = {},
  ) {
    this.grid = MapGrid.fromMapData(map);
    this.theme = map.theme;
    this.plazaRadius = map.plazaRadius ?? 0;
    this.switchTiles = switchTileSet(map);
    this.buffer = new SnapshotBuffer(1000 / tickRate);
    this.predictor = options.predict === false ? null : new Predictor(this.grid, DEFAULT_TUNING, meId);
  }

  applyFull(state: SimulationState, at: number): void {
    // Same reservation the server made when the round started, so the action button agrees with it.
    this.grid.reserveForRound(
      Object.values(state.keys).map((k) => k.pos),
      Object.values(state.switches).map((s) => s.pos),
    );
    this.current = state;
    this.buffer.push(state, at);
    this.predictor?.setState(state);
  }

  applyDelta(msg: SnapshotMessage, at: number): void {
    if (!this.current) return; // baseline not yet received
    this.current = applySnapshot(this.current, msg);
    this.buffer.push(this.current, at);
    this.predictor?.setState(this.current);
  }

  /** The state just received includes this client's inputs up to `seq`. */
  applyAck(seq: number, at: number): void {
    if (!this.predictor) return;
    const moved = this.predictor.reconcile(seq);
    const size = Math.hypot(moved.x, moved.y);
    if (size < 1e-3) return;
    this.corrections++;
    this.settleNudge(at);
    // A small miss is eased into place; a big one (a teleport, a long stall) is shown as it is.
    if (size <= CLIENT_TUNING.prediction.snapBeyondTiles) {
      this.nudge.x += moved.x;
      this.nudge.y += moved.y;
    } else {
      this.nudge.x = this.nudge.y = 0;
    }
  }

  private settleNudge(now: number): void {
    const k = Math.exp((-CLIENT_TUNING.prediction.easePerSec * Math.max(0, now - this.nudgeAt)) / 1000);
    this.nudge.x *= k;
    this.nudge.y *= k;
    if (Math.hypot(this.nudge.x, this.nudge.y) < 1e-3) this.nudge.x = this.nudge.y = 0;
    this.nudgeAt = now;
  }

  localPlayerId(): string | null {
    return this.meId;
  }

  tick(input: PlayerInput): void {
    if (!this.current || this.current.status !== "running") return;
    if (!this.predictor) this.send(input);
    else this.send({ ...input, seq: this.predictor.push(input) });
  }

  sample(now: number, loopAlpha: number): Sample | null {
    const s = this.buffer.sample(now);
    const mine = this.predictor?.active ? this.predictor.blended(loopAlpha) : null;
    if (!s || !mine || !s.to.players[this.meId]) return s;
    this.settleNudge(now);
    // The same mover on both sides: the local player is already blended to this instant.
    return { from: withMover(s.from, this.meId, mine), to: withMover(s.to, this.meId, mine), alpha: s.alpha, nudge: { ...this.nudge } };
  }

  hud(): Record<string, string | number> {
    const st = this.buffer.latest();
    const me = st?.players[this.meId];
    return {
      status: st?.status ?? "-",
      time: st ? formatSeconds(Math.max(0, st.endsAtTick - st.tick) / this.tickRate) : "-",
      players: Object.keys(st?.players ?? {}).length,
      rtt: `${this.rttMs.toFixed(0)}ms`,
      predict: this.predictor ? (this.predictor.active ? `on, ${this.corrections} corrected` : "waiting") : "off",
      key: me?.keyId ? "yes" : "no",
      score: me?.score ?? 0,
      tower: st?.towerArrivals.length ?? 0,
      lights: st ? (st.lightsOn ? "on" : "OFF") : "-",
      items: me ? `${me.items.length}/${DEFAULT_TUNING.inventory.capacity} ${me.items.join(",")}` : "-",
      action: (me && st && availableAction(this.grid, st, me, DEFAULT_TUNING.inventory.capacity)) ?? "-",
    };
  }

  debug(cmd: "ghost"): void {
    this.onDebug?.(cmd);
  }

  /** Leaving mid-match hands the player to the CPU for the rest of the round (CLAUDE.md 2.1). */
  exit(): void {
    this.onLeaveRoom?.();
  }

  results() {
    return {
      endsAt: this.resultsEndAt,
      buttons: this.onLeaveRoom ? [{ label: t("hud.result.leaveRoom"), run: this.onLeaveRoom }] : [],
    };
  }
}

function withMover(state: SimulationState, id: string, mover: MoverState): SimulationState {
  const p = state.players[id];
  return p ? { ...state, players: { ...state.players, [id]: { ...p, mover } } } : state;
}
