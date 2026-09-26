import { CloseCode, Room, type Client } from "@colyseus/core";
import {
  C2S,
  PROTOCOL_VERSION,
  S2C,
  type FullStateMessage,
  type InputMessage,
  type LobbyMessage,
  type LobbyPhase,
  type LobbyPlayer,
  type MatchStartedMessage,
  type PingMessage,
  type RoomMode,
  type SnapshotMessage,
  type StateSection,
  type WelcomeMessage,
} from "@supermaze/protocol";
import {
  DEFAULT_TUNING,
  NO_INPUT,
  Simulation,
  rotateMap,
  type MapData,
  type PlayerInput,
  type QuarterTurns,
  type SimulationState,
} from "@supermaze/sim";
import { canSwitchTeam, makeRoomCode, shouldCountDown, startBlocker, teamForNewPlayer, type LobbyRules } from "./lobbyLogic.js";
import { loadMap } from "./mapLoader.js";

/** Lobby timings (CLAUDE.md 2.1). Server-side only, so they live here rather than in game tuning. */
const COUNTDOWN_MS = 10_000;
const RESULTS_MS = 15_000;
const QUICK_WAIT_MS = 60_000;

/**
 * One room lives through many matches: lobby -> countdown -> playing -> results
 * -> lobby. The lobby is plain room state; the match is an authoritative
 * Simulation created at start and dropped at the end.
 */
export class MazeRoom extends Room {
  override maxClients = DEFAULT_TUNING.round.maxParticipants;

  private mode: RoomMode = "quick";
  private code: string | null = null;
  private phase: LobbyPhase = "lobby";
  private hostId = "";
  private notice: string | null = null;
  private countdownEndsAt: number | null = null;
  private resultsEndAt: number | null = null;
  private readonly lobby = new Map<string, LobbyPlayer>();
  private readonly rules: LobbyRules = {
    minPlayers: DEFAULT_TUNING.round.minParticipants,
    maxPlayers: DEFAULT_TUNING.round.maxParticipants,
    maxTeamSizeDifference: DEFAULT_TUNING.teams.maxSizeDifference,
  };

  private baseMap!: MapData;
  private map: MapData | null = null;
  private sim: Simulation | null = null;
  private readonly latestInputs = new Map<string, PlayerInput>();
  private readonly lastSent = new Map<StateSection, string>();
  private countdownTimer: { clear(): void } | null = null;
  private resultsTimer: { clear(): void } | null = null;
  private quickWaitTimer: { clear(): void } | null = null;

  override async onCreate(options: { mode?: unknown; mapId?: unknown }): Promise<void> {
    this.mode = options.mode === "private" ? "private" : "quick";
    this.code = this.mode === "private" ? makeRoomCode() : null;
    await this.setMetadata({ mode: this.mode, code: this.code });
    this.baseMap = await loadMap(typeof options.mapId === "string" ? options.mapId : "maze-01");
    this.clock.start();

    this.onMessage<InputMessage>(C2S.input, (client, msg) => {
      this.latestInputs.set(client.sessionId, sanitizeInput(msg));
    });
    this.onMessage<PingMessage>(C2S.ping, (client, msg) => client.send(S2C.pong, msg));
    this.onMessage<{ ready?: unknown }>(C2S.ready, (client, msg) => {
      const p = this.lobby.get(client.sessionId);
      if (!p || !this.inLobby()) return;
      p.ready = typeof msg?.ready === "boolean" ? msg.ready : !p.ready;
      this.afterLobbyChange();
    });
    this.onMessage(C2S.switchTeam, (client) => {
      const p = this.lobby.get(client.sessionId);
      if (!p || !this.inLobby()) return;
      if (!canSwitchTeam([...this.lobby.values()], p.id, this.rules)) return;
      p.teamId = p.teamId === "A" ? "B" : "A";
      p.ready = false;
      this.afterLobbyChange();
    });
    this.onMessage(C2S.start, (client) => {
      if (client.sessionId !== this.hostId || this.mode !== "private" || !this.inLobby()) return;
      const blocker = startBlocker([...this.lobby.values()], this.rules, false);
      if (blocker) {
        this.notice = blocker;
        this.broadcastLobby();
        return;
      }
      this.beginCountdown(0);
    });

    this.armQuickWait();
  }

  override onJoin(client: Client, options?: { name?: unknown }): void {
    if (!this.inLobby()) {
      // The room is locked while playing; this is a safety net.
      client.leave(CloseCode.CONSENTED);
      return;
    }
    const players = [...this.lobby.values()];
    this.lobby.set(client.sessionId, {
      id: client.sessionId,
      name: sanitizeName(options?.name),
      teamId: teamForNewPlayer(players),
      ready: false,
      connected: true,
    });
    if (!this.hostId) this.hostId = client.sessionId;
    const welcome: WelcomeMessage = { protocolVersion: PROTOCOL_VERSION, playerId: client.sessionId };
    client.send(S2C.welcome, welcome);
    this.notice = null;
    this.afterLobbyChange();
  }

  override async onLeave(client: Client, code?: number): Promise<void> {
    this.latestInputs.delete(client.sessionId);
    const p = this.lobby.get(client.sessionId);
    if (!p) return;

    if (this.phase !== "playing") {
      this.lobby.delete(client.sessionId);
      this.reassignHost();
      this.afterLobbyChange();
      return;
    }

    // Mid-match: the player stays in the round under CPU control (CLAUDE.md section 2).
    p.connected = false;
    this.sim?.setController(client.sessionId, "cpu");
    this.broadcastLobby();
    if (code === CloseCode.CONSENTED) return; // left on purpose: no reconnection window
    try {
      const back = await this.allowReconnection(client, this.sim?.tuning.connection.reconnectWindowSec ?? 30);
      p.connected = true;
      this.sim?.setController(client.sessionId, "human");
      if (this.map && this.sim) {
        back.send(S2C.matchStarted, this.matchStartedMessage());
        this.sendFull(back);
      }
      this.broadcastLobby();
    } catch {
      // Window expired: stays CPU-controlled until the round ends.
    }
  }

  // ---- lobby -------------------------------------------------------------

  private inLobby(): boolean {
    return this.phase === "lobby" || this.phase === "countdown";
  }

  private reassignHost(): void {
    if (this.lobby.has(this.hostId)) return;
    this.hostId = this.lobby.keys().next().value ?? "";
  }

  /** Re-evaluate the countdown after any roster/ready change, then tell everyone. */
  private afterLobbyChange(): void {
    if (this.inLobby()) {
      const players = [...this.lobby.values()];
      const wanted = shouldCountDown(players, this.rules, this.mode);
      if (wanted && this.phase === "lobby") this.beginCountdown(COUNTDOWN_MS);
      else if (!wanted && this.phase === "countdown") this.cancelCountdown();
    }
    this.broadcastLobby();
  }

  private beginCountdown(ms: number): void {
    this.cancelCountdown();
    this.phase = "countdown";
    this.countdownEndsAt = Date.now() + ms;
    this.countdownTimer = this.clock.setTimeout(() => void this.startMatch(), ms);
    this.broadcastLobby();
  }

  private cancelCountdown(): void {
    this.countdownTimer?.clear();
    this.countdownTimer = null;
    this.countdownEndsAt = null;
    if (this.phase === "countdown") this.phase = "lobby";
  }

  /** Quick rooms that stay below the minimum for a minute tell players to give up (2.1). */
  private armQuickWait(): void {
    this.quickWaitTimer?.clear();
    if (this.mode !== "quick") return;
    this.quickWaitTimer = this.clock.setTimeout(() => {
      if (this.phase === "lobby" && [...this.lobby.values()].filter((p) => p.connected).length < this.rules.minPlayers) {
        this.notice = "等了一分鐘還沒有其他玩家，建議先退出稍後再試";
        this.broadcastLobby();
      }
    }, QUICK_WAIT_MS);
  }

  private lobbyMessage(): LobbyMessage {
    return {
      mode: this.mode,
      code: this.code,
      phase: this.phase,
      hostId: this.hostId,
      players: [...this.lobby.values()].map((p) => ({ ...p })),
      minPlayers: this.rules.minPlayers,
      maxPlayers: this.rules.maxPlayers,
      countdownEndsAt: this.countdownEndsAt,
      resultsEndAt: this.resultsEndAt,
      notice: this.notice,
    };
  }

  private broadcastLobby(): void {
    this.broadcast(S2C.lobby, this.lobbyMessage());
  }

  // ---- match -------------------------------------------------------------

  private async startMatch(): Promise<void> {
    if (this.phase !== "countdown") return;
    this.countdownTimer = null;
    this.countdownEndsAt = null;
    // Last check: someone may have left during the final tick of the countdown.
    const blocker = startBlocker([...this.lobby.values()], this.rules, false);
    if (blocker) {
      this.phase = "lobby";
      this.notice = blocker;
      this.afterLobbyChange();
      return;
    }
    await this.lock();
    this.phase = "playing";
    this.notice = null;
    const seed = Date.now() >>> 0;
    this.map = rotateMap(this.baseMap, (seed % 4) as QuarterTurns);
    this.sim = new Simulation({
      seed,
      map: this.map,
      participants: [...this.lobby.values()]
        .filter((p) => p.connected)
        .map((p) => ({ id: p.id, teamId: p.teamId, controller: "human" as const, name: p.name })),
    });
    this.sim.start();
    this.lastSent.clear();
    this.latestInputs.clear();
    this.broadcastLobby();
    this.broadcast(S2C.matchStarted, this.matchStartedMessage());
    for (const client of this.clients) this.sendFull(client);
    this.setSimulationInterval(() => this.tick(), 1000 / this.sim.tuning.tickRate);
  }

  private matchStartedMessage(): MatchStartedMessage {
    return { mapId: this.map?.id ?? this.baseMap.id, rotation: this.map?.rotation ?? 0, tickRate: DEFAULT_TUNING.tickRate };
  }

  private sendFull(client: Client): void {
    if (!this.sim) return;
    const full: FullStateMessage = { serverTime: Date.now(), state: this.sim.getState() };
    client.send(S2C.full, full);
  }

  private tick(): void {
    const sim = this.sim;
    if (!sim) return;
    const frame = new Map<string, PlayerInput>();
    for (const [id, p] of Object.entries(sim.getState().players)) {
      frame.set(id, p.controller === "human" ? (this.latestInputs.get(id) ?? NO_INPUT) : NO_INPUT);
    }
    sim.step(frame);
    this.broadcast(S2C.snapshot, this.deltaSnapshot(sim.getState()));
    if (sim.getState().status === "finished") this.endMatch();
  }

  private endMatch(): void {
    this.setSimulationInterval(undefined);
    this.phase = "results";
    this.resultsEndAt = Date.now() + RESULTS_MS;
    this.broadcastLobby();
    this.resultsTimer = this.clock.setTimeout(() => void this.backToLobby(), RESULTS_MS);
  }

  private async backToLobby(): Promise<void> {
    this.resultsTimer = null;
    this.resultsEndAt = null;
    this.sim = null;
    this.map = null;
    for (const [id, p] of [...this.lobby.entries()]) {
      if (!p.connected) this.lobby.delete(id);
      else p.ready = false;
    }
    this.reassignHost();
    this.phase = "lobby";
    this.notice = null;
    await this.unlock();
    this.armQuickWait();
    this.afterLobbyChange();
  }

  /**
   * Players every tick; any other section only when its serialised form changed
   * since the last broadcast. Stringifying ~3 KB per tick costs microseconds.
   */
  private deltaSnapshot(state: SimulationState): SnapshotMessage {
    const msg: SnapshotMessage = { serverTime: Date.now(), tick: state.tick, players: state.players };
    for (const section of SECTIONS) {
      const now = JSON.stringify(state[section]);
      if (this.lastSent.get(section) !== now) {
        this.lastSent.set(section, now);
        (msg as unknown as Record<string, unknown>)[section] = state[section];
      }
    }
    return msg;
  }
}

const SECTIONS: readonly StateSection[] = [
  "status",
  "startTick",
  "endsAtTick",
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

/** Display names are cosmetic but still untrusted: trim, cap the length, never empty. */
function sanitizeName(raw: unknown): string {
  const s = typeof raw === "string" ? raw.replace(/[\u0000-\u001f]/g, "").trim() : "";
  return (s || "玩家").slice(0, 12);
}

/** Never trust client numbers: clamp to the unit square and drop NaN. */
function sanitizeInput(msg: unknown): PlayerInput {
  const m = (msg ?? {}) as Partial<InputMessage>;
  const clamp = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
  const input: PlayerInput = { moveX: clamp(m.moveX), moveY: clamp(m.moveY) };
  if (m.action === true) input.action = true;
  return input;
}
