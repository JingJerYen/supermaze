import type { SimulationState } from "@supermaze/sim";
import { TEAM_COLORS, teamColorIndex } from "../render/teamColors.js";

const CSS = `
.rs{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(6,8,14,.55);z-index:25;font-family:system-ui,-apple-system,"Noto Sans TC",sans-serif;color:#fff}
.rs *{box-sizing:border-box}
.rs-card{width:min(640px,94vw);max-height:92vh;overflow:auto;background:rgba(20,24,34,.96);border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:20px 22px}
.rs-title{font-size:clamp(24px,5vw,34px);font-weight:500;line-height:1.1;display:flex;align-items:center;gap:12px}
.rs-dot{width:16px;height:16px;border-radius:50%;display:inline-block;flex:none}
.rs-reason{font-size:14px;color:#c9d2e3;margin:6px 0 16px}
.rs table{width:100%;border-collapse:collapse;font-size:15px}
.rs th{font-size:12px;color:#c9d2e3;font-weight:400;text-align:left;padding:4px 8px;border-bottom:1px solid rgba(255,255,255,.15)}
.rs td{padding:8px;border-bottom:1px solid rgba(255,255,255,.08);white-space:nowrap}
.rs td.num,.rs th.num{text-align:right;font-variant-numeric:tabular-nums}
.rs tr.me td{background:rgba(255,255,255,.07)}
.rs tr.win td:first-child{border-left:3px solid #ffd23f}
.rs-rank{color:#ffe08a;font-weight:500;width:2em}
.rs-team{width:12px;height:12px;border-radius:50%;display:inline-block;margin-right:6px;vertical-align:-1px}
.rs-mult{color:#ffd23f;font-size:12px;margin-left:4px}
.rs-foot{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:16px;flex-wrap:wrap}
.rs-count{font-size:14px;color:#c9d2e3}
.rs button{height:40px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;padding:0 16px;font-size:15px;cursor:pointer}
.rs button.primary{background:#ffd23f;color:#412402;border-color:#ffd23f;font-weight:500}
`;

const REASON_TEXT: Record<string, string> = {
  allClimbed: "全員登頂",
  "timeout:climbed": "時間到，登塔人數較多",
  "timeout:score": "時間到，登塔人數相同，總分較高",
  "timeout:earlier": "時間到，人數與分數相同，較早達成",
  "timeout:draw": "時間到，完全平手",
};

export interface ResultsActions {
  /** Server clock (ms since epoch) when the room returns to the lobby, or null for the sandbox. */
  endsAt: number | null;
  buttons: { label: string; primary?: boolean; run: () => void }[];
}

/** End-of-round scoreboard: winner, reason, ranked players with multiplier, and what happens next. */
export class ResultsPanel {
  private readonly root: HTMLDivElement;
  private readonly card: HTMLDivElement;
  private shownFor: number | null = null;
  private tickTimer: number | null = null;
  private count: HTMLElement | null = null;
  private endsAt: number | null = null;

  constructor(parent: HTMLElement) {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement("div");
    this.root.className = "rs";
    this.root.style.display = "none";
    this.card = document.createElement("div");
    this.card.className = "rs-card";
    this.root.appendChild(this.card);
    parent.appendChild(this.root);
  }

  /** Idempotent per finished round; safe to call every frame. */
  update(state: SimulationState, meId: string | null, actions: ResultsActions): void {
    if (state.status !== "finished" || !state.result) {
      this.hide();
      return;
    }
    this.endsAt = actions.endsAt;
    if (this.shownFor === state.tick) {
      this.refreshCountdown();
      return;
    }
    this.shownFor = state.tick;
    this.render(state, meId, actions);
    this.root.style.display = "flex";
    if (this.tickTimer === null) this.tickTimer = window.setInterval(() => this.refreshCountdown(), 500);
  }

  private render(state: SimulationState, meId: string | null, actions: ResultsActions): void {
    const r = state.result!;
    const winner = r.winnerTeamId;
    const letters = "ABCDEFGH";
    const teamName = (id: string) => `${letters[teamColorIndex(id) % letters.length]} 隊`;
    const teamColor = (id: string) => `#${(TEAM_COLORS[teamColorIndex(id) % TEAM_COLORS.length] as number).toString(16).padStart(6, "0")}`;

    const rows = Object.values(state.players)
      .map((p) => ({ p, final: r.finalScores[p.id] ?? p.score }))
      .sort((a, b) => b.final - a.final || (a.p.towerArrival ?? 99) - (b.p.towerArrival ?? 99))
      .map(({ p, final }, i) => {
        const win = p.teamId === winner;
        const placement = p.phase === "tower" && p.towerArrival !== null ? `第 ${p.towerArrival + 1} 名登塔` : "未登塔";
        return `<tr class="${p.id === meId ? "me" : ""} ${win ? "win" : ""}">
          <td class="rs-rank">${i + 1}</td>
          <td><span class="rs-team" style="background:${teamColor(p.teamId)}"></span>${escapeHtml(p.name ?? p.id.slice(0, 6))}${p.id === meId ? "（你）" : ""}</td>
          <td>${placement}</td>
          <td class="num">${p.score}${win ? `<span class="rs-mult">×2</span>` : ""}</td>
          <td class="num"><strong>${final}</strong></td>
        </tr>`;
      })
      .join("");

    this.card.innerHTML = `
      <div class="rs-title">${winner ? `<span class="rs-dot" style="background:${teamColor(winner)}"></span>${teamName(winner)}獲勝` : "沒有獲勝隊伍"}</div>
      <div class="rs-reason">${REASON_TEXT[r.reason] ?? r.reason}</div>
      <table>
        <thead><tr><th></th><th>玩家</th><th>登塔</th><th class="num">分數</th><th class="num">最終</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="rs-foot"><span class="rs-count" id="rs-count"></span><span id="rs-buttons"></span></div>`;
    this.count = this.card.querySelector("#rs-count");
    const buttons = this.card.querySelector("#rs-buttons")!;
    for (const b of actions.buttons) {
      const el = document.createElement("button");
      el.textContent = b.label;
      if (b.primary) el.className = "primary";
      el.addEventListener("click", b.run);
      buttons.appendChild(el);
    }
    this.refreshCountdown();
  }

  private refreshCountdown(): void {
    if (!this.count) return;
    if (this.endsAt === null) {
      this.count.textContent = "";
      return;
    }
    const s = Math.max(0, Math.ceil((this.endsAt - Date.now()) / 1000));
    this.count.textContent = `${s} 秒後回到大廳`;
  }

  hide(): void {
    if (this.root.style.display !== "none") this.root.style.display = "none";
    this.shownFor = null;
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  dispose(): void {
    this.hide();
    this.root.remove();
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
