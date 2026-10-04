import type * as THREE from "three";
import { DEFAULT_TUNING, SKILL_KINDS, type SkillKind } from "@supermaze/sim";
import { SKILL_INFO } from "../hud/labels.js";
import { t } from "../i18n/index.js";
import { StoreScreen } from "../lobby/storeScreen.js";
import { isPremium } from "../monetize/premium.js";
import type { Profile } from "../profile.js";
import { CharacterPreview } from "../render/characterPreview.js";
import { createSidePanel } from "../ui/sidePanel.js";

/** What the prep screen is for: its heading, lines under it, and the start button. */
export interface PrepHead {
  title: string;
  lines: string[];
  start: string;
}

/**
 * Before each tower run floor (CLAUDE.md 4.1), and before a night parade
 * (4.4): only the round's skills. Who the
 * player is (name, character) is set once on the home screen's character
 * setup, the same for online rooms, so it is shown here but not chosen: the
 * character turns on the right with the name above its head.
 *
 * Free: the floor comes with a skill drawn at random, and a button leads to
 * the full version's page (and back here, unlocked if bought). Full version:
 * up to two skills picked freely (the first on the R key and the right skill
 * button, the second on T and the one left of it).
 */
export class FloorPrep {
  private readonly panel: HTMLDivElement;
  private readonly preview: CharacterPreview;
  /** The player's name, above the character on the right. */
  private readonly tag: HTMLDivElement;
  /** The skills taken onto the floor, in cast-button order. */
  private picks: SkillKind[];
  /** Last skill clicked, for the explanation under the buttons. */
  private shown: SkillKind | null;
  /** The full version's page, opened from here. */
  private store: StoreScreen | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly renderer: THREE.WebGLRenderer,
    private readonly head: PrepHead,
    private readonly profile: Profile,
    /** The skill drawn for this floor; what a free player gets. */
    random: SkillKind,
    private premium: boolean,
    private readonly onStart: (skills: SkillKind[]) => void,
    private readonly onHome: () => void,
  ) {
    this.picks = premium ? [] : [random];
    this.shown = premium ? null : random;
    this.preview = new CharacterPreview(renderer);
    this.preview.show(profile.character ?? "local");
    this.preview.start();
    this.panel = createSidePanel(root);
    this.panel.classList.add("sp-wide");
    this.tag = document.createElement("div");
    this.tag.className = "sp-tag";
    this.tag.textContent = profile.name;
    root.appendChild(this.tag);
    this.preview.setTag(this.tag);
    this.render();
  }

  dispose(): void {
    this.store?.dispose();
    this.store = null;
    this.preview.stop();
    this.panel.remove();
    this.tag.remove();
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
    const skills = SKILL_KINDS.map((k) => {
      const at = this.picks.indexOf(k);
      const tag = this.premium && at >= 0 ? `<i>${at + 1}</i>` : "";
      return `<button data-skill="${k}" class="${at >= 0 ? "on" : ""}" ${this.premium ? "" : "disabled"}>${tag}<b>${name(k)}</b><small>${detail(k)}</small></button>`;
    }).join("");
    const label = this.premium ? t("modes.prep.labelPremium", { n: this.picks.length }) : t("modes.prep.labelRandom");
    const upgradeRow = this.premium ? "" : `<div class="sp-row"><button class="skill" id="fp-upgrade">${t("modes.prep.upgrade")}</button></div>`;
    this.panel.innerHTML = `
      <h2>${this.head.title}</h2>
      ${this.head.lines.map((l) => `<div class="sp-sub">${l}</div>`).join("")}
      <div><label>${label}</label><div class="sp-skills">${skills}</div></div>
      ${upgradeRow}
      <div class="sp-note">${note}</div>
      <div class="sp-spacer"></div>
      <div class="sp-row"><button id="fp-home" data-back>${t("modes.prep.home")}</button><button class="primary" id="fp-go">${this.head.start}</button></div>`;
    for (const b of this.panel.querySelectorAll<HTMLButtonElement>("[data-skill]")) {
      b.addEventListener("click", () => this.pick(b.dataset["skill"] as SkillKind));
    }
    this.panel.querySelector("#fp-upgrade")?.addEventListener("click", () => this.openStore());
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

  /** The full version's page over this one; back returns here, with free choice of two skills if it was bought. */
  private openStore(): void {
    this.preview.stop();
    this.panel.style.display = "none";
    this.tag.style.display = "none";
    this.store = new StoreScreen(
      this.root,
      this.renderer,
      this.profile,
      () => {
        this.store?.dispose();
        this.store = null;
        this.panel.style.display = "";
        this.tag.style.display = "";
        this.preview.start();
        if (!this.premium && isPremium()) {
          this.premium = true;
          this.picks = [];
          this.shown = null;
        }
        this.render();
      },
      t("lobby.store.back"),
    );
  }
}
