import type { LobbyMessage } from "@supermaze/protocol";
import type { JoinRequest } from "../net/connection.js";

const CSS = `
.lb{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#101318;color:#fff;font-family:system-ui,-apple-system,"Noto Sans TC",sans-serif;z-index:30}
.lb *{box-sizing:border-box}
.lb-card{width:min(720px,94vw);background:#1b2030;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:22px 24px}
.lb h1{font-size:22px;font-weight:500;margin:0 0 16px}
.lb-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:10px 0}
.lb input{height:40px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:#0f131c;color:#fff;padding:0 12px;font-size:16px}
.lb button{height:40px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;padding:0 16px;font-size:15px;cursor:pointer}
.lb button.primary{background:#ffd23f;color:#412402;border-color:#ffd23f;font-weight:500}
.lb button:disabled{opacity:.4;cursor:default}
.lb-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px}
.lb-muted{font-size:13px;color:#c9d2e3}
.lb-big{font-size:22px;font-weight:500;letter-spacing:2px}
.lb-teams{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.lb-team{border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:12px}
.lb-team-h{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-weight:500}
.lb-dot{width:12px;height:12px;border-radius:50%;display:inline-block}
.lb-p{display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid rgba(255,255,255,.1);font-size:15px}
.lb-p.empty{color:#7f8899;font-size:13px}
.lb-ready{color:#8bff7a;font-size:12px}.lb-wait{color:#c9d2e3;font-size:12px}.lb-off{color:#ff9f7a;font-size:12px}
.lb-notice{margin-top:12px;font-size:14px;color:#ffe08a;min-height:1.4em}
.lb-error{color:#ff8a8a}
`;

export interface LobbyUiHandlers {
  onJoin(req: JoinRequest): void;
  onReady(ready: boolean): void;
  onSwitchTeam(): void;
  onStart(): void;
  onLeave(): void;
}

const TEAM_COLOR: Record<string, string> = { A: "#ffb347", B: "#5ec8ff" };

/** Home screen (name + quick/private) and the room lobby with two team columns. */
export class LobbyUi {
  private readonly root: HTMLDivElement;
  private readonly card: HTMLDivElement;
  private meId: string | null = null;
  private lastMsg: LobbyMessage | null = null;
  private tickTimer: number | null = null;

  constructor(parent: HTMLElement, private readonly handlers: LobbyUiHandlers) {
    const style = document.createElement("style");
    style.textContent = CSS;
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

  showHome(defaultName: string, error?: string): void {
    this.stopTicking();
    this.show();
    this.card.innerHTML = `
      <h1>Super Maze</h1>
      <div class="lb-row"><label class="lb-muted">暱稱</label><input id="lb-name" maxlength="12" placeholder="你的暱稱" /></div>
      <div class="lb-row">
        <button class="primary" id="lb-quick">快速配對</button>
        <button id="lb-create">建立私人房</button>
      </div>
      <div class="lb-row">
        <input id="lb-code" maxlength="4" placeholder="房間代碼" style="width:9em;text-transform:uppercase" />
        <button id="lb-join">加入私人房</button>
      </div>
      <div class="lb-notice ${error ? "lb-error" : ""}" id="lb-home-notice">${error ?? "同一個伺服器上的朋友輸入四碼代碼就能加入你的私人房"}</div>`;
    const nameEl = this.card.querySelector<HTMLInputElement>("#lb-name")!;
    nameEl.value = defaultName;
    const name = () => nameEl.value.trim() || defaultName;
    this.card.querySelector("#lb-quick")!.addEventListener("click", () => this.handlers.onJoin({ kind: "quick", name: name() }));
    this.card.querySelector("#lb-create")!.addEventListener("click", () => this.handlers.onJoin({ kind: "create", name: name() }));
    this.card.querySelector("#lb-join")!.addEventListener("click", () => {
      const code = this.card.querySelector<HTMLInputElement>("#lb-code")!.value.trim().toUpperCase();
      if (code.length !== 4) {
        this.card.querySelector("#lb-home-notice")!.textContent = "請輸入四碼房間代碼";
        return;
      }
      this.handlers.onJoin({ kind: "join", name: name(), code });
    });
  }

  showConnecting(text = "連線中..."): void {
    this.stopTicking();
    this.show();
    this.card.innerHTML = `<h1>Super Maze</h1><div class="lb-muted">${text}</div>`;
  }

  /** Render the room; called on every lobby message and once a second for the countdowns. */
  showLobby(msg: LobbyMessage): void {
    this.lastMsg = msg;
    this.show();
    const me = msg.players.find((p) => p.id === this.meId);
    const isHost = msg.hostId === this.meId;
    const connected = msg.players.filter((p) => p.connected).length;
    const now = Date.now();
    let headline = `${connected} / ${msg.maxPlayers} 人，至少 ${msg.minPlayers} 人`;
    let big = "";
    if (msg.phase === "countdown" && msg.countdownEndsAt) big = `${Math.max(0, Math.ceil((msg.countdownEndsAt - now) / 1000))} 秒後開始`;
    else if (msg.phase === "results" && msg.resultsEndAt) big = `${Math.max(0, Math.ceil((msg.resultsEndAt - now) / 1000))} 秒後回到大廳`;
    else if (msg.phase === "playing") big = "比賽進行中";
    else headline += msg.mode === "quick" ? "，全員準備後倒數開始" : isHost ? "，你是房主" : "，等房主開始";

    const team = (id: string, label: string) => {
      const members = msg.players.filter((p) => p.teamId === id);
      const rows = members
        .map((p) => {
          const state = !p.connected ? `<span class="lb-off">斷線</span>` : p.ready ? `<span class="lb-ready">準備好了</span>` : `<span class="lb-wait">未準備</span>`;
          const tags = [p.id === this.meId ? "（你）" : "", p.id === msg.hostId ? " 房主" : ""].join("");
          return `<div class="lb-p"><span>${escapeHtml(p.name)}${tags}</span>${state}</div>`;
        })
        .join("");
      const empty = `<div class="lb-p empty">空位</div>`.repeat(Math.max(0, Math.ceil(msg.maxPlayers / 2) - members.length));
      return `<div class="lb-team"><div class="lb-team-h"><span class="lb-dot" style="background:${TEAM_COLOR[id]}"></span>${label}<span class="lb-muted">${members.length} 人</span></div>${rows}${empty}</div>`;
    };

    this.card.innerHTML = `
      <div class="lb-head">
        <div><div class="lb-muted">${msg.mode === "private" ? "房間代碼" : "快速配對"}</div><div class="lb-big">${msg.code ?? ""}</div></div>
        <div style="text-align:right"><div class="lb-muted">${headline}</div><div class="lb-big">${big}</div></div>
      </div>
      <div class="lb-teams">${team("A", "A 隊")}${team("B", "B 隊")}</div>
      <div class="lb-row" style="margin-top:14px">
        <button class="primary" id="lb-ready" ${msg.phase === "lobby" || msg.phase === "countdown" ? "" : "disabled"}>${me?.ready ? "取消準備" : "準備"}</button>
        <button id="lb-switch" ${msg.phase === "lobby" || msg.phase === "countdown" ? "" : "disabled"}>換隊</button>
        ${isHost && msg.mode === "private" ? `<button id="lb-start" ${msg.phase === "lobby" ? "" : "disabled"}>開始</button>` : ""}
        <button id="lb-leave" style="margin-left:auto">離開</button>
      </div>
      <div class="lb-notice">${msg.notice ? escapeHtml(msg.notice) : ""}</div>`;
    this.card.querySelector("#lb-ready")!.addEventListener("click", () => this.handlers.onReady(!me?.ready));
    this.card.querySelector("#lb-switch")!.addEventListener("click", () => this.handlers.onSwitchTeam());
    this.card.querySelector("#lb-start")?.addEventListener("click", () => this.handlers.onStart());
    this.card.querySelector("#lb-leave")!.addEventListener("click", () => this.handlers.onLeave());

    if ((msg.phase === "countdown" || msg.phase === "results") && this.tickTimer === null) {
      this.tickTimer = window.setInterval(() => this.lastMsg && this.showLobby(this.lastMsg), 1000);
    } else if (msg.phase !== "countdown" && msg.phase !== "results") this.stopTicking();
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
