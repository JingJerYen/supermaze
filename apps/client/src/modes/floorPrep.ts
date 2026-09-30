import type * as THREE from "three";
import { capName, NAME_MAX_CHARS } from "@supermaze/protocol";
import { DEFAULT_TUNING, SKILL_KINDS, type SkillKind } from "@supermaze/sim";
import { SKILL_INFO } from "../hud/labels.js";
import { CharacterPreview } from "../render/characterPreview.js";
import { characters } from "../render/characters.js";

const CSS = `
.fp{position:fixed;left:max(12px,env(safe-area-inset-left));top:max(12px,env(safe-area-inset-top));bottom:max(12px,env(safe-area-inset-bottom));
  width:min(430px,56vw);display:flex;flex-direction:column;gap:10px;padding:14px 16px;border-radius:16px;z-index:25;overflow:auto;
  background:rgba(16,19,24,.82);border:1px solid rgba(255,255,255,.14);color:#fff;font-family:system-ui,-apple-system,"Noto Sans TC",sans-serif}
.fp *{box-sizing:border-box}
.fp h2{margin:0;font-size:20px;font-weight:500;color:#ffd23f}
.fp .fp-sub{font-size:12px;color:#c9d2e3;margin-top:-6px}
.fp label{font-size:12px;color:#c9d2e3;display:block;margin-bottom:4px}
.fp input{width:9em;height:34px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;font-size:15px;padding:0 10px}
.fp-chars{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}
.fp-chars button{aspect-ratio:1;padding:0;border-radius:10px;border:2px solid transparent;background:#2a3450;cursor:pointer;overflow:hidden}
.fp-chars button img{width:100%;height:100%;display:block}
.fp-chars button.on{border-color:#ffd23f;box-shadow:0 0 0 2px rgba(255,210,63,.35)}
.fp-skills{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px}
.fp-skills button{text-align:left;padding:6px 8px;border-radius:10px;border:2px solid rgba(255,255,255,.15);background:rgba(110,70,200,.25);color:#fff;cursor:pointer;font-size:13px;line-height:1.3}
.fp-skills button b{display:block;font-size:14px}
.fp-skills button small{color:#d8d0f0;font-size:11px}
.fp-skills button.on{border-color:#c9a6ff;background:rgba(110,70,200,.6)}
.fp-skills button:disabled{cursor:default;opacity:.45}
.fp-skills button.on:disabled{opacity:1}
.fp-row{display:flex;gap:8px;align-items:center}
.fp-row button{flex:1;height:42px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;font-size:15px;cursor:pointer}
.fp-row button.primary{background:#ffd23f;color:#412402;border-color:#ffd23f;font-weight:500}
.fp-row button.skill{background:#6e46c8;border-color:#b48cff}
.fp-row button:disabled{opacity:.45;cursor:default}
.fp-row button.owned,.fp-row button.owned:disabled{opacity:1;background:#2f7a45;border-color:#7fd08e;color:#fff}
.fp-note{font-size:12px;color:#c9d2e3}
@media (max-height:520px){.fp{padding:10px 12px;gap:6px}.fp h2{font-size:17px}.fp-chars{grid-template-columns:repeat(12,1fr);gap:4px}
  .fp-skills{grid-template-columns:repeat(5,1fr)}.fp-skills button{padding:4px 5px}.fp-skills button small{display:none}.fp-row button{height:36px}}
`;

const CHAR_KEY = "supermaze.character";
const NAME_KEY = "supermaze.name";

export interface FloorPrepChoice {
  name: string;
  character: string | null;
  /** Null when the player went without one this floor. */
  skill: SkillKind | null;
}

let portraits: Map<string, string> | null = null;

/**
 * Before each tower run floor (CLAUDE.md 4.1): name, character and the floor's
 * skill. The skill is picked, then taken through `skillGate` (free while
 * testing; an ad or a payment once the game ships), and can be skipped.
 */
export class FloorPrep {
  private readonly panel: HTMLDivElement;
  private readonly preview: CharacterPreview;
  private character: string | null;
  private picked: SkillKind | null = null;
  private owned: SkillKind | null = null;

  constructor(
    root: HTMLElement,
    renderer: THREE.WebGLRenderer,
    private readonly floor: number,
    private readonly floorsTotal: number,
    private name: string,
    private readonly onStart: (choice: FloorPrepChoice) => void,
    private readonly onHome: () => void,
  ) {
    if (!document.getElementById("fp-css")) {
      const style = document.createElement("style");
      style.id = "fp-css";
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    portraits ??= CharacterPreview.portraits(renderer);
    const names = characters.available();
    const saved = loadString(CHAR_KEY);
    this.character = saved && names.includes(saved) ? saved : (names[0] ?? null);
    this.preview = new CharacterPreview(renderer);
    if (this.character) this.preview.show(this.character);
    this.preview.start();
    this.panel = document.createElement("div");
    this.panel.className = "fp";
    root.appendChild(this.panel);
    this.render();
  }

  dispose(): void {
    this.preview.stop();
    this.panel.remove();
  }

  private render(): void {
    const s = DEFAULT_TUNING.skills;
    const detail: Record<SkillKind, string> = {
      sprint: `${s.sprint.durationSec} 秒內速度 ${s.sprint.speedMultiplier} 倍`,
      eagleEye: `${s.eagleEye.durationSec} 秒俯瞰整張地圖`,
      amulet: "擋下一次陷阱或鬼抓",
      lantern: `關燈時 ${s.lantern.durationSec} 秒看得更遠`,
      timeStop: `所有對手定身 ${s.timeStop.freezeSec} 秒`,
    };
    const chars = characters
      .available()
      .map((n) => `<button data-char="${n}" class="${n === this.character ? "on" : ""}" title="${n}"><img alt="" src="${portraits?.get(n) ?? ""}"></button>`)
      .join("");
    const skills = SKILL_KINDS.map((k) => {
      const info = SKILL_INFO[k]!;
      const on = (this.owned ?? this.picked) === k;
      return `<button data-skill="${k}" class="${on ? "on" : ""}" ${this.owned ? "disabled" : ""}><b>${info.icon} ${info.label}</b><small>${detail[k]}</small></button>`;
    }).join("");
    const skillButton = this.owned
      ? `<button class="owned" disabled>✓ 已取得 ${SKILL_INFO[this.owned]!.icon} ${SKILL_INFO[this.owned]!.label}</button>`
      : `<button class="skill" id="fp-take" ${this.picked ? "" : "disabled"}>取得技能</button>`;
    this.panel.innerHTML = `
      <h2>第 ${this.floor} / ${this.floorsTotal} 層</h2>
      <div class="fp-sub">選好角色與這一層的技能後開始</div>
      <div><label>暱稱</label><input id="fp-name" maxlength="${NAME_MAX_CHARS * 2}" value="${escapeAttr(this.name)}"></div>
      <div><label>角色</label><div class="fp-chars">${chars}</div></div>
      <div><label>技能（每層一次，按 R 或技能鍵施放）</label><div class="fp-skills">${skills}</div></div>
      <div class="fp-row">${skillButton}</div>
      <div class="fp-note">${this.owned ? "這一層可以施放一次。" : "不取得技能也可以直接開始。"}</div>
      <div class="fp-row"><button id="fp-home">回首頁</button><button class="primary" id="fp-go">開始第 ${this.floor} 層</button></div>`;
    const nameInput = this.panel.querySelector<HTMLInputElement>("#fp-name")!;
    nameInput.addEventListener("input", () => (this.name = nameInput.value));
    for (const b of this.panel.querySelectorAll<HTMLButtonElement>("[data-char]")) {
      b.addEventListener("click", () => {
        this.character = b.dataset["char"] ?? null;
        if (this.character) this.preview.show(this.character);
        this.render();
      });
    }
    for (const b of this.panel.querySelectorAll<HTMLButtonElement>("[data-skill]")) {
      b.addEventListener("click", () => {
        this.picked = b.dataset["skill"] as SkillKind;
        this.render();
      });
    }
    this.panel.querySelector("#fp-take")?.addEventListener("click", () => void this.take());
    this.panel.querySelector("#fp-home")!.addEventListener("click", () => this.onHome());
    this.panel.querySelector("#fp-go")!.addEventListener("click", () => this.go());
  }

  private async take(): Promise<void> {
    const kind = this.picked;
    if (!kind || this.owned || !(await skillGate(kind))) return;
    this.owned = kind;
    this.render();
  }

  private go(): void {
    const name = capName(this.name.trim()) || "玩家";
    saveString(NAME_KEY, name);
    if (this.character) saveString(CHAR_KEY, this.character);
    this.onStart({ name, character: this.character, skill: this.owned });
  }
}

/**
 * What a skill costs. Free while testing; once the game ships this is where a
 * rewarded ad or a payment goes, resolving false when the player backs out.
 */
async function skillGate(_kind: SkillKind): Promise<boolean> {
  return true;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function loadString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}
