import type * as THREE from "three";
import { DEFAULT_TUNING, SKILL_KINDS, type SkillKind } from "@supermaze/sim";
import { SKILL_INFO } from "../hud/labels.js";
import { portraits, type Profile } from "../profile.js";
import { CharacterPreview } from "../render/characterPreview.js";
import { createSidePanel, escapeHtml } from "../ui/sidePanel.js";

/**
 * Before each tower run floor (CLAUDE.md 4.1): only the floor's skill. Who the
 * player is (name, character) is set once on the home screen's character
 * setup, the same for online rooms, so it is shown here but not chosen. The
 * skill is picked, then taken through `skillGate` (free while testing; an ad
 * or a payment once the game ships), and can be skipped.
 */
export class FloorPrep {
  private readonly panel: HTMLDivElement;
  private readonly preview: CharacterPreview;
  private picked: SkillKind | null = null;
  private owned: SkillKind | null = null;

  constructor(
    root: HTMLElement,
    private readonly renderer: THREE.WebGLRenderer,
    private readonly floor: number,
    private readonly floorsTotal: number,
    private readonly profile: Profile,
    private readonly onStart: (skill: SkillKind | null) => void,
    private readonly onHome: () => void,
  ) {
    this.preview = new CharacterPreview(renderer);
    this.preview.show(profile.character ?? "local");
    this.preview.start();
    this.panel = createSidePanel(root);
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
    const face = this.profile.character ? portraits(this.renderer).get(this.profile.character) : undefined;
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
      <div class="sp-who">${face ? `<img alt="" src="${face}">` : ""}<span>${escapeHtml(this.profile.name)}</span></div>
      <div><label>這一層的技能（施放一次：R 鍵或技能鍵）</label><div class="sp-skills">${skills}</div></div>
      <div class="sp-row">${skillButton}</div>
      <div class="sp-note">${this.owned ? "這一層可以施放一次。" : "不取得技能也可以直接開始。"}</div>
      <div class="sp-spacer"></div>
      <div class="sp-row"><button id="fp-home">回首頁</button><button class="primary" id="fp-go">開始第 ${this.floor} 層</button></div>`;
    for (const b of this.panel.querySelectorAll<HTMLButtonElement>("[data-skill]")) {
      b.addEventListener("click", () => {
        this.picked = b.dataset["skill"] as SkillKind;
        this.render();
      });
    }
    this.panel.querySelector("#fp-take")?.addEventListener("click", () => void this.take());
    this.panel.querySelector("#fp-home")!.addEventListener("click", () => this.onHome());
    this.panel.querySelector("#fp-go")!.addEventListener("click", () => this.onStart(this.owned));
  }

  private async take(): Promise<void> {
    const kind = this.picked;
    if (!kind || this.owned || !(await skillGate(kind))) return;
    this.owned = kind;
    this.render();
  }
}

/**
 * What a skill costs. Free while testing; once the game ships this is where a
 * rewarded ad or a payment goes, resolving false when the player backs out.
 */
async function skillGate(_kind: SkillKind): Promise<boolean> {
  return true;
}
