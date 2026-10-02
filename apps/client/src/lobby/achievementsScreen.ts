import type * as THREE from "three";
import { ACHIEVEMENT_IDS } from "@supermaze/sim";
import { ACHIEVEMENT_ICONS, achievementDesc, achievementName } from "../achievements/info.js";
import { loadAchievements } from "../achievements/store.js";
import { t } from "../i18n/index.js";
import type { Profile } from "../profile.js";
import { CharacterPreview } from "../render/characterPreview.js";
import { createSidePanel } from "../ui/sidePanel.js";

const CSS = `
.sp-ach{list-style:none;margin:0;padding:0 2px 0 0;display:grid;grid-template-columns:1fr 1fr;gap:6px;align-content:start;flex:1 1 auto;min-height:0;overflow:auto}
.sp-ach li{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:10px;background:rgba(255,210,63,.1);border:1px solid rgba(255,210,63,.35)}
.sp-ach li.locked{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.12)}
.sp-ach li.locked i{filter:grayscale(1);opacity:.35}
.sp-ach li.locked b{color:#9aa3b5}
.sp-ach i{font-style:normal;font-size:22px;line-height:1}
.sp-ach div{display:flex;flex-direction:column;min-width:0}
.sp-ach b{font-size:13px;font-weight:600}
.sp-ach span{font-size:11px;color:#c9d2e3;line-height:1.25}
@media (max-height:520px){.sp-ach i{font-size:18px}.sp-ach li{padding:4px 6px}.sp-ach span{font-size:10px}}
`;

/**
 * Achievements page from the home screen (CLAUDE.md section 4.3): every
 * badge, lit when unlocked in this browser and greyed out otherwise, each
 * with what it takes. The list scrolls by itself so the back button stays in
 * view on a phone.
 */
export class AchievementsScreen {
  private readonly panel: HTMLDivElement;
  private readonly preview: CharacterPreview;
  private readonly style: HTMLStyleElement;

  constructor(
    root: HTMLElement,
    renderer: THREE.WebGLRenderer,
    profile: Profile,
    private readonly onHome: () => void,
  ) {
    this.style = document.createElement("style");
    this.style.textContent = CSS;
    document.head.appendChild(this.style);
    this.preview = new CharacterPreview(renderer);
    this.preview.show(profile.character ?? "local");
    this.preview.start();
    this.panel = createSidePanel(root);
    this.panel.classList.add("sp-wide");
    this.render();
  }

  dispose(): void {
    this.preview.stop();
    this.panel.remove();
    this.style.remove();
  }

  private render(): void {
    const have = loadAchievements();
    const items = ACHIEVEMENT_IDS.map((id) => {
      const on = have[id] !== undefined;
      return `<li class="${on ? "" : "locked"}"><i>${ACHIEVEMENT_ICONS[id]}</i><div><b>${achievementName(id)}</b><span>${achievementDesc(id)}</span></div></li>`;
    }).join("");
    const n = ACHIEVEMENT_IDS.filter((id) => have[id] !== undefined).length;
    this.panel.innerHTML = `
      <h2>${t("ach.title")}</h2>
      <div class="sp-sub">${t("ach.count", { n, total: ACHIEVEMENT_IDS.length })}・${t("ach.sub")}</div>
      <ul class="sp-ach">${items}</ul>
      <div class="sp-row"><button id="ac-home" data-back>${t("ach.home")}</button></div>`;
    this.panel.querySelector("#ac-home")!.addEventListener("click", () => this.onHome());
  }
}
