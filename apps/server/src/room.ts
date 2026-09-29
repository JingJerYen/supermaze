import { CloseCode, Room, type Client } from "@colyseus/core";
import {
  C2S,
  InputQueue,
  PROTOCOL_VERSION,
  S2C,
  SnapshotDelta,
  type AckMessage,
  type DebugMessage,
  type FullStateMessage,
  type InputMessage,
  type LobbyMessage,
  type LobbyPhase,
  type LobbyPlayer,
  type MatchStartedMessage,
  type PingMessage,
  type RoomMode,
  type SetTeamModeMessage,
  type WelcomeMessage,
  capName,
} from "@supermaze/protocol";
import {
  DEFAULT_TUNING,
  NO_INPUT,
  CpuController,
  Simulation,
  pickMap,
  rotateMap,
  type MapData,
  type PlayerInput,
  type QuarterTurns,
  type SimulationState,
} from "@supermaze/sim";
import { canSwitchTeam, makeRoomCode, rulesFor, shouldCountDown, startBlocker, teamForNewPlayer, type LobbyRules } from "./lobbyLogic.js";
import { loadMap, loadMapPool } from "./mapLoader.js";

/** Developer commands (force a ghost event, ...). On unless the server runs with SUPERMAZE_DEBUG=0. */
const DEBUG_COMMANDS = process.env["SUPERMAZE_DEBUG"] !== "0";

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
  private rules: LobbyRules = rulesFor("quick", "solo", DEFAULT_TUNING.round.maxParticipants);

  /** Maps this room may draw from; validated when the room was created. */
  private pool: MapData[] = [];
  private map: MapData | null = null;
  private sim: Simulation | null = null;
  /** Drives cpu-controlled players (dropped humans) with the sim's own CPU. */
  private cpu: CpuController | null = null;
  /** Each client's inputs waiting to be applied, in order, one per tick. */
  private readonly inputQueues = new Map<string, InputQueue>();
  /** Last acknowledgement sent to each client, so an unchanged one is not sent again. */
  private readonly ackSent = new Map<string, number>();
  /** What this match last broadcast; a fresh one per match. */
  private delta = new SnapshotDelta();
  private countdownTimer: { clear(): void } | null = null;
  private resultsTimer: { clear(): void } | null = null;
  private quickWaitTimer: { clear(): void } | null = null;

  override async onCreate(options: { mode?: unknown; mapId?: unknown }): Promise<void> {
    this.mode = options.mode === "private" ? "private" : "quick";
    this.code = this.mode === "private" ? makeRoomCode() : null;
    this.rules = rulesFor(this.mode, "teams", DEFAULT_TUNING.round.maxParticipants);
    this.maxClients = this.rules.maxPlayers;
    await this.setMetadata({ mode: this.mode, code: this.code });
    // Every round draws its map from the pool (section 6). A room created with an
    // explicit mapId (scripted checks) plays that map only.
    this.pool = typeof options.mapId === "string" ? [await loadMap(options.mapId)] : await loadMapPool();
    if (this.pool.length === 0) throw new Error("no playable map in content/maps");
    this.clock.start();

    this.onMessage<InputMessage>(C2S.input, (client, msg) => {
      let queue = this.inputQueues.get(client.sessionId);
      if (!queue) this.inputQueues.set(client.sessionId, (queue = new InputQueue()));
      queue.push(sanitizeInput(msg));
    });
    this.onMessage<PingMessage>(C2S.ping, (client, msg) => client.send(S2C.pong, msg));
    this.onMessage<DebugMessage>(C2S.debug, (_client, msg) => {
      if (!DEBUG_COMMANDS || !this.sim) return;
      if (msg?.cmd === "ghost") this.sim.debugForceGhost();
    });
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
    this.onMessage<SetTeamModeMessage>(C2S.setTeamMode, (client, msg) => {
      if (client.sessionId !== this.hostId || this.mode !== "private" || !this.inLobby()) return;
      const teamMode = msg?.teamMode === "solo" ? "solo" : "teams";
      if (teamMode === this.rules.teamMode) return;
      this.rules = rulesFor(this.mode, teamMode, DEFAULT_TUNING.round.maxParticipants);
      for (const p of this.lobby.values()) p.ready = false;
      this.notice = null;
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
    this.inputQueues.delete(client.sessionId);
    this.ackSent.delete(client.sessionId);
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
      teamMode: this.rules.teamMode,
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
    const seed = Date.now() >>> 0;
    const participants = [...this.lobby.values()]
      .filter((p) => p.connected)
      .map((p) => ({ id: p.id, teamId: p.teamId, controller: "human" as const, name: p.name }));
    const drawn = pickMap(this.pool, participants.length, seed);
    if (!drawn) {
      this.phase = "lobby";
      this.notice = `沒有支援 ${participants.length} 人的地圖`;
      this.afterLobbyChange();
      return;
    }
    await this.lock();
    this.phase = "playing";
    this.notice = null;
    this.map = rotateMap(drawn, (seed % 4) as QuarterTurns);
    this.sim = new Simulation({ seed, map: this.map, teamMode: this.rules.teamMode, participants });
    this.sim.start();
    this.cpu = new CpuController(this.sim, seed + 1);
    this.delta = new SnapshotDelta();
    this.inputQueues.clear();
    this.ackSent.clear();
    this.broadcastLobby();
    this.broadcast(S2C.matchStarted, this.matchStartedMessage());
    for (const client of this.clients) this.sendFull(client);
    this.setSimulationInterval(() => this.tick(), 1000 / this.sim.tuning.tickRate);
  }

  private matchStartedMessage(): MatchStartedMessage {
    return { mapId: this.map?.id ?? this.pool[0]?.id ?? "", rotation: this.map?.rotation ?? 0, tickRate: DEFAULT_TUNING.tickRate };
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
      frame.set(id, p.controller === "human" ? (this.inputQueues.get(id)?.take() ?? NO_INPUT) : (this.cpu?.input(id) ?? NO_INPUT));
    }
    sim.step(frame);
    this.broadcast(S2C.snapshot, this.delta.next(sim.getState(), Date.now()));
    // After the state, tell each client which of its inputs that state includes.
    for (const client of this.clients) {
      const acked = this.inputQueues.get(client.sessionId)?.acked ?? 0;
      if (acked === 0 || this.ackSent.get(client.sessionId) === acked) continue;
      this.ackSent.set(client.sessionId, acked);
      client.send(S2C.ack, { seq: acked } satisfies AckMessage);
    }
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
    this.cpu = null;
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
}

/** Display names are cosmetic but still untrusted: trim, cap the length, never empty. */
function sanitizeName(raw: unknown): string {
  const s = typeof raw === "string" ? raw.replace(/[\u0000-\u001f]/g, "").trim() : "";
  return capName(s || "玩家");
}

/** Never trust client numbers: clamp to the unit square and drop NaN. */
function sanitizeInput(msg: unknown): InputMessage {
  const m = (msg ?? {}) as Partial<InputMessage>;
  const clamp = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
  const input: InputMessage = { moveX: clamp(m.moveX), moveY: clamp(m.moveY) };
  if (typeof m.seq === "number" && Number.isInteger(m.seq) && m.seq > 0) input.seq = m.seq;
  if (m.action === true) input.action = true;
  if (m.discard === true) input.discard = true;
  return input;
}
