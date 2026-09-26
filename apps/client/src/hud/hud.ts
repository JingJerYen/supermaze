import { TEAM_COLORS } from "../render/teamColors.js";
import { ACTION_LABEL, ITEM_GLYPH, ITEM_LABEL } from "./labels.js";
import type { HudModel, TeamRow } from "./model.js";

const CSS = `
.hud{position:fixed;inset:0;pointer-events:none;font-family:system-ui,-apple-system,"Noto Sans TC",sans-serif;color:#fff;
  --pad:max(12px,env(safe-area-inset-left));}
.hud *{box-sizing:border-box}
.hud-top{position:absolute;top:max(10px,env(safe-area-inset-top));left:var(--pad);right:max(12px,env(safe-area-inset-right));display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.hud-team{display:flex;flex-direction:column;gap:5px;min-width:0}
.hud-team.right{align-items:flex-end}
.hud-team-name{font-size:11px;letter-spacing:.5px;color:#c9d2e3;text-shadow:0 1px 2px rgba(0,0,0,.6)}
.hud-row{display:flex;align-items:center;gap:6px;background:rgba(0,0,0,.4);border-radius:8px;padding:4px 8px;font-size:13px;line-height:1;white-space:nowrap}
.hud-row.me{outline:1px solid rgba(255,255,255,.45)}
.hud-dot{width:10px;height:10px;border-radius:50%;flex:none}
.hud-badge{font-size:10px;padding:2px 4px;border-radius:4px;background:rgba(255,255,255,.15);color:#ffe08a}
.hud-badge.tower{color:#8bff7a}.hud-badge.cpu{color:#ff9f7a}
.hud-score{font-size:12px;color:#c9d2e3;min-width:2.5em;text-align:right}
.hud-clock{text-align:center;flex:none}
.hud-time{font-size:clamp(34px,6vw,48px);font-weight:500;line-height:1;font-variant-numeric:tabular-nums;text-shadow:0 2px 6px rgba(0,0,0,.6)}
.hud-time.urgent{color:#ff6b6b;animation:hud-pulse 1s infinite}
@keyframes hud-pulse{50%{transform:scale(1.08)}}
.hud-sub{font-size:12px;color:#c9d2e3;margin-top:4px;text-shadow:0 1px 2px rgba(0,0,0,.6)}
.hud-items{position:absolute;left:var(--pad);bottom:max(14px,env(safe-area-inset-bottom));display:flex;gap:10px;align-items:flex-end}
.hud-slot{width:clamp(48px,9vh,60px);height:clamp(48px,9vh,60px);border-radius:12px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.35);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:500}
.hud-slot.next{border:2px solid #ffd23f}
.hud-slot.empty{border-style:dashed;background:rgba(0,0,0,.25)}
.hud-toasts{position:absolute;left:50%;top:calc(max(10px,env(safe-area-inset-top)) + 84px);transform:translateX(-50%);display:flex;flex-direction:column;gap:6px;align-items:center}
.hud-toast{background:rgba(0,0,0,.55);color:#ffe08a;font-size:14px;padding:6px 14px;border-radius:20px;white-space:nowrap;animation:hud-fade 2.2s forwards}
@keyframes hud-fade{0%{opacity:0;transform:translateY(-6px)}10%{opacity:1;transform:none}80%{opacity:1}100%{opacity:0}}
.hud-dark{position:absolute;right:max(20px,env(safe-area-inset-right));bottom:calc(max(14px,env(safe-area-inset-bottom)) + 96px);font-size:12px;color:#c9d2e3;display:none}
.hud-dark.on{display:block}
`;

/**
 * In-game overlay: rosters top-left/right, big countdown top-centre, FIFO item
 * slots bottom-left, event toasts under the clock. Plain HTML over the canvas;
 * the context button lives in the input layer and is positioned to match.
 */
export class Hud {
  private readonly root: HTMLDivElement;
  private readonly left: HTMLDivElement;
  private readonly right: HTMLDivElement;
  private readonly time: HTMLDivElement;
  private readonly sub: HTMLDivElement;
  private readonly items: HTMLDivElement;
  private readonly toasts: HTMLDivElement;
  private readonly dark: HTMLDivElement;
  private lastRosterKey = "";

  constructor(parent: HTMLElement) {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    this.root = el("div", "hud");
    const top = el("div", "hud-top");
    this.left = el("div", "hud-team");
    const clock = el("div", "hud-clock");
    this.time = el("div", "hud-time");
    this.sub = el("div", "hud-sub");
    clock.append(this.time, this.sub);
    this.right = el("div", "hud-team right");
    top.append(this.left, clock, this.right);
    this.items = el("div", "hud-items");
    this.toasts = el("div", "hud-toasts");
    this.dark = el("div", "hud-dark");
    this.dark.textContent = "全圖黑暗";
    this.root.append(top, this.items, this.toasts, this.dark);
    parent.appendChild(this.root);
  }

  update(m: HudModel): void {
    const s = Math.max(0, Math.ceil(m.remainingSec));
    this.time.textContent = m.status === "lobby" ? "--:--" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    this.time.classList.toggle("urgent", m.status === "running" && s <= 30);
    this.sub.textContent = m.status === "finished" ? "回合結束" : `已登塔 ${m.climbed} / ${m.total}`;

    // Rosters change rarely; rebuild only when their content changes.
    const rosterKey = JSON.stringify([m.myTeam, m.otherTeams]);
    if (rosterKey !== this.lastRosterKey) {
      this.lastRosterKey = rosterKey;
      renderTeam(this.left, m.myTeam ? [m.myTeam] : [], true);
      renderTeam(this.right, m.otherTeams, false);
    }

    this.items.replaceChildren();
    for (let i = 0; i < m.capacity; i++) {
      const kind = m.items[i];
      const slot = el("div", `hud-slot${kind ? (i === 0 ? " next" : "") : " empty"}`);
      if (kind) {
        slot.textContent = ITEM_GLYPH[kind] ?? "?";
        slot.title = ITEM_LABEL[kind] ?? kind;
      }
      this.items.appendChild(slot);
    }
    this.dark.classList.toggle("on", !m.lightsOn);
  }

  /** Label for the single context button, or null to hide it. */
  actionLabel(m: HudModel): string | null {
    if (!m.action) return null;
    if (m.action === "useItem") return `用${ITEM_LABEL[m.items[0] ?? ""] ?? "道具"}`;
    return ACTION_LABEL[m.action] ?? m.action;
  }

  dispose(): void {
    this.root.remove();
  }

  toast(text: string): void {
    const t = el("div", "hud-toast");
    t.textContent = text;
    this.toasts.appendChild(t);
    setTimeout(() => t.remove(), 2300);
    while (this.toasts.children.length > 3) this.toasts.firstChild?.remove();
  }
}

function renderTeam(container: HTMLElement, teams: TeamRow[], mine: boolean): void {
  container.replaceChildren();
  for (const team of teams) {
    const name = el("div", "hud-team-name");
    name.textContent = mine ? `我方 ${team.label}` : team.label;
    container.appendChild(name);
    const color = `#${(TEAM_COLORS[team.colorIndex % TEAM_COLORS.length] as number).toString(16).padStart(6, "0")}`;
    for (const p of team.players) {
      const row = el("div", `hud-row${p.isMe ? " me" : ""}`);
      const dot = el("span", "hud-dot");
      dot.style.background = color;
      const label = el("span", "");
      label.textContent = p.isMe ? `${p.name}（你）` : p.name;
      const badges: HTMLElement[] = [];
      if (p.onTower) badges.push(badge("tower", p.arrival === null ? "塔" : `第${p.arrival + 1}名`));
      else if (p.hasKey) badges.push(badge("", "鑰匙"));
      if (p.cpu) badges.push(badge("cpu", "CPU"));
      const score = el("span", "hud-score");
      score.textContent = String(p.score);
      if (mine) row.append(dot, label, ...badges, score);
      else row.append(score, ...badges, label, dot);
      container.appendChild(row);
    }
  }
}

function badge(kind: string, text: string): HTMLElement {
  const b = el("span", `hud-badge ${kind}`.trim());
  b.textContent = text;
  return b;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}
