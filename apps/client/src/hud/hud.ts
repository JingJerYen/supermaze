import { locale, t } from "../i18n/index.js";
import { TEAM_COLORS } from "../render/teamColors.js";
import { itemIconSvg } from "./itemIcons.js";
import { ACTION_LABEL, ITEM_GLYPH, ITEM_LABEL, SKILL_INFO } from "./labels.js";
import type { HudModel, TeamRow } from "./model.js";

/** The word shown when the 3-2-1 countdown ends. */
const GO = t("hud.go");
/** Action labels longer than this many characters get the smaller font (Chinese glyphs are about twice as wide as Latin letters). */
const LONG_ACTION = locale === "zh-Hant" ? 3 : 6;

const CSS = `
.hud{position:fixed;inset:0;pointer-events:none;font-family:system-ui,-apple-system,"Noto Sans TC",sans-serif;color:#fff;
  --pad:max(12px,env(safe-area-inset-left));}
.hud *{box-sizing:border-box}
.hud.demo .hud-team,.hud.demo .hud-time,.hud.demo .hud-sub,.hud.demo .hud-go{display:none}
.hud.demo .hud-top{justify-content:center}
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
.hud-sub:empty{display:none}
.hud-caption{font-size:12px;color:#ffe08a;margin-top:2px;text-shadow:0 1px 2px rgba(0,0,0,.6);white-space:nowrap}
.hud-caption:empty{display:none}
.hud-ghost{margin-top:6px;font-size:14px;font-weight:500;padding:4px 12px;border-radius:14px;display:none;text-shadow:none}
.hud-ghost.warning{display:inline-block;background:rgba(255,210,63,.9);color:#412402}
.hud-ghost.active{display:inline-block;background:rgba(226,75,74,.92);color:#fff;animation:hud-pulse 1s infinite}
.hud-ghost.active.me{background:rgba(120,30,160,.95)}
.hud-badge.frozen{color:#9fd3ff}
.hud-top,.hud-items{transition:opacity .5s}
.hud.intro .hud-top,.hud.intro .hud-items{opacity:0;transition:none}
.hud-items{position:absolute;right:max(24px,env(safe-area-inset-right));bottom:max(24px,env(safe-area-inset-bottom));height:84px;display:flex;gap:8px;align-items:center}
.hud-items.hidden{display:none}
.hud-slot{width:54px;height:54px;border-radius:50%;background:rgba(0,0,0,.45);border:2px solid rgba(255,255,255,.4);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:500;box-sizing:border-box}
.hud-slot svg{width:72%;height:72%;display:block}
.hud-slot.empty,.hud-big.empty{border-style:dashed;background:rgba(0,0,0,.25)}
.hud-big{position:relative;width:84px;height:84px;border-radius:50%;background:rgba(0,0,0,.55);border:2px solid rgba(255,255,255,.4);display:flex;align-items:center;justify-content:center;box-sizing:border-box;font-size:30px;font-weight:500}
.hud-big svg{width:74%;height:74%;display:block}
.hud-big.ready{border:3px solid #ffd23f;box-shadow:0 0 14px rgba(255,210,63,.55)}
.hud-big.dim svg{opacity:.35;filter:grayscale(.7)}
.hud-big.action{background:rgba(255,210,63,.92);border:2px solid rgba(255,255,255,.75);color:#412402;font:700 19px/1.1 system-ui,-apple-system,"Noto Sans TC",sans-serif;text-align:center;padding:0 6px}
.hud-big.action.long{font-size:14px}
.hud-badge-item{position:absolute;left:-6px;top:-6px;width:32px;height:32px;border-radius:50%;background:#1a2130;border:2px solid #ffd23f;display:flex;align-items:center;justify-content:center;box-sizing:border-box}
.hud-badge-item svg{width:78%;height:78%}
.hud-items.locked{filter:grayscale(1);opacity:.55}
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
.hud-frozen{position:absolute;left:50%;top:64%;transform:translateX(-50%);background:rgba(0,0,0,.6);color:#fff;font-size:clamp(15px,2.4vw,20px);font-weight:500;padding:6px 16px;border-radius:20px;white-space:nowrap;display:none}
.hud-frozen.on{display:block}
.hud-skill{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(max(14px,env(safe-area-inset-bottom)) + 22px);background:rgba(110,70,200,.8);color:#fff;font-size:14px;font-weight:500;padding:5px 14px;border-radius:16px;white-space:nowrap;display:none}
.hud-skill.on{display:block}
.hud-frozen b{color:#ffd23f;font-size:1.35em;margin-left:.4em;font-variant-numeric:tabular-nums}
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
  private readonly go: HTMLDivElement;
  private readonly frozen: HTMLDivElement;
  private readonly skill: HTMLDivElement;
  private lastGoText = "";
  private lastRosterKey = "";
  private lastItemsKey = "";

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
    this.go = el("div", "hud-go");
    this.frozen = el("div", "hud-frozen");
    this.skill = el("div", "hud-skill");
    this.root.append(top, this.items, this.gains, this.go, this.frozen, this.skill);
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
    const sub = m.status === "finished" ? t("hud.roundOver") : "";
    if (this.sub.textContent !== sub) this.sub.textContent = sub;

    const g = m.ghost;
    const gs = Math.ceil(g.secondsLeft);
    this.ghost.className = `hud-ghost ${g.phase !== "idle" ? g.phase : ""} ${g.iAmGhost ? "me" : ""}`.trim();
    if (g.phase === "warning") this.ghost.textContent = warningText(gs, m);
    else if (g.phase === "active") this.ghost.textContent = g.iAmGhost ? t("hud.ghost.active.you", { sec: gs }) : g.myTeamIsGhost ? t("hud.ghost.active.ours", { sec: gs }) : t("hud.ghost.active.other", { who: g.teamLabel ?? "", sec: gs });


    // Rosters change rarely; rebuild only when content changes.
    const rosterKey = JSON.stringify([m.myTeam, m.otherTeams]);
    if (rosterKey !== this.lastRosterKey) {
      this.lastRosterKey = rosterKey;
      renderTeam(this.left, m.myTeam ? [m.myTeam] : [], true);
      renderTeam(this.right, m.otherTeams, false);
    }

    this.renderItems(m);

    // Your own freeze counts down under you; others see a "定身" badge in the roster.
    const f = m.myFreeze;
    this.frozen.classList.toggle("on", f !== null);
    const frozenHtml = f ? `${t(f.by === "ghost" ? "hud.freeze.ghost" : "hud.freeze.trap")}<b>${Math.ceil(f.sec)}</b>` : "";
    if (this.frozen.innerHTML !== frozenHtml) this.frozen.innerHTML = frozenHtml;

    const st = m.skillStatus;
    const info = st ? SKILL_INFO[st.kind] : undefined;
    const skillText = st && info ? st.sec === null ? t("hud.skill.active", { icon: info.icon, label: info.label }) : `${info.icon} ${info.label} ${Math.ceil(st.sec)}` : "";
    this.skill.classList.toggle("on", skillText !== "");
    if (this.skill.textContent !== skillText) this.skill.textContent = skillText;
  }

  /** A skill button's face (the first skill, or the second), or null to hide it. */
  skillButton(m: HudModel, slot: 1 | 2 = 1): { icon: string; label: string; ready: boolean } | null {
    const skill = slot === 1 ? m.mySkill : m.mySkill2;
    const info = skill ? SKILL_INFO[skill.kind] : undefined;
    return skill && info ? { icon: info.icon, label: info.label, ready: skill.ready } : null;
  }

  /** 3, 2, 1 during the start freeze, then "開始" (GO) for a moment; each number pops once. */
  private updateGo(m: HudModel): void {
    let text = "";
    if (m.status === "running" && m.freezeSec > 0) text = String(Math.ceil(m.freezeSec));
    else if (m.status === "running" && this.lastGoText !== "" && this.lastGoText !== GO) text = GO;
    if (text === this.lastGoText) return;
    this.lastGoText = text;
    this.go.classList.remove("show", "start");
    if (!text) return;
    this.go.textContent = text;
    void this.go.offsetWidth; // restart the pop animation
    this.go.classList.add("show");
    if (text === GO) {
      this.go.classList.add("start");
      setTimeout(() => {
        if (this.lastGoText === GO) {
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

  /**
   * The bag and the action button in one row at the bottom right: the big
   * circle on the right is the next item (bright when it can be used here, dim
   * when not) or, when the button would climb / flip a switch / pick up a node,
   * that action in yellow with the next item as a small badge; the small
   * circles to its left are the items queued behind it. All grey while the bag
   * is locked (you are the ghost). Rebuilt only when something changed.
   */
  private renderItems(m: HudModel): void {
    const teamColor = m.myTeam ? `#${(TEAM_COLORS[m.myTeam.colorIndex % TEAM_COLORS.length] as number).toString(16).padStart(6, "0")}` : "#5be6ff";
    const key = JSON.stringify([m.items, m.action, m.capacity, m.onTower, m.ghost.iAmGhost, teamColor]);
    if (key === this.lastItemsKey) return;
    this.lastItemsKey = key;
    this.items.className = `hud-items${m.onTower ? " hidden" : ""}${m.ghost.iAmGhost ? " locked" : ""}`;
    this.items.style.color = teamColor; // the teleport icon's pad takes the team colour through currentColor
    const icon = (kind: string) => itemIconSvg(kind) ?? `<span>${ITEM_GLYPH[kind] ?? "?"}</span>`;
    const small = [];
    for (let i = m.capacity - 1; i >= 1; i--) {
      const kind = m.items[i];
      small.push(kind ? `<div class="hud-slot" title="${ITEM_LABEL[kind] ?? kind}">${icon(kind)}</div>` : `<div class="hud-slot empty"></div>`);
    }
    const next = m.items[0];
    let big: string;
    if (m.action && m.action !== "useItem") {
      const label = ACTION_LABEL[m.action] ?? m.action;
      const badge = next ? `<div class="hud-badge-item">${icon(next)}</div>` : "";
      big = `<div class="hud-big action${label.length > LONG_ACTION ? " long" : ""}">${label}${badge}</div>`;
    } else if (next) {
      big = `<div class="hud-big ${m.action === "useItem" ? "ready" : "dim"}" title="${ITEM_LABEL[next] ?? next}">${icon(next)}</div>`;
    } else big = `<div class="hud-big empty"></div>`;
    this.items.innerHTML = small.join("") + big;
  }

  dispose(): void {
    this.root.remove();
  }

  toast(text: string, big = false): void {
    const n = el("div", big ? "hud-toast big" : "hud-toast");
    n.textContent = text;
    this.toasts.appendChild(n);
    setTimeout(() => n.remove(), big ? 3500 : 2300);
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
      name.textContent = mine ? t("hud.roster.myTeam", { team: team.label }) : team.label;
      container.appendChild(name);
    }
    const color = `#${(TEAM_COLORS[team.colorIndex % TEAM_COLORS.length] as number).toString(16).padStart(6, "0")}`;
    for (const p of team.players) {
      const row = el("div", `hud-row${p.isMe ? " me" : ""}${p.onTower ? " up" : ""}`);
      const dot = el("span", "hud-dot");
      dot.style.background = color;
      const label = el("span", "");
      label.textContent = `${p.isMe ? t("hud.nameYou", { name: p.name }) : p.name}${p.ghost ? " 👻" : ""}`;
      const badges: HTMLElement[] = [];
      // Everyone in the maze shows a key slot: bright once they hold their key, faint until then.
      // On the tower the row turns green and the slot says so. No arrival rank: players took it for the final placing.
      if (p.onTower) badges.push(badge("tower", t("hud.roster.tower")));
      else {
        const key = el("span", `hud-key${p.hasKey ? "" : " off"}`);
        key.textContent = "🔑";
        key.title = t(p.hasKey ? "hud.roster.hasKey" : "hud.roster.noKey");
        badges.push(key);
      }
      if (p.cpu) badges.push(badge("cpu", "CPU"));
      if (p.frozen) badges.push(badge("frozen", t("hud.roster.frozen")));
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

/** "10 秒後你變成鬼", "10 秒後 A 隊（我方）變成鬼", "10 秒後 A 隊 變成鬼". */
function warningText(sec: number, m: HudModel): string {
  const who = m.ghost.teamLabel ?? "";
  if (!m.ghost.myTeamIsGhost) return t("hud.ghost.warning.other", { sec, who });
  return m.solo ? t("hud.ghost.warning.you", { sec }) : t("hud.ghost.warning.ours", { sec, team: who });
}
