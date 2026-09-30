import { TEAM_COLORS } from "../render/teamColors.js";
import { itemIconSvg } from "./itemIcons.js";
import { ACTION_LABEL, ITEM_GLYPH, ITEM_LABEL } from "./labels.js";
import type { HudModel, TeamRow } from "./model.js";

const CSS = `
.hud{position:fixed;inset:0;pointer-events:none;font-family:system-ui,-apple-system,"Noto Sans TC",sans-serif;color:#fff;
  --pad:max(12px,env(safe-area-inset-left));}
.hud *{box-sizing:border-box}
.hud.demo .hud-team,.hud.demo .hud-time,.hud.demo .hud-sub,.hud.demo .hud-go{display:none}
.hud.demo .hud-items{right:max(24px,env(safe-area-inset-right))}
.hud-top{position:absolute;top:max(10px,env(safe-area-inset-top));left:var(--pad);right:max(12px,env(safe-area-inset-right));display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.hud-team{display:flex;flex-direction:column;gap:5px;min-width:0}
.hud-team.right{align-items:flex-end}
.hud-team-name{font-size:11px;letter-spacing:.5px;color:#c9d2e3;text-shadow:0 1px 2px rgba(0,0,0,.6)}
.hud-row{display:flex;align-items:center;gap:6px;background:rgba(0,0,0,.4);border-radius:8px;padding:4px 8px;font-size:13px;line-height:1;white-space:nowrap}
.hud-row.me{outline:1px solid rgba(255,255,255,.45)}
.hud-row.up{background:rgba(28,96,44,.72);outline:1px solid rgba(139,255,122,.75)}
.hud-key{font-size:15px;line-height:1;flex:none}
.hud-key.off{opacity:.2;filter:grayscale(1)}
.hud-dot{width:10px;height:10px;border-radius:50%;flex:none}
.hud-badge{font-size:10px;padding:2px 4px;border-radius:4px;background:rgba(255,255,255,.15);color:#ffe08a}
.hud-badge.tower{color:#fff;background:rgba(139,255,122,.28);font-size:11px;font-weight:500}.hud-badge.cpu{color:#ff9f7a}
.hud-score{font-size:12px;color:#c9d2e3;min-width:2.5em;text-align:right}
.hud-clock{text-align:center;flex:none;position:relative}
.hud-time{font-size:clamp(34px,6vw,48px);font-weight:500;line-height:1;font-variant-numeric:tabular-nums;text-shadow:0 2px 6px rgba(0,0,0,.6)}
.hud-time.urgent{color:#ff6b6b;animation:hud-pulse 1s infinite}
@keyframes hud-pulse{50%{transform:scale(1.08)}}
.hud-sub{font-size:12px;color:#c9d2e3;margin-top:4px;text-shadow:0 1px 2px rgba(0,0,0,.6)}
.hud-caption{font-size:12px;color:#ffe08a;margin-top:2px;text-shadow:0 1px 2px rgba(0,0,0,.6);white-space:nowrap}
.hud-caption:empty{display:none}
.hud-ghost{margin-top:6px;font-size:14px;font-weight:500;padding:4px 12px;border-radius:14px;display:none;text-shadow:none}
.hud-ghost.warning{display:inline-block;background:rgba(255,210,63,.9);color:#412402}
.hud-ghost.active{display:inline-block;background:rgba(226,75,74,.92);color:#fff;animation:hud-pulse 1s infinite}
.hud-ghost.active.me{background:rgba(120,30,160,.95)}
.hud-badge.frozen{color:#9fd3ff}
.hud-top,.hud-items{transition:opacity .5s}
.hud.intro .hud-top,.hud.intro .hud-items{opacity:0;transition:none}
.hud-items{position:absolute;right:calc(max(24px,env(safe-area-inset-right)) + 84px + 14px);bottom:max(24px,env(safe-area-inset-bottom));height:84px;display:flex;gap:10px;align-items:center}
.hud-slot{width:clamp(48px,9vh,60px);height:clamp(48px,9vh,60px);border-radius:12px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.35);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:500}
.hud-slot svg{width:80%;height:80%;display:block}
.hud-slot.next{border:2px solid #ffd23f}
.hud-slot.empty{border-style:dashed;background:rgba(0,0,0,.25)}
.hud-toasts{position:absolute;left:50%;top:100%;margin-top:8px;transform:translateX(-50%);display:flex;flex-direction:column;gap:6px;align-items:center}
.hud-toast{background:rgba(0,0,0,.55);color:#ffe08a;font-size:14px;padding:6px 14px;border-radius:20px;white-space:nowrap;animation:hud-fade 2.2s forwards}
.hud-toast.big{background:rgba(40,30,0,.78);border:1px solid #ffd23f;color:#fff;font-size:clamp(17px,3vw,24px);font-weight:500;padding:8px 20px;animation-duration:3.4s}
.hud-gains{position:absolute;left:50%;top:30%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none}
.hud-gain{font-size:clamp(28px,6vw,48px);font-weight:600;line-height:1.1;color:#ffd23f;text-shadow:0 2px 10px rgba(0,0,0,.85),0 0 2px rgba(0,0,0,.9);white-space:nowrap;animation:hud-gain 1.9s ease-out forwards}
.hud-gain span{font-size:.5em;font-weight:500;color:#fff;margin-left:.45em;vertical-align:.18em}
@keyframes hud-gain{0%{opacity:0;transform:translateY(12px) scale(.6)}14%{opacity:1;transform:scale(1.18)}28%{transform:scale(1)}75%{opacity:1;transform:translateY(-12px)}100%{opacity:0;transform:translateY(-34px)}}
@keyframes hud-fade{0%{opacity:0;transform:translateY(-6px)}10%{opacity:1;transform:none}80%{opacity:1}100%{opacity:0}}
.hud-go{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);font-size:clamp(72px,16vw,160px);font-weight:500;line-height:1;color:#fff;text-shadow:0 4px 18px rgba(0,0,0,.7);pointer-events:none;display:none}
.hud-go.show{display:block;animation:hud-go-pop .9s ease-out}
.hud-go.start{color:#ffd23f}
@keyframes hud-go-pop{0%{transform:translate(-50%,-50%) scale(1.6);opacity:0}25%{transform:translate(-50%,-50%) scale(1);opacity:1}80%{opacity:1}100%{opacity:0}}
.hud-dark{position:absolute;left:50%;transform:translateX(-50%);bottom:max(14px,env(safe-area-inset-bottom));font-size:12px;color:#c9d2e3;display:none}
.hud-dark.on{display:block}
`;

/**
 * In-game overlay: rosters top-left/right, big countdown top-centre, FIFO item
 * slots bottom-right next to the context button (the pad owns the bottom-left),
 * event toasts under the clock. Plain HTML over the canvas; the context button
 * lives in the input layer and is positioned to match.
 */
export class Hud {
  private readonly root: HTMLDivElement;
  private readonly left: HTMLDivElement;
  private readonly right: HTMLDivElement;
  private readonly time: HTMLDivElement;
  private readonly sub: HTMLDivElement;
  private readonly caption: HTMLDivElement;
  private readonly ghost: HTMLDivElement;
  private readonly items: HTMLDivElement;
  private readonly toasts: HTMLDivElement;
  private readonly gains: HTMLDivElement;
  private readonly dark: HTMLDivElement;
  private readonly go: HTMLDivElement;
  private lastGoText = "";
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
    this.caption = el("div", "hud-caption");
    this.ghost = el("div", "hud-ghost");
    this.toasts = el("div", "hud-toasts");
    // Toasts hang just below the clock column, which grows with the caption and the ghost banner.
    clock.append(this.time, this.sub, this.caption, this.ghost, this.toasts);
    this.right = el("div", "hud-team right");
    top.append(this.left, clock, this.right);
    this.items = el("div", "hud-items");
    this.gains = el("div", "hud-gains");
    this.dark = el("div", "hud-dark");
    this.dark.textContent = "全圖黑暗";
    this.go = el("div", "hud-go");
    this.root.append(top, this.items, this.gains, this.dark, this.go);
    parent.appendChild(this.root);
  }

  /** Small line under the clock; null hides it. */
  setCaption(text: string | null): void {
    if (this.caption.textContent !== (text ?? "")) this.caption.textContent = text ?? "";
  }

  update(m: HudModel): void {
    this.root.classList.toggle("intro", m.introSec > 0);
    const s = Math.max(0, Math.ceil(m.remainingSec));
    this.time.textContent = m.status === "lobby" ? "--:--" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    this.time.classList.toggle("urgent", m.status === "running" && s <= 30);
    this.updateGo(m);
    this.sub.textContent = m.status === "finished" ? "回合結束" : `已登塔 ${m.climbed} / ${m.total}`;

    const g = m.ghost;
    const gs = Math.ceil(g.secondsLeft);
    this.ghost.className = `hud-ghost ${g.phase !== "idle" ? g.phase : ""} ${g.iAmGhost ? "me" : ""}`.trim();
    if (g.phase === "warning") this.ghost.textContent = `${gs} 秒後 ${g.teamLabel} 變成鬼`;
    else if (g.phase === "active") this.ghost.textContent = g.iAmGhost ? `你是鬼，去抓人 ${gs} 秒` : g.myTeamIsGhost ? `我方是鬼 ${gs} 秒` : `鬼抓人！躲開 ${g.teamLabel} ${gs} 秒`;


    // Rosters change rarely; rebuild only when content changes.
    const rosterKey = JSON.stringify([m.myTeam, m.otherTeams]);
    if (rosterKey !== this.lastRosterKey) {
      this.lastRosterKey = rosterKey;
      renderTeam(this.left, m.myTeam ? [m.myTeam] : [], true);
      renderTeam(this.right, m.otherTeams, false);
    }

    this.items.replaceChildren();
    // Team colour feeds the teleport icon's pad through currentColor.
    const teamColor = m.myTeam ? `#${(TEAM_COLORS[m.myTeam.colorIndex % TEAM_COLORS.length] as number).toString(16).padStart(6, "0")}` : "#5be6ff";
    for (let i = 0; i < m.capacity; i++) {
      const kind = m.items[i];
      const slot = el("div", `hud-slot${kind ? (i === 0 ? " next" : "") : " empty"}`);
      if (kind) {
        const svg = itemIconSvg(kind);
        if (svg) {
          slot.innerHTML = svg;
          slot.style.color = teamColor;
        } else slot.textContent = ITEM_GLYPH[kind] ?? "?";
        slot.title = ITEM_LABEL[kind] ?? kind;
      }
      this.items.appendChild(slot);
    }
    this.dark.classList.toggle("on", !m.lightsOn);
  }

  /** 3, 2, 1 during the start freeze, then "開始" for a moment; each number pops once. */
  private updateGo(m: HudModel): void {
    let text = "";
    if (m.status === "running" && m.freezeSec > 0) text = String(Math.ceil(m.freezeSec));
    else if (m.status === "running" && this.lastGoText !== "" && this.lastGoText !== "開始") text = "開始";
    if (text === this.lastGoText) return;
    this.lastGoText = text;
    this.go.classList.remove("show", "start");
    if (!text) return;
    this.go.textContent = text;
    void this.go.offsetWidth; // restart the pop animation
    this.go.classList.add("show");
    if (text === "開始") {
      this.go.classList.add("start");
      setTimeout(() => {
        if (this.lastGoText === "開始") {
          this.go.classList.remove("show");
          this.lastGoText = "";
        }
      }, 900);
    }
  }

  /**
   * Rules demos keep what explains the scene (bag, ghost banner, toasts, score
   * pop-ups) and drop what belongs to a real round (rosters, clock, 3-2-1).
   */
  setDemo(on: boolean): void {
    this.root.classList.toggle("demo", on);
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

  toast(text: string, big = false): void {
    const t = el("div", big ? "hud-toast big" : "hud-toast");
    t.textContent = text;
    this.toasts.appendChild(t);
    setTimeout(() => t.remove(), big ? 3500 : 2300);
    while (this.toasts.children.length > 3) this.toasts.firstChild?.remove();
  }

  /** Big "+20 抓到人" pop-up for the local player's own score gains. */
  gain(points: number, label: string): void {
    const g = el("div", "hud-gain");
    g.textContent = `+${points}`;
    const why = document.createElement("span");
    why.textContent = label;
    g.appendChild(why);
    this.gains.appendChild(g);
    setTimeout(() => g.remove(), 2000);
    while (this.gains.children.length > 4) this.gains.firstChild?.remove();
  }
}

function renderTeam(container: HTMLElement, teams: TeamRow[], mine: boolean): void {
  container.replaceChildren();
  for (const team of teams) {
    // Solo rounds have no team names: the rows alone are the roster.
    if (team.label) {
      const name = el("div", "hud-team-name");
      name.textContent = mine ? `我方 ${team.label}` : team.label;
      container.appendChild(name);
    }
    const color = `#${(TEAM_COLORS[team.colorIndex % TEAM_COLORS.length] as number).toString(16).padStart(6, "0")}`;
    for (const p of team.players) {
      const row = el("div", `hud-row${p.isMe ? " me" : ""}${p.onTower ? " up" : ""}`);
      const dot = el("span", "hud-dot");
      dot.style.background = color;
      const label = el("span", "");
      label.textContent = `${p.isMe ? `${p.name}（你）` : p.name}${p.ghost ? " 👻" : ""}`;
      const badges: HTMLElement[] = [];
      // Everyone in the maze shows a key slot: bright once they hold their key, faint until then.
      // On the tower the row turns green and the slot becomes the arrival rank.
      if (p.onTower) badges.push(badge("tower", p.arrival === null ? "🏰" : `🏰 第${p.arrival + 1}名`));
      else {
        const key = el("span", `hud-key${p.hasKey ? "" : " off"}`);
        key.textContent = "🔑";
        key.title = p.hasKey ? "已拿到鑰匙" : "還沒有鑰匙";
        badges.push(key);
      }
      if (p.cpu) badges.push(badge("cpu", "CPU"));
      if (p.frozen) badges.push(badge("frozen", "定身"));
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
