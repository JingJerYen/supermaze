import type * as THREE from "three";
import type { LobbyMessage, MatchStartedMessage } from "@supermaze/protocol";
import { rotateMap } from "@supermaze/sim";
import { LobbyUi } from "./lobby/lobbyUi.js";
import { loadMapById } from "./maps.js";
import { Match } from "./match.js";
import { OnlineMatchMode } from "./modes/online.js";
import { Connection, type JoinRequest } from "./net/connection.js";

/**
 * Online flow: home -> room lobby -> match -> results -> lobby, on one socket.
 * Owns the connection and swaps the Match on screen as the room changes phase.
 */
export class Session {
  private readonly ui: LobbyUi;
  private readonly conn: Connection;
  private meId: string | null = null;
  private match: Match | null = null;
  private matchMode: OnlineMatchMode | null = null;
  private pendingStart: MatchStartedMessage | null = null;
  private lastLobby: LobbyMessage | null = null;
  private pingTimer: number | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly renderer: THREE.WebGLRenderer,
    endpoint: string,
    private readonly defaultName: string,
  ) {
    this.ui = new LobbyUi(root, {
      onJoin: (req) => void this.join(req),
      onReady: (ready) => this.conn.setReady(ready),
      onSwitchTeam: () => this.conn.switchTeam(),
      onStart: () => this.conn.requestStart(),
      onLeave: () => void this.leave(),
    });
    this.conn = new Connection(endpoint, {
      onWelcome: (m) => {
        this.meId = m.playerId;
        this.ui.setMe(m.playerId);
      },
      onLobby: (m) => this.onLobby(m),
      onMatchStarted: (m) => this.onMatchStarted(m),
      onFull: (m, at) => {
        if (!this.matchMode && this.pendingStart) this.buildMatch(this.pendingStart);
        this.matchMode?.applyFull(m.state, at);
      },
      onSnapshot: (m, at) => this.matchMode?.applyDelta(m, at),
      onPong: (m, at) => {
        if (this.matchMode) this.matchMode.rttMs = at - m.t;
      },
      onLeave: (code) => this.onDisconnected(code),
    });
  }

  async start(): Promise<void> {
    this.ui.showConnecting("嘗試接回上一場...");
    if (await this.conn.tryReconnect()) {
      this.startPing();
      return; // lobby / matchStarted / full will arrive and drive the UI
    }
    this.ui.showHome(this.defaultName);
  }

  private async join(req: JoinRequest): Promise<void> {
    this.ui.showConnecting();
    try {
      await this.conn.connect(req);
      this.startPing();
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      this.ui.showHome(req.name, req.kind === "join" ? `找不到房間 ${req.code}，請確認代碠` : `無法連線：${msg}`);
    }
  }

  private async leave(): Promise<void> {
    await this.conn.leave();
    this.teardownMatch();
    this.ui.showHome(this.defaultName);
  }

  private onLobby(m: LobbyMessage): void {
    this.lastLobby = m;
    if (m.phase === "playing") {
      // Match view stays up; nothing to show in the lobby.
      this.ui.hide();
      return;
    }
    if (m.phase === "results") {
      // Keep the round banner visible under a small lobby card countdown.
      this.ui.showLobby(m);
      return;
    }
    this.teardownMatch();
    this.ui.showLobby(m);
  }

  private onMatchStarted(m: MatchStartedMessage): void {
    this.pendingStart = m;
    this.teardownMatch();
    this.buildMatch(m);
    this.ui.hide();
  }

  private buildMatch(m: MatchStartedMessage): void {
    if (!this.meId) return;
    const map = rotateMap(loadMapById(m.mapId), m.rotation);
    this.matchMode = new OnlineMatchMode(map, m.tickRate, this.meId, (input) => this.conn.sendInput(input));
    this.match = new Match(this.root, this.renderer, this.matchMode);
    this.pendingStart = null;
  }

  private teardownMatch(): void {
    this.match?.dispose();
    this.match = null;
    this.matchMode = null;
  }

  private onDisconnected(code: number): void {
    this.stopPing();
    this.teardownMatch();
    this.ui.showHome(this.defaultName, code === 4000 ? undefined : `連線中斷（代碼 ${code}）`);
    void this.lastLobby;
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = window.setInterval(() => this.conn.ping(), 1000);
  }
  private stopPing(): void {
    if (this.pingTimer !== null) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }
}
