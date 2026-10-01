import type * as THREE from "three";
import { DEFAULT_TUNING, SKILL_KINDS, type SkillKind } from "@supermaze/sim";
import { SKILL_INFO } from "../hud/labels.js";
import { showRewardedAd } from "../monetize/ads.js";
import { portraits, type Profile } from "../profile.js";
import { CharacterPreview } from "../render/characterPreview.js";
import { createSidePanel, escapeHtml } from "../ui/sidePanel.js";

/**
 * Before each tower run floor (CLAUDE.md 4.1): only the floor's skills. Who the
 * player is (name, character) is set once on the home screen's character
 * setup, the same for online rooms, so it is shown here but not chosen.
 *
 * Free: the floor comes with a skill drawn at random; watching an ad lets the
 * player pick another one instead. Full version: no ad, and up to two skills
 * picked freely (the first on the R key and the right skill button, the second on T and the one left of it).
 */
export class FloorPrep {
  private readonly panel: HTMLDivElement;
  private readonly preview: CharacterPreview;
  /** The skills taken onto the floor, in cast-button order. */
  private picks: SkillKind[];
  /** The free player watched the ad: any skill may be picked. */
  private unlocked: boolean;
  /** Last skill clicked, for the explanation under the buttons. */
  private shown: SkillKind | null;

  constructor(
    root: HTMLElement,
    private readonly renderer: THREE.WebGLRenderer,
    private readonly floor: number,
    private readonly floorsTotal: number,
    private readonly profile: Profile,
    /** The skill drawn for this floor; what a free player gets without the ad. */
    random: SkillKind,
    private readonly premium: boolean,
    private readonly onStart: (skills: SkillKind[]) => void,
    private readonly onHome: () => void,
  ) {
    this.picks = premium ? [] : [random];
    this.unlocked = premium;
    this.shown = premium ? null : random;
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
      jump: "跳上或跳下面前一格",
      pierce: `${s.pierce.durationSec} 秒穿過障礙與陷阱`,
      warp: "移到隨機位置",
      supply: "背包補滿隨機道具",
    };
    // The longer explanation under the buttons, for the skill last picked (phones hide the buttons' second line).
    const explain: Record<SkillKind, string> = {
      sprint: `${s.sprint.durationSec} 秒內移動速度變成 ${s.sprint.speedMultiplier} 倍。`,
      eagleEye: `${s.eagleEye.durationSec} 秒內從高空俯瞰整張地圖，看清鑰匙和路線。`,
      amulet: "擋下下一次陷阱或鬼抓：不會被定身，也不會失去道具和鑰匙。",
      lantern: `只能在關燈時用：${s.lantern.durationSec} 秒內黑暗中看得到 ${s.lantern.darkRadiusTiles} 格遠。`,
      timeStop: `迷宮裡所有對手原地定身 ${s.timeStop.freezeSec} 秒。`,
      jump: "面向牆時跳上牆頂，站在牆頂時跳下道路，不用找樓梯。面前能落腳時技能鈕才會亮。",
      pierce: `${s.pierce.durationSec} 秒內直接穿過障礙物和單向門（兩個方向都行），踩到陷阱也不會觸發。牆還是過不去。`,
      warp: "瞬間移到迷宮裡隨機的一格，可能更近也可能更遠，看運氣。只會落在走得到的地方。",
      supply: "背包空著的格子立刻補滿隨機道具。背包滿了或當鬼時不能用。",
    };
    const name = (k: SkillKind) => `${SKILL_INFO[k]!.icon} ${SKILL_INFO[k]!.label}`;
    const note = this.shown ? `${name(this.shown)}：${explain[this.shown]}` : "點技能選擇，最多兩個；再點一次取消。";
    const face = this.profile.character ? portraits(this.renderer).get(this.profile.character) : undefined;
    const skills = SKILL_KINDS.map((k) => {
      const at = this.picks.indexOf(k);
      const tag = this.premium && at >= 0 ? `<i>${at + 1}</i>` : "";
      return `<button data-skill="${k}" class="${at >= 0 ? "on" : ""}" ${this.unlocked ? "" : "disabled"}>${tag}<b>${name(k)}</b><small>${detail[k]}</small></button>`;
    }).join("");
    const label = this.premium
      ? `這一層的技能（⭐ 完整版：可選兩個，已選 ${this.picks.length} / 2）`
      : this.unlocked
        ? "這一層的技能（點一個更換）"
        : "這一層的技能（隨機抽到）";
    const adRow = this.premium
      ? ""
      : `<div class="sp-row">${
          this.unlocked
            ? `<button class="owned" disabled>✓ 已解鎖，點技能更換</button>`
            : `<button class="skill" id="fp-ad">📺 看廣告，自己挑技能</button>`
        }</div>`;
    this.panel.innerHTML = `
      <h2>第 ${this.floor} / ${this.floorsTotal} 層</h2>
      <div class="sp-who">${face ? `<img alt="" src="${face}">` : ""}<span>${escapeHtml(this.profile.name)}</span></div>
      <div><label>${label}</label><div class="sp-skills">${skills}</div></div>
      ${adRow}
      <div class="sp-note">${note}</div>
      <div class="sp-spacer"></div>
      <div class="sp-row"><button id="fp-home">回首頁</button><button class="primary" id="fp-go">開始第 ${this.floor} 層</button></div>`;
    for (const b of this.panel.querySelectorAll<HTMLButtonElement>("[data-skill]")) {
      b.addEventListener("click", () => this.pick(b.dataset["skill"] as SkillKind));
    }
    this.panel.querySelector("#fp-ad")?.addEventListener("click", () => void this.watchAd());
    this.panel.querySelector("#fp-home")!.addEventListener("click", () => this.onHome());
    this.panel.querySelector("#fp-go")!.addEventListener("click", () => this.onStart(this.picks));
  }

  private pick(kind: SkillKind): void {
    this.shown = kind;
    if (!this.premium) this.picks = [kind];
    else if (this.picks.includes(kind)) this.picks = this.picks.filter((k) => k !== kind);
    // A third pick replaces the older of the two.
    else this.picks = [...this.picks, kind].slice(-2);
    this.render();
  }

  private async watchAd(): Promise<void> {
    if (await showRewardedAd("這一層自己挑技能")) this.unlocked = true;
    this.render();
  }
}
