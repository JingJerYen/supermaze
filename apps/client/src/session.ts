import type * as THREE from "three";
import type { LobbyMessage, MatchStartedMessage } from "@supermaze/protocol";
import { rotateMap } from "@supermaze/sim";
import { LobbyUi } from "./lobby/lobbyUi.js";
import { loadMapById } from "./maps.js";
import { Match } from "./match.js";
import { OnlineMatchMode } from "./modes/online.js";
import { loadTowerBest, TowerRun } from "./modes/towerRun.js";
import { Connection, ConnectTimeout, type JoinRequest } from "./net/connection.js";
import { RulesScreen } from "./rules/rulesScreen.js";

/**
 * Online flow: home -> room lobby -> match -> results -> lobby, on one socket.
 * Owns the connection and swaps the Match on screen as the room changes phase.
 */
export class Session {
  private readonly ui: LobbyUi;
  private readonly conn: Connection;
  private meId: string | null = null;
  private match: Match | null = null;
  private rules: RulesScreen | null = null;
  private towerRun: TowerRun | null = null;
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
      onTowerRun: (name) => this.playTowerRun(name),
      onRules: () => this.showRules(),
      onReady: (ready) => this.conn.setReady(ready),
      onSwitchTeam: () => this.conn.switchTeam(),
      onSetTeamMode: (mode) => this.conn.setTeamMode(mode),
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
      onAck: (m, at) => this.matchMode?.applyAck(m.seq, at),
      onPong: (m, at) => {
        if (this.matchMode) this.matchMode.rttMs = at - m.t;
      },
      onLeave: (code) => this.onDisconnected(code),
    });
  }

  async start(): Promise<void> {
    this.ui.setServer(this.conn.getEndpoint());
    this.ui.showConnecting("嘗試接回上一場...");
    if (await this.conn.tryReconnect()) {
      this.startPing();
      return; // lobby / matchStarted / full will arrive and drive the UI
    }
    this.showHome(this.defaultName);
  }

  /** Rules cards over demo scenes; closing returns to the home screen. */
  private showRules(): void {
    this.teardownMatch();
    this.ui.hide();
    this.rules = new RulesScreen(this.root, this.renderer, () => {
      this.rules?.dispose();
      this.rules = null;
      this.showHome(this.defaultName);
    });
  }

  /** Single-player tower run in the page: no socket involved; quitting leads back here. */
  private playTowerRun(name: string): void {
    this.teardownMatch();
    this.ui.hide();
    this.towerRun = new TowerRun(this.root, this.renderer, name, (notice) => {
      this.teardownMatch();
      this.showHome(name, notice);
    });
    this.towerRun.start();
  }

  private showHome(name: string, notice?: string): void {
    this.ui.showHome(name, notice, loadTowerBest());
  }

  private async join(req: JoinRequest): Promise<void> {
    if (req.server) {
      const url = normalizeServerUrl(req.server);
      this.conn.setEndpoint(url);
      this.ui.setServer(url);
      try {
        localStorage.setItem("supermaze.server", url);
      } catch {
        /* storage unavailable */
      }
    }
    const endpoint = this.conn.getEndpoint();
    this.ui.showConnecting(`連線中... ${endpoint}`);
    try {
      await this.conn.connect(req);
      this.startPing();
    } catch (e) {
      const local = `ws://${location.hostname}:2567`;
      const hint = endpoint === local ? "請確認伺服器已啟動（npm run dev）" : `若伺服器在這台電腦上，請把伺服器欄位改成 ${local}`;
      if (e instanceof ConnectTimeout) this.ui.showHome(req.name, `連不上伺服器 ${endpoint}。${hint}`);
      else if (req.kind === "join") this.ui.showHome(req.name, `找不到房間 ${req.code}，請確認代碼`);
      else this.ui.showHome(req.name, `無法連線到 ${endpoint}：${(e as Error).message ?? String(e)}。${hint}`);
    }
  }

  private async leave(): Promise<void> {
    await this.conn.leave();
    this.teardownMatch();
    this.showHome(this.defaultName);
  }

  private onLobby(m: LobbyMessage): void {
    this.lastLobby = m;
    if (m.phase === "playing") {
      // Match view stays up; nothing to show in the lobby.
      this.ui.hide();
      return;
    }
    if (m.phase === "results") {
      // The match's results panel stays up and shows the return countdown.
      this.ui.hide();
      if (this.matchMode) this.matchMode.resultsEndAt = m.resultsEndAt;
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
    // ?predict=0 turns the prediction of your own movement off, to compare or to chase a bug.
    const predict = new URLSearchParams(location.search).get("predict") !== "0";
    this.matchMode = new OnlineMatchMode(map, m.tickRate, this.meId, (input) => this.conn.sendInput(input), { predict });
    this.matchMode.onLeaveRoom = () => void this.leave();
    this.matchMode.onDebug = (cmd) => this.conn.sendDebug(cmd);
    this.match = new Match(this.root, this.renderer, this.matchMode);
    this.pendingStart = null;
  }

  private teardownMatch(): void {
    this.towerRun?.dispose();
    this.towerRun = null;
    this.match?.dispose();
    this.match = null;
    this.matchMode = null;
  }

  private onDisconnected(code: number): void {
    this.stopPing();
    this.teardownMatch();
    this.showHome(this.defaultName, code === 4000 ? undefined : `連線中斷（代碼 ${code}）`);
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

/**
 * Accept what people paste: a bare host, an http(s) URL (as printed by
 * cloudflared) or a ws(s) URL. An https page may only use wss.
 */
export function normalizeServerUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(url)) url = url.replace(/^http/i, "ws");
  else if (!/^wss?:\/\//i.test(url)) url = `${location.protocol === "https:" ? "wss" : "ws"}://${url}`;
  return url;
}
