import type * as THREE from "three";
import type { LobbyMessage, MatchStartedMessage } from "@supermaze/protocol";
import { rotateMap } from "@supermaze/sim";
import { t } from "./i18n/index.js";
import { CharacterSetup } from "./lobby/characterSetup.js";
import { LobbyUi } from "./lobby/lobbyUi.js";
import { onlineAvailable } from "./lobby/onlineScreen.js";
import { loadProfile, portraits } from "./profile.js";
import { loadMapById } from "./maps.js";
import { Match } from "./match.js";
import { OnlineMatchMode } from "./modes/online.js";
import { TowerRun } from "./modes/towerRun.js";
import { isNewPlayer, loadTowerBest } from "./modes/towerProgress.js";
import { StoreScreen } from "./lobby/storeScreen.js";
import { AchievementsScreen } from "./lobby/achievementsScreen.js";
import { SettingsScreen } from "./lobby/settingsScreen.js";
import { Connection, ConnectTimeout, type JoinRequest } from "./net/connection.js";
import { RulesScreen } from "./rules/rulesScreen.js";

/**
 * Online flow: home -> online page -> room lobby -> match -> results -> lobby, on one socket.
 * Owns the connection and swaps the Match on screen as the room changes phase.
 */
export class Session {
  private readonly ui: LobbyUi;
  private readonly conn: Connection;
  private meId: string | null = null;
  private match: Match | null = null;
  private rules: RulesScreen | null = null;
  private towerRun: TowerRun | null = null;
  private profileScreen: CharacterSetup | null = null;
  private store: StoreScreen | null = null;
  private achievements: AchievementsScreen | null = null;
  private settings: SettingsScreen | null = null;
  private matchMode: OnlineMatchMode | null = null;
  private pendingStart: MatchStartedMessage | null = null;
  private lastLobby: LobbyMessage | null = null;
  private pingTimer: number | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly renderer: THREE.WebGLRenderer,
    endpoint: string,
  ) {
    this.ui = new LobbyUi(root, {
      onJoin: (req) => void this.join(req),
      onTowerRun: () => (isNewPlayer() ? this.showRules(() => this.playTowerRun()) : this.playTowerRun()),
      onOnline: () => this.showOnline(),
      onHome: () => this.showHome(),
      onProfile: () => this.showProfile(),
      onRules: () => this.showRules(),
      onStore: () => this.showStore(),
      onAchievements: () => this.showAchievements(),
      onSettings: () => this.showSettings(),
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
    if (!onlineAvailable()) {
      this.showHome();
      return;
    }
    this.ui.showConnecting(t("lobby.connecting.rejoin"));
    if (await this.conn.tryReconnect()) {
      this.startPing();
      return; // lobby / matchStarted / full will arrive and drive the UI
    }
    this.showHome();
  }

  /**
   * Rules cards over demo scenes; closing returns to the home screen. `then`
   * (a new player's first tower run) adds a button that goes on to it.
   */
  private showRules(then?: () => void): void {
    this.teardownMatch();
    this.ui.hide();
    const close = () => {
      this.rules?.dispose();
      this.rules = null;
    };
    this.rules = new RulesScreen(
      this.root,
      this.renderer,
      () => {
        close();
        this.showHome();
      },
      then &&
        (() => {
          close();
          then();
        }),
    );
  }

  /** Single-player tower run in the page: no socket involved; quitting leads back here. */
  /** Character setup (name and character); done returns to the home screen. */
  private showProfile(): void {
    this.teardownMatch();
    this.ui.hide();
    this.profileScreen = new CharacterSetup(this.root, this.renderer, () => {
      this.profileScreen?.dispose();
      this.profileScreen = null;
      this.showHome();
    });
  }

  /** The full version's page; back returns to the home screen. */
  private showStore(): void {
    this.teardownMatch();
    this.ui.hide();
    this.store = new StoreScreen(this.root, this.renderer, loadProfile(), () => {
      this.store?.dispose();
      this.store = null;
      this.showHome();
    });
  }

  /** Every achievement, lit or not; back returns to the home screen. */
  private showAchievements(): void {
    this.teardownMatch();
    this.ui.hide();
    this.achievements = new AchievementsScreen(this.root, this.renderer, loadProfile(), () => {
      this.achievements?.dispose();
      this.achievements = null;
      this.showHome();
    });
  }

  /** Touch controls and other per-device choices; back returns to the home screen. */
  private showSettings(): void {
    this.teardownMatch();
    this.ui.hide();
    this.settings = new SettingsScreen(this.root, this.renderer, loadProfile(), () => {
      this.settings?.dispose();
      this.settings = null;
      this.showHome();
    });
  }

  private playTowerRun(): void {
    this.teardownMatch();
    this.ui.hide();
    this.towerRun = new TowerRun(this.root, this.renderer, (notice) => {
      this.teardownMatch();
      this.showHome(notice);
    });
    this.towerRun.start();
  }

  private showHome(notice?: string): void {
    this.ui.setPortraits(portraits(this.renderer));
    this.ui.showHome(loadProfile(), notice, loadTowerBest());
  }

  /** The online page; `notice` is why the last connection failed or ended. */
  private showOnline(notice?: string): void {
    this.ui.showOnline(loadProfile(), notice);
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
    this.ui.showConnecting(t("lobby.connecting.server", { server: endpoint }));
    try {
      await this.conn.connect(req);
      this.startPing();
    } catch (e) {
      // Players see one short line; the details go to the console for whoever debugs it.
      console.warn(`connect to ${endpoint} failed`, e);
      // The server answered and turned the join down: the code matched no open room.
      const refused = !(e instanceof ConnectTimeout) && e instanceof Error && e.name === "ServerError";
      this.showOnline(req.kind === "join" && refused ? t("lobby.online.noRoom", { code: req.code.toUpperCase() }) : t("lobby.online.badServer"));
    }
  }

  private async leave(): Promise<void> {
    await this.conn.leave();
    this.teardownMatch();
    this.showOnline();
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
    if (code !== 4000) console.warn(`disconnected, code ${code}`);
    this.showOnline(code === 4000 ? undefined : t("lobby.online.lost"));
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
