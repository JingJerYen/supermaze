import { capName, type LobbyMessage, type TeamMode } from "@supermaze/protocol";
import { isPremium } from "../monetize/premium.js";
import type { JoinRequest } from "../net/connection.js";
import { HOME_CSS, homeHtml } from "./homeScreen.js";
import { ONLINE_CSS, onlineAvailable, onlineHtml } from "./onlineScreen.js";

const CSS = `
.lb{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#101318;color:#fff;font-family:system-ui,-apple-system,"Noto Sans TC",sans-serif;z-index:30}
.lb *{box-sizing:border-box}
.lb-card{position:relative;width:min(720px,94vw);background:rgba(16,24,44,.9);border:1px solid rgba(140,170,230,.25);border-radius:16px;padding:22px 24px;box-shadow:0 12px 40px rgba(0,0,0,.5);backdrop-filter:blur(4px)}
.lb h1{font-size:22px;font-weight:500;margin:0 0 16px}
.lb-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:10px 0}
.lb input{height:40px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:#0f131c;color:#fff;padding:0 12px;font-size:16px}
.lb button{height:40px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;padding:0 16px;font-size:15px;cursor:pointer}
.lb button.primary{background:#ffd23f;color:#412402;border-color:#ffd23f;font-weight:500}
.lb button:disabled{opacity:.4;cursor:default}
.lb select{height:40px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;padding:0 10px;font-size:15px}
.lb-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px}
.lb-muted{font-size:13px;color:#c9d2e3}
.lb-big{font-size:22px;font-weight:500;letter-spacing:2px}
.lb-teams{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.lb-team{border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:12px}
.lb-team-h{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-weight:500}
.lb-dot{width:12px;height:12px;border-radius:50%;display:inline-block}
.lb-p{display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid rgba(255,255,255,.1);font-size:15px}
.lb-av{width:22px;height:22px;border-radius:5px;vertical-align:middle;margin-right:6px;background:#2a3450}
.lb-p.empty{color:#7f8899;font-size:13px}
.lb-ready{color:#8bff7a;font-size:12px}.lb-wait{color:#c9d2e3;font-size:12px}.lb-off{color:#ff9f7a;font-size:12px}
.lb button.on{background:rgba(255,210,63,.22);border-color:#ffd23f;color:#ffe08a}
.lb-solo{border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:12px}
.lb-notice{margin-top:12px;font-size:14px;color:#ffe08a;min-height:1.4em}
.lb-error{color:#ff8a8a}
`;

export interface LobbyUiHandlers {
  onJoin(req: JoinRequest): void;
  /** Single-player tower run against CPUs, run inside the page. */
  onTowerRun(): void;
  /** Open the online page (only when this build has online play). */
  onOnline(): void;
  /** Back to the home screen from the online page. */
  onHome(): void;
  /** Open the character setup (name and character). */
  onProfile(): void;
  /** Open the rules cards. */
  onRules(): void;
  /** Open the full version's page. */
  onStore(): void;
  onReady(ready: boolean): void;
  onSwitchTeam(): void;
  /** Private-room host: two teams or everyone for themselves. */
  onSetTeamMode(mode: TeamMode): void;
  onStart(): void;
  onLeave(): void;
}

const TEAM_COLOR: Record<string, string> = { A: "#ffb347", B: "#5ec8ff" };
const MODE_LABEL: Record<TeamMode, string> = { teams: "兩隊對戰", solo: "個人對戰" };

/** Home screen (name + quick/private) and the room lobby with two team columns. */
export class LobbyUi {
  private readonly root: HTMLDivElement;
  private readonly card: HTMLDivElement;
  private meId: string | null = null;
  private server = "";
  private lastMsg: LobbyMessage | null = null;
  private tickTimer: number | null = null;
  private faces = new Map<string, string>();

  constructor(parent: HTMLElement, private readonly handlers: LobbyUiHandlers) {
    const style = document.createElement("style");
    style.textContent = CSS + HOME_CSS + ONLINE_CSS;
    document.head.appendChild(style);
    this.root = document.createElement("div");
    this.root.className = "lb";
    this.card = document.createElement("div");
    this.card.className = "lb-card";
    this.root.appendChild(this.card);
    parent.appendChild(this.root);
  }

  setMe(id: string | null): void {
    this.meId = id;
  }

  show(): void {
    this.root.style.display = "flex";
  }
  hide(): void {
    this.root.style.display = "none";
    this.stopTicking();
  }

  /** Prefill for the server field on the home screen. */
  setServer(url: string): void {
    this.server = url;
  }

  /** Portraits by character, for the room lists. */
  setPortraits(faces: Map<string, string>): void {
    this.faces = faces;
  }

  /** `best` is the tower-run record shown next to its button. */
  showHome(profile: { name: string; character: string | null }, error?: string, best?: { score: number; floor: number } | null): void {
    const online = onlineAvailable();
    this.showPage(homeHtml({ name: profile.name, portrait: profile.character ? this.faces.get(profile.character) : undefined, error, best, premium: isPremium(), online }));
    this.card.querySelector("#lb-rules")!.addEventListener("click", () => this.handlers.onRules());
    this.card.querySelector("#lb-store")!.addEventListener("click", () => this.handlers.onStore());
    this.card.querySelector("#lb-profile")!.addEventListener("click", () => this.handlers.onProfile());
    this.card.querySelector("#lb-local")!.addEventListener("click", () => this.handlers.onTowerRun());
    this.card.querySelector("#lb-online")!.addEventListener("click", () => {
      if (online) this.handlers.onOnline();
      else this.setNotice("#lb-home-notice", "連線對戰即將推出，敬請期待！");
    });
  }

  /** Server field, quick match and private rooms; `error` is why the last try failed. */
  showOnline(profile: { name: string; character: string | null }, error?: string): void {
    this.showPage(onlineHtml(error));
    const name = () => capName(profile.name);
    const character = profile.character;
    const serverEl = this.card.querySelector<HTMLInputElement>("#lb-server")!;
    serverEl.value = this.server;
    const server = () => serverEl.value.trim();
    this.card.querySelector("#lb-quick")!.addEventListener("click", () => this.handlers.onJoin({ kind: "quick", name: name(), character, server: server() }));
    this.card.querySelector("#lb-create")!.addEventListener("click", () => this.handlers.onJoin({ kind: "create", name: name(), character, server: server() }));
    this.card.querySelector("#lb-back")!.addEventListener("click", () => this.handlers.onHome());
    this.card.querySelector("#lb-join")!.addEventListener("click", () => {
      const code = this.card.querySelector<HTMLInputElement>("#lb-code")!.value.trim().toUpperCase();
      if (code.length !== 4) {
        this.setNotice("#lb-online-notice", "請輸入四碼房間代碼");
        return;
      }
      this.handlers.onJoin({ kind: "join", name: name(), character, code, server: server() });
    });
  }

  /** The home and online pages: logo top left, panel on the painted background. */
  private showPage(panel: string): void {
    this.stopTicking();
    this.show();
    this.root.classList.add("home");
    this.card.className = "hm";
    this.card.innerHTML = panel;
  }

  private setNotice(selector: string, text: string): void {
    const el = this.card.querySelector(selector);
    if (!el) return;
    el.classList.remove("err");
    el.textContent = text;
  }

  private face(character: string | null | undefined): string {
    const src = character ? this.faces.get(character) : undefined;
    return src ? `<img class="lb-av" alt="" src="${src}">` : "";
  }

  showConnecting(text = "連線中..."): void {
    this.stopTicking();
    this.showCard();
    this.card.innerHTML = `<h1>迷宮高塔</h1><div class="lb-muted">${text}</div>`;
  }

  /** Render the room; called on every lobby message and once a second for the countdowns. */
  showLobby(msg: LobbyMessage): void {
    this.lastMsg = msg;
    this.showCard();
    const me = msg.players.find((p) => p.id === this.meId);
    const isHost = msg.hostId === this.meId;
    const connected = msg.players.filter((p) => p.connected).length;
    const now = Date.now();
    const lobbyOpen = msg.phase === "lobby" || msg.phase === "countdown";
    const teamsMode = msg.teamMode === "teams";
    let headline = msg.mode === "quick" ? `${connected} / ${msg.maxPlayers} 人，1 對 1` : `${connected} / ${msg.maxPlayers} 人，至少 ${msg.minPlayers} 人`;
    let big = "";
    if (msg.phase === "countdown" && msg.countdownEndsAt) big = `${Math.max(0, Math.ceil((msg.countdownEndsAt - now) / 1000))} 秒後開始`;
    else if (msg.phase === "results" && msg.resultsEndAt) big = `${Math.max(0, Math.ceil((msg.resultsEndAt - now) / 1000))} 秒後回到大廳`;
    else if (msg.phase === "playing") big = "比賽進行中";
    else headline += msg.mode === "quick" ? "，兩人到齊就開始" : isHost ? "，你是房主" : "，等房主開始";

    const team = (id: string, label: string) => {
      const members = msg.players.filter((p) => p.teamId === id);
      const rows = members
        .map((p) => {
          const state = !p.connected ? `<span class="lb-off">斷線</span>` : p.ready ? `<span class="lb-ready">準備好了</span>` : `<span class="lb-wait">未準備</span>`;
          const tags = [p.id === this.meId ? "（你）" : "", p.id === msg.hostId ? " 房主" : ""].join("");
          return `<div class="lb-p"><span>${this.face(p.character)}${escapeHtml(p.name)}${tags}</span>${state}</div>`;
        })
        .join("");
      const empty = `<div class="lb-p empty">空位</div>`.repeat(Math.max(0, Math.ceil(msg.maxPlayers / 2) - members.length));
      return `<div class="lb-team"><div class="lb-team-h"><span class="lb-dot" style="background:${TEAM_COLOR[id]}"></span>${label}<span class="lb-muted">${members.length} 人</span></div>${rows}${empty}</div>`;
    };

    const playerRow = (p: LobbyMessage["players"][number]) => {
      const state = !p.connected ? `<span class="lb-off">斷線</span>` : p.ready ? `<span class="lb-ready">準備好了</span>` : `<span class="lb-wait">未準備</span>`;
      const tags = [p.id === this.meId ? "（你）" : "", p.id === msg.hostId ? " 房主" : ""].join("");
      return `<div class="lb-p"><span>${this.face(p.character)}${escapeHtml(p.name)}${tags}</span>${state}</div>`;
    };
    const soloList = `<div class="lb-solo"><div class="lb-team-h">個人對戰<span class="lb-muted">每人一隊，依分數排名，沒有勝隊加成</span></div>${msg.players.map(playerRow).join("")}${`<div class="lb-p empty">空位</div>`.repeat(Math.max(0, msg.maxPlayers - msg.players.length))}</div>`;
    // Only a private room has a choice; its host switches, everyone else just sees the mode.
    const modeRow =
      msg.mode !== "private"
        ? ""
        : isHost
          ? `<div class="lb-row"><span class="lb-muted">模式</span>${(["teams", "solo"] as TeamMode[])
              .map((m) => `<button data-mode="${m}" class="lb-mode ${msg.teamMode === m ? "on" : ""}" ${lobbyOpen ? "" : "disabled"}>${MODE_LABEL[m]}</button>`)
              .join("")}<span class="lb-muted">${teamsMode ? "兩隊人數相同才能開始" : "2 到 6 人都能開始"}</span></div>`
          : `<div class="lb-row"><span class="lb-muted">模式：${MODE_LABEL[msg.teamMode]}${teamsMode ? "，兩隊人數相同才能開始" : ""}</span></div>`;

    this.card.innerHTML = `
      <div class="lb-head">
        <div><div class="lb-muted">${msg.mode === "private" ? "房間代碼" : "快速配對"}</div><div class="lb-big">${msg.code ?? ""}</div></div>
        <div style="text-align:right"><div class="lb-muted">${headline}</div><div class="lb-big">${big}</div></div>
      </div>
      ${modeRow}
      ${teamsMode ? `<div class="lb-teams">${team("A", "A 隊")}${team("B", "B 隊")}</div>` : soloList}
      <div class="lb-row" style="margin-top:14px">
        <button class="primary" id="lb-ready" ${lobbyOpen ? "" : "disabled"}>${me?.ready ? "取消準備" : "準備"}</button>
        ${teamsMode && msg.mode === "private" ? `<button id="lb-switch" ${lobbyOpen ? "" : "disabled"}>換隊</button>` : ""}
        ${isHost && msg.mode === "private" ? `<button id="lb-start" ${msg.phase === "lobby" ? "" : "disabled"}>開始</button>` : ""}
        <button id="lb-leave" style="margin-left:auto">離開</button>
      </div>
      <div class="lb-notice">${msg.notice ? escapeHtml(msg.notice) : ""}</div>`;
    this.card.querySelector("#lb-ready")!.addEventListener("click", () => this.handlers.onReady(!me?.ready));
    this.card.querySelector("#lb-switch")?.addEventListener("click", () => this.handlers.onSwitchTeam());
    for (const b of this.card.querySelectorAll<HTMLButtonElement>(".lb-mode")) {
      b.addEventListener("click", () => this.handlers.onSetTeamMode(b.dataset["mode"] === "solo" ? "solo" : "teams"));
    }
    this.card.querySelector("#lb-start")?.addEventListener("click", () => this.handlers.onStart());
    this.card.querySelector("#lb-leave")!.addEventListener("click", () => this.handlers.onLeave());

    if ((msg.phase === "countdown" || msg.phase === "results") && this.tickTimer === null) {
      this.tickTimer = window.setInterval(() => this.lastMsg && this.showLobby(this.lastMsg), 1000);
    } else if (msg.phase !== "countdown" && msg.phase !== "results") this.stopTicking();
  }

  /** Every screen but home: the centred card over the background. */
  private showCard(): void {
    this.show();
    this.root.classList.remove("home");
    this.card.className = "lb-card";
  }

  private stopTicking(): void {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
