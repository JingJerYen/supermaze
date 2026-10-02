import type * as THREE from "three";
import { DEFAULT_TUNING, passRank } from "@supermaze/sim";
import { t } from "../i18n/index.js";
import type { Profile } from "../profile.js";
import { CharacterPreview } from "../render/characterPreview.js";
import { createSidePanel } from "../ui/sidePanel.js";
import { floorModLines } from "./floorMods.js";

/**
 * Full version only: pick the floor a tower run starts on, any floor up to
 * the highest one played (CLAUDE.md section 4.1). Picking the highest carries
 * on from there; a run that does not start on floor 1 keeps no best record.
 */
export class FloorSelect {
  private readonly panel: HTMLDivElement;
  private readonly preview: CharacterPreview;
  private picked: number;

  constructor(
    root: HTMLElement,
    renderer: THREE.WebGLRenderer,
    private readonly reached: number,
    profile: Profile,
    private readonly onStart: (floor: number) => void,
    private readonly onHome: () => void,
  ) {
    this.picked = Math.min(reached, DEFAULT_TUNING.towerRun.floors.length);
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
    const floors = DEFAULT_TUNING.towerRun.floors;
    const top = Math.min(this.reached, floors.length);
    const buttons = floors
      .map((_, i) => {
        const n = i + 1;
        const open = n <= top;
        const cls = [n === this.picked ? "on" : "", n === top ? "top" : ""].join(" ");
        return `<button data-floor="${n}" class="${cls}" ${open ? "" : "disabled"}>${open ? n : "🔒"}</button>`;
      })
      .join("");
    const f = floors[this.picked - 1]!;
    const players = f.cpus + 1;
    this.panel.innerHTML = `
      <h2>${t("modes.select.title")}</h2>
      <div class="sp-sub">${t("modes.select.sub")}</div>
      <div class="sp-floors">${buttons}</div>
      <div class="sp-note">${t("modes.select.floorInfo", { n: this.picked, difficulty: t(`modes.select.${f.map}`), cpus: f.cpus, pass: passRank(players) })}${floorModLines(f.mods).map((l) => `<br>${l}`).join("")}${
        this.picked > 1 ? `<br>${t("modes.select.noBest")}` : ""
      }</div>
      <div class="sp-spacer"></div>
      <div class="sp-row"><button id="fs-home" data-back>${t("modes.select.home")}</button><button class="primary" id="fs-go">${t("modes.select.start", { n: this.picked })}</button></div>`;
    for (const b of this.panel.querySelectorAll<HTMLButtonElement>("[data-floor]")) {
      b.addEventListener("click", () => {
        this.picked = Number(b.dataset["floor"]);
        this.render();
      });
    }
    this.panel.querySelector("#fs-home")!.addEventListener("click", () => this.onHome());
    this.panel.querySelector("#fs-go")!.addEventListener("click", () => this.onStart(this.picked));
  }
}
