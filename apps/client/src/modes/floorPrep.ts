import type * as THREE from "three";
import { DEFAULT_TUNING, SKILL_KINDS, type SkillKind } from "@supermaze/sim";
import { SKILL_INFO } from "../hud/labels.js";
import { t } from "../i18n/index.js";
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
    // The numbers each skill's text quotes, from the tuning.
    const params: Record<SkillKind, Record<string, number>> = {
      sprint: { sec: s.sprint.durationSec, mult: s.sprint.speedMultiplier },
      eagleEye: { sec: s.eagleEye.durationSec },
      amulet: {},
      lantern: { sec: s.lantern.durationSec, tiles: s.lantern.darkRadiusTiles },
      timeStop: { sec: s.timeStop.freezeSec },
      jump: {},
      pierce: { sec: s.pierce.durationSec },
      warp: {},
      supply: {},
    };
    const detail = (k: SkillKind) => t(`modes.prep.skill.${k}.short`, params[k]);
    // The longer explanation under the buttons, for the skill last picked (phones hide the buttons' second line).
    const explain = (k: SkillKind) => t(`modes.prep.skill.${k}.desc`, params[k]);
    const name = (k: SkillKind) => `${SKILL_INFO[k]!.icon} ${SKILL_INFO[k]!.label}`;
    const note = this.shown ? t("modes.prep.note", { skill: name(this.shown), text: explain(this.shown) }) : t("modes.prep.pickHint");
    const face = this.profile.character ? portraits(this.renderer).get(this.profile.character) : undefined;
    const skills = SKILL_KINDS.map((k) => {
      const at = this.picks.indexOf(k);
      const tag = this.premium && at >= 0 ? `<i>${at + 1}</i>` : "";
      return `<button data-skill="${k}" class="${at >= 0 ? "on" : ""}" ${this.unlocked ? "" : "disabled"}>${tag}<b>${name(k)}</b><small>${detail(k)}</small></button>`;
    }).join("");
    const label = this.premium
      ? t("modes.prep.labelPremium", { n: this.picks.length })
      : this.unlocked
        ? t("modes.prep.labelUnlocked")
        : t("modes.prep.labelRandom");
    const adRow = this.premium
      ? ""
      : `<div class="sp-row">${
          this.unlocked
            ? `<button class="owned" disabled>${t("modes.prep.unlocked")}</button>`
            : `<button class="skill" id="fp-ad">${t("modes.prep.watchAd")}</button>`
        }</div>`;
    this.panel.innerHTML = `
      <h2>${t("modes.prep.title", { n: this.floor, total: this.floorsTotal })}</h2>
      <div class="sp-who">${face ? `<img alt="" src="${face}">` : ""}<span>${escapeHtml(this.profile.name)}</span></div>
      <div><label>${label}</label><div class="sp-skills">${skills}</div></div>
      ${adRow}
      <div class="sp-note">${note}</div>
      <div class="sp-spacer"></div>
      <div class="sp-row"><button id="fp-home" data-back>${t("modes.prep.home")}</button><button class="primary" id="fp-go">${t("modes.prep.start", { n: this.floor })}</button></div>`;
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
    if (await showRewardedAd(t("modes.prep.adReward"))) this.unlocked = true;
    this.render();
  }
}
