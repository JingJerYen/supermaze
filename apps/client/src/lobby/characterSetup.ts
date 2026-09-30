import type * as THREE from "three";
import { NAME_MAX_CHARS } from "@supermaze/protocol";
import { defaultNameFor } from "../characterNames.js";
import { hasOwnName, loadProfile, portraits, saveProfile, type Profile } from "../profile.js";
import { CharacterPreview } from "../render/characterPreview.js";
import { characters } from "../render/characters.js";
import { createSidePanel, escapeHtml } from "../ui/sidePanel.js";

/**
 * Character setup, opened from the home screen: name and one of the Kenney
 * characters, with the pick turning on a stage and waving hello. Saved in the
 * browser and used in online rooms and the tower run alike.
 */
export class CharacterSetup {
  private readonly panel: HTMLDivElement;
  private readonly preview: CharacterPreview;
  private profile: Profile;

  constructor(
    root: HTMLElement,
    private readonly renderer: THREE.WebGLRenderer,
    private readonly onDone: (profile: Profile) => void,
  ) {
    this.profile = loadProfile();
    if (!this.profile.character) {
      this.profile.character = characters.available()[0] ?? null;
      if (!hasOwnName()) this.profile.name = defaultNameFor(this.profile.character) ?? this.profile.name;
    }
    this.preview = new CharacterPreview(renderer);
    if (this.profile.character) this.preview.show(this.profile.character);
    this.preview.start();
    this.panel = createSidePanel(root);
    this.render();
  }

  dispose(): void {
    this.preview.stop();
    this.panel.remove();
  }

  private render(): void {
    const faces = portraits(this.renderer);
    const chars = characters
      .available()
      .map((n) => `<button data-char="${n}" class="${n === this.profile.character ? "on" : ""}"><img alt="" src="${faces.get(n) ?? ""}"></button>`)
      .join("");
    this.panel.innerHTML = `
      <h2>角色設定</h2>
      <div class="sp-sub">連線對戰與爬塔挑戰都用這個角色</div>
      <div><label>暱稱（最多 ${NAME_MAX_CHARS} 個字）</label><input id="cs-name" maxlength="${NAME_MAX_CHARS * 2}" value="${escapeHtml(this.profile.name)}"></div>
      <div><label>角色</label><div class="sp-chars">${chars}</div></div>
      <div class="sp-spacer"></div>
      <div class="sp-row"><button class="primary" id="cs-done">完成</button></div>`;
    const nameInput = this.panel.querySelector<HTMLInputElement>("#cs-name")!;
    nameInput.addEventListener("input", () => (this.profile.name = nameInput.value));
    for (const b of this.panel.querySelectorAll<HTMLButtonElement>("[data-char]")) {
      b.addEventListener("click", () => {
        // A name still at the old character's default (or cleared) follows the new pick; a typed one stays.
        const before = defaultNameFor(this.profile.character);
        this.profile.character = b.dataset["char"] ?? null;
        const typed = nameInput.value.trim();
        if (!typed || typed === before) {
          this.profile.name = defaultNameFor(this.profile.character) ?? typed;
          nameInput.value = this.profile.name;
        }
        if (this.profile.character) this.preview.show(this.profile.character);
        for (const o of this.panel.querySelectorAll("[data-char]")) o.classList.toggle("on", o === b);
      });
    }
    this.panel.querySelector("#cs-done")!.addEventListener("click", () => {
      saveProfile(this.profile);
      this.onDone(loadProfile());
    });
  }
}
